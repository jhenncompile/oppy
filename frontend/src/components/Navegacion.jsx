import { NavLink } from 'react-router-dom';
import { Logo } from './Logo.jsx';
import { Icono } from './Icono.jsx';

/**
 * Navegacion principal.
 *
 * Cuatro destinos y ninguno mas. El onboarding es de una sola vez, el proceso
 * en vivo es transitorio y el detalle se abre desde una card: ninguno de los
 * tres merece un lugar permanente.
 *
 * Lateral en escritorio, barra inferior en movil. NO hay menu hamburguesa a
 * proposito: esta app la usa gente de 55 anios y gente con poca practica
 * digital, y un menu escondido detras de tres rayitas es exactamente la barrera
 * que Oppy existe para no poner. Cuatro destinos entran en una barra inferior.
 *
 * Nunca iconos solos: siempre icono + texto, en las dos variantes.
 */
// `corto` es la etiqueta de la barra inferior. En 320px cada destino tiene 80px
// y "Oportunidades" no entra en una sola linea sin cortarse — es una palabra
// sola, asi que no hay donde partirla. El nombre completo sigue estando para el
// lector de pantalla.
const DESTINOS = [
  { a: '/oportunidades', icono: 'brujula', texto: 'Oportunidades', corto: 'Para ti' },
  { a: '/seguimiento', icono: 'marcador', texto: 'Mis oportunidades', corto: 'Guardadas' },
  { a: '/calendario', icono: 'calendario', texto: 'Calendario', corto: 'Fechas' },
  { a: '/perfil', icono: 'persona', texto: 'Mi perfil', corto: 'Perfil' }
];

/** Cuenta lo que cierra pronto. Un numero dice mas que un punto rojo. */
function Aviso({ cantidad }) {
  if (!cantidad) return null;

  return (
    <span
      className="ml-auto rounded-full bg-trust-pending-bg px-2 py-0.5 text-[11px] font-medium text-trust-pending-text"
      aria-label={`${cantidad} ${cantidad === 1 ? 'oportunidad cierra' : 'oportunidades cierran'} pronto`}
    >
      {cantidad}
    </span>
  );
}

function enlaceClases({ isActive }) {
  return [
    'flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition',
    // El destino activo no se marca solo con color: lleva ademas fondo y una
    // barra de acento a la izquierda.
    isActive
      ? 'border-l-2 border-accent bg-surface-hover font-medium text-ink'
      : 'border-l-2 border-transparent text-ink-secondary hover:bg-surface-hover'
  ].join(' ');
}

export function Navegacion({ cierranPronto = 0 }) {
  return (
    <>
      {/* Escritorio */}
      <nav
        aria-label="Navegacion principal"
        className="hidden w-60 shrink-0 lg:block"
      >
        <div className="sticky top-6 panel px-3 py-6">
          <div className="px-3 pb-4">
            <Logo tamanio="sm" animado />
          </div>
          <ul className="flex flex-col gap-1">
            {DESTINOS.map((destino) => (
              <li key={destino.a}>
                <NavLink to={destino.a} className={enlaceClases}>
                  <Icono nombre={destino.icono} tamanio={18} />
                  <span>{destino.texto}</span>
                  {destino.a === '/seguimiento' && <Aviso cantidad={cierranPronto} />}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Movil: barra inferior fija */}
      <nav
        aria-label="Navegacion principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line-subtle bg-surface-card lg:hidden"
      >
        <ul className="mx-auto flex max-w-lg">
          {DESTINOS.map((destino) => (
            <li key={destino.a} className="flex-1">
              <NavLink
                to={destino.a}
                className={({ isActive }) =>
                  [
                    // 56px de alto: comodo tambien para quien tiene poca
                    // destreza motriz.
                    'relative flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] leading-tight transition',
                    isActive ? 'font-medium text-ink-accent' : 'text-ink-secondary'
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-accent"
                      />
                    )}
                    <Icono nombre={destino.icono} tamanio={20} />
                    <span className="text-center">{destino.corto ?? destino.texto}</span>
                    {destino.corto && <span className="sr-only">{destino.texto}</span>}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
