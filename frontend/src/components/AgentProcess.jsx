import { useEffect, useRef, useState } from 'react';
import { Icono } from './Icono.jsx';

/**
 * Narracion del proceso en vivo.
 *
 * Es la pantalla mas importante de la demo. Un spinner generico no demuestra
 * nada; ver al agente decidir que buscar, rastrear fuentes con nombre propio y
 * razonar sobre compatibilidad es lo que convierte la espera en evidencia de
 * que no hay nada precargado.
 */

/**
 * Cada etapa lleva el icono de lo que el agente esta haciendo, no un simbolo
 * decorativo: leer, buscar, filtrar, comparar. Es lo que hace que la lista se
 * entienda como trabajo y no como una barra de carga disfrazada.
 */
const ICONOS = {
  perfil: 'persona',
  plan_inicio: 'chispas',
  plan_fin: 'objetivo',
  descubrimiento_inicio: 'lupa',
  fuente_inicio: 'globo',
  busqueda_inicio: 'lupa',
  busqueda_fin: 'check',
  descubrimiento_fin: 'check-circulo',
  normalizacion_inicio: 'filtro',
  normalizacion_progreso: 'punto',
  normalizacion_fin: 'check-circulo',
  indice: 'base',
  scoring_inicio: 'balanza',
  scoring_fin: 'check-circulo',
  error: 'alerta'
};

/** Una fuente que no respondio se marca distinto, pero no como error. */
function iconoDe(paso) {
  if (paso.tipo === 'fuente_fin') return paso.exito ? 'check' : 'alerta';
  return ICONOS[paso.tipo] ?? 'punto';
}

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
  'busqueda_fin',
  'normalizacion_progreso'
]);

/** Una fuente que no respondio no es un error: que respondan 3 de 5 es un exito. */
const noRespondio = (paso) => paso.tipo === 'fuente_fin' && paso.exito === false;

const SILENCIO_MS = 10_000;

export function AgentProcess({ pasos, estado }) {
  const finRef = useRef(null);
  const [callado, setCallado] = useState(false);

  // El agente tarda decenas de segundos. Si pasa mucho sin un paso nuevo, la
  // pantalla no puede quedarse muda: el silencio se lee como que se colgo.
  useEffect(() => {
    setCallado(false);
    if (estado !== 'en_curso') return undefined;

    const temporizador = setTimeout(() => setCallado(true), SILENCIO_MS);
    return () => clearTimeout(temporizador);
  }, [pasos.length, estado]);

  // Sigue al ultimo paso, salvo que la persona haya scrolleado a leer algo.
  useEffect(() => {
    finRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [pasos.length]);

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
                'paso-entra flex items-start gap-3 text-sm',
                // Los hitos pesan mas que el detalle: sin jerarquia, catorce
                // lineas iguales se leen como ruido.
                detalle ? 'pl-6 text-ink-secondary' : 'font-medium text-ink',
                noRespondio(paso) ? 'text-trust-pending-text' : '',
                esError ? 'text-trust-stale-text' : ''
              ].join(' ')}
            >
              <Icono nombre={iconoDe(paso)} tamanio={detalle ? 14 : 17} className="mt-0.5" />
              <span>{textoDe(paso)}</span>
            </li>
          );
        })}

        {estado === 'en_curso' && (
          <li className="flex items-center gap-3 pl-6 text-sm text-ink-secondary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden="true" />
            {callado ? 'sigo trabajando…' : 'trabajando…'}
          </li>
        )}
      </ol>
      <div ref={finRef} />
    </div>
  );
}
