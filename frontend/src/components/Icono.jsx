/**
 * Set de iconos de Oppy.
 *
 * SVG en linea y no una libreria: son ~40 iconos y una dependencia mas
 * significa que la otra persona tenga que correr npm install para que le
 * compile. Tampoco son glifos Unicode, que era lo que habia antes: "✆" y "▦"
 * se dibujan distinto en cada sistema, algunos ni existen en la fuente de
 * Windows y "🎙" aparece a color en medio de una interfaz monocroma.
 *
 * Todos heredan color con `currentColor` y tamanio con la prop, asi que ningun
 * icono decide su propio color — eso lo siguen resolviendo los tokens.
 *
 * REGLA: el icono nunca reemplaza al texto, lo acompania. Por eso van todos con
 * aria-hidden y no llevan <title>: lo que tiene que leer un lector de pantalla
 * ya esta escrito al lado.
 */

// Geometria sobre una retica de 24, trazo abierto. Derivados de Lucide (ISC).
const TRAZOS = {
  // --- Navegacion ---
  brujula: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36z" />
    </>
  ),
  marcador: <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />,
  calendario: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </>
  ),
  persona: (
    <>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  personas: (
    <>
      <path d="M18 21a8 8 0 0 0-16 0" />
      <circle cx="10" cy="8" r="5" />
      <path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" />
    </>
  ),

  // --- Estado y confianza ---
  check: <path d="M20 6 9 17l-5-5" />,
  'check-circulo': (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  escudo: (
    <>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  reloj: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  alerta: (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
  // Circulo punteado: lo que todavia falta se lee distinto de lo que ya esta.
  pendiente: <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />,
  equis: <path d="M18 6 6 18M6 6l12 12" />,

  // --- Acciones ---
  'flecha-izquierda': <path d="M19 12H5M12 19l-7-7 7-7" />,
  'flecha-derecha': <path d="M5 12h14M12 5l7 7-7 7" />,
  'flecha-abajo': <path d="M12 5v14M19 12l-7 7-7-7" />,
  'enlace-externo': (
    <>
      <path d="M15 3h6v6M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </>
  ),
  lupa: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  filtro: <path d="M22 3H2l8 9.46V19l4 2v-8.54z" />,
  refrescar: <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5" />,
  corazon: (
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" />
  ),

  // --- Canales de contacto ---
  correo: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </>
  ),
  mensaje: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />,
  enviar: <path d="m22 2-7 20-4-9-9-4zM22 2 11 13" />,
  microfono: (
    <>
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
    </>
  ),
  campana: (
    <path d="M10.27 21a2 2 0 0 0 3.46 0M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33" />
  ),

  // --- El agente trabajando ---
  objetivo: (
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
  chispas: (
    <>
      <path d="M11.5 3.2a.5.5 0 0 1 1 0l1.06 4.1a2 2 0 0 0 1.44 1.44l4.1 1.06a.5.5 0 0 1 0 .97l-4.1 1.06a2 2 0 0 0-1.44 1.44l-1.06 4.1a.5.5 0 0 1-1 0l-1.06-4.1a2 2 0 0 0-1.44-1.44l-4.1-1.06a.5.5 0 0 1 0-.97l4.1-1.06a2 2 0 0 0 1.44-1.44z" />
      <path d="M19 16v4M21 18h-4M5 3v3M6.5 4.5h-3" />
    </>
  ),
  globo: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20" />
    </>
  ),
  base: (
    <>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0" />
    </>
  ),
  balanza: <path d="M12 3v18M7 21h10M3 8h18M6 8l-3 7a3 3 0 0 0 6 0zM18 8l3 7a3 3 0 0 1-6 0z" />,
  // Relleno y no anillo: a 14px un circulo de trazo se pierde, y este es el
  // icono de las lineas de detalle del proceso en vivo.
  punto: <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />,

  // --- Categorias de oportunidad ---
  maletin: (
    <>
      <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      <rect x="2" y="6" width="20" height="14" rx="2" />
    </>
  ),
  birrete: (
    <>
      <path d="M21.42 10.92a1 1 0 0 0-.02-1.84L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.83l8.57 3.91a2 2 0 0 0 1.66 0z" />
      <path d="M22 10v6M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
    </>
  ),
  libro: (
    <path d="M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
  ),
  trofeo: (
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0z" />
  ),
  monedas: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82" />
    </>
  ),
  intercambio: <path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16" />,
  ubicacion: (
    <>
      <path d="M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),

  // --- Tema ---
  sol: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </>
  ),
  luna: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
};

/**
 * @param {string} nombre    clave de TRAZOS
 * @param {number} tamanio   lado en px; hereda el color del texto que acompania
 * @param {boolean} relleno  version solida, para estados activos (guardada)
 */
export function Icono({ nombre, tamanio = 18, relleno = false, className = '' }) {
  const trazo = TRAZOS[nombre];

  // Un nombre mal escrito no puede romper la pantalla entera.
  if (!trazo) return null;

  return (
    <svg
      width={tamanio}
      height={tamanio}
      viewBox="0 0 24 24"
      fill={relleno ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      {trazo}
    </svg>
  );
}

/**
 * Icono por categoria de oportunidad.
 *
 * La categoria ya se muestra escrita; el icono le da una forma reconocible de
 * un vistazo cuando hay diez tarjetas en pantalla.
 */
const POR_CATEGORIA = {
  empleo: 'maletin',
  beca: 'birrete',
  curso: 'libro',
  pasantia: 'maletin',
  voluntariado: 'corazon',
  programa_social: 'personas',
  concurso: 'trofeo',
  financiamiento: 'monedas',
  evento: 'calendario',
  intercambio: 'intercambio'
};

export const iconoDeCategoria = (categoria) => POR_CATEGORIA[categoria] ?? 'objetivo';
