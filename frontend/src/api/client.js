// En dev, sin VITE_API_URL (o vacio), usamos /api para que Vite haga proxy.
// Ojo: `??` no trata "" como ausente — por eso el `||`.
const BASE = import.meta.env.VITE_API_URL || '/api';

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

  obtenerPerfil: (userId) => pedir(`/profiles/${userId}`),

  // --- Acceso por codigo. Contrato en docs/12-auth.md. -------------------
  // Mientras el backend no exista, `estadoAcceso` devuelve 404 y la interfaz
  // esconde la funcionalidad sola.
  estadoAcceso: () => pedir('/auth/estado'),

  pedirCodigoAcceso: (contacto) =>
    pedir('/auth/codigo', { method: 'POST', body: JSON.stringify({ contacto }) }),

  canjearCodigoAcceso: (contacto, codigo) =>
    pedir('/auth/sesion', { method: 'POST', body: JSON.stringify({ contacto, codigo }) }),

  obtenerOportunidad: (id) => pedir(`/opportunities/${id}`),

  dispararAgente: (userId) =>
    pedir('/agent/run', { method: 'POST', body: JSON.stringify({ userId }) }),

  obtenerMatches: (userId, { minScore = 30, limit = 20 } = {}) =>
    pedir(`/matches?userId=${userId}&minScore=${minScore}&limit=${limit}`),

  actualizarMatch: (matchId, estadoOPayload, extra = {}) => {
    const cuerpo = typeof estadoOPayload === 'string'
      ? { estado: estadoOPayload, ...extra }
      : estadoOPayload;
    return pedir(`/matches/${matchId}`, {
      method: 'PATCH',
      body: JSON.stringify(cuerpo)
    });
  },

  /** Contacto para avisos y para recuperar el acceso: el mismo dato, un permiso. */
  actualizarContacto: (userId, contacto) =>
    pedir(`/profiles/${userId}/contacto`, {
      method: 'PATCH',
      body: JSON.stringify(contacto)
    }),

  actualizarVisibilidad: (userId, visibleParaEmpresas) =>
    pedir(`/profiles/${userId}/visibilidad`, {
      method: 'PATCH',
      body: JSON.stringify({ visibleParaEmpresas })
    }),

  // --- La libreta propia: lo que la persona encontro por su cuenta. --------
  // Privada y aparte del indice compartido, asi que todas las operaciones
  // llevan el userId: sin auth, es lo unico que ata una libreta a su dueña.
  obtenerPropias: (userId) => pedir(`/propias?userId=${userId}`),

  crearPropia: (propia) =>
    pedir('/propias', { method: 'POST', body: JSON.stringify(propia) }),

  actualizarPropia: (id, userId, estado) =>
    pedir(`/propias/${id}`, { method: 'PATCH', body: JSON.stringify({ userId, estado }) }),

  eliminarPropia: (id, userId) =>
    pedir(`/propias/${id}?userId=${userId}`, { method: 'DELETE' }),

  /** Telemetria: nunca debe romper la interfaz si falla. */
  registrarEvento: (evento) =>
    pedir('/events', { method: 'POST', body: JSON.stringify(evento) }).catch(() => null),

  urlStream: (runId) => `${BASE}/agent/runs/${runId}/stream`
};
