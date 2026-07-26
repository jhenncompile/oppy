const VARIANTES = {
  // Pildora oscura: el gesto de llamada a la accion principal de la pagina
  primario: 'bg-ink text-surface-card hover:opacity-90',
  acento: 'bg-accent text-ink-inverse hover:bg-accent-hover',
  secundario: 'border border-line bg-transparent text-ink hover:bg-surface-hover'
};

const TAMANOS = {
  // 44px de alto minimo: area tactil accesible
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3.5 text-base'
};

export function Button({
  variante = 'acento',
  tamano = 'md',
  className = '',
  children,
  ...props
}) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center gap-2 rounded-full font-medium',
        'transition disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTES[variante],
        TAMANOS[tamano],
        className
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  );
}
