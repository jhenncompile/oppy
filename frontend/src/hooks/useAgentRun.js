import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';

/**
 * Sigue una corrida del agente en vivo.
 *
 * Los pasos que devuelve alimentan la pantalla de proceso, que es donde se ve
 * que hay un agente decidiendo. Por eso el hook expone la lista completa de
 * pasos y no solo un booleano de "cargando".
 */
export function useAgentRun() {
  const [estado, setEstado] = useState('inactivo');
  const [pasos, setPasos] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState(null);
  const fuenteRef = useRef(null);

  const cerrarFuente = useCallback(() => {
    fuenteRef.current?.close();
    fuenteRef.current = null;
  }, []);

  useEffect(() => cerrarFuente, [cerrarFuente]);

  const iniciar = useCallback(
    async (userId) => {
      cerrarFuente();
      setPasos([]);
      setResumen(null);
      setError(null);
      setEstado('en_curso');

      let runId;
      try {
        ({ runId } = await api.dispararAgente(userId));
      } catch (fallo) {
        setError(fallo.message);
        setEstado('fallida');
        return null;
      }

      const fuente = new EventSource(api.urlStream(runId));
      fuenteRef.current = fuente;

      fuente.addEventListener('paso', (evento) => {
        setPasos((previos) => [...previos, JSON.parse(evento.data)]);
      });

      fuente.addEventListener('fin', (evento) => {
        const fin = JSON.parse(evento.data);
        setResumen(fin.resumen ?? null);
        setEstado(fin.estado === 'completada' ? 'completada' : 'fallida');
        cerrarFuente();
      });

      fuente.onerror = () => {
        // El servidor cierra el stream al terminar; eso llega aca como error.
        // Solo es un fallo real si la corrida seguia en curso.
        setEstado((actual) => (actual === 'en_curso' ? 'fallida' : actual));
        cerrarFuente();
      };

      return runId;
    },
    [cerrarFuente]
  );

  return { estado, pasos, resumen, error, iniciar };
}
