import { TrustBadge } from './TrustBadge.jsx';
import { ScoreBar } from './ScoreBar.jsx';
import { Button } from './Button.jsx';

/** Devuelve dias restantes, o null si no hay fecha limite. */
function diasRestantes(fechaLimite) {
  if (!fechaLimite) return null;
  const limite = new Date(fechaLimite);
  if (Number.isNaN(limite.getTime())) return null;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.ceil((limite - hoy) / 86_400_000);
}

function Deadline({ fechaLimite }) {
  const dias = diasRestantes(fechaLimite);
  if (dias === null) return <span className="text-xs text-ink-muted">Sin fecha limite</span>;
  if (dias < 0) return <span className="text-xs text-ink-muted">Cerrada</span>;

  // Solo se pone urgente cuando de verdad lo es. Si todo grita, nada grita.
  const urgente = dias <= 3;
  const texto = dias === 0 ? 'Cierra hoy' : `Cierra en ${dias} ${dias === 1 ? 'dia' : 'dias'}`;

  return (
    <span
      className={`text-xs font-medium ${urgente ? 'text-trust-stale-text' : 'text-ink-secondary'}`}
    >
      {texto}
    </span>
  );
}

export function OpportunityCard({ match, onGuardar, onAbrir }) {
  const { oportunidad } = match;

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-line-subtle bg-surface-card p-5 shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <TrustBadge confianza={oportunidad.confianza} />
        <div className="flex items-center gap-3">
          {oportunidad.sponsored && (
            <span className="pill bg-surface-subtle text-ink-muted">Patrocinada</span>
          )}
          <span className="pill bg-surface-subtle text-ink-secondary capitalize">
            {oportunidad.categoria}
          </span>
          <Deadline fechaLimite={oportunidad.fechaLimite} />
        </div>
      </header>

      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold leading-snug text-ink">{oportunidad.titulo}</h3>
        <p className="text-xs text-ink-muted">
          {oportunidad.fuente.nombre} · actualizado{' '}
          {new Date(oportunidad.fechaExtraida).toLocaleDateString('es-BO')}
        </p>
      </div>

      <ScoreBar score={match.matchScore} />

      {/* La salida visible del razonamiento del agente. No es letra chica:
          es la prueba de que el modelo decidio y no solo listo resultados. */}
      <div className="rounded-md bg-surface-accent p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-accent">
          Por que calza con vos
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
          {match.porQueCalza}
        </p>
      </div>

      <footer className="flex items-center justify-end gap-2">
        <Button
          variante="secundario"
          onClick={() => onGuardar(match)}
          aria-pressed={match.estado === 'guardado'}
        >
          {match.estado === 'guardado' ? 'Guardada' : 'Guardar'}
        </Button>
        <Button variante="acento" onClick={() => onAbrir(match)}>
          Ver detalle
        </Button>
      </footer>
    </article>
  );
}
