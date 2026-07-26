import { createHash } from 'node:crypto';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { completeJson } from '../llm/index.js';
import * as oppyClient from '../llm/oppyClient.js';
import { extraccionACruda } from '../llm/oppyAdapter.js';
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
 *
 * @param {object} documento
 * @param {{ categorias?: string[], timeoutMs?: number }} [opciones]
 */
export async function normalizar(documento, opciones = {}) {
  if (env.features.oppy) {
    const desdeOppy = await normalizarConOppy(documento, opciones);
    if (desdeOppy.length > 0) return filtrarPorCategorias(desdeOppy, opciones.categorias);
  }

  const lotes = await normalizarConOllama(documento, opciones);
  if (lotes.length > 0) return filtrarPorCategorias(lotes, opciones.categorias);

  // Si Ollama timeout/falla, igual devolvemos algo usable a partir del titulo
  // y texto que ya trajo Exa/Firecrawl. Mejor una oferta basica que cero.
  const fallback = normalizarHeuristico(documento, opciones.categorias);
  return filtrarPorCategorias(fallback, opciones.categorias);
}

function filtrarPorCategorias(oportunidades, categorias) {
  if (!categorias?.length) return oportunidades;
  const permitidas = new Set(categorias);
  return oportunidades.filter((o) => permitidas.has(o.categoria));
}

async function normalizarConOppy(documento, opciones = {}) {
  const texto = [
    documento.titulo ? `Titulo: ${documento.titulo}` : null,
    `URL: ${documento.url}`,
    documento.texto.slice(0, 4000)
  ].filter(Boolean).join('\n\n');

  try {
    const [extracted, classified] = await Promise.all([
      oppyClient.extract(texto),
      oppyClient.classify(texto)
    ]);

    const cruda = extraccionACruda(extracted, classified);
    if (!cruda) return [];

    // Validamos contra el mismo schema que Ollama: lo que no cruza, no entra.
    const validada = oportunidadSchema.safeParse(cruda);
    if (!validada.success) {
      log.warn('Extraccion Oppy no paso el schema', {
        url: documento.url,
        error: validada.error.message
      });
      return [];
    }

    const dominio = aDominio(validada.data, documento);
    return dominio ? [dominio] : [];
  } catch (error) {
    log.warn('Normalizacion Oppy fallida', {
      url: documento.url,
      error: error.message
    });
    return [];
  }
}

async function normalizarConOllama(documento, opciones = {}) {
  const prompt = construirPrompt(documento, opciones.categorias);
  const timeoutMs = opciones.timeoutMs ?? env.NORMALIZE_TIMEOUT_MS;

  let resultado;
  try {
    resultado = await completeJson({
      system: SISTEMA,
      prompt,
      schema: respuestaSchema,
      temperature: 0.1,
      timeoutMs
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

/**
 * Extraccion minima sin LLM: titulo de la pagina + categoria del plan.
 * Sirve cuando Ollama no responde a tiempo en una laptop.
 */
export function normalizarHeuristico(documento, categorias = []) {
  const titulo = (documento.titulo ?? '').trim().replace(/\s+/g, ' ');
  if (titulo.length < 8) return [];

  // Listados genericos no son una oferta concreta.
  if (/^(ofertas?|empleos?|pasantias?|trabajos?|resultados)\b/i.test(titulo)) return [];
  if (/trabajo-de-pasantias|\/ofertas\/?$/i.test(documento.url ?? '')) return [];

  const texto = (documento.texto ?? '').trim();
  const categoria = inferirCategoria(titulo, texto, categorias);
  if (categorias?.length && !categorias.includes(categoria)) return [];

  const descripcion = texto
    ? texto.slice(0, 400).replace(/\s+/g, ' ').trim()
    : null;

  const dominio = aDominio(
    {
      titulo: titulo.slice(0, 300),
      categoria,
      descripcion,
      elegibilidad: null,
      monto_beneficio: null,
      skills: [],
      fecha_limite: null,
      link_aplicacion: documento.url
    },
    documento
  );

  if (dominio) {
    log.info('Normalizacion heuristica (sin LLM)', {
      url: documento.url,
      titulo: dominio.titulo,
      categoria: dominio.categoria
    });
  }

  return dominio ? [dominio] : [];
}

function inferirCategoria(titulo, texto, categorias) {
  const blob = `${titulo} ${texto}`.toLowerCase();
  if (/\bpasant[ií]a/.test(blob) && (!categorias?.length || categorias.includes('pasantia'))) {
    return 'pasantia';
  }
  if (/\bbecas?\b/.test(blob) && (!categorias?.length || categorias.includes('beca'))) {
    return 'beca';
  }
  if (categorias?.includes('empleo')) return 'empleo';
  return categorias?.[0] ?? 'empleo';
}

function construirPrompt(documento, categorias) {
  const foco = categorias?.length
    ? `Solo extrae oportunidades de estas categorias: ${categorias.join(', ')}. Ignora el resto.`
    : null;

  return [
    `Fuente: ${documento.fuente.nombre}`,
    `URL: ${documento.url}`,
    documento.titulo ? `Titulo de la pagina: ${documento.titulo}` : null,
    foco,
    '',
    'Contenido:',
    // Menos texto = respuesta mas rapida en CPU local.
    documento.texto.slice(0, 2500),
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
