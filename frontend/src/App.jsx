import { useCallback, useEffect, useState } from 'react';
import { Panel, PanelTitulo } from './components/Panel.jsx';
import { AgentProcess } from './components/AgentProcess.jsx';
import { ThemeToggle } from './components/ThemeToggle.jsx';
import { Onboarding } from './pages/Onboarding.jsx';
import { Results } from './pages/Results.jsx';
import { useAgentRun } from './hooks/useAgentRun.js';
import { api } from './api/client.js';

const SCORE_MINIMO = 40;
const INTERVALO_SONDEO_MS = 4000;

export default function App() {
  const [perfil, setPerfil] = useState(null);
  const [matches, setMatches] = useState([]);
  const [error, setError] = useState(null);
  const { estado, pasos, error: errorAgente, iniciar } = useAgentRun();

  /**
   * Los resultados se van persistiendo mientras el agente razona, asi que se
   * recogen durante la corrida y una vez mas al terminar. El intervalo se
   * limpia con el efecto: sin eso, cada corrida dejaria uno vivo para siempre.
   */
  useEffect(() => {
    if (!perfil || (estado !== 'en_curso' && estado !== 'completada')) return undefined;

    let cancelado = false;

    const recoger = async () => {
      try {
        const { matches: encontrados } = await api.obtenerMatches(perfil.id, {
          minScore: SCORE_MINIMO
        });
        if (!cancelado && encontrados.length > 0) setMatches(encontrados);
      } catch {
        // Sondeo de conveniencia: el canal principal es el stream.
      }
    };

    recoger();

    if (estado !== 'en_curso') return () => { cancelado = true; };

    const temporizador = setInterval(recoger, INTERVALO_SONDEO_MS);
    return () => {
      cancelado = true;
      clearInterval(temporizador);
    };
  }, [perfil, estado]);

  const crearPerfilYBuscar = async (datos) => {
    setError(null);
    try {
      const { perfil: creado } = await api.crearPerfil(datos);
      setPerfil(creado);
      await iniciar(creado.id);
    } catch (fallo) {
      setError(fallo.message);
    }
  };

  const reintentar = useCallback(() => {
    if (perfil) iniciar(perfil.id);
  }, [perfil, iniciar]);

  /**
   * Optimista: la interfaz responde ya, y si el servidor falla se revierte.
   * En una lista que se refresca sola, esperar la respuesta se siente como que
   * el click no hizo nada.
   */
  const cambiarEstado = async (match, nuevoEstado) => {
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
  };

  const guardar = (match) => {
    const enSeguimiento = match.estado !== 'nuevo' && match.estado !== 'visto';
    return cambiarEstado(match, enSeguimiento ? 'visto' : 'guardado');
  };

  const trabajando = estado === 'en_curso';

  return (
    <div className="min-h-screen bg-surface-page px-3 py-3 sm:px-6 sm:py-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:gap-6">
        <div className="flex justify-end">
          <ThemeToggle />
        </div>

        {/* Portada */}
        <Panel centrado>
          <PanelTitulo sobretitulo="Bolivia · becas, pasantias y empleo">
            Las oportunidades existen. El problema es enterarse.
          </PanelTitulo>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-ink-secondary">
            Oppy rastrea embajadas, universidades y fundaciones bolivianas, y te
            dice cuales calzan con tu perfil — y por que.
          </p>

          {!perfil && (
            <div className="mt-10">
              <Onboarding onEnviar={crearPerfilYBuscar} enviando={trabajando} />
            </div>
          )}

          {(error || errorAgente) && (
            <p className="mt-6 text-sm text-trust-stale-text" role="alert">
              {error || errorAgente}
            </p>
          )}
        </Panel>

        {/* Proceso en vivo: la prueba de que hay un agente decidiendo */}
        {perfil && pasos.length > 0 && (
          <Panel centrado>
            <PanelTitulo sobretitulo={trabajando ? 'En curso' : 'Corrida terminada'}>
              {trabajando ? 'Oppy esta trabajando' : 'Esto hizo Oppy'}
            </PanelTitulo>
            <div className="mt-10 text-left">
              <AgentProcess pasos={pasos} estado={estado} />
            </div>
          </Panel>
        )}

        {/* Resultados */}
        {perfil && (matches.length > 0 || estado === 'completada') && (
          <Panel>
            <div className="mb-10 text-center">
              <PanelTitulo sobretitulo="Resultados">Esto es para vos</PanelTitulo>
            </div>
            <Results
              matches={matches}
              perfil={perfil}
              onGuardar={guardar}
              onSeguimiento={cambiarEstado}
              onReintentar={reintentar}
            />
          </Panel>
        )}

        <footer className="px-6 py-8 text-center text-xs text-ink-secondary">
          Oppy no busca oportunidades para llenar vacantes; busca oportunidades
          para que las personas puedan avanzar.
        </footer>
      </div>
    </div>
  );
}
