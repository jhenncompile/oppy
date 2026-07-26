const BASE = import.meta.env.VITE_API_URL ?? '/api';

async function pedir(ruta, opciones = {}) {
  const respuesta = await fetch(`${BASE}${ruta}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opciones
  });

  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => null);
    throw new Error(cuerpo?.error?.message ?? `Error ${respuesta.status}`);
  }

  return respuesta.status === 202 && respuesta.headers.get('content-length') === '0'
    ? null
    : respuesta.json().catch(() => null);
}

export const api = {
  crearPerfil: (perfil) =>
    pedir('/profiles', { method: 'POST', body: JSON.stringify(perfil) }),

  dispararAgente: (userId) =>
    pedir('/agent/run', { method: 'POST', body: JSON.stringify({ userId }) }),

  obtenerMatches: (userId, { minScore = 0, limit = 20 } = {}) =>
    pedir(`/matches?userId=${userId}&minScore=${minScore}&limit=${limit}`),

  actualizarMatch: (matchId, estado) =>
    pedir(`/matches/${matchId}`, { method: 'PATCH', body: JSON.stringify({ estado }) }),

  /** Telemetria: nunca debe romper la interfaz si falla. */
  registrarEvento: (evento) =>
    pedir('/events', { method: 'POST', body: JSON.stringify(evento) }).catch(() => null),

  urlStream: (runId) => `${BASE}/agent/runs/${runId}/stream`
};
