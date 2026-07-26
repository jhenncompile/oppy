import { createHash } from 'node:crypto';
import { z } from 'zod';
import { completeJson } from '../llm/index.js';
import { clasificar, hostnameDe } from '../scoring/trust.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ module: 'normalizer' });

export const CATEGORIAS = [
  'beca', 'pasantia', 'empleo', 'intercambio',
  'concurso', 'financiamiento', 'curso',
  'voluntariado', 'evento', 'programa_social'
];

const oportunidadSchema = z.object({
  titulo: z.string().min(3).max(300),
  categoria: z.enum(CATEGORIAS),
  descripcion: z.string().max(1200).nullish(),
  elegibilidad: z.string().max(800).nullish(),
  monto_beneficio: z.string().max(300).nullish(),
  // Se extrae siempre: habilita el producto de inteligencia de oportunidades
  // sin tener que reprocesar el historico mas adelante.
  skills: z.array(z.string().max(60)).max(15).default([]),
  fecha_limite: z.string().nullish(),
  link_aplicacion: z.string().nullish()
});

const respuestaSchema = z.object({
  oportunidades: z.array(oportunidadSchema).max(8)
});

const SISTEMA = `Sos un extractor de convocatorias para Bolivia y Latinoamerica.
Tu tarea es leer el contenido de una pagina y extraer UNICAMENTE oportunidades
reales y concretas: becas, pasantias, empleos, intercambios, concursos,
financiamiento o cursos.

Reglas estrictas:
- No inventes datos. Si un campo no aparece en el texto, devolvelo como null.
- Si la pagina no contiene ninguna convocatoria concreta, devolve una lista vacia.
- fecha_limite debe ser formato YYYY-MM-DD, o null si no figura explicitamente.
- skills debe listar habilidades, requisitos o areas de estudio mencionados
  (ej: "ingles B2", "carrera STEM", "Excel", "4to anio").
- Responde solo con JSON.`;

/**
 * Convierte un documento crudo en oportunidades normalizadas.
 *
 * Nunca lanza: un documento ilegible no puede tumbar la corrida.
 */
export async function normalizar(documento) {
  const prompt = construirPrompt(documento);

  let resultado;
  try {
    resultado = await completeJson({
      system: SISTEMA,
      prompt,
      schema: respuestaSchema,
      temperature: 0.1
    });
  } catch (error) {
    log.warn('No se pudo normalizar el documento', {
      url: documento.url,
      error: error.message
    });
    return [];
  }

  return resultado.oportunidades
    .map((cruda) => aDominio(cruda, documento))
    .filter(Boolean);
}

function construirPrompt(documento) {
  return [
    `Fuente: ${documento.fuente.nombre}`,
    `URL: ${documento.url}`,
    documento.titulo ? `Titulo de la pagina: ${documento.titulo}` : null,
    '',
    'Contenido:',
    documento.texto.slice(0, 8000),
    '',
    'Devolve un objeto JSON con esta forma exacta:',
    '{"oportunidades":[{"titulo":"","categoria":"beca|pasantia|empleo|intercambio|concurso|financiamiento|curso","descripcion":null,"elegibilidad":null,"monto_beneficio":null,"skills":[],"fecha_limite":null,"link_aplicacion":null}]}'
  ].filter(Boolean).join('\n');
}

function aDominio(cruda, documento) {
  const fechaLimite = normalizarFecha(cruda.fecha_limite);

  return {
    titulo: cruda.titulo.trim(),
    categoria: cruda.categoria,
    descripcion: cruda.descripcion ?? null,
    elegibilidad: cruda.elegibilidad ?? null,
    montoBeneficio: cruda.monto_beneficio ?? null,
    skills: normalizarSkills(cruda.skills),
    fuente: { nombre: documento.fuente.nombre, url: documento.url },
    linkAplicacion: cruda.link_aplicacion ?? documento.url,
    fechaLimite,
    confianza: clasificar({ url: documento.url, fechaLimite }),
    origen: 'descubierta',
    hashDedupe: calcularHash(cruda.titulo, documento.url)
  };
}

/** Quita tildes y diacriticos para que el hash no dependa de la ortografia. */
function sinDiacriticos(texto) {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/**
 * Clave natural de deduplicacion: titulo normalizado + dominio. La misma
 * convocatoria replicada en dos paginas del mismo sitio entra una sola vez;
 * publicada por dos instituciones distintas, entra dos veces — que es
 * correcto, porque las condiciones pueden diferir.
 */
export function calcularHash(titulo, url) {
  const tituloNormalizado = sinDiacriticos(titulo.toLowerCase())
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  return createHash('sha256')
    .update(`${tituloNormalizado}|${hostnameDe(url) ?? url}`)
    .digest('hex');
}

function normalizarSkills(skills) {
  const unicos = new Set(
    skills
      .map((skill) => skill.trim().toLowerCase())
      .filter((skill) => skill.length > 1 && skill.length <= 60)
  );
  return [...unicos];
}

function normalizarFecha(valor) {
  if (!valor) return null;
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;
  return fecha.toISOString().slice(0, 10);
}
