/**
 * Campos de formulario compartidos entre el onboarding y el perfil.
 *
 * Estan aca y no dentro de una pantalla porque editar el perfil tiene que
 * verse y comportarse igual que crearlo: si el usuario aprendio a usar el
 * onboarding, no deberia tener que reaprender nada despues.
 */

/** Grupo de opciones que se marcan con un toque. */
export function Opciones({
  leyenda,
  ayuda,
  opciones,
  seleccion,
  onCambiar,
  maximo = Infinity,
  etiquetaPrincipal = false
}) {
  const alternar = (valor) => {
    if (seleccion.includes(valor)) {
      return onCambiar(seleccion.filter((v) => v !== valor));
    }
    if (seleccion.length >= maximo) return undefined;
    // El orden de seleccion se conserva: lo primero marcado queda primero, y
    // eso es lo que el backend interpreta como principal.
    return onCambiar([...seleccion, valor]);
  };

  const lleno = seleccion.length >= maximo;

  return (
    <fieldset className="flex flex-col gap-2 text-left">
      <legend className="text-base font-medium text-ink">{leyenda}</legend>
      {ayuda && <p className="text-sm text-ink-secondary">{ayuda}</p>}

      <div className="mt-2 flex flex-wrap gap-2">
        {opciones.map((opcion) => {
          const activa = seleccion.includes(opcion.valor);
          const principal = etiquetaPrincipal && seleccion[0] === opcion.valor;
          // Al llegar al tope, lo no elegido se apaga. Lo elegido sigue
          // pulsable: sacar uno es como se cambia de opinion.
          const bloqueada = lleno && !activa;

          return (
            <button
              key={opcion.valor}
              type="button"
              onClick={() => alternar(opcion.valor)}
              aria-pressed={activa}
              disabled={bloqueada}
              title={opcion.nota}
              className={[
                // 44px de alto: area tactil accesible tambien en movil
                'min-h-[44px] rounded-full border px-4 py-2 text-sm transition',
                'disabled:cursor-not-allowed disabled:opacity-40',
                activa
                  ? 'border-line-accent bg-surface-accent font-medium text-ink-accent'
                  : 'border-line-subtle bg-surface-subtle text-ink-secondary hover:bg-surface-hover'
              ].join(' ')}
            >
              {opcion.etiqueta}
              {principal && (
                <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-ink-inverse">
                  Principal
                </span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Campo({ nombre, etiqueta, ayuda, opcional, valor, onCambiar, hijos, ...props }) {
  return (
    <div className="flex flex-col gap-1.5 text-left">
      <label htmlFor={nombre} className="text-base font-medium text-ink">
        {etiqueta}
        {opcional && <span className="ml-2 text-sm font-normal text-ink-secondary">opcional</span>}
      </label>
      {ayuda && (
        <p id={`${nombre}-ayuda`} className="text-sm text-ink-secondary">
          {ayuda}
        </p>
      )}

      {hijos ?? (
        <input
          id={nombre}
          name={nombre}
          value={valor}
          onChange={onCambiar}
          aria-describedby={ayuda ? `${nombre}-ayuda` : undefined}
          className="min-h-[44px] rounded-md border border-line-subtle bg-surface-subtle px-4 py-3 text-ink placeholder:text-ink-secondary focus:border-line-accent focus:outline-none"
          {...props}
        />
      )}
    </div>
  );
}

export function Selector({ nombre, etiqueta, ayuda, opciones, valor, onCambiar, opcional }) {
  return (
    <Campo
      nombre={nombre}
      etiqueta={etiqueta}
      ayuda={ayuda}
      opcional={opcional}
      hijos={
        <select
          id={nombre}
          name={nombre}
          value={valor}
          onChange={onCambiar}
          aria-describedby={ayuda ? `${nombre}-ayuda` : undefined}
          className="min-h-[44px] rounded-md border border-line-subtle bg-surface-subtle px-4 py-3 text-ink focus:border-line-accent focus:outline-none"
        >
          <option value="">Elegi una opcion</option>
          {opciones.map((opcion) => (
            <option key={opcion} value={opcion}>
              {opcion}
            </option>
          ))}
        </select>
      }
    />
  );
}
