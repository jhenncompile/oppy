import { query } from '../db/index.js';

export async function registrar({ userId = null, opportunityId, tipo }) {
  await query(
    'INSERT INTO events (user_id, opportunity_id, tipo) VALUES ($1, $2, $3)',
    [userId, opportunityId, tipo]
  );
}

/**
 * Reporte de alcance de una organizacion: cuantas personas vieron sus
 * convocatorias y cuantas hicieron clic. Es lo que se le entrega a una
 * empresa que publica o patrocina.
 */
export async function alcancePorOrg(orgId, { dias = 30 } = {}) {
  const { rows } = await query(
    `SELECT o.id, o.titulo,
            COUNT(*) FILTER (WHERE e.tipo = 'impresion')::int AS impresiones,
            COUNT(*) FILTER (WHERE e.tipo = 'clic')::int      AS clics,
            COUNT(*) FILTER (WHERE e.tipo = 'guardado')::int  AS guardados
     FROM opportunities o
     LEFT JOIN events e
       ON e.opportunity_id = o.id
      AND e.created_at >= now() - ($2 || ' days')::interval
     WHERE o.org_id = $1
     GROUP BY o.id, o.titulo
     ORDER BY impresiones DESC`,
    [orgId, String(dias)]
  );
  return rows;
}
