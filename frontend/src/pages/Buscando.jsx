import { useEffect, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Panel, PanelTitulo } from '../components/Panel.jsx';
import { Button } from '../components/Button.jsx';
import { AgentProcess } from '../components/AgentProcess.jsx';
import { useAgentRun } from '../hooks/useAgentRun.js';
import { usePerfil } from '../hooks/usePerfil.jsx';
import { useMatchesCompartidos } from '../Layout.jsx';

const PAUSA_ANTES_DE_RESULTADOS_MS = 900;

/**
 * El agente trabajando.
 *
 * Es la pantalla mas importante del producto: un spinner generico no demuestra
 * nada, pero ver al agente decidir que buscar, rastrear fuentes con nombre
 * propio y razonar sobre compatibilidad es la prueba de que nada esta
 * precargado.
 */
export function Buscando() {
  const { perfil } = usePerfil();
  const { estado, pasos, iniciar } = useAgentRun();
  const { recargar } = useMatchesCompartidos();
  const navegar = useNavigate();
  const arrancado = useRef(false);

  useEffect(() => {
    if (!perfil || arrancado.current) return;
    arrancado.current = true;
    iniciar(perfil.id);
  }, [perfil, iniciar]);

  // Al terminar se recogen los resultados y se pasa al tablero. La pausa deja
  // leer la ultima linea en vez de cortar la narracion de golpe.
  useEffect(() => {
    if (estado !== 'completada') return undefined;

    const temporizador = setTimeout(async () => {
      await recargar();
      navegar('/oportunidades', { replace: true });
    }, PAUSA_ANTES_DE_RESULTADOS_MS);

    return () => clearTimeout(temporizador);
  }, [estado, navegar, recargar]);

  if (!perfil) return <Navigate to="/" replace />;

  const fallo = estado === 'fallida';

  return (
    <Panel centrado>
      <PanelTitulo sobretitulo={fallo ? 'Algo salio mal' : 'En curso'}>
        {fallo ? 'No pude terminar de buscar' : 'Estoy trabajando'}
      </PanelTitulo>

      <div className="mt-10 text-left">
        <AgentProcess pasos={pasos} estado={estado} />
      </div>

      {fallo && (
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button variante="primario" onClick={() => iniciar(perfil.id)}>
            Intentar de nuevo
          </Button>
          <Button variante="secundario" onClick={() => navegar('/oportunidades')}>
            Ver lo que ya tengo
          </Button>
        </div>
      )}
    </Panel>
  );
}
