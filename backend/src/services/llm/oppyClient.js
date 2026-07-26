import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ module: 'oppy-api' });

/**
 * Cliente HTTP hacia la API LoRA de Oppy (Modal / serve_oppy_api.py).
 *
 * Si OPPY_API_URL no esta o el servicio cae, devolvemos null. El caller
 * decide el fallback: con Oppy activo el producto NO debe caer a Ollama.
 *
 * El header ngrok-skip-browser-warning evita la pagina interstitial del plan
 * free de ngrok, que rompe el JSON.
 */
async function post(path, body) {
  if (!env.features.oppy) return null;

  const url = `${env.OPPY_API_URL.replace(/\/$/, '')}${path}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Plan free de ngrok: sin esto (o User-Agent de browser) devuelve HTML.
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'oppy-backend/0.1'
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(env.LLM_TIMEOUT_MS)
    });

    if (!response.ok) {
      const texto = await response.text().catch(() => '');
      log.warn('Oppy API respondio con error', {
        path,
        status: response.status,
        body: texto.slice(0, 300)
      });
      return null;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      log.warn('Oppy API no devolvio JSON', { path, contentType });
      return null;
    }

    return await response.json();
  } catch (error) {
    const motivo = error.name === 'TimeoutError'
      ? `timeout ${env.LLM_TIMEOUT_MS} ms`
      : error.message;
    log.warn('No se pudo contactar Oppy API', { path, error: motivo });
    return null;
  }
}

/** @returns {Promise<object|null>} data parseada o null */
function dataDe(respuesta) {
  if (!respuesta || respuesta.data == null) return null;
  return respuesta.data;
}

export async function extract(text) {
  return dataDe(await post('/v1/extract', { text }));
}

export async function classify(text) {
  return dataDe(await post('/v1/classify', { text }));
}

export async function match(user, opportunity) {
  return dataDe(await post('/v1/match', { user, opportunity }));
}

export async function decide(payload) {
  return dataDe(await post('/v1/decide', payload));
}

export async function run(payload) {
  if (!env.features.oppy) return null;
  return post('/v1/run', payload);
}

export async function health() {
  if (!env.features.oppy) return null;

  const url = `${env.OPPY_API_URL.replace(/\/$/, '')}/health`;
  try {
    const response = await fetch(url, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'oppy-backend/0.1'
      },
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) return null;
    return await response.json();
  } catch (error) {
    log.warn('Oppy /health fallo', { error: error.message });
    return null;
  }
}
