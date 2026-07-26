/**
 * Panel apilado.
 *
 * Es el gesto visual que define la pagina: bloques grandes, muy redondeados,
 * flotando sobre el fondo calido con mucho aire alrededor.
 */
export function Panel({ children, className = '', centrado = false }) {
  return (
    <section className={`panel panel-padding ${className}`}>
      <div className={`mx-auto w-full max-w-panel ${centrado ? 'text-center' : ''}`}>
        {children}
      </div>
    </section>
  );
}

export function PanelTitulo({ children, sobretitulo }) {
  return (
    <header className="flex flex-col items-center gap-4">
      {sobretitulo && (
        <span className="pill border border-line-subtle bg-surface-subtle text-ink-secondary">
          {sobretitulo}
        </span>
      )}
      <h2 className="max-w-2xl text-balance font-display text-display font-bold text-ink">
        {children}
      </h2>
    </header>
  );
}
