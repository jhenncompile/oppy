import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Panel, PanelTitulo } from '../components/Panel.jsx';
import { Button } from '../components/Button.jsx';
import { OpportunityCard } from '../components/OpportunityCard.jsx';
import { usePerfil } from '../hooks/usePerfil.jsx';
import { useMatchesCompartidos } from '../Layout.jsx';
import { diasRestantes, CIERRA_PRONTO_DIAS, enSeguimiento } from '../hooks/useMatches.js';

/**
 * El seguimiento avanza: guardada -> preparando -> aplicada -> entrevista ->
 * finalizada. Se muestra agrupado y no como tablero kanban: una lista es mas
 * simple de entender y, sobre todo, se puede usar con teclado y con lector de
 * pantalla. Arrastrar tarjetas no.
 */
const GRUPOS = [
  { estado: 'guardado', titulo: 'Guardadas', ayuda: 'Las marcaste para mirar despues.' },
  { estado: 'preparando', titulo: 'Preparando', ayuda: 'Estas juntando lo que piden.' },
  { estado: 'aplicada', titulo: 'Aplicadas', ayuda: 'Ya enviaste tu postulacion.' },
  { estado: 'entrevista', titulo: 'En entrevista', ayuda: 'Te contactaron.' },
  { estado: 'finalizada', titulo: 'Finalizadas', ayuda: 'Cerradas, con el resultado que sea.' }
];

/** Lo que cierra pronto va arriba de todo: es lo unico que tiene reloj. */
function Recordatorios({ matches }) {
  const urgentes = matches
    .map((match) => ({ match, dias: diasRestantes(match.oportunidad.fechaLimite) }))
    .filter(({ dias }) => dias !== null && dias >= 0 && dias <= CIERRA_PRONTO_DIAS)
    .sort((a, b) => a.dias - b.dias);

  if (urgentes.length === 0) return null;

  return (
    <div className="mb-8 rounded-lg border border-trust-pending-border bg-trust-pending-bg p-4">
      <p className="text-sm font-medium text-trust-pending-text">
        {urgentes.length === 1 ? 'Una cierra pronto' : `${urgentes.length} cierran pronto`}
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {urgentes.map(({ match, dias }) => (
          <li key={match.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-ink">{match.oportunidad.titulo}</span>
            <Link
              to={`/oportunidad/${match.id}`}
              className="min-h-[44px] text-sm font-medium text-ink-accent underline underline-offset-2"
            >
              {dias === 0 ? 'Cierra hoy' : dias === 1 ? 'Cierra maniana' : `Cierra en ${dias} dias`}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Seguimiento() {
  const { perfil } = usePerfil();
  const { matches, cambiarEstado } = useMatchesCompartidos();
  const navegar = useNavigate();

  if (!perfil) return <Navigate to="/" replace />;

  const seguidas = matches.filter(enSeguimiento);

  return (
    <Panel>
      <div className="mb-8">
        <PanelTitulo sobretitulo="Seguimiento">Mis oportunidades</PanelTitulo>
      </div>

      {seguidas.length === 0 ? (
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-6 text-center">
          <p className="text-lg font-medium text-ink">Todavia no guardaste ninguna.</p>
          <p className="text-sm text-ink-secondary">
            Cuando encuentres algo que te interese, guardalo y aca vas a poder
            seguirle el rastro hasta que se cierre.
          </p>
          <Button variante="primario" onClick={() => navegar('/oportunidades')}>
            Ver oportunidades
          </Button>
        </div>
      ) : (
        <>
          <Recordatorios matches={seguidas} />

          <div className="flex flex-col gap-10">
            {GRUPOS.map((grupo) => {
              const delGrupo = seguidas.filter((m) => m.estado === grupo.estado);
              if (delGrupo.length === 0) return null;

              return (
                <section key={grupo.estado}>
                  <h3 className="text-base font-semibold text-ink">
                    {grupo.titulo}{' '}
                    <span className="font-normal text-ink-secondary">({delGrupo.length})</span>
                  </h3>
                  <p className="mt-1 text-sm text-ink-secondary">{grupo.ayuda}</p>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    {delGrupo.map((match) => (
                      <OpportunityCard
                        key={match.id}
                        match={match}
                        onGuardar={(m) => cambiarEstado(m, 'visto')}
                        onSeguimiento={cambiarEstado}

                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </Panel>
  );
}
