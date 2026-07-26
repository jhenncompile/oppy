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
 * Con OPPY_API_URL: solo Modal/LoRA. Sin URL (solo local): Ollama.
 *
 * Nunca lanza: un documento ilegible no puede tumbar la corrida.
 *
 * @param {object} documento
 * @param {{ categorias?: string[], timeoutMs?: number }} [opciones]
 */
export async function normalizar(documento, opciones = {}) {
  if (env.features.oppy) {
    const desdeOppy = await normalizarConOppy(documento);
    const filtradas = filtrarPorCategorias(desdeOppy, opciones.categorias);
    if (desdeOppy.length > 0 && filtradas.length === 0) {
      log.info('Oppy extrajo fuera de categoria; se descarta', {
        url: documento.url,
        categorias: opciones.categorias,
        obtenidas: desdeOppy.map((o) => o.categoria)
      });
    }
    return filtradas;
  }

  if (!env.features.ollama) {
    log.warn('Sin Oppy ni Ollama: no se puede normalizar', { url: documento.url });
    return [];
  }

  const lotes = await normalizarConOllama(documento, opciones);
  return filtrarPorCategorias(lotes, opciones.categorias);
}

function filtrarPorCategorias(oportunidades, categorias) {
  if (!categorias?.length) return oportunidades;
  const permitidas = new Set(categorias);
  return oportunidades.filter((o) => permitidas.has(o.categoria));
}

async function normalizarConOppy(documento) {
  const texto = [
    documento.titulo ? `Titulo: ${documento.titulo}` : null,
    `URL: ${documento.url}`,
    documento.texto.slice(0, 4000)
  ].filter(Boolean).join('\n\n');

  try {
    // Secuencial: en Modal una sola GPU; Promise.all dispara extract+classify
    // a la vez y el proxy cancela uno con 408 "Missing request...".
    const extracted = await oppyClient.extract(texto);
    if (!extracted) {
      log.warn('Oppy extract vacio', { url: documento.url });
      return [];
    }

    let classified = null;
    if (!extracted.type && !extracted.categoria) {
      classified = await oppyClient.classify(texto);
    }

    const cruda = extraccionACruda(extracted, classified);
    if (!cruda) {
      log.warn('Oppy extract no mapeable a dominio', {
        url: documento.url,
        keys: Object.keys(extracted)
      });
      return [];
    }

    const validada = oportunidadSchema.safeParse(cruda);
    if (!validada.success) {
      log.warn('Extraccion Oppy no paso el schema', {
        url: documento.url,
        error: validada.error.message,
        cruda
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
    log.warn('No se pudo normalizar el documento con Ollama', {
      url: documento.url,
      error: error.message
    });
    return [];
  }

  return resultado.oportunidades
    .map((cruda) => aDominio(cruda, documento))
    .filter(Boolean);
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
    documento.texto.slice(0, 2500),
    '',
    'Devolve un objeto JSON con esta forma exacta:',
    '{"oportunidades":[{"titulo":"","categoria":"beca|pasantia|empleo|intercambio|concurso|financiamiento|curso","descripcion":null,"elegibilidad":null,"monto_beneficio":null,"skills":[],"fecha_limite":null,"link_aplicacion":null}]}'
  ].filter(Boolean).join('\n');
}

function aDominio(cruda, documento) {
  let fechaLimite = normalizarFecha(cruda.fecha_limite);
  // Si el modelo inventa una fecha ya pasada, no la usamos como vigente.
  if (fechaLimite && !fechaEsFuturaOHoy(fechaLimite)) {
    fechaLimite = null;
  }
  if (!fechaLimite) {
    fechaLimite = extraerFechaDelTexto(
      [documento.titulo, documento.texto?.slice(0, 3500)].filter(Boolean).join('\n')
    );
  }

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

function fechaEsFuturaOHoy(iso) {
  const fecha = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(fecha.getTime())) return false;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return fecha >= hoy;
}

const MESES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12
};

/**
 * Oppy LoRA a menudo omite `deadline`. Si la pagina trae una fecha futura
 * legible, la usamos para el calendario y recordatorios.
 */
export function extraerFechaDelTexto(texto) {
  if (!texto || typeof texto !== 'string') return null;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const candidatas = [];

  for (const match of texto.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)) {
    candidatas.push(`${match[1]}-${match[2]}-${match[3]}`);
  }

  for (const match of texto.matchAll(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2})\b/g)) {
    const d = Number(match[1]);
    const m = Number(match[2]);
    const y = match[3];
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      candidatas.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
  }

  for (const match of texto.matchAll(
    /\b(\d{1,2})\s+de\s+([A-Za-záéíóúñ]+)\s+(?:de\s+)?(20\d{2})\b/gi
  )) {
    const mes = MESES[match[2].toLowerCase()];
    if (!mes) continue;
    const d = Number(match[1]);
    candidatas.push(
      `${match[3]}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    );
  }

  const futuras = candidatas
    .map((iso) => normalizarFecha(iso))
    .filter(Boolean)
    .filter((iso) => {
      const f = new Date(`${iso}T12:00:00`);
      return !Number.isNaN(f.getTime()) && f >= hoy;
    })
    .sort();

  return futuras[0] ?? null;
}
