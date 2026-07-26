import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { AppError } from '../../utils/AppError.js';
import { ollamaProvider } from './ollamaProvider.js';

const log = logger.child({ module: 'llm' });

const providers = {
  ollama: ollamaProvider
};

const provider = providers[env.LLM_PROVIDER];

if (!provider) {
  throw new Error(`Proveedor de LLM desconocido: ${env.LLM_PROVIDER}`);
}

function asegurarOllamaPermitido() {
  if (env.features.oppy) {
    throw AppError.unavailable(
      'Ollama deshabilitado: OPPY_API_URL activo; usar solo el agente Modal'
    );
  }
}

/** Texto libre. Rara vez es lo que queremos: preferir completeJson. */
export async function complete(options) {
  asegurarOllamaPermitido();
  const startedAt = Date.now();
  const text = await provider.complete(options);
  log.debug('Completion', { provider: provider.name, ms: Date.now() - startedAt });
  return text;
}

/**
 * Salida estructurada y validada.
 *
 * Un modelo puede devolver JSON sintacticamente valido pero semanticamente
 * equivocado. El schema de Zod es la frontera: lo que no lo cruza, no entra
 * al sistema. Ante un fallo se reintenta una vez devolviendole el error al
 * modelo, que es lo que suele bastar.
 *
 * Con OPPY_API_URL activo esta API no se usa: el producto va por Modal.
 */
export async function completeJson({
  system,
  prompt,
  schema,
  temperature = 0.2,
  timeoutMs
}) {
  asegurarOllamaPermitido();
  const intentar = async (promptEfectivo) => {
    const raw = await provider.complete({
      system,
      prompt: promptEfectivo,
      json: true,
      temperature,
      timeoutMs
    });
    return schema.parse(extraerJson(raw));
  };

  try {
    return await intentar(prompt);
  } catch (error) {
    if (error instanceof AppError) throw error;

    log.warn('Salida del modelo invalida, reintentando', { error: error.message });

    const promptCorregido = [
      prompt,
      '',
      'Tu respuesta anterior fue rechazada por este motivo:',
      error.message,
      '',
      'Devolve unicamente JSON valido que respete exactamente el formato pedido.'
    ].join('\n');

    try {
      return await intentar(promptCorregido);
    } catch (segundoError) {
      if (segundoError instanceof AppError) throw segundoError;
      throw AppError.unavailable(
        'El modelo no produjo una respuesta con el formato esperado',
        { motivo: segundoError.message }
      );
    }
  }
}

/**
 * Los modelos suelen envolver el JSON en prosa o en un bloque de codigo,
 * incluso cuando se les pide lo contrario. Se rescata el objeto.
 */
export function extraerJson(raw) {
  const texto = raw.trim();

  try {
    return JSON.parse(texto);
  } catch {
    const inicio = texto.indexOf('{');
    const fin = texto.lastIndexOf('}');
    if (inicio === -1 || fin <= inicio) {
      throw new Error('La respuesta no contiene un objeto JSON');
    }
    return JSON.parse(texto.slice(inicio, fin + 1));
  }
}
