/**
 * Barra de compatibilidad.
 *
 * El numero acompana siempre a la barra: la longitud sola no es un dato
 * accesible, y ademas el valor exacto es lo que genera confianza.
 */
export function ScoreBar({ score }) {
  const valor = Math.max(0, Math.min(100, score));

  return (
    // La barra se achica en pantallas angostas en vez de empujar al texto
    // fuera de la tarjeta: en 320px, 144px de barra mas "92% compatible" no
    // entran, y lo que se perdia era el numero.
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <div
        className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-score-track sm:w-36"
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
      <span className="text-sm text-ink-secondary">compatible</span>
    </div>
  );
}
