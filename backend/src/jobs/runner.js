import { logger } from '../utils/logger.js';
import { closePool } from '../db/index.js';
import { correrDescubrimiento } from './descubrimientoJob.js';
import { correrRecordatorios } from './recordatoriosJob.js';

const log = logger.child({ module: 'runner' });

/**
 * Ejecucion unica de la corrida autonoma, pensada para un Render Cron Job:
 * corre, reporta y sale. Comparte los jobs con el cron embebido, asi que no
 * hay dos caminos de codigo que puedan divergir.
 *
 * Los dos pasos van en try separados a proposito. El descubrimiento necesita
 * el modelo; los recordatorios solo necesitan fechas que alguien anoto. Si un
 * fallo del primero se llevara puesto al segundo, un despliegue sin modelo
 * servido dejaria de avisar de plazos que la persona pidio que le recuerden —
 * y eso es lo unico que el sistema le prometio directamente.
 */
let huboFallo = false;

try {
  const resumen = await correrDescubrimiento();
  log.info('Descubrimiento finalizado', resumen);
} catch (error) {
  huboFallo = true;
  log.error('Descubrimiento fallido', { error: error.message });
}

try {
  const resumen = await correrRecordatorios();
  log.info('Recordatorios finalizados', resumen);
} catch (error) {
  huboFallo = true;
  log.error('Recordatorios fallidos', { error: error.message });
}

if (huboFallo) process.exitCode = 1;

await closePool();
