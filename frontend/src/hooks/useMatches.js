import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';

/** Dias que faltan para una fecha, o null. Compartido por varias vistas. */
export function diasRestantes(fechaLimite) {
  if (!fechaLimite) return null;

  const limite = new Date(fechaLimite);
  if (Number.isNaN(limite.getTime())) return null;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.ceil((limite - hoy) / 86_400_000);
}

export const CIERRA_PRONTO_DIAS = 7;

/**
 * Las recomendaciones de la persona, con el cambio de estado incluido.
 *
 * Vive arriba de las vistas porque la lista se comparte: el tablero, el
 * seguimiento y el calendario miran los mismos matches, y una accion en
 * cualquiera de los tres tiene que verse en los otros dos.
 */
export function useMatches(userId) {
  const [matches, setMatches] = useState([]);
  const [cargando, setCargando] = useState(Boolean(userId));
  const [error, setError] = useState(null);

  const recargar = useCallback(async () => {
    if (!userId) {
      setMatches([]);
      setCargando(false);
      return;
    }

    setCargando(true);
    try {
      const { matches: encontrados } = await api.obtenerMatches(userId, { limit: 50 });
      setMatches(encontrados);
      setError(null);
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setCargando(false);
    }
  }, [userId]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  /**
   * Optimista: la interfaz responde ya y si el servidor falla se revierte. En
   * una lista que se refresca sola, esperar la respuesta se siente como que el
   * click no hizo nada.
   */
  const cambiarEstado = useCallback(async (match, nuevoEstado) => {
    setMatches((previos) =>
      previos.map((m) => (m.id === match.id ? { ...m, estado: nuevoEstado } : m))
    );

    try {
      await api.actualizarMatch(match.id, nuevoEstado);
    } catch {
      setMatches((previos) =>
        previos.map((m) => (m.id === match.id ? { ...m, estado: match.estado } : m))
      );
    }
  }, []);

  return { matches, cargando, error, recargar, cambiarEstado, setMatches };
}

/** Las que ya estan en seguimiento, en cualquier etapa. */
export const enSeguimiento = (match) =>
  match.estado !== 'nuevo' && match.estado !== 'visto' && match.estado !== 'descartado';

/** Cuantas cierran dentro de la ventana de urgencia. */
export function contarCierranPronto(matches) {
  return matches.filter((match) => {
    if (!enSeguimiento(match)) return false;
    const dias = diasRestantes(match.oportunidad.fechaLimite);
    return dias !== null && dias >= 0 && dias <= CIERRA_PRONTO_DIAS;
  }).length;
}
