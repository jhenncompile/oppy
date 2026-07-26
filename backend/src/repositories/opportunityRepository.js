import { query, queryOne } from '../db/index.js';

function toDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    titulo: row.titulo,
    categoria: row.categoria,
    descripcion: row.descripcion,
    elegibilidad: row.elegibilidad,
    montoBeneficio: row.monto_beneficio,
    skills: row.skills,
    fuente: { nombre: row.fuente_nombre, url: row.fuente_url },
    linkAplicacion: row.link_aplicacion,
    fechaLimite: row.fecha_limite,
    confianza: row.confianza,
    origen: row.origen,
    orgId: row.org_id,
    sponsored: row.sponsored,
    estado: row.estado,
    fechaExtraida: row.fecha_extraida
  };
}

/**
 * Alta o actualizacion contra el indice compartido. `hash_dedupe` es la clave
 * natural: la misma convocatoria descubierta por dos fuentes distintas entra
 * una sola vez.
 *
 * Devuelve `{ oportunidad, esNueva }` para poder reportar cuantas aparecieron
 * por primera vez en la corrida — que es lo que le interesa al usuario.
 */
export async function upsert(opportunity) {
  const row = await queryOne(
    `INSERT INTO opportunities (
       titulo, categoria, descripcion, elegibilidad, monto_beneficio, skills,
       fuente_nombre, fuente_url, link_aplicacion, fecha_limite,
       confianza, origen, org_id, sponsored, hash_dedupe, fecha_extraida
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now())
     ON CONFLICT (hash_dedupe) DO UPDATE SET
       titulo          = EXCLUDED.titulo,
       descripcion     = EXCLUDED.descripcion,
       elegibilidad    = EXCLUDED.elegibilidad,
       monto_beneficio = EXCLUDED.monto_beneficio,
       skills          = EXCLUDED.skills,
       fecha_limite    = EXCLUDED.fecha_limite,
       confianza       = EXCLUDED.confianza,
       fecha_extraida  = now(),
       updated_at      = now()
     RETURNING *, (xmax = 0) AS es_nueva`,
    [
      opportunity.titulo,
      opportunity.categoria,
      opportunity.descripcion ?? null,
      opportunity.elegibilidad ?? null,
      opportunity.montoBeneficio ?? null,
      opportunity.skills ?? [],
      opportunity.fuente.nombre,
      opportunity.fuente.url,
      opportunity.linkAplicacion ?? opportunity.fuente.url,
      opportunity.fechaLimite ?? null,
      opportunity.confianza,
      opportunity.origen ?? 'descubierta',
      opportunity.orgId ?? null,
      opportunity.sponsored ?? false,
      opportunity.hashDedupe
    ]
  );

  return { oportunidad: toDomain(row), esNueva: row.es_nueva };
}

export async function findById(id) {
  const row = await queryOne('SELECT * FROM opportunities WHERE id = $1', [id]);
  return toDomain(row);
}

/**
 * Candidatas para puntuar. Se pre-filtra en SQL — barato — para que el LLM
 * solo razone sobre lo que tiene sentido razonar.
 */
export async function findCandidatas({ categorias = null, limit = 40 } = {}) {
  const { rows } = await query(
    `SELECT * FROM opportunities
     WHERE estado = 'vigente'
       AND (fecha_limite IS NULL OR fecha_limite >= CURRENT_DATE)
       AND ($1::text[] IS NULL OR categoria = ANY($1))
       AND char_length(trim(titulo)) >= 8
       AND lower(trim(titulo)) NOT IN (
         'beca', 'evento', 'curso', 'empleo', 'pasantia', 'pasantía',
         'voluntariado', 'concurso', 'intercambio', 'financiamiento',
         'programa', 'oportunidad'
       )
     ORDER BY
       confianza = 'verificada' DESC,
       fecha_extraida DESC
     LIMIT $2`,
    [categorias, limit]
  );
  return rows.map(toDomain);
}

/**
 * Marca como vencidas las convocatorias cuyo deadline ya paso. No se borran:
 * el historico permite anticipar convocatorias que se repiten cada anio.
 */
export async function marcarVencidas() {
  const { rowCount } = await query(
    `UPDATE opportunities
     SET estado = 'vencida', confianza = 'desactualizada', updated_at = now()
     WHERE estado = 'vigente'
       AND fecha_limite IS NOT NULL
       AND fecha_limite < CURRENT_DATE`
  );
  return rowCount;
}

/** Insumo del producto de inteligencia de oportunidades. */
export async function habilidadesMasPedidas({ dias = 30, limit = 10 } = {}) {
  const { rows } = await query(
    `SELECT skill, COUNT(*)::int AS total
     FROM opportunities, UNNEST(skills) AS skill
     WHERE fecha_extraida >= now() - ($1 || ' days')::interval
     GROUP BY skill
     ORDER BY total DESC
     LIMIT $2`,
    [String(dias), limit]
  );
  return rows;
}

export async function contarPorCategoria() {
  const { rows } = await query(
    `SELECT categoria, COUNT(*)::int AS total
     FROM opportunities
     WHERE estado = 'vigente'
     GROUP BY categoria
     ORDER BY total DESC`
  );
  return rows;
}
