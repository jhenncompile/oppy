import { z } from 'zod';
import { completeJson } from '../llm/index.js';
import { CATEGORIAS } from './normalizer.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ module: 'orchestrator' });

const planSchema = z.object({
  queries: z.array(z.string().min(8).max(200)).min(1).max(4),
  categorias: z.array(z.enum(CATEGORIAS)).min(1).max(5),
  razonamiento: z.string().max(400)
});

const SISTEMA = `Sos el orquestador de un agente que busca oportunidades para
jovenes en Bolivia. Dado un perfil, decidis QUE buscar y DONDE.

Genera entre 2 y 3 busquedas en espanol, concretas y orientadas a convocatorias
reales de Bolivia o abiertas a bolivianos. Incluí el anio actual cuando aporte.
Evita busquedas genericas como "becas": tienen que reflejar la carrera, el nivel
y los intereses del perfil.

Elegi las categorias que tengan sentido para este perfil, no todas.

Si el perfil declara mas de un objetivo, cubri el principal primero y deja al
menos una busqueda para los demas. No dividas todo en partes iguales: el primero
es el que la persona puso adelante.

Respeta las restricciones: si dice que solo puede a la maniana o que necesita
que sea remoto, no generes busquedas que las ignoren.

Responde solo con JSON.`;

/**
 * Decide el plan de busqueda para un perfil.
 *
 * Esto es lo que separa a un agente de un buscador: las queries no estan
 * escritas en el codigo, las decide el modelo a partir de la persona. El
 * campo `razonamiento` se muestra en la pantalla de proceso en vivo.
 */
export async function planificar(perfil) {
  const objetivos = perfil.objetivos ?? [];

  const prompt = [
    'PERFIL',
    // Va primero y con enfasis: es la senal que acota que buscar antes que
    // cualquier otra cosa. El orden importa — el primero es el que mas pesa.
    objetivos.length > 0
      ? `Objetivo principal: ${objetivos[0]}` +
        (objetivos.length > 1 ? ` (tambien busca: ${objetivos.slice(1).join(', ')})` : '')
      : 'Objetivo: sin especificar',
    `Carrera: ${perfil.carrera}`,
    `Nivel de estudios: ${perfil.nivelEstudios}`,
    `Ubicacion: ${perfil.ubicacion}`,
    `Intereses: ${(perfil.intereses ?? []).join(', ') || 'sin especificar'}`,
    `Restricciones: ${(perfil.restricciones ?? []).join(', ') || 'ninguna'}`,
    `Anio actual: ${new Date().getFullYear()}`,
    '',
    `Categorias validas: ${CATEGORIAS.join(', ')}`,
    '',
    'Devolve JSON con esta forma exacta:',
    '{"queries":[""],"categorias":[""],"razonamiento":""}'
  ].join('\n');

  try {
    const plan = await completeJson({
      system: SISTEMA,
      prompt,
      schema: planSchema,
      temperature: 0.4
    });

    log.info('Plan generado', { queries: plan.queries.length, categorias: plan.categorias });
    return plan;
  } catch (error) {
    // Si el modelo no responde, la corrida sigue con un plan derivado del
    // perfil. Peor que razonado, pero mejor que una demo en blanco.
    log.warn('Planificacion fallida, se usa el plan de respaldo', { error: error.message });
    return planDeRespaldo(perfil);
  }
}

/** Categorias del indice que corresponden a cada objetivo declarado. */
const CATEGORIAS_POR_OBJETIVO = {
  empleo: ['empleo', 'pasantia'],
  reinsercion: ['empleo', 'curso', 'programa_social'],
  beca: ['beca', 'intercambio'],
  curso: ['curso', 'beca'],
  crecimiento: ['concurso', 'financiamiento', 'evento'],
  voluntariado: ['voluntariado', 'programa_social'],
  evento: ['evento', 'concurso']
};

function planDeRespaldo(perfil) {
  const anio = new Date().getFullYear();
  const objetivos = perfil.objetivos ?? [];

  // Incluso el respaldo respeta lo que la persona dijo que busca: un plan que
  // ignora el objetivo devuelve resultados que no le sirven a nadie.
  const categorias = [
    ...new Set(objetivos.flatMap((objetivo) => CATEGORIAS_POR_OBJETIVO[objetivo] ?? []))
  ];

  return {
    queries: [
      `${objetivos[0] ?? 'becas'} ${perfil.carrera} Bolivia ${anio} convocatoria`,
      `${objetivos[1] ?? 'pasantias'} ${perfil.carrera} ${perfil.ubicacion} ${anio}`
    ],
    categorias: categorias.length > 0 ? categorias : ['beca', 'pasantia', 'empleo'],
    razonamiento: 'Plan de respaldo derivado directamente del perfil.'
  };
}
