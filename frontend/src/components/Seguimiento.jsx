/**
 * Estado de seguimiento de una oportunidad.
 *
 * El seguimiento avanza: guardada -> preparando -> aplicada -> entrevista ->
 * finalizada. Se muestra como un solo control y no como una linea de tiempo
 * completa porque en una lista de tarjetas la linea de tiempo compite con lo
 * que importa, que es por que la oportunidad calza.
 *
 * Guardar no es aplicar. La interfaz no debe empujar a confundirlos: el paso
 * siguiente se ofrece, nunca se asume.
 */
const ETAPAS = [
  { valor: 'guardado', etiqueta: 'Guardada', siguiente: 'Prepararla' },
  { valor: 'preparando', etiqueta: 'Preparando', siguiente: 'Ya apliqué' },
  { valor: 'aplicada', etiqueta: 'Aplicada', siguiente: 'Me llamaron' },
  { valor: 'entrevista', etiqueta: 'En entrevista', siguiente: 'Cerrar' },
  { valor: 'finalizada', etiqueta: 'Finalizada', siguiente: null }
];

const POR_VALOR = new Map(ETAPAS.map((etapa) => [etapa.valor, etapa]));

export function Seguimiento({ estado, onCambiar }) {
  const etapa = POR_VALOR.get(estado);

  // Sin seguimiento todavia: no hay nada que mostrar aca.
  if (!etapa) return null;

  const indice = ETAPAS.indexOf(etapa);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md bg-surface-subtle px-3 py-2">
      <span className="text-xs font-medium text-ink">{etapa.etiqueta}</span>

      {/* El progreso se comunica con texto ademas de con los puntos: un estado
          que solo se ve nunca llega a quien usa lector de pantalla. */}
      <span className="sr-only">
        Paso {indice + 1} de {ETAPAS.length}
      </span>
      <span aria-hidden="true" className="flex gap-1">
        {ETAPAS.map((paso, i) => (
          <span
            key={paso.valor}
            className={`h-1.5 w-1.5 rounded-full ${
              i <= indice ? 'bg-accent' : 'bg-line-subtle'
            }`}
          />
        ))}
      </span>

      {etapa.siguiente && (
        <button
          type="button"
          onClick={() => onCambiar(ETAPAS[indice + 1].valor)}
          className="ml-auto min-h-[44px] text-xs font-medium text-ink-accent underline underline-offset-2 hover:opacity-80"
        >
          {etapa.siguiente}
        </button>
      )}
    </div>
  );
}
