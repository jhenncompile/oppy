import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client.js';

const AccesoContexto = createContext(null);

/**
 * Acceso por codigo, sin clave.
 *
 * El backend responde GET /auth/estado. Sin Zavu, en development el acceso
 * sigue disponible y el codigo se imprime en los logs (AUTH_DEV_LOG_CODE).
 *
 * Esa deteccion por 404 es a proposito. Un flag de entorno habria que
 * acordarlo, documentarlo y acordarse de encenderlo; el 404 se resuelve solo el
 * dia que el endpoint responda.
 */
export function ProveedorAcceso({ children }) {
  const [disponible, setDisponible] = useState(false);
  const [comprobando, setComprobando] = useState(true);

  useEffect(() => {
    let cancelado = false;

    api
      .estadoAcceso()
      .then((estado) => {
        if (!cancelado) setDisponible(Boolean(estado?.disponible));
      })
      .catch(() => {
        // 404 mientras el backend no exista, o red caida. En los dos casos la
        // respuesta correcta es la misma: no ofrecer algo que no funciona.
        if (!cancelado) setDisponible(false);
      })
      .finally(() => {
        if (!cancelado) setComprobando(false);
      });

    return () => { cancelado = true; };
  }, []);

  const pedirCodigo = useCallback((contacto) => api.pedirCodigoAcceso(contacto), []);
  const canjearCodigo = useCallback(
    (contacto, codigo) => api.canjearCodigoAcceso(contacto, codigo),
    []
  );

  return (
    <AccesoContexto.Provider value={{ disponible, comprobando, pedirCodigo, canjearCodigo }}>
      {children}
    </AccesoContexto.Provider>
  );
}

export function useAcceso() {
  const contexto = useContext(AccesoContexto);
  if (!contexto) throw new Error('useAcceso necesita estar dentro de ProveedorAcceso');
  return contexto;
}
