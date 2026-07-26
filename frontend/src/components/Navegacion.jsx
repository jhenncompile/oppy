import { NavLink } from 'react-router-dom';

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
const DESTINOS = [
  { a: '/oportunidades', icono: '◆', texto: 'Oportunidades' },
  { a: '/seguimiento', icono: '★', texto: 'Mis oportunidades' },
  { a: '/calendario', icono: '▦', texto: 'Calendario' },
  { a: '/perfil', icono: '●', texto: 'Mi perfil' }
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
          <p className="px-3 pb-4 font-display text-xl font-bold text-ink">Oppy</p>
          <ul className="flex flex-col gap-1">
            {DESTINOS.map((destino) => (
              <li key={destino.a}>
                <NavLink to={destino.a} className={enlaceClases}>
                  <span aria-hidden="true" className="text-xs">{destino.icono}</span>
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
                    <span aria-hidden="true" className="text-sm">{destino.icono}</span>
                    <span className="text-center">{destino.texto}</span>
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
