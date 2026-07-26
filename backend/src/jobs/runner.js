import { logger } from '../utils/logger.js';
import { closePool } from '../db/index.js';
import { correrDescubrimiento } from './descubrimientoJob.js';

const log = logger.child({ module: 'runner' });

/**
 * Ejecucion unica del descubrimiento, pensada para un Render Cron Job:
 * corre, reporta y sale. Comparte el job con el cron embebido, asi que no
 * hay dos caminos de codigo que puedan divergir.
 */
try {
  const resumen = await correrDescubrimiento();
  log.info('Runner finalizado', resumen);
} catch (error) {
  log.error('Runner fallido', { error: error.message });
  process.exitCode = 1;
} finally {
  await closePool();
}
