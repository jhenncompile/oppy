import { Icono } from './Icono.jsx';

/**
 * Senal de confianza de la fuente.
 *
 * El estado se comunica SIEMPRE con icono + texto, nunca solo con color: de
 * otro modo seria invisible para daltonismo y para lectores de pantalla. Cada
 * nivel lleva ademas una forma distinta — escudo, reloj, triangulo — asi que
 * los tres se distinguen incluso impresos en blanco y negro.
 */
const ESTADOS = {
  verificada: {
    etiqueta: 'Verificada',
    descripcion: 'Publicada por una fuente oficial',
    clases: 'bg-trust-verified-bg border-trust-verified-border text-trust-verified-text',
    icono: 'escudo'
  },
  por_validar: {
    etiqueta: 'Por validar',
    descripcion: 'Fuente comunitaria, todavia sin confirmar',
    clases: 'bg-trust-pending-bg border-trust-pending-border text-trust-pending-text',
    icono: 'reloj'
  },
  desactualizada: {
    etiqueta: 'Desactualizada',
    descripcion: 'El plazo vencio o no tiene fecha verificable',
    clases: 'bg-trust-stale-bg border-trust-stale-border text-trust-stale-text',
    icono: 'alerta'
  }
};

export function TrustBadge({ confianza }) {
  const estado = ESTADOS[confianza] ?? ESTADOS.por_validar;

  return (
    <span className={`pill border ${estado.clases}`} title={estado.descripcion}>
      <Icono nombre={estado.icono} tamanio={13} />
      {estado.etiqueta}
      <span className="sr-only">. {estado.descripcion}</span>
    </span>
  );
}
