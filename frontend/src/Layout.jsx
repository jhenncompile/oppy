import { Outlet, useLocation } from 'react-router-dom';
import { Navegacion } from './components/Navegacion.jsx';
import { ThemeToggle } from './components/ThemeToggle.jsx';
import { usePerfil } from './hooks/usePerfil.jsx';
import { useMatches, contarCierranPronto } from './hooks/useMatches.js';
import { createContext, useContext } from 'react';

const MatchesContexto = createContext(null);

export function useMatchesCompartidos() {
  const contexto = useContext(MatchesContexto);
  if (!contexto) throw new Error('useMatchesCompartidos necesita el Layout');
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

  const conNavegacion = perfil && !SIN_NAVEGACION.includes(pathname);

  return (
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
          {conNavegacion && <Navegacion cierranPronto={contarCierranPronto(matches.matches)} />}

          <main
            id="contenido"
            // El padding de abajo deja respirar sobre la barra inferior movil.
            className="flex min-w-0 flex-1 flex-col gap-3 pb-24 sm:gap-6 lg:pb-0"
          >
            <div className="flex justify-end">
              <ThemeToggle />
            </div>

            <Outlet />

            <footer className="px-6 py-8 text-center text-xs text-ink-secondary">
              Oppy no busca oportunidades para llenar vacantes; busca oportunidades
              para que las personas puedan avanzar.
            </footer>
          </main>
        </div>
      </div>
    </MatchesContexto.Provider>
  );
}
