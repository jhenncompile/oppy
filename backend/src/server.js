import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { crearApp } from './app.js';
import { closePool } from './db/index.js';
import { migrate } from './db/migrate.js';
import { programar } from './jobs/cron.js';

const log = logger.child({ module: 'server' });

// El esquema es idempotente, asi que aplicarlo al arrancar deja el servicio
// listo en un despliegue limpio sin un paso manual que alguien pueda olvidar.
await migrate();

const app = crearApp();
const server = app.listen(env.PORT, () => {
  log.info('Oppy escuchando', {
    puerto: env.PORT,
    entorno: env.NODE_ENV,
    capacidades: env.features
  });
});

const tareaCron = programar();

/**
 * Apagado ordenado: se deja de aceptar conexiones, se detiene el cron y se
 * cierra el pool. Sin esto, un redespliegue puede cortar una corrida a la
 * mitad y dejar filas en estado 'en_curso' para siempre.
 */
async function apagar(senal) {
  log.info('Apagando', { senal });

  tareaCron?.stop();
  server.close();

  try {
    await closePool();
  } catch (error) {
    log.error('Error al cerrar el pool', { error: error.message });
  }

  process.exit(0);
}

process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));
