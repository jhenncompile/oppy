import cron from 'node-cron';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { correrDescubrimiento } from './descubrimientoJob.js';

const log = logger.child({ module: 'cron' });

let enCurso = false;

/**
 * Programa el descubrimiento autonomo dentro del proceso del servidor.
 *
 * Alternativa en Render: usar un Cron Job nativo que ejecute `npm run cron`,
 * que corre el mismo job en un proceso aparte. Cualquiera de las dos sirve;
 * la de aqui tiene la ventaja de no requerir configuracion extra.
 *
 * @returns {import('node-cron').ScheduledTask | null}
 */
export function programar() {
  if (!env.cronEnabled) {
    log.info('Cron desactivado (CRON_ENABLED=false)');
    return null;
  }

  if (!cron.validate(env.CRON_SCHEDULE)) {
    log.error('CRON_SCHEDULE invalido, no se programa nada', {
      schedule: env.CRON_SCHEDULE
    });
    return null;
  }

  const tarea = cron.schedule(env.CRON_SCHEDULE, async () => {
    // Una corrida puede durar mas que el intervalo. Solapar dos significaria
    // pagar dos veces por el mismo descubrimiento.
    if (enCurso) {
      log.warn('Se omite la corrida: la anterior sigue en curso');
      return;
    }

    enCurso = true;
    try {
      await correrDescubrimiento();
    } catch (error) {
      log.error('Corrida programada fallida', { error: error.message });
    } finally {
      enCurso = false;
    }
  });

  log.info('Cron programado', { schedule: env.CRON_SCHEDULE });
  return tarea;
}
