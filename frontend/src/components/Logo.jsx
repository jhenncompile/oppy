/**
 * Logo de Oppy: una rosa de los vientos, y la palabra al lado.
 *
 * Una rosa es una estrella y una brujula a la vez, que es exactamente lo que
 * hace el agente: no lista resultados, orienta. Las cuatro puntas largas dan la
 * silueta que se lee a 16px; las cuatro cortas dan el detalle que aparece
 * cuando el logo es grande — y son las que giran mientras el agente busca.
 *
 * Geometria sobre una retica de 32, en poligonos rectos y no en curvas: la
 * rosa es angular por definicion, y un path relleno sobrevive al favicon, al
 * bordado y a una sola tinta. Los colores salen de tokens semanticos — ningun
 * componente toca un primitivo.
 */

const TAMANIOS = {
  sm: { marca: 24, palabra: 'text-lg' },
  md: { marca: 32, palabra: 'text-2xl' },
  lg: { marca: 48, palabra: 'text-4xl' }
};

// Puntas cardinales: radio 14 hacia N, E, S, O, con la cintura a 3.5 en las
// diagonales. Es la silueta que queda cuando el logo mide 16px.
const CARDINALES = 'M16 2 L18.48 13.52 L30 16 L18.48 18.48 L16 30 L13.52 18.48 L2 16 L13.52 13.52 Z';

// Vientos: la misma figura rotada 45 grados y mas corta (radio 8.5). Va DEBAJO
// de las cardinales, asi que el cruce del centro no se ve.
const VIENTOS = 'M22.01 9.99 L19 16 L22.01 22.01 L16 19 L9.99 22.01 L13 16 L9.99 9.99 L16 13 Z';

/** La marca sola. Util para el favicon, el avatar y los espacios apretados. */
export function LogoMarca({ tamanio = 32, className = '' }) {
  return (
    <svg
      width={tamanio}
      height={tamanio}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <g className="logo-rosa">
        <g className="logo-vientos-grupo">
          <path className="logo-vientos" d={VIENTOS} style={{ fill: 'var(--logo-vientos)' }} />
        </g>
        <path className="logo-marca" d={CARDINALES} style={{ fill: 'var(--logo-marca)' }} />
      </g>
    </svg>
  );
}

/**
 * @param {'sm'|'md'|'lg'} tamanio
 * @param {boolean} animado    corre la secuencia de entrada una vez
 * @param {boolean} buscando   los vientos giran mientras el agente trabaja
 * @param {boolean} soloMarca  sin la palabra, para espacios apretados
 */
export function Logo({
  tamanio = 'md',
  animado = false,
  buscando = false,
  soloMarca = false,
  className = ''
}) {
  const medida = TAMANIOS[tamanio] ?? TAMANIOS.md;

  const clases = [
    'inline-flex items-center gap-2.5 logo-interactivo',
    animado && 'logo-anima',
    buscando && 'logo-buscando',
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={clases} role="img" aria-label={buscando ? 'Oppy esta buscando' : 'Oppy'}>
      <LogoMarca tamanio={medida.marca} />
      {/* La palabra es texto y no un path: se lee, se selecciona, se traduce y
       * no se pixela. La marca ya es decorativa, asi que aca no se repite el
       * nombre para el lector de pantalla. */}
      {!soloMarca && (
        <span
          className={`logo-palabra font-display font-bold tracking-tight text-ink ${medida.palabra}`}
          aria-hidden="true"
        >
          Oppy
        </span>
      )}
    </span>
  );
}
