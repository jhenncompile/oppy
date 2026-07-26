import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ module: 'exa' });
const ENDPOINT = 'https://api.exa.ai/search';

/**
 * Busqueda semantica. Encuentra convocatorias que no se indexan bien por
 * palabra clave — que es exactamente el caso de las fuentes bolivianas.
 *
 * Nunca lanza: una fuente caida no puede tumbar la corrida completa. Devuelve
 * lista vacia y lo registra.
 */
export async function buscar(query, { dominios = null, resultados = env.EXA_RESULTS_PER_QUERY } = {}) {
  if (!env.features.exa) {
    log.warn('EXA_API_KEY ausente, se omite la busqueda semantica');
    return [];
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.EXA_API_KEY
      },
      body: JSON.stringify({
        query,
        numResults: resultados,
        type: 'auto',
        includeDomains: dominios ?? undefined,
        contents: { text: { maxCharacters: 4000 } }
      }),
      signal: AbortSignal.timeout(30_000)
    });

    if (!response.ok) {
      log.warn('Exa respondio con error', { status: response.status, query });
      return [];
    }

    const payload = await response.json();

    return (payload.results ?? [])
      .filter((item) => item.url)
      .map((item) => ({
        url: item.url,
        titulo: item.title ?? '',
        texto: item.text ?? '',
        publicadoEn: item.publishedDate ?? null,
        origenBusqueda: query
      }));
  } catch (error) {
    log.warn('Busqueda semantica fallida', { query, error: error.message });
    return [];
  }
}
