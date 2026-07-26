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
import * as runTracker from './runTracker.js';

const log = logger.child({ module: 'pipeline' });

const CONCURRENCIA_NORMALIZACION = 4;
const CONCURRENCIA_SCORING = 4;

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
      mensaje: `Entendi tu perfil: ${perfil.carrera}, ${perfil.nivelEstudios}, ${perfil.ubicacion}`
    });

    // 1. Decidir que buscar — esto es lo que lo hace un agente y no un buscador
    paso({ tipo: 'plan_inicio', mensaje: 'Decidiendo que buscar para vos' });
    const plan = await planificar(perfil);
    paso({
      tipo: 'plan_fin',
      mensaje: plan.razonamiento,
      queries: plan.queries,
      categorias: plan.categorias
    });

    // 2. Ejecutar la busqueda sobre todas las fuentes, en paralelo
    paso({ tipo: 'descubrimiento_inicio', mensaje: 'Rastreando fuentes' });
    const documentos = await descubrir(plan, paso);
    paso({
      tipo: 'descubrimiento_fin',
      mensaje: `${documentos.length} paginas recuperadas`,
      total: documentos.length
    });

    // 3. Normalizar al esquema comun
    paso({ tipo: 'normalizacion_inicio', mensaje: 'Leyendo y estructurando convocatorias' });
    const lotes = await mapExitosos(
      documentos,
      CONCURRENCIA_NORMALIZACION,
      (documento) => normalizar(documento)
    );
    const oportunidades = lotes.flat();
    paso({
      tipo: 'normalizacion_fin',
      mensaje: `${oportunidades.length} oportunidades extraidas`,
      total: oportunidades.length
    });

    // 4. Alimentar el indice compartido
    const nuevas = await guardarEnIndice(oportunidades);
    paso({ tipo: 'indice', mensaje: `${nuevas} nuevas para el indice`, nuevas });

    // 5. Razonar sobre compatibilidad
    paso({ tipo: 'scoring_inicio', mensaje: 'Evaluando cuales son para vos' });
    const matches = await puntuarParaPerfil(perfil, plan.categorias);
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
async function puntuarParaPerfil(perfil, categorias) {
  const [candidatas, yaEvaluadas] = await Promise.all([
    opportunityRepository.findCandidatas({
      categorias,
      limit: env.MAX_SCORING_PER_RUN
    }),
    matchRepository.idsYaEvaluados(perfil.id)
  ]);

  const pendientes = candidatas.filter((o) => !yaEvaluadas.has(o.id));

  const evaluaciones = await mapExitosos(
    pendientes,
    CONCURRENCIA_SCORING,
    async (oportunidad) => {
      const evaluacion = await evaluarSeguro(perfil, oportunidad);
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
