import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client.js';

const AccesoContexto = createContext(null);

/**
 * Acceso por codigo, sin clave.
 *
 * El backend todavia no existe (ver docs/12-auth.md). Este proveedor pregunta
 * una sola vez si la capacidad esta disponible y, si no lo esta, deja todo
 * apagado: la interfaz no muestra nada relacionado con acceso y el producto
 * sigue funcionando exactamente igual que hoy.
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
