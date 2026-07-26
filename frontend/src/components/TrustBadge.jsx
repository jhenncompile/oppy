/**
 * Senal de confianza de la fuente.
 *
 * El estado se comunica SIEMPRE con punto + texto, nunca solo con color:
 * de otro modo seria invisible para daltonismo y para lectores de pantalla.
 */
const ESTADOS = {
  verificada: {
    etiqueta: 'Verificada',
    descripcion: 'Publicada por una fuente oficial',
    clases: 'bg-trust-verified-bg border-trust-verified-border text-trust-verified-text',
    punto: 'bg-trust-verified-solid'
  },
  por_validar: {
    etiqueta: 'Por validar',
    descripcion: 'Fuente comunitaria, todavia sin confirmar',
    clases: 'bg-trust-pending-bg border-trust-pending-border text-trust-pending-text',
    punto: 'bg-trust-pending-solid'
  },
  desactualizada: {
    etiqueta: 'Desactualizada',
    descripcion: 'El plazo vencio o no tiene fecha verificable',
    clases: 'bg-trust-stale-bg border-trust-stale-border text-trust-stale-text',
    punto: 'bg-trust-stale-solid'
  }
};

export function TrustBadge({ confianza }) {
  const estado = ESTADOS[confianza] ?? ESTADOS.por_validar;

  return (
    <span className={`pill border ${estado.clases}`} title={estado.descripcion}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${estado.punto}`} aria-hidden="true" />
      {estado.etiqueta}
      <span className="sr-only">. {estado.descripcion}</span>
    </span>
  );
}
