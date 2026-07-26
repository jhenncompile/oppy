import { z } from 'zod';
import { env } from '../../config/env.js';
import { completeJson } from '../llm/index.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ module: 'matcher' });

const evaluacionSchema = z.object({
  compatibilidad: z.number().int().min(0).max(100),
  elegible: z.boolean(),
  razones: z.array(z.string().min(4).max(200)).min(1).max(5),
  brechas: z.array(z.string().min(3).max(200)).max(5).default([])
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

En "razones" devolve entre 1 y 3 motivos concretos, uno por elemento, en segunda
persona y en espanol rioplatense neutro. Cada razon es una frase corta que
menciona un requisito concreto de la convocatoria y por que el perfil lo cumple
o no. Nada de generalidades como "es una buena oportunidad".

En "brechas" devolve lo que le falta a la persona para poder postular, uno por
elemento y accionable — "certificado de ingles B1", no "mejorar el ingles". Si
no le falta nada, devolve una lista vacia.

Nunca inventes requisitos que no esten en la convocatoria.

Responde solo con JSON.`;

/**
 * Evalua un par (perfil, oportunidad) usando Ollama.
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
  return evaluarConOllama(perfil, oportunidad, perspectiva);
}

async function evaluarConOllama(perfil, oportunidad, perspectiva) {
  const prompt = [
    'PERFIL DE LA PERSONA',
    `Objetivo: ${perfil.objetivo ?? perfil.objetivos?.[0] ?? 'sin especificar'}`,
    `Objetivos: ${(perfil.objetivos ?? []).join(', ') || 'sin especificar'}`,
    `Carrera: ${perfil.carrera}`,
    `Nivel de estudios: ${perfil.nivelEstudios}`,
    `Ubicacion: ${perfil.ubicacion}`,
    `Experiencia: ${(perfil.experiencia ?? []).join(', ') || 'sin especificar'}`,
    `Habilidades: ${(perfil.habilidades ?? []).map((h) => String(h).replace(/_/g, ' ')).join(', ') || 'sin especificar'}`,
    `Intereses: ${(perfil.intereses ?? []).join(', ') || 'sin especificar'}`,
    `Restricciones: ${(perfil.restricciones ?? []).join(', ') || 'ninguna'}`,
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
      ? 'Escribi "razones" dirigidas a la organizacion que busca al candidato.'
      : 'Escribi "razones" dirigidas a la persona, tratandola de vos.',
    '',
    'Devolve JSON con esta forma exacta:',
    '{"compatibilidad":0,"elegible":false,"razones":[""],"brechas":[""]}'
  ].filter(Boolean).join('\n');

  const resultado = await completeJson({
    system: SISTEMA,
    prompt,
    schema: evaluacionSchema,
    temperature: 0.2,
    timeoutMs: env.LLM_TIMEOUT_MS
  });

  return {
    compatibilidad: resultado.compatibilidad,
    elegible: resultado.elegible,
    razones: resultado.razones.map((razon) => razon.trim()),
    brechas: resultado.brechas.map((brecha) => brecha.trim())
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
    log.warn('Evaluacion Ollama fallida', {
      oportunidad: oportunidad.id ?? oportunidad.titulo,
      error: error.message
    });
    return null;
  }
}

function formatearIdiomas(idiomas) {
  if (!Array.isArray(idiomas) || idiomas.length === 0) return 'sin especificar';
  return idiomas.map((i) => `${i.idioma} (${i.nivel})`).join(', ');
}
