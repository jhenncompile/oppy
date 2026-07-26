import { query, queryOne } from '../db/index.js';

/**
 * Codigos de acceso. Contrato en docs/12-auth.md.
 *
 * Unico lugar con SQL de acceso, igual que el resto de repositories. El hash lo
 * calcula la ruta: este modulo guarda y compara, no decide como se protege el
 * codigo.
 */

/**
 * Busca a la persona por el contacto que dejo, sea correo o telefono.
 *
 * Exige `acepta_notificaciones`: sin consentimiento el canal no esta habilitado
 * ni para avisos ni para acceso. Es la misma regla, no dos permisos distintos —
 * mandar un codigo a quien dijo que no queria mensajes seria usar el contacto
 * para algo que no autorizo.
 *
 * El correo se compara sin distinguir mayusculas porque nadie recuerda como lo
 * escribio hace dos semanas.
 */
export async function findUserByContacto(contacto) {
  const row = await queryOne(
    `SELECT * FROM users
     WHERE acepta_notificaciones = TRUE
       AND (lower(email) = lower($1) OR telefono = $1)
     ORDER BY created_at DESC
     LIMIT 1`,
    [contacto]
  );
  return row;
}

/**
 * Invalida los codigos vigentes y emite uno nuevo.
 *
 * Pedir un codigo nuevo tiene que apagar el anterior: si los dos siguieran
 * sirviendo, cada pedido ampliaria la ventana de adivinanza en vez de
 * reiniciarla.
 */
export async function crearCodigo(userId, codigoHash, expiraEn) {
  await query(
    `UPDATE codigos_acceso
     SET usado_en = now()
     WHERE user_id = $1 AND usado_en IS NULL`,
    [userId]
  );

  return queryOne(
    `INSERT INTO codigos_acceso (user_id, codigo_hash, expira_en)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, codigoHash, expiraEn]
  );
}

/** El codigo vigente de esa persona: sin usar y sin vencer. */
export async function buscarVigente(userId) {
  return queryOne(
    `SELECT * FROM codigos_acceso
     WHERE user_id = $1
       AND usado_en IS NULL
       AND expira_en > now()
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
}

/**
 * Cuenta los intentos fallidos y devuelve el total.
 *
 * Se incrementa en la base y no en memoria porque el limite tiene que valer
 * aunque el proceso se reinicie o corran dos instancias.
 */
export async function registrarIntento(id) {
  const row = await queryOne(
    `UPDATE codigos_acceso
     SET intentos = intentos + 1
     WHERE id = $1
     RETURNING intentos`,
    [id]
  );
  return row?.intentos ?? 0;
}

export async function marcarUsado(id) {
  await query('UPDATE codigos_acceso SET usado_en = now() WHERE id = $1', [id]);
}

/** Cuantos codigos se pidieron en la ventana, para frenar el abuso del envio. */
export async function contarPedidosRecientes(userId, minutos) {
  const row = await queryOne(
    `SELECT count(*)::int AS total
     FROM codigos_acceso
     WHERE user_id = $1
       AND created_at > now() - make_interval(mins => $2)`,
    [userId, minutos]
  );
  return row?.total ?? 0;
}
