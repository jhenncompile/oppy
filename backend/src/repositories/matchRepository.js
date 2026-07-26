import { query, queryOne } from '../db/index.js';

function toDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    compatibilidad: row.compatibilidad,
    razones: row.razones,
    brechas: row.brechas,
    elegible: row.elegible,
    estado: row.estado,
    createdAt: row.created_at,
    oportunidad: row.titulo
      ? {
          id: row.opportunity_id,
          titulo: row.titulo,
          categoria: row.categoria,
          elegibilidad: row.elegibilidad,
          montoBeneficio: row.monto_beneficio,
          skills: row.skills,
          fuente: { nombre: row.fuente_nombre, url: row.fuente_url },
          linkAplicacion: row.link_aplicacion,
          fechaLimite: row.fecha_limite,
          confianza: row.confianza,
          sponsored: row.sponsored,
          fechaExtraida: row.fecha_extraida
        }
      : { id: row.opportunity_id }
  };
}

const SELECT_CON_OPORTUNIDAD = `
  SELECT m.*, o.titulo, o.categoria, o.elegibilidad, o.monto_beneficio, o.skills,
         o.fuente_nombre, o.fuente_url, o.link_aplicacion, o.fecha_limite,
         o.confianza, o.sponsored, o.fecha_extraida
  FROM matches m
  JOIN opportunities o ON o.id = m.opportunity_id
`;

export async function upsert(match) {
  const row = await queryOne(
    `INSERT INTO matches (user_id, opportunity_id, compatibilidad, razones, brechas, elegible)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, opportunity_id) DO UPDATE SET
       compatibilidad = EXCLUDED.compatibilidad,
       razones        = EXCLUDED.razones,
       brechas        = EXCLUDED.brechas,
       elegible       = EXCLUDED.elegible,
       updated_at     = now()
     RETURNING *`,
    [
      match.userId,
      match.opportunityId,
      match.compatibilidad,
      match.razones ?? [],
      match.brechas ?? [],
      match.elegible
    ]
  );
  return toDomain(row);
}

/**
 * Los descartados no vuelven a aparecer: si la persona ya dijo que no, se
 * respeta. Es la base del feedback loop.
 */
export async function findByUser(userId, { minScore = 0, limit = 20 } = {}) {
  const { rows } = await query(
    `${SELECT_CON_OPORTUNIDAD}
     WHERE m.user_id = $1
       AND m.estado <> 'descartado'
       AND m.compatibilidad >= $2
       AND o.estado = 'vigente'
     ORDER BY m.compatibilidad DESC, o.fecha_limite ASC NULLS LAST
     LIMIT $3`,
    [userId, minScore, limit]
  );
  return rows.map(toDomain);
}

export async function actualizarEstado(matchId, estado) {
  const row = await queryOne(
    `UPDATE matches SET estado = $2, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [matchId, estado]
  );
  return toDomain(row);
}

/** IDs ya evaluados: evita gastar tokens puntuando dos veces lo mismo. */
export async function idsYaEvaluados(userId) {
  const { rows } = await query(
    'SELECT opportunity_id FROM matches WHERE user_id = $1',
    [userId]
  );
  return new Set(rows.map((row) => row.opportunity_id));
}

/**
 * Senales de usuario para alimentar al agente Oppy en el proximo match.
 * Preferidas = guardado / en seguimiento; evitadas = descartado.
 */
export async function resumenFeedback(userId, { limit = 30 } = {}) {
  const { rows } = await query(
    `SELECT m.estado, o.categoria, o.skills, o.titulo
     FROM matches m
     JOIN opportunities o ON o.id = m.opportunity_id
     WHERE m.user_id = $1
       AND m.estado IN (
         'guardado', 'preparando', 'aplicada', 'entrevista',
         'finalizada', 'descartado'
       )
     ORDER BY m.updated_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  const positivos = rows.filter((row) => row.estado !== 'descartado');
  const negativos = rows.filter((row) => row.estado === 'descartado');

  const uniq = (valores) => [...new Set(valores.filter(Boolean))];

  return {
    skillsPreferidas: uniq(positivos.flatMap((row) => row.skills ?? [])).slice(0, 15),
    categoriasPreferidas: uniq(positivos.map((row) => row.categoria)).slice(0, 6),
    categoriasEvitadas: uniq(negativos.map((row) => row.categoria)).slice(0, 6),
    titulosPreferidos: uniq(positivos.map((row) => row.titulo)).slice(0, 5),
    titulosEvitados: uniq(negativos.map((row) => row.titulo)).slice(0, 5)
  };
}
