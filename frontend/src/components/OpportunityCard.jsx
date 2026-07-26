import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TrustBadge } from './TrustBadge.jsx';
import { ScoreBar } from './ScoreBar.jsx';
import { Button } from './Button.jsx';
import { Seguimiento } from './Seguimiento.jsx';
import { Icono, iconoDeCategoria } from './Icono.jsx';

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
  if (dias === null) return <span className="text-xs text-ink-secondary">Sin fecha limite</span>;
  if (dias < 0) return <span className="text-xs text-ink-secondary">Cerrada</span>;

  const urgente = dias <= 3;
  const texto = dias === 0 ? 'Cierra hoy' : `Cierra en ${dias} ${dias === 1 ? 'dia' : 'dias'}`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${
        urgente ? 'text-trust-stale-text' : 'text-ink-secondary'
      }`}
    >
      {urgente && <Icono nombre="reloj" tamanio={13} />}
      {texto}
    </span>
  );
}

export function OpportunityCard({ match, onGuardar, onSeguimiento, onMalaInfo }) {
  const { oportunidad } = match;
  const guardada = match.estado !== 'nuevo' && match.estado !== 'visto';
  const [mostrandoFeedback, setMostrandoFeedback] = useState(false);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviarMalaInfo = async () => {
    if (!onMalaInfo || enviando) return;
    setEnviando(true);
    try {
      await onMalaInfo(match, comentario.trim());
      setMostrandoFeedback(false);
      setComentario('');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-line-subtle bg-surface-card p-5 shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <TrustBadge confianza={oportunidad.confianza} />
        <div className="flex items-center gap-3">
          {oportunidad.sponsored && (
            <span className="pill bg-surface-subtle text-ink-secondary">Patrocinada</span>
          )}
          <span className="pill bg-surface-subtle text-ink-secondary capitalize">
            <Icono nombre={iconoDeCategoria(oportunidad.categoria)} tamanio={13} />
            {oportunidad.categoria}
          </span>
          <Deadline fechaLimite={oportunidad.fechaLimite} />
        </div>
      </header>

      <div className="flex flex-col gap-1">
        <h3 className="break-words text-lg font-semibold leading-snug text-ink">{oportunidad.titulo}</h3>
        <p className="text-xs text-ink-secondary">
          {oportunidad.fuente.nombre} · actualizado{' '}
          {new Date(oportunidad.fechaExtraida).toLocaleDateString('es-BO')}
        </p>
      </div>

      <ScoreBar score={match.compatibilidad} />

      <div className="rounded-md bg-surface-accent p-4">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-accent">
          <Icono nombre="chispas" tamanio={13} />
          Por que calza con tu perfil
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {match.razones?.map((razon) => (
            <li key={razon} className="flex gap-2 text-sm leading-relaxed text-ink-secondary">
              <Icono nombre="check" tamanio={15} className="mt-0.5 text-trust-verified-text" />
              <span>{razon}</span>
            </li>
          ))}
        </ul>

        {match.brechas?.length > 0 && (
          <div className="mt-4 border-t border-line-subtle pt-3">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-secondary">
              <Icono nombre="pendiente" tamanio={13} />
              Para postular te falta
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {match.brechas.map((brecha) => (
                <li key={brecha} className="flex gap-2 text-sm leading-relaxed text-ink-secondary">
                  <Icono nombre="pendiente" tamanio={15} className="mt-0.5" />
                  <span>{brecha}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {guardada && (
        <Seguimiento
          estado={match.estado}
          onCambiar={(estado) => onSeguimiento(match, estado)}
        />
      )}

      {mostrandoFeedback && (
        <div className="flex flex-col gap-2 rounded-md border border-line-subtle bg-surface-subtle p-3">
          <label htmlFor={`mala-info-${match.id}`} className="text-xs font-medium text-ink">
            ¿Qué estaba mal? (opcional)
          </label>
          <textarea
            id={`mala-info-${match.id}`}
            rows={2}
            maxLength={500}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Ej: ya cerro, es de Santa Cruz, invento el monto…"
            className="w-full resize-y rounded-md border border-line-subtle bg-surface-card px-3 py-2 text-sm text-ink placeholder:text-ink-muted"
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variante="secundario"
              type="button"
              disabled={enviando}
              onClick={() => {
                setMostrandoFeedback(false);
                setComentario('');
              }}
            >
              Cancelar
            </Button>
            <Button
              variante="secundario"
              type="button"
              disabled={enviando}
              onClick={enviarMalaInfo}
            >
              {enviando ? 'Enviando…' : 'Enviar corrección'}
            </Button>
          </div>
        </div>
      )}

      <footer className="flex flex-wrap items-center justify-end gap-2">
        {onMalaInfo && !mostrandoFeedback && (
          <Button
            variante="secundario"
            type="button"
            onClick={() => setMostrandoFeedback(true)}
          >
            No es la información que buscaba
          </Button>
        )}
        <Button
          variante="secundario"
          onClick={() => onGuardar(match)}
          aria-pressed={guardada}
        >
          <Icono nombre="marcador" tamanio={15} relleno={guardada} />
          {guardada ? 'Quitar' : 'Guardar'}
        </Button>
        <Link to={`/oportunidad/${match.id}`}>
          <Button variante="acento">
            Ver detalle
            <Icono nombre="flecha-derecha" tamanio={15} />
          </Button>
        </Link>
      </footer>
    </article>
  );
}
