import { query, queryOne } from '../db/index.js';

function toDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    nombre: row.nombre,
    carrera: row.carrera,
    nivelEstudios: row.nivel_estudios,
    intereses: row.intereses,
    ubicacion: row.ubicacion,
    idiomas: row.idiomas,
    orgId: row.org_id,
    visibleParaEmpresas: row.visible_para_empresas,
    createdAt: row.created_at
  };
}

export async function create(profile) {
  const row = await queryOne(
    `INSERT INTO users (nombre, carrera, nivel_estudios, intereses, ubicacion, idiomas)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      profile.nombre ?? null,
      profile.carrera,
      profile.nivelEstudios,
      profile.intereses,
      profile.ubicacion,
      JSON.stringify(profile.idiomas ?? [])
    ]
  );
  return toDomain(row);
}

export async function findById(id) {
  const row = await queryOne('SELECT * FROM users WHERE id = $1', [id]);
  return toDomain(row);
}

export async function findAll({ limit = 50 } = {}) {
  const { rows } = await query(
    'SELECT * FROM users ORDER BY created_at DESC LIMIT $1',
    [limit]
  );
  return rows.map(toDomain);
}

/**
 * Solo perfiles con opt-in explicito. Es la unica puerta por la que el
 * matching inverso puede ver a una persona.
 */
export async function findVisibleParaEmpresas({ limit = 100 } = {}) {
  const { rows } = await query(
    `SELECT * FROM users
     WHERE visible_para_empresas = TRUE
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map(toDomain);
}

export async function setVisibilidadEmpresas(userId, otorgado) {
  const row = await queryOne(
    `UPDATE users
     SET visible_para_empresas = $2, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [userId, otorgado]
  );

  if (row) {
    await query(
      `INSERT INTO consents (user_id, tipo, otorgado)
       VALUES ($1, 'visibilidad_empresas', $2)`,
      [userId, otorgado]
    );
  }

  return toDomain(row);
}
