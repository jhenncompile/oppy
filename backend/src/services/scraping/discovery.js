import { buscar } from './exaClient.js';
import { extraer } from './firecrawlClient.js';
import { ESTRATEGIAS, fuentesPorEstrategia } from './sources.js';
import { mapExitosos } from '../../utils/concurrency.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ module: 'discovery' });

/** Sin tope, 8–12 fetches Exa a la vez suelen terminar en `fetch failed`. */
const CONCURRENCIA_EXA = 2;
const CONCURRENCIA_SCRAPE = 2;

/**
 * Recolecta documentos crudos de todas las fuentes, con concurrencia limitada.
 *
 * Se usa allSettled/mapExitosos a proposito: una fuente que falla no puede
 * tumbar la corrida. La degradacion tiene que ser parcial — en una demo en
 * vivo, que tres de cinco fuentes respondan es un exito, no un error.
 *
 * @param {object} plan             Plan del orquestador
 * @param {string[]} plan.queries   Busquedas semanticas generadas para el perfil
 * @param {string[]} plan.categorias Categorias de interes
 * @param {(paso: object) => void} [onPaso] Notificacion de progreso en vivo
 */
export async function descubrir({ queries, categorias }, onPaso = () => {}) {
  const paraScrapear = fuentesPorEstrategia(ESTRATEGIAS.SCRAPE, { categorias });
  const paraBuscar = fuentesPorEstrategia(ESTRATEGIAS.BUSQUEDA, { categorias });
  // Menos queries × menos resultados = menos paginas a normalizar (el cuello
  // de botella es Ollama, no Exa).
  const queriesEfectivas = queries.slice(0, 2);
  const busquedas = [...combinacionesDeBusqueda(paraBuscar, queriesEfectivas).values()];
  const resultadosPorQuery = Math.min(env.EXA_RESULTS_PER_QUERY, 4);

  const scrapes = await mapExitosos(paraScrapear, CONCURRENCIA_SCRAPE, async (fuente) => {
    onPaso({ tipo: 'fuente_inicio', fuente: fuente.nombre });
    const documento = await extraer(fuente.url);
    onPaso({
      tipo: 'fuente_fin',
      fuente: fuente.nombre,
      exito: Boolean(documento)
    });
    return documento ? [{ ...documento, fuente }] : [];
  });

  const resultadosBusqueda = await mapExitosos(busquedas, CONCURRENCIA_EXA, async (busqueda) => {
    const { query, dominios, fuente } = busqueda;
    onPaso({ tipo: 'busqueda_inicio', query });
    const resultados = await buscar(query, { dominios, resultados: resultadosPorQuery });
    onPaso({ tipo: 'busqueda_fin', query, encontrados: resultados.length });
    return resultados.map((documento) => ({ ...documento, fuente }));
  });

  const documentos = [...scrapes.flat(), ...resultadosBusqueda.flat()];
  const unicos = deduplicarPorUrl(documentos);

  log.info('Descubrimiento completado', {
    documentos: unicos.length,
    scrapes: paraScrapear.length,
    busquedas: busquedas.length
  });

  return unicos;
}

/**
 * Combinaciones unicas de (query, alcance de dominios).
 *
 * La clave incluye los dominios porque buscar "becas STEM" restringido a
 * `.edu.bo` y buscarlo sin restriccion son dos busquedas distintas y ambas
 * valen. Lo que no vale es repetir la identica dos veces.
 */
export function combinacionesDeBusqueda(fuentes, queries) {
  const unicas = new Map();

  for (const fuente of fuentes) {
    const dominios = fuente.dominiosPreferidos ?? null;
    const alcance = dominios ? [...dominios].sort().join(',') : 'todos';

    for (const query of queries) {
      const clave = `${alcance}::${query}`;
      if (!unicas.has(clave)) unicas.set(clave, { query, dominios, fuente });
    }
  }

  return unicas;
}

/** Dos fuentes pueden apuntar a la misma pagina; se procesa una sola vez. */
function deduplicarPorUrl(documentos) {
  const vistos = new Map();
  for (const documento of documentos) {
    if (!vistos.has(documento.url)) vistos.set(documento.url, documento);
  }
  return [...vistos.values()];
}
