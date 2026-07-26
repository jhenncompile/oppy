import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Panel } from '../components/Panel.jsx';
import { Button } from '../components/Button.jsx';
import { TrustBadge } from '../components/TrustBadge.jsx';
import { ScoreBar } from '../components/ScoreBar.jsx';
import { usePerfil } from '../hooks/usePerfil.jsx';
import { useMatchesCompartidos } from '../Layout.jsx';
import { diasRestantes, enSeguimiento } from '../hooks/useMatches.js';
import { api } from '../api/client.js';

const FECHA = new Intl.DateTimeFormat('es-BO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

const legible = (slug) => slug.replace(/_/g, ' ');

/**
 * El checklist vive en localStorage y no en el servidor.
 *
 * Es estado del usuario sobre su propio proceso, no dato del dominio: que
 * alguien haya conseguido su carta de motivacion no le importa a nadie mas, y
 * meterlo en la base obligaria a una tabla y un endpoint para algo que hoy solo
 * se mira desde un dispositivo.
 */
function useChecklist(matchId, brechas) {
  const clave = `oppy.checklist.${matchId}`;
  const [hechas, setHechas] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(clave) ?? '[]'));
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    localStorage.setItem(clave, JSON.stringify([...hechas]));
  }, [clave, hechas]);

  const alternar = (brecha) =>
    setHechas((previas) => {
      const siguientes = new Set(previas);
      if (siguientes.has(brecha)) siguientes.delete(brecha);
      else siguientes.add(brecha);
      return siguientes;
    });

  // Solo cuentan las que siguen siendo brechas: si el agente reevalua y una
  // desaparece, no deberia seguir sumando al progreso.
  const completas = brechas.filter((brecha) => hechas.has(brecha)).length;

  return { hechas, alternar, completas };
}

function Cuenta({ fechaLimite }) {
  const dias = diasRestantes(fechaLimite);

  if (dias === null) {
    return <span className="text-ink-secondary">Sin fecha limite publicada</span>;
  }
  if (dias < 0) {
    return <span className="text-trust-stale-text">El plazo ya vencio</span>;
  }

  const texto =
    dias === 0 ? 'Cierra hoy' : dias === 1 ? 'Cierra maniana' : `Faltan ${dias} dias`;

  return (
    <span className={dias <= 3 ? 'font-medium text-trust-stale-text' : 'text-ink'}>
      {texto} · {FECHA.format(new Date(fechaLimite))}
    </span>
  );
}

function Bloque({ titulo, children }) {
  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">
        {titulo}
      </h3>
      <div className="mt-2 text-sm leading-relaxed text-ink">{children}</div>
    </section>
  );
}

export function Detalle() {
  const { matchId } = useParams();
  const { perfil } = usePerfil();
  const { matches, cargando, cambiarEstado } = useMatchesCompartidos();
  const navegar = useNavigate();

  const match = matches.find((m) => m.id === matchId);
  const brechas = match?.brechas ?? [];
  const { hechas, alternar, completas } = useChecklist(matchId, brechas);

  if (!perfil) return <Navigate to="/" replace />;

  if (cargando) {
    return (
      <Panel>
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-32 rounded-full bg-surface-hover" />
          <div className="h-8 w-3/4 rounded bg-surface-hover" />
          <div className="h-32 rounded-md bg-surface-hover" />
        </div>
      </Panel>
    );
  }

  if (!match) {
    return (
      <Panel centrado>
        <p className="text-lg font-medium text-ink">No encontre esa oportunidad.</p>
        <p className="mt-2 text-sm text-ink-secondary">
          Puede que la hayas descartado, o que ya no este vigente.
        </p>
        <div className="mt-6">
          <Link to="/oportunidades">
            <Button variante="primario">Ver mis oportunidades</Button>
          </Link>
        </div>
      </Panel>
    );
  }

  const { oportunidad } = match;
  const misHabilidades = new Set(perfil.habilidades ?? []);
  const enSeg = enSeguimiento(match);

  const postular = () => {
    api.registrarEvento({
      userId: perfil.id,
      opportunityId: oportunidad.id,
      tipo: 'clic'
    });
    if (!enSeg) cambiarEstado(match, 'preparando');
    window.open(oportunidad.linkAplicacion, '_blank', 'noopener,noreferrer');
  };

  const descartar = async () => {
    await cambiarEstado(match, 'descartado');
    navegar('/oportunidades');
  };

  return (
    <Panel>
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <Link
          to="/oportunidades"
          className="self-start text-sm text-ink-secondary underline underline-offset-2 hover:text-ink"
        >
          ← Volver a mis oportunidades
        </Link>

        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <TrustBadge confianza={oportunidad.confianza} />
            <span className="pill bg-surface-subtle capitalize text-ink-secondary">
              {legible(oportunidad.categoria)}
            </span>
            {oportunidad.sponsored && (
              <span className="pill bg-surface-subtle text-ink-secondary">Patrocinada</span>
            )}
          </div>

          <h2 className="font-display text-2xl font-bold leading-snug text-ink sm:text-3xl">
            {oportunidad.titulo}
          </h2>

          <ScoreBar score={match.compatibilidad} />

          {/* Si no es elegible se dice de frente y arriba, no escondido abajo:
              hacer perder el tiempo a alguien es peor que darle una mala noticia. */}
          {match.elegible === false && (
            <p className="rounded-md border border-trust-stale-border bg-trust-stale-bg p-3 text-sm text-trust-stale-text">
              Hay un requisito que hoy no cumplis. Podes postular igual, pero
              conviene que mires primero lo que falta.
            </p>
          )}
        </header>

        {/* Las razones son la salida del razonamiento del agente: van primero y
            con peso propio, nunca como letra chica. */}
        <div className="rounded-lg bg-surface-accent p-5">
          <Bloque titulo="Por que calza con vos">
            <ul className="flex flex-col gap-2">
              {match.razones?.map((razon) => (
                <li key={razon} className="flex gap-2">
                  <span aria-hidden="true" className="text-trust-verified-text">✓</span>
                  <span>{razon}</span>
                </li>
              ))}
            </ul>
          </Bloque>
        </div>

        {brechas.length > 0 && (
          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">
                Para postular te falta
              </h3>
              <span className="text-xs text-ink-secondary">
                {completas} de {brechas.length} listo{completas === 1 ? '' : 's'}
              </span>
            </div>

            {/* Marcable: la brecha detectada deja de ser un diagnostico y pasa a
                ser una tarea que la persona puede ir cerrando. */}
            <ul className="mt-3 flex flex-col gap-1">
              {brechas.map((brecha) => {
                const hecha = hechas.has(brecha);
                return (
                  <li key={brecha}>
                    <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-surface-hover">
                      <input
                        type="checkbox"
                        checked={hecha}
                        onChange={() => alternar(brecha)}
                        className="h-4 w-4 shrink-0 accent-[var(--accent-solid)]"
                      />
                      <span
                        className={
                          hecha ? 'text-sm text-ink-secondary line-through' : 'text-sm text-ink'
                        }
                      >
                        {brecha}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <div className="grid gap-6 sm:grid-cols-2">
          <Bloque titulo="Cuando cierra">
            <Cuenta fechaLimite={oportunidad.fechaLimite} />
          </Bloque>

          {oportunidad.montoBeneficio && (
            <Bloque titulo="Que incluye">{oportunidad.montoBeneficio}</Bloque>
          )}
        </div>

        {oportunidad.elegibilidad && (
          <Bloque titulo="Quienes pueden postular">{oportunidad.elegibilidad}</Bloque>
        )}

        {oportunidad.skills?.length > 0 && (
          <Bloque titulo="Lo que piden">
            <ul className="flex flex-wrap gap-1.5">
              {oportunidad.skills.map((skill) => {
                const laTengo = misHabilidades.has(skill);
                return (
                  <li
                    key={skill}
                    className={[
                      'pill capitalize',
                      laTengo
                        ? 'border border-line-accent bg-surface-accent font-medium text-ink-accent'
                        : 'bg-surface-subtle text-ink-secondary'
                    ].join(' ')}
                  >
                    {legible(skill)}
                    {laTengo && <span className="sr-only"> — ya lo tenes</span>}
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-ink-secondary">
              Lo resaltado es lo que ya cargaste en tu perfil.
            </p>
          </Bloque>
        )}

        {/* La fuente sostiene la credibilidad del producto entero: se muestra
            completa, con enlace y fecha, nunca escondida. */}
        <Bloque titulo="De donde lo saque">
          <a
            href={oportunidad.fuente.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-accent underline underline-offset-2"
          >
            {oportunidad.fuente.nombre}
          </a>
          <p className="mt-1 text-xs text-ink-secondary">
            Revisado el {FECHA.format(new Date(oportunidad.fechaExtraida))}
          </p>
        </Bloque>

        <footer className="flex flex-wrap items-center gap-3 border-t border-line-subtle pt-6">
          <Button variante="primario" tamano="lg" onClick={postular}>
            Postular
          </Button>
          <Button
            variante="secundario"
            onClick={() => cambiarEstado(match, enSeg ? 'visto' : 'guardado')}
            aria-pressed={enSeg}
          >
            {enSeg ? '♥ Guardada' : '♡ Guardar'}
          </Button>
          <button
            type="button"
            onClick={descartar}
            className="ml-auto min-h-[44px] text-sm text-ink-secondary underline underline-offset-2 hover:text-ink"
          >
            No me interesa
          </button>
        </footer>
      </div>
    </Panel>
  );
}
