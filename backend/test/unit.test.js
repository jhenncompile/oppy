import test from 'node:test';
import assert from 'node:assert/strict';

import { clasificar, esDominioOficial, hostnameDe, CONFIANZA } from '../src/services/scoring/trust.js';
import { mapConLimite, mapExitosos } from '../src/utils/concurrency.js';
import { fuentesActivas, fuentesPorEstrategia, ESTRATEGIAS } from '../src/services/scraping/sources.js';
import { combinacionesDeBusqueda } from '../src/services/scraping/discovery.js';
import { extraerJson } from '../src/services/llm/index.js';
import { calcularHash } from '../src/services/agent/normalizer.js';
import {
  mensajeDeOportunidad,
  mensajeDeAcceso,
  mensajeDeRecordatorio,
  mensajeDeCierreGuardada
} from '../src/services/notifications/templates.js';
import { coincide, derivar, generarCodigo } from '../src/services/auth/codigo.js';
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

// ---------------------------------------------------------------------------
// Acceso por codigo. Contrato en docs/12-auth.md.
//
// Se prueba aca y no contra el servidor porque el mecanismo es puro: si el
// codigo se guarda mal o se compara mal, no hay base de datos que lo salve.
// ---------------------------------------------------------------------------

test('acceso: el codigo son 6 digitos, con ceros a la izquierda incluidos', () => {
  for (let i = 0; i < 200; i += 1) {
    assert.match(generarCodigo(), /^\d{6}$/);
  }
});

test('acceso: dos codigos seguidos no son el mismo', () => {
  const muestras = new Set(Array.from({ length: 50 }, () => generarCodigo()));
  // Con 10^6 posibilidades, 50 iguales seria randomInt roto, no mala suerte.
  assert.ok(muestras.size > 40);
});

test('acceso: el codigo derivado verifica contra si mismo', () => {
  const guardado = derivar('483920');
  assert.ok(coincide('483920', guardado));
});

test('acceso: un codigo equivocado no verifica', () => {
  const guardado = derivar('483920');
  assert.equal(coincide('483921', guardado), false);
  assert.equal(coincide('000000', guardado), false);
  assert.equal(coincide('', guardado), false);
});

test('acceso: el mismo codigo derivado dos veces da hashes distintos', () => {
  // Si la sal no fuera por codigo, dos personas con el mismo numero
  // compartirian hash y una tabla precalculada las abriria a las dos.
  assert.notEqual(derivar('483920'), derivar('483920'));
});

test('acceso: el codigo nunca queda guardado en claro', () => {
  const guardado = derivar('483920');
  assert.equal(guardado.includes('483920'), false);
});

test('acceso: un hash guardado corrupto no abre la puerta', () => {
  // Nada de esto deberia existir en la base, pero si aparece la respuesta
  // correcta es "no", no una excepcion que devuelva 500.
  for (const roto of ['', 'sin-dos-puntos', 'sal:', ':hash', null, undefined]) {
    assert.equal(coincide('483920', roto), false);
  }
});

test('acceso: el mensaje trae el codigo, la vigencia y la salida para quien no lo pidio', () => {
  const texto = mensajeDeAcceso({
    perfil: { nombre: 'Maria' },
    codigo: '483920',
    minutos: 10
  });

  assert.match(texto, /Maria/);
  assert.match(texto, /483920/);
  assert.match(texto, /10 minutos/);
  assert.match(texto, /no hagas nada/i);

  // Sin enlaces: un mensaje inesperado con algo para apretar tiene la forma
  // exacta de una estafa, y es la gente de Oppy la mas expuesta a eso.
  assert.equal(/https?:\/\//.test(texto), false);
});

test('acceso: el mensaje funciona sin nombre', () => {
  const texto = mensajeDeAcceso({ perfil: {}, codigo: '000123', minutos: 10 });
  assert.match(texto, /^Hola, soy Oppy/);
  assert.match(texto, /000123/);
});

test('recordatorio: dice que lo anoto la persona, no que Oppy lo encontro', () => {
  // Es la diferencia entre un recordatorio pedido y un mensaje no solicitado.
  // Si el texto sonara a recomendacion, Oppy estaria empujando algo que nadie
  // verifico — que es exactamente la forma de una estafa laboral.
  const texto = mensajeDeRecordatorio({
    persona: { nombre: 'Maria' },
    propia: {
      titulo: 'Ayudante de cocina en el centro',
      organizacion: 'Restaurante Sucre',
      donde: 'me lo paso una conocida',
      fechaLimite: '2026-08-01'
    },
    hoy: new Date('2026-07-29T10:00:00Z')
  });

  assert.match(texto, /anotaste vos/);
  assert.doesNotMatch(texto, /Encontre algo/);
  assert.match(texto, /Cierra en 3 dias/);
  assert.match(texto, /me lo paso una conocida/);
});

test('recordatorio: sin fecha limite no inventa un plazo', () => {
  const texto = mensajeDeRecordatorio({
    persona: {},
    propia: { titulo: 'Puesto en la ferreteria' }
  });

  assert.match(texto, /Puesto en la ferreteria/);
  assert.doesNotMatch(texto, /Cierra/);
});

test('recordatorio de guardada: nombra la fuente, que es lo que Oppy si reviso', () => {
  const texto = mensajeDeCierreGuardada({
    persona: { nombre: 'Diego' },
    match: {
      oportunidad: {
        titulo: 'Beca MEXT 2027',
        fuente: { nombre: 'Embajada de Japon en Bolivia', url: 'https://ej.bo' },
        linkAplicacion: 'https://ej.bo/becas',
        fechaLimite: '2026-07-27'
      }
    },
    hoy: new Date('2026-07-26T10:00:00Z')
  });

  assert.match(texto, /que guardaste/);
  assert.match(texto, /Embajada de Japon en Bolivia/);
  assert.match(texto, /Cierra maniana/);
  assert.match(texto, /https:\/\/ej\.bo\/becas/);
});

test('los dos recordatorios se distinguen: uno lo guardo, el otro lo anoto', () => {
  // Si los dos textos fueran iguales, la persona no podria saber si Oppy vio la
  // fuente o si solo esta repitiendo algo que ella escribio.
  const guardada = mensajeDeCierreGuardada({
    persona: {},
    match: { oportunidad: { titulo: 'X', fuente: { nombre: 'Fuente oficial' } } }
  });
  const anotada = mensajeDeRecordatorio({ persona: {}, propia: { titulo: 'X' } });

  assert.notEqual(guardada, anotada);
  assert.match(guardada, /guardaste/);
  assert.match(anotada, /anotaste vos/);
});

test('confianza: lo que cierra HOY todavia no vencio', () => {
  // Una fecha sin hora se parsea como medianoche UTC; en Bolivia eso cae el dia
  // anterior. Comparar contra la medianoche local marcaba como vencida toda
  // convocatoria que cerraba hoy — justo cuando mas urge postular.
  const hoy = new Date();
  const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

  assert.equal(clasificar({ url: 'https://ejemplo.com', fechaLimite: iso }), CONFIANZA.POR_VALIDAR);
  assert.equal(
    clasificar({ url: 'https://bo.usembassy.gov/x', fechaLimite: iso }),
    CONFIANZA.VERIFICADA
  );
});

test('confianza: acepta un Date de Postgres igual que una cadena', () => {
  // La columna es DATE y node-postgres la devuelve como Date en hora local.
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  assert.equal(clasificar({ url: 'https://ejemplo.com', fechaLimite: hoy }), CONFIANZA.POR_VALIDAR);

  const anteayer = new Date();
  anteayer.setDate(anteayer.getDate() - 2);
  assert.equal(
    clasificar({ url: 'https://bo.usembassy.gov/x', fechaLimite: anteayer }),
    CONFIANZA.DESACTUALIZADA
  );
});
