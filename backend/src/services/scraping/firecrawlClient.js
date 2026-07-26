import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { fetchConReintentos, motivoFetch } from '../../utils/fetchConReintentos.js';

const log = logger.child({ module: 'firecrawl' });
const ENDPOINT = 'https://api.firecrawl.dev/v1/scrape';

/**
 * Extraccion estructurada de una pagina conocida. Devuelve markdown limpio,
 * que es mucho mas barato de razonar para el LLM que HTML crudo.
 *
 * Igual que el cliente de busqueda: nunca lanza. La degradacion es parcial,
 * no total.
 */
export async function extraer(url) {
  if (!env.features.firecrawl) {
    log.warn('FIRECRAWL_API_KEY ausente, se omite la extraccion', { url });
    return null;
  }

  try {
    const response = await fetchConReintentos(
      ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.FIRECRAWL_API_KEY}`
        },
        body: JSON.stringify({
          url,
          formats: ['markdown'],
          onlyMainContent: true
        }),
        signal: AbortSignal.timeout(45_000)
      },
      { intentos: 3, esperaMs: 900 }
    );

    if (!response.ok) {
      log.warn('Firecrawl respondio con error', { status: response.status, url });
      return null;
    }

    const payload = await response.json();
    const markdown = payload?.data?.markdown;

    if (!markdown) {
      log.warn('Firecrawl no devolvio contenido', { url });
      return null;
    }

    return {
      url,
      titulo: payload?.data?.metadata?.title ?? '',
      texto: markdown.slice(0, 12_000),
      publicadoEn: null
    };
  } catch (error) {
    log.warn('Extraccion fallida', { url, error: motivoFetch(error) });
    return null;
  }
}
