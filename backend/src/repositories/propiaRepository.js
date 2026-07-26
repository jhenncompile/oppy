import { query, queryOne } from '../db/index.js';

/**
 * La libreta privada de cada persona.
 *
 * TODA consulta lleva `user_id` en el WHERE, incluso cuando el id de la fila ya
 * seria suficiente para encontrarla. No es redundancia: sin autenticacion, el
 * id de la fila es lo unico que separa la libreta de una persona de la de otra,
 * y una consulta que solo filtra por id deja que cualquiera con ese id la
 * modifique. Aca el dueño es parte de la clave, siempre.
 */

function toDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    titulo: row.titulo,
    organizacion: row.organizacion,
    enlace: row.enlace,
    donde: row.donde,
    notas: row.notas,
    fechaLimite: row.fecha_limite,
    estado: row.estado,
    recordatorioEnviadoEn: row.recordatorio_enviado_en,
    createdAt: row.created_at
  };
}

export async function crear(propia) {
  const row = await queryOne(
    `INSERT INTO oportunidades_propias
       (user_id, titulo, organizacion, enlace, donde, notas, fecha_limite, estado)
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'guardado'))
     RETURNING *`,
    [
      propia.userId,
      propia.titulo,
      propia.organizacion ?? null,
      propia.enlace ?? null,
      propia.donde ?? null,
      propia.notas ?? null,
      propia.fechaLimite ?? null,
      propia.estado ?? null
    ]
  );
  return toDomain(row);
}

/**
 * Las descartadas quedan fuera, igual que en `matches`: si la persona ya dijo
 * que no, no se le vuelve a poner adelante. La fila no se borra — puede querer
 * recordar que se postulo y no salio.
 */
export async function findByUser(userId, { incluirDescartadas = false } = {}) {
  const { rows } = await query(
    `SELECT * FROM oportunidades_propias
     WHERE user_id = $1
       AND ($2::boolean OR estado <> 'descartado')
     ORDER BY fecha_limite ASC NULLS LAST, created_at DESC`,
    [userId, incluirDescartadas]
  );
  return rows.map(toDomain);
}

export async function actualizarEstado(id, userId, estado) {
  const row = await queryOne(
    `UPDATE oportunidades_propias
     SET estado = $3, updated_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [id, userId, estado]
  );
  return toDomain(row);
}

export async function eliminar(id, userId) {
  const row = await queryOne(
    `DELETE FROM oportunidades_propias
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [id, userId]
  );
  return Boolean(row);
}

/**
 * Candidatas a recordatorio: cierran dentro de la ventana, siguen activas y
 * todavia no se aviso de ellas.
 *
 * Devuelve tambien el contacto de la persona porque el job necesita las dos
 * cosas juntas, y pedirlas en dos consultas obligaria a repetir el filtro de
 * consentimiento del lado de JavaScript — donde es facil olvidarlo.
 */
export async function pendientesDeRecordatorio({ dias = 3 } = {}) {
  const { rows } = await query(
    `SELECT p.*, u.nombre AS persona_nombre, u.email, u.telefono
     FROM oportunidades_propias p
     JOIN users u ON u.id = p.user_id
     WHERE p.recordatorio_enviado_en IS NULL
       AND p.fecha_limite IS NOT NULL
       AND p.fecha_limite >= CURRENT_DATE
       AND p.fecha_limite <= CURRENT_DATE + ($1 || ' days')::interval
       AND p.estado NOT IN ('finalizada', 'descartado')
       AND u.acepta_notificaciones = TRUE
       AND (u.email IS NOT NULL OR u.telefono IS NOT NULL)
     ORDER BY p.fecha_limite ASC`,
    [String(dias)]
  );

  return rows.map((row) => ({
    ...toDomain(row),
    persona: {
      id: row.user_id,
      nombre: row.persona_nombre,
      email: row.email,
      telefono: row.telefono
    }
  }));
}

/** Marca el aviso como enviado. Solo se llama cuando el envio salio bien. */
export async function marcarRecordatorioEnviado(id) {
  await query(
    'UPDATE oportunidades_propias SET recordatorio_enviado_en = now() WHERE id = $1',
    [id]
  );
}
