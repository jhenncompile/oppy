import { query, queryOne } from '../db/index.js';

function toDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    opportunityId: row.opportunity_id,
    canal: row.canal,
    tipo: row.tipo,
    estado: row.estado,
    mensajeId: row.mensaje_id,
    error: row.error,
    enviadoEn: row.enviado_en
  };
}

/**
 * Registra el envio, haya salido o no.
 *
 * `ON CONFLICT DO UPDATE` en vez de `DO NOTHING`: si un intento fallo y el
 * siguiente sale bien, interesa el ultimo estado. Lo que el UNIQUE garantiza es
 * que a una persona no se le avisa dos veces de la misma oportunidad.
 */
export async function registrar({
  userId,
  opportunityId,
  canal,
  estado,
  mensajeId,
  error,
  tipo = 'match_alto'
}) {
  const row = await queryOne(
    `INSERT INTO notificaciones (user_id, opportunity_id, canal, estado, mensaje_id, error, tipo)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, opportunity_id, tipo) DO UPDATE SET
       canal      = EXCLUDED.canal,
       estado     = EXCLUDED.estado,
       mensaje_id = EXCLUDED.mensaje_id,
       error      = EXCLUDED.error,
       enviado_en = now()
     RETURNING *`,
    [userId, opportunityId, canal ?? null, estado, mensajeId ?? null, error ?? null, tipo]
  );
  return toDomain(row);
}

/**
 * IDs ya notificados con exito. Es el mecanismo de idempotencia del cron: los
 * fallidos quedan fuera del conjunto a proposito, para que se reintenten en la
 * corrida siguiente.
 */
export async function idsYaNotificados(userId, tipo = 'match_alto') {
  const { rows } = await query(
    `SELECT opportunity_id FROM notificaciones
     WHERE user_id = $1 AND estado = 'enviado' AND tipo = $2`,
    [userId, tipo]
  );
  return new Set(rows.map((row) => row.opportunity_id));
}

/** Bitacora reciente: la prueba de que las notificaciones salieron solas. */
export async function recientes({ limit = 20 } = {}) {
  const { rows } = await query(
    `SELECT n.*, o.titulo
     FROM notificaciones n
     JOIN opportunities o ON o.id = n.opportunity_id
     ORDER BY n.enviado_en DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map((row) => ({ ...toDomain(row), titulo: row.titulo }));
}
