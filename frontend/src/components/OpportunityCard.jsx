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

  // Solo se pone urgente cuando de verdad lo es. Si todo grita, nada grita.
  const urgente = dias <= 3;
  const texto = dias === 0 ? 'Cierra hoy' : `Cierra en ${dias} ${dias === 1 ? 'dia' : 'dias'}`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${
        urgente ? 'text-trust-stale-text' : 'text-ink-secondary'
      }`}
    >
      {/* El reloj solo aparece cuando corre el plazo: un icono en cada fecha
          seria ruido, en las tres que cierran esta semana es una senial. */}
      {urgente && <Icono nombre="reloj" tamanio={13} />}
      {texto}
    </span>
  );
}

export function OpportunityCard({ match, onGuardar, onSeguimiento }) {
  const { oportunidad } = match;
  const guardada = match.estado !== 'nuevo' && match.estado !== 'visto';

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

      {/* La salida visible del razonamiento del agente. No es letra chica:
          es la prueba de que el modelo decidio y no solo listo resultados. */}
      <div className="rounded-md bg-surface-accent p-4">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-accent">
          <Icono nombre="chispas" tamanio={13} />
          Por que calza con tu perfil
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {match.razones?.map((razon) => (
            <li key={razon} className="flex gap-2 text-sm leading-relaxed text-ink-secondary">
              {/* El icono acompana al texto, nunca lo reemplaza: el estado
                  tiene que entenderse tambien leido por un lector de pantalla. */}
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

      <footer className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variante="secundario"
          onClick={() => onGuardar(match)}
          aria-pressed={guardada}
        >
          {/* El marcador relleno es lo que distingue guardada de no guardada de
              un vistazo; el texto igual cambia, para quien no ve el icono. */}
          <Icono nombre="marcador" tamanio={15} relleno={guardada} />
          {guardada ? 'Quitar' : 'Guardar'}
        </Button>
        {/* Lleva al detalle, no al enlace externo: sacar a alguien del producto
            antes de que vea por que le sirve es perderlo. */}
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
