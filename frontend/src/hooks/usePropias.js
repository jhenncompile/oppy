import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { diasRestantes, enSeguimiento } from './useMatches.js';

/**
 * La libreta propia: lo que la persona encontro por fuera de Oppy.
 *
 * Vive al lado de los matches y no mezclada con ellos, igual que en la base.
 * Una oportunidad anotada a mano no tiene compatibilidad, ni razones, ni
 * semaforo de confianza — Oppy no la vio nunca. Lo unico que comparte con un
 * match es el estado de seguimiento, y por eso las dos listas se muestran
 * juntas pero se guardan separadas.
 */
export function usePropias(userId) {
  const [propias, setPropias] = useState([]);
  const [cargando, setCargando] = useState(Boolean(userId));
  const [error, setError] = useState(null);

  const recargar = useCallback(async () => {
    if (!userId) {
      setPropias([]);
      setCargando(false);
      return;
    }

    setCargando(true);
    try {
      const { propias: encontradas } = await api.obtenerPropias(userId);
      setPropias(encontradas);
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

  const agregar = useCallback(
    async (datos) => {
      const { propia } = await api.crearPropia({ ...datos, userId });
      setPropias((previas) => [...previas, propia]);
      return propia;
    },
    [userId]
  );

  /** Optimista, igual que en los matches: esperar se siente como que no paso nada. */
  const cambiarEstado = useCallback(
    async (propia, nuevoEstado) => {
      setPropias((previas) =>
        previas.map((p) => (p.id === propia.id ? { ...p, estado: nuevoEstado } : p))
      );

      try {
        await api.actualizarPropia(propia.id, userId, nuevoEstado);
      } catch {
        setPropias((previas) =>
          previas.map((p) => (p.id === propia.id ? { ...p, estado: propia.estado } : p))
        );
      }
    },
    [userId]
  );

  const eliminar = useCallback(
    async (propia) => {
      const previas = propias;
      setPropias((actuales) => actuales.filter((p) => p.id !== propia.id));

      try {
        await api.eliminarPropia(propia.id, userId);
      } catch {
        setPropias(previas);
      }
    },
    [propias, userId]
  );

  return { propias, cargando, error, recargar, agregar, cambiarEstado, eliminar };
}

/** Sigue en juego: ni cerrada ni descartada. */
export const propiaActiva = (propia) =>
  propia.estado !== 'finalizada' && propia.estado !== 'descartado';

/**
 * Sigue siendo relevante para el calendario: la persona no la descarto y no
 * esta cerrada.
 *
 * Es a proposito MAS AMPLIO que `enSeguimiento`, y esa diferencia es la que
 * hacia que el calendario apareciera vacio: el agente deja sus recomendaciones
 * en estado 'nuevo', y `enSeguimiento` las excluye. Con eso, alguien que
 * acababa de correr el agente y tenia diez convocatorias con fecha veia
 * "no tienes fechas por delante" — que se lee como que la aplicacion no
 * funciona, no como que falta guardar algo.
 */
const vigenteParaCalendario = (match) =>
  match.estado !== 'descartado' && match.estado !== 'finalizada';

/**
 * Las tres fuentes en una sola lista con fecha, para el calendario y para los
 * avisos de "cierra pronto".
 *
 * Se normaliza aca y no en cada vista porque la diferencia entre las formas
 * — `match.oportunidad.fechaLimite` contra `propia.fechaLimite` — no le importa
 * a nadie del lado de la pantalla: lo que importa es que algo cierra un dia.
 *
 * Cada fila lleva `origen` para que quien la muestre pueda distinguir un
 * compromiso que la persona tomo de una recomendacion que todavia no miro. Son
 * cosas distintas y no deberian pesar igual.
 */
export function filasConFecha({ matches = [], propias = [] }) {
  // Incluye recomendaciones nuevas/vistas con fecha: el calendario sirve para
  // "que se me viene", no solo lo ya guardado en seguimiento.
  const deMatches = matches.filter(vigenteParaCalendario).map((match) => ({
    clave: `match-${match.id}`,
    titulo: match.oportunidad.titulo,
    subtitulo: match.oportunidad.fuente?.nombre ?? null,
    fechaLimite: match.oportunidad.fechaLimite,
    confianza: match.oportunidad.confianza,
    rutaDetalle: `/oportunidad/${match.id}`,
    enlace: null,
    propia: false,
    enSeguimiento: enSeguimiento(match)
  }));

  const deLibreta = propias.filter(propiaActiva).map((propia) => ({
    clave: `propia-${propia.id}`,
    titulo: propia.titulo,
    subtitulo: propia.organizacion ?? propia.donde ?? null,
    fechaLimite: propia.fechaLimite,
    confianza: null,
    rutaDetalle: null,
    enlace: propia.enlace,
    propia: true,
    // Lo que alguien se tomo el trabajo de anotar ya es una decision suya: no
    // hay estado "sugerida" posible en la libreta.
    enSeguimiento: true
  }));

  return [...deMatches, ...deLibreta]
    .map((fila) => ({ ...fila, dias: diasRestantes(fila.fechaLimite) }))
    .filter((fila) => fila.dias !== null && fila.dias >= 0)
    .sort((a, b) => {
      if (a.dias !== b.dias) return a.dias - b.dias;
      // A igual urgencia, primero lo que la persona ya eligio: una sugerencia
      // no puede empujar hacia abajo algo que ya decidio seguir.
      return Number(b.enSeguimiento) - Number(a.enSeguimiento);
    });
}

/**
 * Lo que de verdad amerita un aviso en la navegacion.
 *
 * Solo compromisos: lo que la persona guardo y lo que anoto. Una recomendacion
 * que todavia no miro no puede generar un numero rojo — eso seria apurarla por
 * algo que ni siquiera eligio.
 */
export const esCompromiso = (fila) => fila.enSeguimiento;

/** Hay oportunidades activas pero ninguna con fecha usable. */
export function sinFechasPeroConOportunidades({ matches = [], propias = [] }) {
  const conFecha = filasConFecha({ matches, propias }).length;
  if (conFecha > 0) return false;
  const matchesActivos = matches.filter(vigenteParaCalendario).length;
  const propiasActivas = propias.filter(propiaActiva).length;
  return matchesActivos + propiasActivas > 0;
}
