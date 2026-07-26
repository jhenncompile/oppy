import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client.js';

const CLAVE = 'oppy.userId';

const PerfilContexto = createContext(null);

/**
 * El perfil de la persona, disponible en toda la app.
 *
 * El id vive en localStorage y es toda la "sesion" que existe: Oppy no pide
 * cuenta ni contrasenia, porque cada paso extra antes de ver el valor es gente
 * que abandona. Al volver a entrar, el perfil se recupera solo.
 *
 * Si el id guardado ya no existe en el servidor — base recreada, perfil
 * borrado — se limpia en vez de dejar la app en un estado roto.
 */
export function ProveedorPerfil({ children }) {
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const guardado = localStorage.getItem(CLAVE);
    if (!guardado) {
      setCargando(false);
      return;
    }

    api
      .obtenerPerfil(guardado)
      .then(({ perfil: recuperado }) => setPerfil(recuperado))
      .catch(() => localStorage.removeItem(CLAVE))
      .finally(() => setCargando(false));
  }, []);

  const guardar = useCallback((nuevo) => {
    localStorage.setItem(CLAVE, nuevo.id);
    setPerfil(nuevo);
  }, []);

  const olvidar = useCallback(() => {
    localStorage.removeItem(CLAVE);
    setPerfil(null);
  }, []);

  return (
    <PerfilContexto.Provider value={{ perfil, cargando, guardar, olvidar }}>
      {children}
    </PerfilContexto.Provider>
  );
}

export function usePerfil() {
  const contexto = useContext(PerfilContexto);
  if (!contexto) throw new Error('usePerfil necesita estar dentro de ProveedorPerfil');
  return contexto;
}
