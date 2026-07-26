import { z } from 'zod';
import { env } from '../../config/env.js';
import { completeJson } from '../llm/index.js';
import * as oppyClient from '../llm/oppyClient.js';
import { perfilAOppy, oportunidadAOppy, matchingAEvaluacion } from '../llm/oppyAdapter.js';
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
 * Evalua un par (perfil, oportunidad).
 * Con OPPY_API_URL: solo Modal/LoRA (cualquier perspectiva). Sin URL: Ollama.
 */
export async function evaluar(perfil, oportunidad, { perspectiva = 'persona' } = {}) {
  if (env.features.oppy) {
    const desdeOppy = await evaluarConOppy(perfil, oportunidad);
    if (desdeOppy) return desdeOppy;
    log.warn('Matching Oppy sin resultado', { oportunidadId: oportunidad.id });
    return null;
  }

  if (!env.features.ollama) {
    log.warn('Sin Oppy ni Ollama: no se puede evaluar', {
      oportunidadId: oportunidad.id
    });
    return null;
  }

  return evaluarConOllama(perfil, oportunidad, perspectiva);
}

async function evaluarConOppy(perfil, oportunidad) {
  const data = await oppyClient.match(
    perfilAOppy(perfil),
    oportunidadAOppy(oportunidad)
  );
  const evaluacion = matchingAEvaluacion(data);
  if (!evaluacion) return null;

  const ajustada = aplicarSenalesFeedback(evaluacion, perfil.feedback, oportunidad);

  const validada = evaluacionSchema.safeParse(ajustada);
  if (!validada.success) {
    log.warn('Matching Oppy no paso el schema', { error: validada.error.message });
    return null;
  }

  return {
    compatibilidad: validada.data.compatibilidad,
    elegible: validada.data.elegible,
    razones: validada.data.razones.map((razon) => razon.trim()),
    brechas: validada.data.brechas.map((brecha) => brecha.trim())
  };
}

/** Ajuste deterministico con senales de usuario (guardado / descartado). */
function aplicarSenalesFeedback(evaluacion, feedback, oportunidad) {
  if (!feedback) return evaluacion;

  let score = evaluacion.compatibilidad;
  const razones = [...evaluacion.razones];
  const cat = oportunidad.categoria;

  if (feedback.categoriasEvitadas?.includes(cat)) {
    score = Math.max(0, score - 25);
    razones.push('Ajustado: descartaste oportunidades similares antes');
  }
  if (feedback.categoriasPreferidas?.includes(cat)) {
    score = Math.min(100, score + 8);
  }

  const skillsOpp = new Set((oportunidad.skills ?? []).map((s) => s.toLowerCase()));
  const overlap = (feedback.skillsPreferidas ?? []).filter((s) =>
    skillsOpp.has(String(s).toLowerCase())
  );
  if (overlap.length > 0) {
    score = Math.min(100, score + Math.min(12, overlap.length * 4));
  }

  return {
    ...evaluacion,
    compatibilidad: score,
    elegible: evaluacion.elegible && score >= 30,
    razones: razones.slice(0, 5)
  };
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
