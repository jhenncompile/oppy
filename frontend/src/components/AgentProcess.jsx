/**
 * Narracion del proceso en vivo.
 *
 * Es la pantalla mas importante de la demo. Un spinner generico no demuestra
 * nada; ver al agente decidir que buscar, rastrear fuentes con nombre propio y
 * razonar sobre compatibilidad es lo que convierte la espera en evidencia de
 * que no hay nada precargado.
 */

const ICONOS = {
  perfil: '◆',
  plan_inicio: '◇',
  plan_fin: '◆',
  descubrimiento_inicio: '◇',
  fuente_inicio: '·',
  fuente_fin: '·',
  busqueda_inicio: '·',
  busqueda_fin: '·',
  descubrimiento_fin: '◆',
  normalizacion_inicio: '◇',
  normalizacion_fin: '◆',
  indice: '◆',
  scoring_inicio: '◇',
  scoring_fin: '◆',
  error: '✕'
};

/** Los pasos de detalle no traen mensaje: se arma aca para no ensuciar el backend. */
function textoDe(paso) {
  switch (paso.tipo) {
    case 'fuente_inicio':
      return `Consultando ${paso.fuente}`;
    case 'fuente_fin':
      return paso.exito ? `${paso.fuente} respondio` : `${paso.fuente} no respondio`;
    case 'busqueda_inicio':
      return `Buscando: "${paso.query}"`;
    case 'busqueda_fin':
      return `"${paso.query}" — ${paso.encontrados} resultados`;
    default:
      return paso.mensaje ?? paso.tipo;
  }
}

const ES_DETALLE = new Set([
  'fuente_inicio',
  'fuente_fin',
  'busqueda_inicio',
  'busqueda_fin'
]);

export function AgentProcess({ pasos, estado }) {
  return (
    <div className="mx-auto w-full max-w-xl">
      <ol className="flex flex-col gap-2.5" aria-live="polite" aria-busy={estado === 'en_curso'}>
        {pasos.map((paso, indice) => {
          const detalle = ES_DETALLE.has(paso.tipo);
          const esError = paso.tipo === 'error';

          return (
            <li
              key={`${paso.tipo}-${paso.en}-${indice}`}
              className={[
                'flex items-start gap-3 text-sm',
                detalle ? 'pl-6 text-ink-secondary' : 'text-ink-secondary',
                esError ? 'text-trust-stale-text' : ''
              ].join(' ')}
            >
              <span className="mt-0.5 select-none text-xs" aria-hidden="true">
                {ICONOS[paso.tipo] ?? '·'}
              </span>
              <span className={detalle ? '' : 'font-medium'}>{textoDe(paso)}</span>
            </li>
          );
        })}

        {estado === 'en_curso' && (
          <li className="flex items-center gap-3 pl-6 text-sm text-ink-secondary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden="true" />
            trabajando…
          </li>
        )}
      </ol>
    </div>
  );
}
