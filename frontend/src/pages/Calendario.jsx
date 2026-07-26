import { Navigate, useNavigate } from 'react-router-dom';
import { Panel, PanelTitulo } from '../components/Panel.jsx';
import { Button } from '../components/Button.jsx';
import { TrustBadge } from '../components/TrustBadge.jsx';
import { usePerfil } from '../hooks/usePerfil.jsx';
import { useMatchesCompartidos } from '../Layout.jsx';
import { diasRestantes, enSeguimiento } from '../hooks/useMatches.js';
import { Icono } from '../components/Icono.jsx';

/**
 * Proximos cierres.
 *
 * Es una lista ordenada por fecha y no una grilla mensual a proposito: un
 * calendario apretado en 360px no lo usa nadie, y lo que la persona necesita
 * saber es "que se me viene", no "que dia de la semana cae".
 */
const FORMATO = new Intl.DateTimeFormat('es-BO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long'
});

function agrupar(matches) {
  const grupos = new Map();

  for (const match of matches) {
    const dias = diasRestantes(match.oportunidad.fechaLimite);
    if (dias === null || dias < 0) continue;

    const clave =
      dias === 0 ? 'Hoy' : dias === 1 ? 'Maniana' : dias <= 7 ? 'Esta semana' : 'Mas adelante';

    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push({ match, dias });
  }

  for (const lista of grupos.values()) lista.sort((a, b) => a.dias - b.dias);
  return grupos;
}

const ORDEN = ['Hoy', 'Maniana', 'Esta semana', 'Mas adelante'];

// Lo que vence hoy lleva triangulo y no reloj: es la unica fila donde ya no
// queda margen para postergarlo.
const ICONOS = {
  Hoy: 'alerta',
  Maniana: 'reloj',
  'Esta semana': 'calendario',
  'Mas adelante': 'calendario'
};

export function Calendario() {
  const { perfil } = usePerfil();
  const { matches } = useMatchesCompartidos();
  const navegar = useNavigate();

  if (!perfil) return <Navigate to="/" replace />;

  const seguidas = matches.filter(enSeguimiento);
  const grupos = agrupar(seguidas);
  const total = [...grupos.values()].reduce((suma, lista) => suma + lista.length, 0);

  return (
    <Panel>
      <div className="mb-8">
        <PanelTitulo sobretitulo="Fechas">Proximos cierres</PanelTitulo>
      </div>

      {total === 0 ? (
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-6 text-center">
          <Icono nombre="calendario" tamanio={40} className="text-ink-secondary" />
          <p className="text-lg font-medium text-ink">No tenes fechas por delante.</p>
          <p className="text-sm text-ink-secondary">
            Aca aparecen los cierres de las oportunidades que vayas guardando,
            ordenados por lo que se viene primero.
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
                {grupos.get(clave).map(({ match, dias }) => (
                  <li
                    key={match.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line-subtle bg-surface-subtle p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">{match.oportunidad.titulo}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-secondary">
                        <Icono nombre="calendario" tamanio={13} />
                        {FORMATO.format(new Date(match.oportunidad.fechaLimite))} ·{' '}
                        {match.oportunidad.fuente.nombre}
                      </p>
                    </div>

                    <TrustBadge confianza={match.oportunidad.confianza} />

                    <span
                      className={[
                        'text-sm font-medium',
                        dias <= 3 ? 'text-trust-stale-text' : 'text-ink-secondary'
                      ].join(' ')}
                    >
                      {dias === 0 ? 'Hoy' : dias === 1 ? 'En 1 dia' : `En ${dias} dias`}
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
