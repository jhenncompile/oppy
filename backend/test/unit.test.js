import test from 'node:test';
import assert from 'node:assert/strict';

import { clasificar, esDominioOficial, hostnameDe, CONFIANZA } from '../src/services/scoring/trust.js';
import { mapConLimite, mapExitosos } from '../src/utils/concurrency.js';
import { fuentesActivas, fuentesPorEstrategia, ESTRATEGIAS } from '../src/services/scraping/sources.js';
import { combinacionesDeBusqueda } from '../src/services/scraping/discovery.js';
import { extraerJson } from '../src/services/llm/index.js';
import { calcularHash } from '../src/services/agent/normalizer.js';
import { mensajeDeOportunidad } from '../src/services/notifications/templates.js';
import { AppError } from '../src/utils/AppError.js';
import {
  perfilAOppy,
  oportunidadAOppy,
  extraccionACruda,
  matchingAEvaluacion,
  deadlineStatusDe
} from '../src/services/llm/oppyAdapter.js';
import {
  alinearConObjetivo,
  categoriasPara,
  planDeRespaldo,
  planDesdePerfil
} from '../src/services/agent/orchestrator.js';

const MANANA = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const AYER = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
test('confianza: dominio oficial y plazo vigente da verificada', () => {
  assert.equal(
    clasificar({ url: 'https://www.bo.emb-japan.go.jp/becas', fechaLimite: MANANA }),
    CONFIANZA.VERIFICADA
  );
});

test('confianza: dominio no oficial queda por validar', () => {
  assert.equal(
    clasificar({ url: 'https://blogdebecas.com/post', fechaLimite: MANANA }),
    CONFIANZA.POR_VALIDAR
  );
});

test('confianza: un plazo vencido pesa mas que un dominio oficial', () => {
  assert.equal(
    clasificar({ url: 'https://bo.usembassy.gov/x', fechaLimite: AYER }),
    CONFIANZA.DESACTUALIZADA
  );
});

test('confianza: sin fecha limite no se asume vencida', () => {
  assert.equal(
    clasificar({ url: 'https://bo.usembassy.gov/x', fechaLimite: null }),
    CONFIANZA.VERIFICADA
  );
});

test('confianza: una fecha ilegible no rompe la clasificacion', () => {
  assert.equal(
    clasificar({ url: 'https://ejemplo.com', fechaLimite: 'proximamente' }),
    CONFIANZA.POR_VALIDAR
  );
});

test('dominio oficial: acepta subdominios pero no sufijos falsos', () => {
  assert.equal(esDominioOficial('https://becas.upb.edu/x'), true);
  assert.equal(esDominioOficial('https://www.upb.edu/x'), true);
  // Un atacante no puede registrar "notupb.edu" y colarse como oficial
  assert.equal(esDominioOficial('https://notupb.edu/x'), false);
  assert.equal(esDominioOficial('https://upb.edu.falso.com/x'), false);
});

test('hostname: una URL invalida devuelve null en vez de lanzar', () => {
  assert.equal(hostnameDe('no-es-una-url'), null);
});

// ---------------------------------------------------------------------------
test('concurrencia: preserva el orden de entrada', async () => {
  const items = [50, 10, 30, 5];
  const resultados = await mapConLimite(items, 2, async (ms) => {
    await new Promise((r) => setTimeout(r, ms));
    return ms;
  });
  assert.deepEqual(resultados.map((r) => r.valor), items);
});

test('concurrencia: nunca supera el limite de tareas simultaneas', async () => {
  let activas = 0;
  let pico = 0;

  await mapConLimite(Array.from({ length: 20 }), 3, async () => {
    activas += 1;
    pico = Math.max(pico, activas);
    await new Promise((r) => setTimeout(r, 5));
    activas -= 1;
  });

  assert.ok(pico <= 3, `el pico fue ${pico}, deberia ser <= 3`);
});

test('concurrencia: un fallo no tumba al resto', async () => {
  const resultados = await mapConLimite([1, 2, 3], 2, async (n) => {
    if (n === 2) throw new Error('falla a proposito');
    return n;
  });

  assert.equal(resultados[0].ok, true);
  assert.equal(resultados[1].ok, false);
  assert.equal(resultados[2].ok, true);

  const exitosos = await mapExitosos([1, 2, 3], 2, async (n) => {
    if (n === 2) throw new Error('falla');
    return n;
  });
  assert.deepEqual(exitosos, [1, 3]);
});

test('concurrencia: lista vacia no cuelga', async () => {
  assert.deepEqual(await mapConLimite([], 4, async () => 1), []);
});

// ---------------------------------------------------------------------------
test('fuentes: filtrar por categoria excluye las que no aplican', () => {
  const soloEmpleo = fuentesActivas({ categorias: ['empleo'] });
  assert.ok(soloEmpleo.length > 0);
  assert.ok(soloEmpleo.every((f) => f.categorias.includes('empleo')));
});

test('fuentes: hay fuentes de ambas estrategias configuradas', () => {
  assert.ok(fuentesPorEstrategia(ESTRATEGIAS.SCRAPE).length > 0);
  assert.ok(fuentesPorEstrategia(ESTRATEGIAS.BUSQUEDA).length > 0);
});

// ---------------------------------------------------------------------------
test('busquedas: no se paga dos veces la misma query con el mismo alcance', () => {
  const fuentes = [
    { id: 'a', dominiosPreferidos: null },
    { id: 'b', dominiosPreferidos: null }
  ];
  const combinaciones = combinacionesDeBusqueda(fuentes, ['becas STEM', 'pasantias']);
  assert.equal(combinaciones.size, 2);
});

test('busquedas: distinto alcance de dominios son busquedas distintas', () => {
  const fuentes = [
    { id: 'a', dominiosPreferidos: null },
    { id: 'b', dominiosPreferidos: ['edu.bo'] }
  ];
  const combinaciones = combinacionesDeBusqueda(fuentes, ['becas STEM']);
  assert.equal(combinaciones.size, 2);
});

test('busquedas: el orden de los dominios no crea duplicados', () => {
  const fuentes = [
    { id: 'a', dominiosPreferidos: ['edu.bo', 'gob.bo'] },
    { id: 'b', dominiosPreferidos: ['gob.bo', 'edu.bo'] }
  ];
  const combinaciones = combinacionesDeBusqueda(fuentes, ['becas']);
  assert.equal(combinaciones.size, 1);
});

// ---------------------------------------------------------------------------
test('json: extrae aunque el modelo lo envuelva en prosa', () => {
  assert.deepEqual(extraerJson('{"a":1}'), { a: 1 });
  assert.deepEqual(extraerJson('Claro, aca tenes:\n{"a":1}\nEspero que sirva'), { a: 1 });
  assert.deepEqual(extraerJson('```json\n{"a":1}\n```'), { a: 1 });
});

test('json: sin objeto, lanza con mensaje util', () => {
  assert.throws(() => extraerJson('no hay json aca'), /no contiene un objeto JSON/);
});

// ---------------------------------------------------------------------------
test('dedupe: mismo titulo y dominio produce el mismo hash', () => {
  const a = calcularHash('Beca MEXT 2026', 'https://www.bo.emb-japan.go.jp/becas');
  const b = calcularHash('Beca MEXT 2026', 'https://bo.emb-japan.go.jp/otra-pagina');
  assert.equal(a, b);
});

test('dedupe: ignora tildes, mayusculas y puntuacion', () => {
  const a = calcularHash('Beca de Japón — 2026', 'https://ejemplo.com');
  const b = calcularHash('beca de japon 2026', 'https://ejemplo.com');
  assert.equal(a, b);
});

test('dedupe: distinta institucion se conserva por separado', () => {
  const a = calcularHash('Beca de intercambio', 'https://upb.edu/x');
  const b = calcularHash('Beca de intercambio', 'https://ucb.edu.bo/x');
  assert.notEqual(a, b);
});

// ---------------------------------------------------------------------------
test('AppError: conserva status y codigo', () => {
  const error = AppError.badRequest('faltan datos', { campo: 'carrera' });
  assert.equal(error.status, 400);
  assert.equal(error.code, 'bad_request');
  assert.deepEqual(error.details, { campo: 'carrera' });
  assert.ok(error instanceof Error);
});

// ---------------------------------------------------------------------------
// Notificaciones. El template es puro a proposito: se prueba el texto que le
// llega a una persona real sin gastar un envio.

const HOY = new Date('2027-03-10T12:00:00Z');

function matchDePrueba(extra = {}) {
  return {
    compatibilidad: 92,
    razones: ['Pide 4to anio o superior, y estas en ese tramo'],
    oportunidad: {
      titulo: 'Beca MEXT 2027',
      fechaLimite: '2027-03-13',
      linkAplicacion: 'https://bo.emb-japan.go.jp/becas',
      ...extra
    }
  };
}

test('mensaje: incluye titulo, compatibilidad, razon, plazo y enlace', () => {
  const texto = mensajeDeOportunidad({
    perfil: { nombre: 'Maria' },
    match: matchDePrueba(),
    hoy: HOY
  });

  assert.match(texto, /Hola Maria/);
  assert.match(texto, /Beca MEXT 2027/);
  assert.match(texto, /92% compatible/);
  assert.match(texto, /Pide 4to anio o superior/i);
  assert.match(texto, /Cierra en 3 dias/);
  assert.match(texto, /https:\/\/bo\.emb-japan\.go\.jp\/becas/);
});

test('mensaje: sin nombre saluda igual, sin quedar cortado', () => {
  const texto = mensajeDeOportunidad({ perfil: {}, match: matchDePrueba(), hoy: HOY });
  assert.match(texto, /^Hola, soy Oppy/);
});

test('mensaje: el plazo se dice en lenguaje de persona', () => {
  const hoyMismo = mensajeDeOportunidad({
    perfil: {},
    match: matchDePrueba({ fechaLimite: '2027-03-10' }),
    hoy: HOY
  });
  assert.match(hoyMismo, /Cierra hoy/);

  const maniana = mensajeDeOportunidad({
    perfil: {},
    match: matchDePrueba({ fechaLimite: '2027-03-11' }),
    hoy: HOY
  });
  assert.match(maniana, /Cierra maniana/);
});

test('mensaje: sin fecha limite no inventa un plazo', () => {
  const texto = mensajeDeOportunidad({
    perfil: {},
    match: matchDePrueba({ fechaLimite: null }),
    hoy: HOY
  });
  assert.ok(!/Cierra/.test(texto));
});

test('mensaje: una convocatoria vencida no anuncia un plazo negativo', () => {
  const texto = mensajeDeOportunidad({
    perfil: {},
    match: matchDePrueba({ fechaLimite: '2027-03-01' }),
    hoy: HOY
  });
  assert.ok(!/Cierra/.test(texto));
});

// ---------------------------------------------------------------------------
test('oppyAdapter: perfil del producto mapea a schema LoRA', () => {
  const user = perfilAOppy({
    carrera: 'Ingenieria de Sistemas',
    habilidades: ['Python', 'SQL'],
    intereses: ['backend'],
    experiencia: ['pasantias'],
    ubicacion: 'Santa Cruz',
    nivelEstudios: 'universidad'
  });

  assert.equal(user.career, 'Ingenieria de Sistemas');
  assert.deepEqual(user.skills, ['Python', 'SQL']);
  assert.deepEqual(user.interests, ['backend', 'pasantias']);
  assert.equal(user.location, 'Santa Cruz');
});

test('oppyAdapter: empleo_junior del LoRA vira a categoria empleo', () => {
  const cruda = extraccionACruda(
    {
      title: 'Pasantia backend Python',
      type: 'empleo_junior',
      description: 'Buscamos pasante',
      skills: ['Python'],
      deadline: '2026-12-01',
      url: 'https://ejemplo.bo/pasa'
    },
    { type: 'pasantia', category: 'tech' }
  );

  assert.equal(cruda.titulo, 'Pasantia backend Python');
  assert.equal(cruda.categoria, 'pasantia');
  assert.deepEqual(cruda.skills, ['Python']);
  assert.equal(cruda.fecha_limite, '2026-12-01');
});

test('oppyAdapter: matching LoRA vira a evaluacion del producto', () => {
  const evaluacion = matchingAEvaluacion({
    match: 'alto',
    score: 88,
    reason: 'Coincide en Python y ubicacion Santa Cruz'
  });

  assert.equal(evaluacion.compatibilidad, 88);
  assert.equal(evaluacion.elegible, true);
  assert.equal(evaluacion.razones.length, 1);
  assert.deepEqual(evaluacion.brechas, []);
});

test('oppyAdapter: match nulo no es elegible', () => {
  const evaluacion = matchingAEvaluacion({
    match: 'nulo',
    score: 10,
    reason: 'No cumple el nivel de estudios'
  });
  assert.equal(evaluacion.elegible, false);
});

test('oppyAdapter: deadline_status refleja la fecha', () => {
  assert.equal(deadlineStatusDe(null), 'sin_fecha');
  assert.equal(deadlineStatusDe(MANANA), 'vigente');
  assert.equal(deadlineStatusDe(AYER), 'vencida');
});

test('oppyAdapter: oportunidad del producto mapea type empleo_junior', () => {
  const opp = oportunidadAOppy({
    titulo: 'Dev junior',
    categoria: 'empleo',
    descripcion: 'Backend',
    skills: ['Node'],
    elegibilidad: 'Estudiante',
    fechaLimite: MANANA
  });
  assert.equal(opp.type, 'empleo_junior');
  assert.equal(opp.deadline_status, 'vigente');
  assert.deepEqual(opp.requirements, ['Estudiante']);
});

test('oppyAdapter: el objetivo entra en interests, no en career', () => {
  const user = perfilAOppy({
    carrera: 'Sistemas',
    objetivo: 'empleo',
    intereses: [],
    experiencia: [],
    habilidades: []
  });
  assert.equal(user.career, 'Sistemas');
  assert.deepEqual(user.interests, ['empleo']);
});

// ---------------------------------------------------------------------------
test('orquestador: empleo no busca becas en el plan de respaldo', () => {
  const plan = planDeRespaldo({
    objetivos: ['empleo'],
    carrera: 'Sistemas',
    ubicacion: 'Santa Cruz'
  });

  assert.deepEqual(plan.categorias, ['empleo', 'pasantia']);
  assert.ok(plan.queries.every((q) => !/\bbecas?\b/i.test(q)));
  assert.ok(plan.queries.some((q) => /empleo|trabajo|pasant/i.test(q)));
});

test('orquestador: planDesdePerfil incorpora remoto y habilidades', () => {
  const plan = planDesdePerfil({
    objetivos: ['empleo'],
    carrera: 'Sistemas',
    ubicacion: 'Santa Cruz',
    habilidades: ['excel', 'ventas'],
    restricciones: ['remoto', 'horario_manana'],
    experiencia: ['sin_experiencia']
  });

  assert.ok(plan.queries.some((q) => /remoto/i.test(q)));
  assert.ok(plan.queries.some((q) => /excel/i.test(q)));
  assert.ok(plan.queries.some((q) => /primer empleo|junior/i.test(q)));
  assert.ok(plan.queries.some((q) => /manana/i.test(q)));
  assert.match(plan.razonamiento, /empleo/i);
});

test('orquestador: beca si busca becas', () => {
  const plan = planDeRespaldo({
    objetivos: ['beca'],
    carrera: 'Sistemas',
    ubicacion: 'La Paz'
  });

  assert.ok(plan.categorias.includes('beca'));
  assert.ok(plan.queries.some((q) => /\bbecas?\b/i.test(q)));
});

test('orquestador: alinearConObjetivo descarta queries de becas si pide empleo', () => {
  const alineado = alinearConObjetivo(
    {
      queries: [
        'becas Sistemas Bolivia 2026 convocatoria',
        'empleo Sistemas Santa Cruz 2026'
      ],
      categorias: ['beca', 'empleo', 'pasantia'],
      razonamiento: 'mezclado'
    },
    { objetivos: ['empleo'], carrera: 'Sistemas', ubicacion: 'Santa Cruz' }
  );

  assert.deepEqual(alineado.categorias.sort(), ['empleo', 'pasantia'].sort());
  assert.equal(alineado.queries.length, 1);
  assert.match(alineado.queries[0], /empleo/i);
});

test('orquestador: categoriasPara respeta el objetivo', () => {
  assert.deepEqual(categoriasPara({ objetivos: ['empleo'] }), ['empleo', 'pasantia']);
  assert.deepEqual(categoriasPara({ objetivos: ['voluntariado'] }), ['voluntariado']);
  assert.ok(categoriasPara({ objetivos: ['empleo', 'beca'] }).includes('beca'));
});
