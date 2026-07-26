import { EventEmitter } from 'node:events';

/**
 * Registro en memoria del progreso de cada corrida.
 *
 * Existe para una razon de producto, no tecnica: la pantalla de proceso en
 * vivo necesita narrar lo que el agente esta haciendo. Un spinner generico no
 * demuestra nada; ver "buscando en Embajada de Japon..." si.
 *
 * En memoria a proposito — es estado efimero de una corrida. La bitacora
 * durable vive en la tabla `agent_runs`.
 */
const corridas = new Map();
const TTL_MS = 10 * 60 * 1000;

export function crear(runId) {
  const corrida = {
    id: runId,
    estado: 'en_curso',
    pasos: [],
    emitter: new EventEmitter(),
    creadaEn: Date.now()
  };
  // Puede haber varios clientes escuchando la misma corrida.
  corrida.emitter.setMaxListeners(20);
  corridas.set(runId, corrida);
  limpiarViejas();
  return corrida;
}

export function emitir(runId, paso) {
  const corrida = corridas.get(runId);
  if (!corrida) return;

  const conSello = { ...paso, en: new Date().toISOString() };
  corrida.pasos.push(conSello);
  corrida.emitter.emit('paso', conSello);
}

export function finalizar(runId, { estado, resumen = null }) {
  const corrida = corridas.get(runId);
  if (!corrida) return;

  corrida.estado = estado;
  corrida.emitter.emit('fin', { estado, resumen });
}

export function obtener(runId) {
  return corridas.get(runId) ?? null;
}

/**
 * Suscribe un cliente. Reenvia primero los pasos ya ocurridos, para que quien
 * llega tarde vea la narracion completa y no solo el final.
 *
 * @returns {() => void} funcion para cancelar la suscripcion
 */
export function suscribir(runId, { onPaso, onFin }) {
  const corrida = corridas.get(runId);
  if (!corrida) return null;

  for (const paso of corrida.pasos) onPaso(paso);

  if (corrida.estado !== 'en_curso') {
    onFin({ estado: corrida.estado });
    return () => {};
  }

  corrida.emitter.on('paso', onPaso);
  corrida.emitter.on('fin', onFin);

  return () => {
    corrida.emitter.off('paso', onPaso);
    corrida.emitter.off('fin', onFin);
  };
}

function limpiarViejas() {
  const limite = Date.now() - TTL_MS;
  for (const [id, corrida] of corridas) {
    if (corrida.creadaEn < limite) {
      corrida.emitter.removeAllListeners();
      corridas.delete(id);
    }
  }
}
