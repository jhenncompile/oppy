/**
 * Barra de compatibilidad.
 *
 * El numero acompana siempre a la barra: la longitud sola no es un dato
 * accesible, y ademas el valor exacto es lo que genera confianza.
 */
export function ScoreBar({ score }) {
  const valor = Math.max(0, Math.min(100, score));

  return (
    <div className="flex items-center gap-3">
      <div
        className="h-1.5 w-36 overflow-hidden rounded-full bg-score-track"
        role="progressbar"
        aria-valuenow={valor}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Compatibilidad con tu perfil"
      >
        <div
          className="h-full rounded-full bg-score-fill transition-[width] duration-500"
          style={{ width: `${valor}%` }}
        />
      </div>
      <span className="text-sm font-semibold text-score-text">{valor}%</span>
      <span className="text-sm text-ink-muted">compatible</span>
    </div>
  );
}
