import { z } from 'zod';
import { completeJson } from '../llm/index.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ module: 'matcher' });

const evaluacionSchema = z.object({
  match_score: z.number().int().min(0).max(100),
  elegible: z.boolean(),
  por_que_calza: z.string().min(10).max(600)
});

const SISTEMA = `Sos un evaluador de compatibilidad entre personas y oportunidades
(becas, pasantias, empleos, concursos) en Bolivia y Latinoamerica.

No hagas coincidencia de palabras clave: razona sobre elegibilidad REAL.
Si la convocatoria exige un requisito que el perfil no cumple (nivel de estudios,
idioma, carrera, ubicacion, edad), la persona NO es elegible aunque el tema le
interese, y el puntaje debe ser bajo.

Criterio de puntaje:
  85-100  cumple todos los requisitos y encaja con sus intereses
  60-84   cumple los requisitos duros, encaje parcial de intereses
  30-59   le podria servir, pero hay un requisito dudoso o faltante
  0-29    no califica

En "por_que_calza" explica en 1 o 2 frases, en segunda persona y en espanol
rioplatense neutro, POR QUE calza o por que no. Menciona el requisito concreto
que motivo el puntaje. Nunca inventes requisitos que no esten en la convocatoria.

Responde solo con JSON.`;

/**
 * Evalua un par (perfil, oportunidad).
 *
 * Es deliberadamente simetrico: no recibe un "usuario" ni un "candidato", sino
 * dos lados. Eso permite reusarlo tal cual para el matching inverso — una
 * empresa buscando talento — sin reescribir el motor de razonamiento.
 *
 * @param {object} perfil        Perfil de la persona
 * @param {object} oportunidad   Oportunidad normalizada
 * @param {'persona'|'organizacion'} perspectiva  A quien se le habla
 */
export async function evaluar(perfil, oportunidad, { perspectiva = 'persona' } = {}) {
  const prompt = [
    'PERFIL DE LA PERSONA',
    `Carrera: ${perfil.carrera}`,
    `Nivel de estudios: ${perfil.nivelEstudios}`,
    `Ubicacion: ${perfil.ubicacion}`,
    `Intereses: ${(perfil.intereses ?? []).join(', ') || 'sin especificar'}`,
    `Idiomas: ${formatearIdiomas(perfil.idiomas)}`,
    '',
    'OPORTUNIDAD',
    `Titulo: ${oportunidad.titulo}`,
    `Categoria: ${oportunidad.categoria}`,
    `Fuente: ${oportunidad.fuente.nombre}`,
    `Fecha limite: ${oportunidad.fechaLimite ?? 'no especificada'}`,
    `Elegibilidad: ${oportunidad.elegibilidad ?? 'no especificada'}`,
    `Beneficio: ${oportunidad.montoBeneficio ?? 'no especificado'}`,
    `Requisitos detectados: ${(oportunidad.skills ?? []).join(', ') || 'ninguno'}`,
    oportunidad.descripcion ? `Descripcion: ${oportunidad.descripcion}` : null,
    '',
    perspectiva === 'organizacion'
      ? 'Escribi "por_que_calza" dirigido a la organizacion que busca al candidato.'
      : 'Escribi "por_que_calza" dirigido a la persona, tratandola de vos.',
    '',
    'Devolve JSON con esta forma exacta:',
    '{"match_score":0,"elegible":false,"por_que_calza":""}'
  ].filter(Boolean).join('\n');

  const resultado = await completeJson({
    system: SISTEMA,
    prompt,
    schema: evaluacionSchema,
    temperature: 0.2
  });

  return {
    matchScore: resultado.match_score,
    elegible: resultado.elegible,
    porQueCalza: resultado.por_que_calza.trim()
  };
}

/**
 * Version tolerante: devuelve null en vez de lanzar. La usa el pipeline, donde
 * una evaluacion fallida no debe interrumpir a las demas.
 */
export async function evaluarSeguro(perfil, oportunidad, opciones) {
  try {
    return await evaluar(perfil, oportunidad, opciones);
  } catch (error) {
    log.warn('Evaluacion fallida', {
      oportunidad: oportunidad.id,
      error: error.message
    });
    return null;
  }
}

function formatearIdiomas(idiomas) {
  if (!Array.isArray(idiomas) || idiomas.length === 0) return 'sin especificar';
  return idiomas.map((i) => `${i.idioma} (${i.nivel})`).join(', ');
}
