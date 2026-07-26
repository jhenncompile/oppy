import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { Layout } from './Layout.jsx';
import { ProveedorPerfil } from './hooks/usePerfil.jsx';
import { Landing } from './pages/Landing.jsx';
import { Onboarding } from './pages/Onboarding.jsx';
import { Buscando } from './pages/Buscando.jsx';
import { Oportunidades } from './pages/Oportunidades.jsx';
import { Detalle } from './pages/Detalle.jsx';
import { Seguimiento } from './pages/Seguimiento.jsx';
import { Calendario } from './pages/Calendario.jsx';
import { Perfil } from './pages/Perfil.jsx';

import './styles/index.css';

// El tema se resuelve en index.html, antes de pintar, para no mostrar un
// destello del tema equivocado. El boton ThemeToggle es el unico que lo cambia
// despues.

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Landing /> },
      { path: '/onboarding', element: <Onboarding /> },
      { path: '/buscando', element: <Buscando /> },
      { path: '/oportunidades', element: <Oportunidades /> },
      { path: '/oportunidad/:matchId', element: <Detalle /> },
      { path: '/seguimiento', element: <Seguimiento /> },
      { path: '/calendario', element: <Calendario /> },
      { path: '/perfil', element: <Perfil /> },
      // Una ruta que no existe devuelve a la portada, que decide sola si la
      // persona ya tiene perfil o recien empieza.
      { path: '*', element: <Landing /> }
    ]
  }
]);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ProveedorPerfil>
      <RouterProvider router={router} />
    </ProveedorPerfil>
  </StrictMode>
);
