import { query, queryOne } from '../db/index.js';

function toDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    nombre: row.nombre,
    edad: row.edad,
    carrera: row.carrera,
    nivelEstudios: row.nivel_estudios,
    intereses: row.intereses,
    ubicacion: row.ubicacion,
    idiomas: row.idiomas,
    objetivos: row.objetivos,
    experiencia: row.experiencia,
    habilidades: row.habilidades,
    preferencias: row.preferencias,
    restricciones: row.restricciones,
    email: row.email,
    telefono: row.telefono,
    aceptaNotificaciones: row.acepta_notificaciones,
    orgId: row.org_id,
    visibleParaEmpresas: row.visible_para_empresas,
    createdAt: row.created_at
  };
}

export async function create(profile) {
  const row = await queryOne(
    `INSERT INTO users (
       nombre, edad, carrera, nivel_estudios, intereses, ubicacion, idiomas,
       objetivos, experiencia, habilidades, preferencias, restricciones,
       email, telefono, acepta_notificaciones
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING *`,
    [
      profile.nombre ?? null,
      profile.edad ?? null,
      profile.carrera,
      profile.nivelEstudios,
      profile.intereses,
      profile.ubicacion,
      JSON.stringify(profile.idiomas ?? []),
      profile.objetivos ?? [],
      profile.experiencia ?? [],
      profile.habilidades ?? [],
      JSON.stringify(profile.preferencias ?? {}),
      profile.restricciones ?? [],
      profile.email ?? null,
      profile.telefono ?? null,
      profile.aceptaNotificaciones ?? false
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

/**
 * Perfiles a los que se les puede avisar: dieron consentimiento explicito y
 * dejaron al menos un contacto. Las dos condiciones, no una — un contacto sin
 * consentimiento no habilita nada.
 */
export async function findNotificables({ limit = 50 } = {}) {
  const { rows } = await query(
    `SELECT * FROM users
     WHERE acepta_notificaciones = TRUE
       AND (email IS NOT NULL OR telefono IS NOT NULL)
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map(toDomain);
}

/** Consentimientos: revocables y con historial, nunca un booleano suelto. */
export async function registrarConsentimiento(userId, tipo, otorgado) {
  await query(
    `INSERT INTO consents (user_id, tipo, otorgado) VALUES ($1, $2, $3)`,
    [userId, tipo, otorgado]
  );
}

/**
 * Cambia el contacto de un perfil que ya existe.
 *
 * Hace falta para el acceso (docs/12-auth.md): sin esto, quien paso el
 * onboarding sin dejar correo ni telefono no puede habilitarlo despues, y la
 * unica salida que le queda es borrar el perfil y empezar de nuevo.
 *
 * El consentimiento queda registrado con su fecha en cada cambio, igual que la
 * visibilidad: es revocable y auditable, no un booleano suelto.
 */
export async function setContacto(userId, { email, telefono, aceptaNotificaciones }) {
  const row = await queryOne(
    `UPDATE users
     SET email = $2, telefono = $3, acepta_notificaciones = $4, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [userId, email ?? null, telefono ?? null, aceptaNotificaciones]
  );

  if (row) {
    await query(
      `INSERT INTO consents (user_id, tipo, otorgado)
       VALUES ($1, 'notificaciones', $2)`,
      [userId, aceptaNotificaciones]
    );
  }

  return toDomain(row);
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
