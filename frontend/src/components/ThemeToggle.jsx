import { useEffect, useState } from 'react';

const CLAVE = 'oppy-tema';

/**
 * Lee el tema inicial: primero lo que la persona eligio, y si nunca eligio,
 * lo que prefiere su sistema. Se resuelve una sola vez al montar.
 */
function temaInicial() {
  const guardado = localStorage.getItem(CLAVE);
  if (guardado === 'claro' || guardado === 'oscuro') return guardado;

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
}

/**
 * Alterna claro y oscuro.
 *
 * Cambiar de tema es cambiar una clase en <html>: todos los colores salen de
 * variables CSS, asi que ningun componente se entera. Esa es la razon de que
 * los componentes no escriban colores.
 *
 * El estado se recuerda entre visitas, porque volver a elegirlo cada vez es
 * exactamente el tipo de friccion que Oppy no deberia tener.
 */
export function ThemeToggle() {
  const [tema, setTema] = useState(temaInicial);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'oscuro');
    localStorage.setItem(CLAVE, tema);
  }, [tema]);

  const oscuro = tema === 'oscuro';

  return (
    <button
      type="button"
      onClick={() => setTema(oscuro ? 'claro' : 'oscuro')}
      // El estado no se comunica solo con el icono: quien usa lector de
      // pantalla tiene que saber que va a pasar si lo aprieta.
      aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-line-subtle bg-surface-card px-4 text-sm text-ink-secondary transition hover:bg-surface-hover"
    >
      <span aria-hidden="true">{oscuro ? '☀' : '☾'}</span>
      <span>{oscuro ? 'Claro' : 'Oscuro'}</span>
    </button>
  );
}
