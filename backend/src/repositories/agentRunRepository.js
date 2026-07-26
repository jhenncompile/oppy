import { query, queryOne } from '../db/index.js';

function toDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    disparador: row.disparador,
    userId: row.user_id,
    estado: row.estado,
    oportunidadesNuevas: row.oportunidades_nuevas,
    matchesCreados: row.matches_creados,
    error: row.error,
    startedAt: row.started_at,
    finishedAt: row.finished_at
  };
}

export async function iniciar({ disparador, userId = null }) {
  const row = await queryOne(
    'INSERT INTO agent_runs (disparador, user_id) VALUES ($1, $2) RETURNING *',
    [disparador, userId]
  );
  return toDomain(row);
}

export async function completar(id, { oportunidadesNuevas, matchesCreados }) {
  const row = await queryOne(
    `UPDATE agent_runs
     SET estado = 'completada', oportunidades_nuevas = $2,
         matches_creados = $3, finished_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, oportunidadesNuevas, matchesCreados]
  );
  return toDomain(row);
}

export async function fallar(id, mensaje) {
  const row = await queryOne(
    `UPDATE agent_runs
     SET estado = 'fallida', error = $2, finished_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, mensaje]
  );
  return toDomain(row);
}

/** Bitacora publica: la prueba de que el agente corre solo. */
export async function recientes({ limit = 20 } = {}) {
  const { rows } = await query(
    'SELECT * FROM agent_runs ORDER BY started_at DESC LIMIT $1',
    [limit]
  );
  return rows.map(toDomain);
}
