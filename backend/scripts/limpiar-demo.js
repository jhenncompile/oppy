#!/usr/bin/env node
/**
 * Saca del indice las convocatorias del catalogo de ejemplo.
 *
 * Existe por un riesgo concreto: el catalogo de demo entra al indice compartido
 * por la misma puerta que lo descubierto, con nombres de fuente autenticos y
 * semaforo de confianza real. Una vez adentro es indistinguible de una
 * convocatoria de verdad — y apagar DEMO_MODE no la borra.
 *
 * Correr esto antes de una demo con fuentes reales. Si no, el indice mezcla
 * ambas cosas y se demuestra sobre datos inventados sin querer.
 *
 * Borra por `hash_dedupe`, que es deterministico, asi que solo toca lo que
 * genero el catalogo. Los matches y las notificaciones de esas oportunidades
 * se van solos por CASCADE.
 *
 *   node scripts/limpiar-demo.js          muestra que se borraria
 *   node scripts/limpiar-demo.js --si     lo borra
 */
import { query, closePool } from '../src/db/index.js';
import { oportunidadesDemo } from '../src/services/agent/demo.js';

const confirmado = process.argv.includes('--si');
const hashes = oportunidadesDemo().map((o) => o.hashDedupe);

try {
  const { rows } = await query(
    `SELECT o.titulo, count(m.id)::int AS matches
     FROM opportunities o
     LEFT JOIN matches m ON m.opportunity_id = o.id
     WHERE o.hash_dedupe = ANY($1)
     GROUP BY o.id, o.titulo
     ORDER BY o.titulo`,
    [hashes]
  );

  if (rows.length === 0) {
    console.log('\nNo hay convocatorias de ejemplo en el indice.\n');
  } else if (!confirmado) {
    console.log(`\nSe borrarian ${rows.length} convocatorias de ejemplo:\n`);
    for (const row of rows) {
      console.log(`  ${row.titulo}  (${row.matches} match(es))`);
    }
    console.log('\nPara borrarlas: node scripts/limpiar-demo.js --si\n');
  } else {
    const { rowCount } = await query(
      'DELETE FROM opportunities WHERE hash_dedupe = ANY($1)',
      [hashes]
    );
    console.log(`\n${rowCount} convocatorias de ejemplo eliminadas del indice.`);
    console.log('Sus matches y notificaciones se fueron con ellas.\n');
  }
} catch (error) {
  console.error(`\nFallo la limpieza: ${error.message}\n`);
  process.exitCode = 1;
} finally {
  await closePool();
}
