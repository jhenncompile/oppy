import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Panel, PanelTitulo } from '../components/Panel.jsx';
import { Button } from '../components/Button.jsx';
import { TrustBadge } from '../components/TrustBadge.jsx';
import { usePerfil } from '../hooks/usePerfil.jsx';
import { useMatchesCompartidos, usePropiasCompartidas } from '../Layout.jsx';
import { filasConFecha, sinFechasPeroConOportunidades } from '../hooks/usePropias.js';
import { Icono } from '../components/Icono.jsx';

/**
 * Proximos cierres.
 *
 * Es una lista ordenada por fecha y no una grilla mensual a proposito: un
 * calendario apretado en 360px no lo usa nadie, y lo que la persona necesita
 * saber es "que se me viene", no "que dia de la semana cae".
 *
 * Entran las dos fuentes: lo que guardo de las recomendaciones y lo que anoto
 * por su cuenta. Un plazo es un plazo — un calendario que solo conoce la mitad
 * de los compromisos de alguien no sirve para organizarse.
 */
const FORMATO = new Intl.DateTimeFormat('es-BO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long'
});

function agrupar(filas) {
  const grupos = new Map();

  for (const fila of filas) {
    const clave =
      fila.dias === 0
        ? 'Hoy'
        : fila.dias === 1
          ? 'En 1 dia'
          : fila.dias <= 7
            ? 'Esta semana'
            : 'Mas adelante';

    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(fila);
  }

  return grupos;
}

const ORDEN = ['Hoy', 'En 1 dia', 'Esta semana', 'Mas adelante'];

// Lo que vence hoy lleva triangulo y no reloj: es la unica fila donde ya no
// queda margen para postergarlo.
const ICONOS = {
  Hoy: 'alerta',
  'En 1 dia': 'reloj',
  'Esta semana': 'calendario',
  'Mas adelante': 'calendario'
};

/** Lleva al detalle solo si Oppy tiene algo que contar sobre eso. */
function Titulo({ fila }) {
  const clases = 'font-medium text-ink underline-offset-2 hover:underline';

  if (fila.rutaDetalle) {
    return (
      <Link to={fila.rutaDetalle} className={clases}>
        {fila.titulo}
      </Link>
    );
  }

  if (fila.enlace) {
    return (
      <a href={fila.enlace} target="_blank" rel="noopener noreferrer" className={clases}>
        {fila.titulo}
      </a>
    );
  }

  return <span className="font-medium text-ink">{fila.titulo}</span>;
}

export function Calendario() {
  const { perfil } = usePerfil();
  const { matches } = useMatchesCompartidos();
  const { propias } = usePropiasCompartidas();
  const navegar = useNavigate();

  if (!perfil) return <Navigate to="/" replace />;

  const filas = filasConFecha({ matches, propias });
  const grupos = agrupar(filas);
  const haySinFecha = sinFechasPeroConOportunidades({ matches, propias });

  return (
    <Panel>
      <div className="mb-8">
        <PanelTitulo sobretitulo="Fechas">Proximos cierres</PanelTitulo>
      </div>

      {filas.length === 0 ? (
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-6 text-center">
          <Icono nombre="calendario" tamanio={40} className="text-ink-secondary" />
          <p className="text-lg font-medium text-ink">
            {haySinFecha
              ? 'Todavia no hay fechas de cierre'
              : 'No tienes fechas por delante.'}
          </p>
          <p className="text-sm text-ink-secondary">
            {haySinFecha
              ? 'Tus oportunidades aun no tienen plazo publicado (o no lo pudimos leer). Anota una fecha en Seguimiento → Agregar, o espera a convocatorias con deadline.'
              : 'Aca aparecen los cierres de las oportunidades recomendadas y de las que anotes, ordenados por lo que se viene primero.'}
          </p>
          <Button variante="primario" onClick={() => navegar('/oportunidades')}>
            <Icono nombre="brujula" tamanio={16} />
            Ver oportunidades
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {ORDEN.filter((clave) => grupos.has(clave)).map((clave) => (
            <section key={clave}>
              <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
                <Icono
                  nombre={ICONOS[clave]}
                  tamanio={17}
                  className={clave === 'Hoy' ? 'text-trust-stale-text' : 'text-ink-accent'}
                />
                {clave}
              </h3>

              <ul className="mt-3 flex flex-col gap-2">
                {grupos.get(clave).map((fila) => (
                  <li
                    key={fila.clave}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line-subtle bg-surface-subtle p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <Titulo fila={fila} />
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-secondary">
                        <Icono nombre="calendario" tamanio={13} />
                        {FORMATO.format(new Date(fila.fechaLimite))}
                        {fila.subtitulo && ` · ${fila.subtitulo}`}
                      </p>
                    </div>

                    {/* Sin semaforo para lo anotado a mano: Oppy no reviso esa
                        fuente y no puede afirmar nada sobre ella. Lo que si
                        dice es quien la puso ahi. */}
                    {fila.propia ? (
                      <span className="pill bg-surface-accent text-ink-accent">
                        <Icono nombre="marcador" tamanio={13} relleno />
                        La anotaste tu
                      </span>
                    ) : (
                      <TrustBadge confianza={fila.confianza} />
                    )}

                    <span
                      className={[
                        'text-sm font-medium',
                        fila.dias <= 3 ? 'text-trust-stale-text' : 'text-ink-secondary'
                      ].join(' ')}
                    >
                      {fila.dias === 0
                        ? 'Hoy'
                        : fila.dias === 1
                          ? 'En 1 dia'
                          : `En ${fila.dias} dias`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Panel>
  );
}
