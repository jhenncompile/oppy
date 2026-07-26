import { Button } from './Button.jsx';
import { Icono } from './Icono.jsx';
import { Seguimiento } from './Seguimiento.jsx';
import { diasRestantes } from '../hooks/useMatches.js';

/**
 * Una oportunidad de la libreta propia.
 *
 * Deliberadamente NO es una OpportunityCard. Le faltan tres cosas y ninguna es
 * un olvido:
 *
 *   - Sin badge de confianza. El semaforo es una afirmacion de Oppy sobre una
 *     fuente que reviso. Esta no la reviso nadie, y pintarla de amarillo seria
 *     afirmar algo igual.
 *   - Sin barra de compatibilidad. La persona ya decidio que le interesa.
 *   - Sin "por que calza". No hay razonamiento que mostrar, y fabricar uno
 *     seria justo lo que el producto promete no hacer.
 *
 * Lo que si lleva es el sello de quien la puso, porque un dia esta lista va a
 * tener veinte cosas y hay que poder distinguir lo que encontro Oppy de lo que
 * encontro uno mismo.
 */
function Plazo({ fechaLimite }) {
  const dias = diasRestantes(fechaLimite);
  if (dias === null) return null;

  const vencida = dias < 0;
  const urgente = !vencida && dias <= 7;

  return (
    <span
      className={[
        'pill',
        vencida
          ? 'bg-surface-subtle text-ink-secondary'
          : urgente
            ? 'bg-trust-pending-bg text-trust-pending-text'
            : 'bg-surface-subtle text-ink-secondary'
      ].join(' ')}
    >
      <Icono nombre={urgente ? 'alerta' : 'reloj'} tamanio={13} />
      {vencida
        ? 'Ya cerro'
        : dias === 0
          ? 'Cierra hoy'
          : dias === 1
            ? 'Cierra en 1 dia'
            : `En ${dias} dias`}
    </span>
  );
}

export function PropiaCard({ propia, onCambiarEstado, onEliminar }) {
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-line-subtle bg-surface-card p-5 shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <span className="pill bg-surface-accent text-ink-accent">
          <Icono nombre="marcador" tamanio={13} relleno />
          La anotaste tu
        </span>
        <Plazo fechaLimite={propia.fechaLimite} />
      </header>

      <div className="flex flex-col gap-1">
        <h3 className="break-words text-lg font-semibold leading-snug text-ink">{propia.titulo}</h3>
        {(propia.organizacion || propia.donde) && (
          <p className="break-words text-xs text-ink-secondary">
            {[propia.organizacion, propia.donde].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      {propia.notas && (
        <p className="whitespace-pre-line break-words rounded-md bg-surface-subtle p-3 text-sm text-ink-secondary">
          {propia.notas}
        </p>
      )}

      <Seguimiento
        estado={propia.estado}
        onCambiar={(estado) => onCambiarEstado(propia, estado)}
      />

      <footer className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variante="secundario"
          onClick={() => onEliminar(propia)}
          aria-label={`Borrar ${propia.titulo} de mi libreta`}
        >
          <Icono nombre="equis" tamanio={15} />
          Borrar
        </Button>

        {/* El enlace externo si va directo: aca no hay detalle que mostrar
            primero, porque Oppy no tiene nada que agregar sobre esta. */}
        {propia.enlace && (
          <a href={propia.enlace} target="_blank" rel="noopener noreferrer">
            <Button variante="acento">
              <Icono nombre="enlace-externo" tamanio={15} />
              Abrir
            </Button>
          </a>
        )}
      </footer>
    </article>
  );
}
