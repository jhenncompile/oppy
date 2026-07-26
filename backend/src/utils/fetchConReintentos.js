/**
 * fetch con reintentos. Exa/Firecrawl a veces tiran `fetch failed`
 * (AggregateError de undici) bajo rafagas concurrentes; un reintento corto
 * recupera la mayoria sin tumbar la corrida.
 */
export async function fetchConReintentos(url, opciones = {}, {
  intentos = 3,
  esperaMs = 800
} = {}) {
  let ultimoError;

  for (let i = 0; i < intentos; i += 1) {
    try {
      return await fetch(url, opciones);
    } catch (error) {
      ultimoError = error;
      if (i === intentos - 1) break;
      await new Promise((r) => setTimeout(r, esperaMs * (i + 1)));
    }
  }

  throw ultimoError;
}

/** Mensaje util para logs: undici esconde el motivo en `cause`. */
export function motivoFetch(error) {
  if (!error) return 'error desconocido';
  const causa = error.cause;
  if (causa?.code) return `${error.message} (${causa.code})`;
  if (causa?.errors?.length) {
    const codigos = causa.errors.map((e) => e.code || e.message).join(', ');
    return `${error.message} [${codigos}]`;
  }
  if (causa?.message) return `${error.message}: ${causa.message}`;
  return error.message;
}
