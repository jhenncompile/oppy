import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'db' });

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000
});

pool.on('error', (error) => {
  log.error('Cliente inactivo fallo', { error: error.message });
});

/**
 * Unico punto de acceso a la base. Las consultas lentas se registran para
 * que un cuello de botella se note antes de que lo note el usuario.
 */
export async function query(text, params = []) {
  const startedAt = Date.now();
  const result = await pool.query(text, params);
  const durationMs = Date.now() - startedAt;

  if (durationMs > 500) {
    log.warn('Consulta lenta', { durationMs, rows: result.rowCount });
  }

  return result;
}

/** Devuelve la primera fila, o null. Evita el `rows[0] ?? null` repetido. */
export async function queryOne(text, params = []) {
  const { rows } = await query(text, params);
  return rows[0] ?? null;
}

/** Ejecuta una funcion dentro de una transaccion, con rollback automatico. */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  await pool.end();
  log.info('Pool de conexiones cerrado');
}
