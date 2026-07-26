import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/index.css';

// El tema se resuelve en index.html, antes de pintar, para no mostrar un
// destello del tema equivocado. Aca no hace falta hacer nada: el boton
// ThemeToggle es el unico que lo cambia despues.

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
