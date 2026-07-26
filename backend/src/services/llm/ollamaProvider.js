import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

/**
 * Adaptador de Ollama. Es el unico archivo que sabe como habla Ollama;
 * cambiar de proveedor significa escribir otro archivo como este, no tocar
 * el resto del sistema.
 */
export const ollamaProvider = {
  name: 'ollama',

  async complete({ system, prompt, json = false, temperature = 0.2 }) {
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    let response;
    try {
      response = await fetch(`${env.OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: env.OLLAMA_MODEL,
          messages,
          stream: false,
          format: json ? 'json' : undefined,
          options: { temperature }
        }),
        signal: AbortSignal.timeout(env.LLM_TIMEOUT_MS)
      });
    } catch (error) {
      const motivo = error.name === 'TimeoutError'
        ? `el modelo no respondio en ${env.LLM_TIMEOUT_MS} ms`
        : error.message;
      throw AppError.unavailable(`No se pudo contactar a Ollama: ${motivo}`);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw AppError.unavailable(
        `Ollama respondio ${response.status}`,
        { body: body.slice(0, 500) }
      );
    }

    const payload = await response.json();
    const content = payload?.message?.content;

    if (typeof content !== 'string' || content.length === 0) {
      throw AppError.unavailable('Ollama devolvio una respuesta vacia');
    }

    return content;
  }
};
