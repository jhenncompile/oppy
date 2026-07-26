import { Outlet, useLocation } from 'react-router-dom';
import { Navegacion } from './components/Navegacion.jsx';
import { ThemeToggle } from './components/ThemeToggle.jsx';
import { usePerfil } from './hooks/usePerfil.jsx';
import { useMatches } from './hooks/useMatches.js';
import { usePropias, filasConFecha } from './hooks/usePropias.js';
import { createContext, useContext } from 'react';
import { CIERRA_PRONTO_DIAS } from './hooks/useMatches.js';

const MatchesContexto = createContext(null);
const PropiasContexto = createContext(null);

export function useMatchesCompartidos() {
  const contexto = useContext(MatchesContexto);
  if (!contexto) throw new Error('useMatchesCompartidos necesita el Layout');
  return contexto;
}

/** La libreta propia, compartida por el seguimiento y el calendario. */
export function usePropiasCompartidas() {
  const contexto = useContext(PropiasContexto);
  if (!contexto) throw new Error('usePropiasCompartidas necesita el Layout');
  return contexto;
}

/**
 * Rutas donde la navegacion NO aparece.
 *
 * En la portada y el onboarding la persona todavia no tiene nada que navegar, y
 * mostrarle cuatro destinos la distrae del unico paso que importa.
 */
const SIN_NAVEGACION = ['/', '/onboarding', '/acceso'];

export function Layout() {
  const { perfil } = usePerfil();
  const { pathname } = useLocation();
  const matches = useMatches(perfil?.id);
  const propias = usePropias(perfil?.id);

  const conNavegacion = perfil && !SIN_NAVEGACION.includes(pathname);

  // El aviso de la navegacion cuenta las dos fuentes: para la persona, que un
  // plazo lo haya encontrado el agente o lo haya anotado ella no cambia nada.
  const cierranPronto = filasConFecha({
    matches: matches.matches,
    propias: propias.propias
  }).filter((fila) => fila.dias <= CIERRA_PRONTO_DIAS).length;

  return (
    <PropiasContexto.Provider value={propias}>
    <MatchesContexto.Provider value={matches}>
      <div className="min-h-screen bg-surface-page px-3 py-3 sm:px-6 sm:py-6">
        {/* Requisito de teclado: saltar el menu para llegar al contenido. */}
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-surface-card"
        >
          Saltar al contenido
        </a>

        <div className="mx-auto flex max-w-6xl gap-6">
          {conNavegacion && <Navegacion cierranPronto={cierranPronto} />}

          <main
            id="contenido"
            // El padding de abajo deja respirar sobre la barra inferior movil.
            className="flex min-w-0 flex-1 flex-col gap-3 pb-24 sm:gap-6 lg:pb-0"
          >
            <div className="flex justify-end">
              <ThemeToggle />
            </div>

            <Outlet />

            <footer className="flex flex-col items-center gap-2 px-4 py-8 text-center text-xs text-ink-secondary sm:px-6">
              <p className="max-w-md text-balance">
                Oppy no busca oportunidades para llenar vacantes; busca oportunidades
                para que las personas puedan avanzar.
              </p>
              <p>
                Hecho por <span className="font-medium text-ink">Los Palomillos</span>
              </p>
            </footer>
          </main>
        </div>
      </div>
    </MatchesContexto.Provider>
    </PropiasContexto.Provider>
  );
}
