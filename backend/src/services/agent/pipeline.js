import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { mapExitosos } from '../../utils/concurrency.js';
import { descubrir } from '../scraping/discovery.js';
import { evaluarSeguro } from '../scoring/matcher.js';
import * as opportunityRepository from '../../repositories/opportunityRepository.js';
import * as matchRepository from '../../repositories/matchRepository.js';
import * as agentRunRepository from '../../repositories/agentRunRepository.js';
import { planificar } from './orchestrator.js';
import { normalizar } from './normalizer.js';
import { oportunidadesDemo } from './demo.js';
import * as runTracker from './runTracker.js';

const log = logger.child({ module: 'pipeline' });

// Modal (T4) atiende 1 inferencia a la vez; paralelizar extract/match satura
// el endpoint y produce 408. Una a la vez es mas lento pero fiable.
const CONCURRENCIA_NORMALIZACION = 1;
const CONCURRENCIA_SCORING = 1;

/** Pausa entre pasos narrados, solo en modo demo. Ver `ritmo`. */
const RITMO_DEMO_MS = 700;

/**
 * La narracion en vivo es la prueba visible de que hay un agente decidiendo, y
 * es lo que sostiene el criterio de demo del pitch.
 *
 * En el camino real la espera existe sola: descubrir y razonar tardan decenas
 * de segundos. Pero el catalogo de demo corre en milisegundos, y ahi la
 * narracion entera pasa antes de que nadie alcance a leer una linea — la
 * pantalla mas importante del producto queda invisible.
 *
 * Esto NO simula trabajo que no ocurre: separa pasos que si ocurrieron para
 * que se puedan leer. Fuera de modo demo no hace absolutamente nada.
 */
const ritmo = () =>
  env.demoMode ? new Promise((listo) => setTimeout(listo, RITMO_DEMO_MS)) : Promise.resolve();

/**
 * Registra la corrida y arranca el trabajo, devolviendo el runId de inmediato.
 *
 * La separacion importa: la corrida tarda decenas de segundos, pero el cliente
 * necesita el runId ya para suscribirse al progreso en vivo.
 *
 * @returns {Promise<{runId: string, completado: Promise<object>}>}
 */
export async function iniciar({ perfil, disparador = 'manual' }) {
  const corrida = await agentRunRepository.iniciar({
    disparador,
    userId: perfil?.id ?? null
  });

  runTracker.crear(corrida.id);

  return { runId: corrida.id, completado: correr({ perfil, corrida, disparador }) };
}

/** Version bloqueante, para el cron y los scripts. */
export async function ejecutar(opciones) {
  const { completado } = await iniciar(opciones);
  return completado;
}

/**
 * El loop completo del agente: percibe, decide, ejecuta, evalua, entrega.
 *
 * Un solo camino de codigo con dos disparadores — el boton del dashboard y el
 * cron. Asi la corrida autonoma no puede divergir de lo que se demuestra en
 * vivo, que es lo que hace creible la respuesta a "y esto corre solo?".
 */
async function correr({ perfil, corrida, disparador }) {
  const paso = (evento) => runTracker.emitir(corrida.id, evento);

  try {
    paso({
      tipo: 'perfil',
      mensaje: resumenPerfil(perfil)
    });
    await ritmo();

    // 1. Decidir que buscar — esto es lo que lo hace un agente y no un buscador
    paso({ tipo: 'plan_inicio', mensaje: 'Decidiendo que buscar para vos' });
    const plan = await planificar(perfil);
    await ritmo();
    paso({
      tipo: 'plan_fin',
      mensaje: plan.razonamiento,
      queries: plan.queries,
      categorias: plan.categorias
    });
    await ritmo();

    // 2 y 3. Conseguir oportunidades: rastreando el mundo real, o del catalogo
    // de demo cuando no hay claves de scraping ni modelo servido.
    const oportunidades = env.demoMode
      ? await deCatalogoDemo(paso, plan.categorias)
      : await descubrirYNormalizar(plan, paso);

    // 4. Alimentar el indice compartido
    const nuevas = await guardarEnIndice(oportunidades);
    paso({ tipo: 'indice', mensaje: `${nuevas} nuevas para el indice`, nuevas });
    await ritmo();

    // 5. Razonar sobre compatibilidad (agente Modal / Oppy).
    // En demo solo se salta el scraping; el scoring sigue yendo al LoRA.
    paso({ tipo: 'scoring_inicio', mensaje: 'Evaluando cuales son para vos' });
    const matches = await puntuarParaPerfil(perfil, plan.categorias, evaluarSeguro);
    paso({
      tipo: 'scoring_fin',
      mensaje: `${matches.length} oportunidades compatibles`,
      total: matches.length
    });

    await agentRunRepository.completar(corrida.id, {
      oportunidadesNuevas: nuevas,
      matchesCreados: matches.length
    });

    runTracker.finalizar(corrida.id, {
      estado: 'completada',
      resumen: { oportunidadesNuevas: nuevas, matchesCreados: matches.length }
    });

    log.info('Corrida completada', {
      runId: corrida.id,
      disparador,
      nuevas,
      matches: matches.length
    });

    return { runId: corrida.id, oportunidadesNuevas: nuevas, matches };
  } catch (error) {
    log.error('Corrida fallida', { runId: corrida.id, error: error.message });
    await agentRunRepository.fallar(corrida.id, error.message);
    paso({ tipo: 'error', mensaje: error.message });
    runTracker.finalizar(corrida.id, { estado: 'fallida' });
    throw error;
  }
}

/** El camino real: rastrear las fuentes y estructurar lo recuperado. */
async function descubrirYNormalizar(plan, paso) {
  paso({ tipo: 'descubrimiento_inicio', mensaje: 'Rastreando fuentes' });
  const documentos = await descubrir(plan, paso);
  const priorizados = priorizarDocumentos(documentos);
  const tope = env.MAX_NORMALIZE_PER_RUN;
  const aProcesar = priorizados.slice(0, tope);

  if (documentos.length > tope) {
    paso({
      tipo: 'descubrimiento_fin',
      mensaje: `${documentos.length} paginas recuperadas — proceso las ${tope} mas relevantes`,
      total: documentos.length
    });
  } else {
    paso({
      tipo: 'descubrimiento_fin',
      mensaje: `${documentos.length} paginas recuperadas`,
      total: documentos.length
    });
  }

  const totalDocs = aProcesar.length;
  paso({
    tipo: 'normalizacion_inicio',
    mensaje: totalDocs > 0
      ? `Leyendo y estructurando ${totalDocs} pagina${totalDocs === 1 ? '' : 's'}`
      : 'Sin paginas para estructurar'
  });

  const lotes = await mapExitosos(
    aProcesar,
    CONCURRENCIA_NORMALIZACION,
    async (documento, indice) => {
      const lote = await normalizar(documento, {
        categorias: plan.categorias,
        timeoutMs: env.NORMALIZE_TIMEOUT_MS
      });
      paso({
        tipo: 'normalizacion_progreso',
        mensaje: `Pagina ${indice + 1} de ${totalDocs}${lote.length ? ` → ${lote.length}` : ''}`,
        procesados: indice + 1,
        total: totalDocs
      });
      return lote;
    }
  );
  const oportunidades = lotes.flat();
  paso({
    tipo: 'normalizacion_fin',
    mensaje: `${oportunidades.length} oportunidades extraidas`,
    total: oportunidades.length
  });

  return oportunidades;
}

/**
 * Prefiere ofertas concretas (con titulo de Exa) sobre listados genericos
 * scrapeados: esos listados consumen el presupuesto de normalizacion y
 * suelen no devolver nada util.
 */
function priorizarDocumentos(documentos) {
  return [...documentos].sort((a, b) => puntajeDocumento(b) - puntajeDocumento(a));
}

function puntajeDocumento(documento) {
  let puntos = 0;
  const titulo = (documento.titulo ?? '').trim();
  const url = documento.url ?? '';

  if (titulo.length >= 12) puntos += 3;
  if (documento.origenBusqueda || documento.texto?.length > 200) puntos += 2;
  if (/computrabajo\.com|\/trabajo-de-pasantias|\/ofertas\/?$/i.test(url)) puntos -= 4;
  if (/pasantias?$|ofertas de trabajo|buscar empleo/i.test(titulo)) puntos -= 3;
  if (/ingenier|analista|desarroll|empleo|trabajo|pasant/i.test(titulo)) puntos += 2;

  return puntos;
}

/**
 * El atajo de desarrollo. Narra los mismos pasos — la pantalla de proceso en
 * vivo se ve igual — pero deja dicho que son datos de ejemplo: una demo que se
 * confunde con la real es peor que no tener demo.
 */
async function deCatalogoDemo(paso, categorias) {
  paso({ tipo: 'descubrimiento_inicio', mensaje: 'Modo demo: catalogo de ejemplo, sin rastreo' });
  const todas = oportunidadesDemo();
  const oportunidades = categorias?.length
    ? todas.filter((o) => categorias.includes(o.categoria))
    : todas;
  paso({
    tipo: 'descubrimiento_fin',
    mensaje: `${oportunidades.length} convocatorias de ejemplo`,
    total: oportunidades.length
  });
  await ritmo();
  paso({
    tipo: 'normalizacion_fin',
    mensaje: `${oportunidades.length} oportunidades listas`,
    total: oportunidades.length
  });
  await ritmo();

  return oportunidades;
}

function resumenPerfil(perfil) {
  const objetivo = perfil.objetivo ?? perfil.objetivos?.[0];
  const partes = [
    objetivo ? `objetivo ${objetivo}` : null,
    perfil.carrera,
    perfil.nivelEstudios,
    perfil.ubicacion
  ].filter(Boolean);

  const extras = [];
  if (perfil.habilidades?.length) extras.push(`skills: ${perfil.habilidades.slice(0, 3).join(', ')}`);
  if (perfil.restricciones?.length) extras.push(perfil.restricciones.slice(0, 2).join(', '));

  return extras.length
    ? `Entendi tu perfil: ${partes.join(' · ')} (${extras.join(' · ')})`
    : `Entendi tu perfil: ${partes.join(' · ')}`;
}

async function guardarEnIndice(oportunidades) {
  let nuevas = 0;

  for (const oportunidad of oportunidades) {
    try {
      const { esNueva } = await opportunityRepository.upsert(oportunidad);
      if (esNueva) nuevas += 1;
    } catch (error) {
      log.warn('No se pudo guardar la oportunidad', {
        titulo: oportunidad.titulo,
        error: error.message
      });
    }
  }

  return nuevas;
}

/**
 * Puntua solo lo que hace falta: candidatas pre-filtradas en SQL — barato — y
 * que la persona no haya evaluado antes. Es la diferencia entre un costo
 * marginal de centavos y uno de dolares por usuario.
 */
async function puntuarParaPerfil(perfil, categorias, evaluador) {
  const [candidatas, yaEvaluadas, feedback] = await Promise.all([
    opportunityRepository.findCandidatas({
      categorias,
      limit: env.MAX_SCORING_PER_RUN
    }),
    matchRepository.idsYaEvaluados(perfil.id),
    matchRepository.resumenFeedback(perfil.id)
  ]);

  const perfilConSenales = { ...perfil, feedback };
  const pendientes = candidatas.filter((o) => !yaEvaluadas.has(o.id));

  const evaluaciones = await mapExitosos(
    pendientes,
    CONCURRENCIA_SCORING,
    async (oportunidad) => {
      const evaluacion = await evaluador(perfilConSenales, oportunidad);
      if (!evaluacion) return null;

      return matchRepository.upsert({
        userId: perfil.id,
        opportunityId: oportunidad.id,
        ...evaluacion
      });
    }
  );

  return evaluaciones.filter(Boolean);
}
