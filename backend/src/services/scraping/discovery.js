import { buscar } from './exaClient.js';
import { extraer } from './firecrawlClient.js';
import { ESTRATEGIAS, fuentesPorEstrategia } from './sources.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ module: 'discovery' });

/**
 * Recolecta documentos crudos de todas las fuentes, en paralelo.
 *
 * Se usa allSettled a proposito: una fuente que falla no puede tumbar la
 * corrida. La degradacion tiene que ser parcial — en una demo en vivo, que
 * tres de cinco fuentes respondan es un exito, no un error.
 *
 * @param {object} plan             Plan del orquestador
 * @param {string[]} plan.queries   Busquedas semanticas generadas para el perfil
 * @param {string[]} plan.categorias Categorias de interes
 * @param {(paso: object) => void} [onPaso] Notificacion de progreso en vivo
 */
export async function descubrir({ queries, categorias }, onPaso = () => {}) {
  const paraScrapear = fuentesPorEstrategia(ESTRATEGIAS.SCRAPE, { categorias });
  const paraBuscar = fuentesPorEstrategia(ESTRATEGIAS.BUSQUEDA, { categorias });

  const tareas = [];

  for (const fuente of paraScrapear) {
    tareas.push(
      (async () => {
        onPaso({ tipo: 'fuente_inicio', fuente: fuente.nombre });
        const documento = await extraer(fuente.url);
        onPaso({
          tipo: 'fuente_fin',
          fuente: fuente.nombre,
          exito: Boolean(documento)
        });
        return documento ? [{ ...documento, fuente }] : [];
      })()
    );
  }

  // Varias fuentes de busqueda pueden compartir el mismo alcance de dominios.
  // Sin deduplicar, la misma query se pagaria una vez por fuente coincidente:
  // con 3 queries y 3 fuentes serian 9 llamadas para 3 busquedas distintas.
  for (const [, busqueda] of combinacionesDeBusqueda(paraBuscar, queries)) {
    tareas.push(
      (async () => {
        const { query, dominios, fuente } = busqueda;
        onPaso({ tipo: 'busqueda_inicio', query });
        const resultados = await buscar(query, { dominios });
        onPaso({ tipo: 'busqueda_fin', query, encontrados: resultados.length });
        return resultados.map((documento) => ({ ...documento, fuente }));
      })()
    );
  }

  const resultados = await Promise.allSettled(tareas);

  const documentos = [];
  let fallidas = 0;

  for (const resultado of resultados) {
    if (resultado.status === 'fulfilled') documentos.push(...resultado.value);
    else fallidas += 1;
  }

  if (fallidas > 0) {
    log.warn('Algunas fuentes fallaron', { fallidas, total: tareas.length });
  }

  const unicos = deduplicarPorUrl(documentos);

  log.info('Descubrimiento completado', {
    documentos: unicos.length,
    tareas: tareas.length,
    fallidas
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
