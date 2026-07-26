import { CATEGORIAS } from './normalizer.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ module: 'orchestrator' });

/**
 * El objetivo del onboarding es la senal mas fuerte: acota QUE buscar antes
 * de mirar carrera o intereses. Sin este mapa, el plan de respaldo terminaba
 * buscando becas aunque la persona pidiera empleo.
 */
export const OBJETIVO_A_CATEGORIAS = {
  empleo: ['empleo', 'pasantia'],
  reinsercion: ['empleo', 'curso', 'pasantia'],
  beca: ['beca', 'intercambio'],
  curso: ['curso', 'evento'],
  crecimiento: ['empleo', 'curso', 'pasantia'],
  voluntariado: ['voluntariado'],
  evento: ['evento', 'concurso']
};

const OBJETIVO_ETIQUETA = {
  empleo: 'encontrar empleo / trabajo',
  reinsercion: 'volver al mercado laboral',
  beca: 'becas e intercambios',
  curso: 'cursos y certificaciones',
  crecimiento: 'crecimiento profesional (empleo, cursos, pasantias)',
  voluntariado: 'voluntariados',
  evento: 'eventos y hackathons'
};

/**
 * Decide el plan de busqueda para un perfil.
 *
 * Siempre deterministico desde los parametros del frontend/DB. No llama a
 * Ollama ni a Modal: el plan es reglas + objetivos del onboarding.
 */
export async function planificar(perfil) {
  const objetivo = objetivoPrincipal(perfil);
  const plan = planDesdePerfil(perfil);
  log.info('Plan desde parametros del frontend', {
    objetivo,
    objetivos: perfil.objetivos ?? [],
    queries: plan.queries,
    categorias: plan.categorias
  });
  return plan;
}

/** Primer objetivo del onboarding (el principal) o el campo legacy singular. */
export function objetivoPrincipal(perfil) {
  if (perfil?.objetivo && OBJETIVO_A_CATEGORIAS[perfil.objetivo]) return perfil.objetivo;
  const lista = perfil?.objetivos ?? [];
  return lista.find((o) => OBJETIVO_A_CATEGORIAS[o]) ?? lista[0] ?? null;
}

/** Categorias permitidas segun el/los objetivos; sin objetivo, el catalogo completo. */
export function categoriasPara(perfil) {
  const lista = [
    ...(perfil?.objetivo ? [perfil.objetivo] : []),
    ...(perfil?.objetivos ?? [])
  ].filter((o, i, arr) => OBJETIVO_A_CATEGORIAS[o] && arr.indexOf(o) === i);

  if (lista.length === 0) return [...CATEGORIAS];

  const categorias = [];
  for (const objetivo of lista) {
    for (const cat of OBJETIVO_A_CATEGORIAS[objetivo]) {
      if (!categorias.includes(cat)) categorias.push(cat);
    }
  }
  return categorias;
}

/**
 * Plan armado solo con lo que la persona cargo en el formulario.
 * Es la fuente de verdad cuando hay objetivo.
 */
export function planDesdePerfil(perfil) {
  const anio = new Date().getFullYear();
  const carrera = (perfil.carrera || 'jovenes').trim();
  const ubicacion = (perfil.ubicacion || 'Bolivia').trim();
  const objetivo = objetivoPrincipal(perfil);
  const secundarios = (perfil.objetivos ?? []).filter((o) => o !== objetivo);
  const categorias = categoriasPara(perfil).slice(0, 4);
  const extras = modificadoresDeBusqueda(perfil);
  const skill = skillParaQuery((perfil.habilidades ?? [])[0]);

  const basePorObjetivo = {
    empleo: [
      `empleo ${carrera} ${ubicacion} ${anio}`,
      `trabajo ${carrera} Bolivia ${anio}`,
      `pasantias ${carrera} ${ubicacion}`
    ],
    reinsercion: [
      `empleo reinsercion laboral ${ubicacion} ${anio}`,
      `trabajo ${carrera} Bolivia ${anio}`,
      `cursos certificacion laboral Bolivia ${anio}`
    ],
    beca: [
      `becas ${carrera} Bolivia ${anio} convocatoria`,
      `intercambio ${carrera} Bolivia ${anio}`
    ],
    curso: [
      `cursos certificaciones ${carrera} Bolivia ${anio}`,
      `capacitacion ${carrera} ${ubicacion} ${anio}`
    ],
    crecimiento: [
      `empleo ${carrera} ${ubicacion} ${anio}`,
      `cursos ${carrera} Bolivia ${anio}`,
      `pasantias ${carrera} ${ubicacion}`
    ],
    voluntariado: [
      `voluntariado ${carrera} Bolivia ${anio}`,
      `voluntariado ${ubicacion} ${anio}`
    ],
    evento: [
      `hackathon ${carrera} Bolivia ${anio}`,
      `eventos concursos ${carrera} ${ubicacion} ${anio}`
    ]
  };

  let queries = [...(basePorObjetivo[objetivo] ?? [
    `oportunidades ${carrera} ${ubicacion} ${anio}`,
    `pasantias empleo ${carrera} Bolivia ${anio}`
  ])];

  // Una query extra para el segundo objetivo, sin desplazar al principal.
  if (secundarios[0] && basePorObjetivo[secundarios[0]]) {
    queries.push(basePorObjetivo[secundarios[0]][0]);
  }

  // Incorpora restricciones y habilidades del formulario a las queries.
  if (extras.length > 0) {
    queries = queries.map((q, i) => (i === 0 ? `${q} ${extras.join(' ')}` : q));
  }
  if (skill && queries[1]) {
    queries[1] = `${queries[1]} ${skill}`;
  }
  if ((perfil.experiencia ?? []).includes('sin_experiencia') && queries[0]) {
    queries[0] = `${queries[0]} junior primer empleo`;
  }

  queries = [...new Set(queries.map((q) => q.replace(/\s+/g, ' ').trim()))].slice(0, 3);

  const partes = [
    objetivo ? `Busco ${etiquetaObjetivo(objetivo)}` : 'Busco oportunidades',
    `para ${carrera} en ${ubicacion}`
  ];
  if (secundarios.length) {
    partes.push(`tambien ${secundarios.map(etiquetaObjetivo).join(', ')}`);
  }
  if (extras.length) partes.push(`(${extras.join(', ')})`);

  return {
    queries,
    categorias,
    razonamiento: `${partes.join(' ')}.`
  };
}

/** @deprecated usar planDesdePerfil */
export function planDeRespaldo(perfil) {
  return planDesdePerfil(perfil);
}

/**
 * Fuerza categorias al objetivo y descarta queries que claramente apuntan a
 * otra cosa (ej. "becas …" cuando pidieron empleo).
 */
export function alinearConObjetivo(plan, perfil) {
  const objetivo = objetivoPrincipal(perfil);
  const permitidas = new Set(categoriasPara(perfil));
  const categorias = (plan.categorias ?? []).filter((c) => permitidas.has(c));
  const categoriasFinales = categorias.length > 0
    ? categorias
    : [...permitidas].slice(0, 3);

  let queries = (plan.queries ?? []).filter((q) => queryAlineada(q, objetivo));
  if (queries.length === 0) {
    queries = planDesdePerfil(perfil).queries;
  }

  return {
    queries,
    categorias: categoriasFinales,
    razonamiento: plan.razonamiento
  };
}

export function etiquetaObjetivo(objetivo) {
  if (!objetivo) return 'sin especificar — inferí a partir del resto del perfil';
  return OBJETIVO_ETIQUETA[objetivo] ?? objetivo;
}

/** Traduce chips del onboarding a palabras utiles en la busqueda. */
function modificadoresDeBusqueda(perfil) {
  const restricciones = perfil.restricciones ?? [];
  const mapa = {
    remoto: 'remoto teletrabajo',
    cerca_de_casa: perfil.ubicacion || 'cerca',
    medio_tiempo: 'medio tiempo',
    solo_manana: 'turno manana',
    solo_tarde: 'turno tarde',
    horario_manana: 'turno manana',
    horario_tarde: 'turno tarde',
    horario_noche: 'turno noche',
    solo_fines_de_semana: 'fines de semana',
    necesidad_economica_inmediata: 'urgente',
    necesito_ingreso_ya: 'urgente',
    cuidado_familiar: 'horario flexible',
    sin_transporte: 'cerca o remoto',
    sin_internet_en_casa: 'presencial',
    sin_computadora: 'sin computadora',
    requiere_accesibilidad: 'accesible',
    discapacidad_visual: 'accesible',
    discapacidad_auditiva: 'accesible',
    discapacidad_motriz: 'accesible'
  };

  return [...new Set(
    restricciones
      .map((r) => mapa[r])
      .filter(Boolean)
  )];
}

/** Slugs del front (atencion_al_cliente) → texto de busqueda. */
function skillParaQuery(skill) {
  if (!skill) return null;
  return String(skill).replace(/_/g, ' ').trim();
}

/** Una query de becas no sirve si el objetivo es empleo (y viceversa). */
function queryAlineada(query, objetivo) {
  if (!objetivo) return true;
  const texto = query.toLowerCase();
  const hablaDeBeca = /\bbecas?\b/.test(texto);
  const hablaDeEmpleo = /\b(empleo|trabajo|pasant[ií]a|vacante|puesto)s?\b/.test(texto);

  if (['empleo', 'reinsercion', 'crecimiento'].includes(objetivo) && hablaDeBeca && !hablaDeEmpleo) {
    return false;
  }
  if (objetivo === 'beca' && hablaDeEmpleo && !hablaDeBeca) {
    return false;
  }
  return true;
}
