import { z } from 'zod';
import { completeJson } from '../llm/index.js';
import { CATEGORIAS } from './normalizer.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ module: 'orchestrator' });

/**
 * El objetivo del onboarding es la senal mas fuerte: acota QUE buscar antes
 * de mirar carrera o intereses. Sin este mapa, el modelo (y el plan de
 * respaldo) terminaban buscando becas aunque la persona pidiera empleo.
 */
export const OBJETIVO_A_CATEGORIAS = {
  empleo: ['empleo', 'pasantia'],
  reinsercion: ['empleo', 'curso', 'pasantia'],
  beca: ['beca', 'intercambio'],
  curso: ['curso'],
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

const planSchema = z.object({
  queries: z.array(z.string().min(8).max(200)).min(1).max(4),
  categorias: z.array(z.enum(CATEGORIAS)).min(1).max(5),
  razonamiento: z.string().max(400)
});

const SISTEMA = `Sos el orquestador de un agente que busca oportunidades para
jovenes en Bolivia. Dado un perfil, decidis QUE buscar y DONDE.

La senal MAS IMPORTANTE es el OBJETIVO del perfil. Todas las busquedas tienen
que apuntar a ese objetivo. Si pide empleo, buscas empleos y pasantias — NUNCA
becas. Si pide becas, buscas becas — no empleos.

Genera entre 2 y 3 busquedas en espanol, concretas y orientadas a convocatorias
reales de Bolivia o abiertas a bolivianos. Incluí el anio actual cuando aporte.
Evita busquedas genericas: tienen que reflejar el objetivo, la carrera y el nivel.

Elegi SOLO categorias alineadas al objetivo. No agregues categorias de mas.

Responde solo con JSON.`;

/**
 * Decide el plan de busqueda para un perfil.
 *
 * Si el frontend mando un objetivo, el plan se arma de forma deterministica
 * desde esos parametros: asi "empleo" nunca termina buscando becas, y no
 * dependemos de que Ollama responda a tiempo. El LLM solo se usa cuando no
 * hay objetivo claro.
 */
export async function planificar(perfil) {
  if (perfil?.objetivo && OBJETIVO_A_CATEGORIAS[perfil.objetivo]) {
    const plan = planDesdePerfil(perfil);
    log.info('Plan desde parametros del frontend', {
      objetivo: perfil.objetivo,
      queries: plan.queries,
      categorias: plan.categorias
    });
    return plan;
  }

  const categoriasObjetivo = categoriasPara(perfil);
  const prompt = [
    'PERFIL',
    `Objetivo (senal principal): ${etiquetaObjetivo(perfil.objetivo)}`,
    `Carrera: ${perfil.carrera}`,
    `Nivel de estudios: ${perfil.nivelEstudios}`,
    `Ubicacion: ${perfil.ubicacion}`,
    `Experiencia: ${(perfil.experiencia ?? []).join(', ') || 'sin especificar'}`,
    `Habilidades: ${(perfil.habilidades ?? []).join(', ') || 'sin especificar'}`,
    `Intereses: ${(perfil.intereses ?? []).join(', ') || 'sin especificar'}`,
    `Restricciones: ${(perfil.restricciones ?? []).join(', ') || 'ninguna'}`,
    `Anio actual: ${new Date().getFullYear()}`,
    '',
    `Categorias permitidas para este objetivo: ${categoriasObjetivo.join(', ')}`,
    '',
    'Devolve JSON con esta forma exacta:',
    '{"queries":[""],"categorias":[""],"razonamiento":""}'
  ].join('\n');

  try {
    const plan = await completeJson({
      system: SISTEMA,
      prompt,
      schema: planSchema,
      temperature: 0.4,
      timeoutMs: 45_000
    });

    const alineado = alinearConObjetivo(plan, perfil);
    log.info('Plan generado', {
      queries: alineado.queries.length,
      categorias: alineado.categorias,
      objetivo: perfil.objetivo ?? null
    });
    return alineado;
  } catch (error) {
    log.warn('Planificacion fallida, se usa el plan de respaldo', { error: error.message });
    return planDesdePerfil(perfil);
  }
}

/** Categorias permitidas segun el objetivo; sin objetivo, el catalogo completo. */
export function categoriasPara(perfil) {
  if (perfil?.objetivo && OBJETIVO_A_CATEGORIAS[perfil.objetivo]) {
    return OBJETIVO_A_CATEGORIAS[perfil.objetivo];
  }
  return [...CATEGORIAS];
}

/**
 * Plan armado solo con lo que la persona cargo en el formulario.
 * Es la fuente de verdad cuando hay objetivo.
 */
export function planDesdePerfil(perfil) {
  const anio = new Date().getFullYear();
  const carrera = (perfil.carrera || 'jovenes').trim();
  const ubicacion = (perfil.ubicacion || 'Bolivia').trim();
  const objetivo = perfil.objetivo;
  const categorias = categoriasPara(perfil).slice(0, 3);
  const extras = modificadoresDeBusqueda(perfil);
  const skill = (perfil.habilidades ?? [])[0];

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
  const permitidas = new Set(categoriasPara(perfil));
  const categorias = (plan.categorias ?? []).filter((c) => permitidas.has(c));
  const categoriasFinales = categorias.length > 0
    ? categorias
    : [...permitidas].slice(0, 3);

  let queries = (plan.queries ?? []).filter((q) => queryAlineada(q, perfil.objetivo));
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
    necesito_ingreso_ya: 'urgente',
    requiere_accesibilidad: 'accesible'
  };

  return restricciones
    .map((r) => mapa[r])
    .filter(Boolean);
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
