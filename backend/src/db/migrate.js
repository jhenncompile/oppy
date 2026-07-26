import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool, closePool } from './index.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'migrate' });
const here = dirname(fileURLToPath(import.meta.url));

/**
 * El esquema es idempotente (todo es CREATE ... IF NOT EXISTS), asi que la
 * migracion es simplemente aplicarlo. Suficiente mientras el esquema no
 * necesite cambios destructivos; cuando los necesite, toca versionar.
 */
export async function migrate() {
  const sql = await readFile(join(here, 'schema.sql'), 'utf8');
  await pool.query(sql);
  log.info('Esquema aplicado');
}

const isEntryPoint = process.argv[1] === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  try {
    await migrate();
  } catch (error) {
    log.error('Migracion fallida', { error: error.message });
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
