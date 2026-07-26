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
    tipoFeedback: row.tipo_feedback ?? null,
    comentarioFeedback: row.comentario_feedback ?? null,
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
export async function findByUser(userId, { minScore = 30, limit = 20 } = {}) {
  const { rows } = await query(
    `${SELECT_CON_OPORTUNIDAD}
     WHERE m.user_id = $1
       AND m.estado <> 'descartado'
       AND m.elegible = TRUE
       AND m.compatibilidad >= $2
       AND o.estado = 'vigente'
       AND (o.fecha_limite IS NULL OR o.fecha_limite >= CURRENT_DATE)
     ORDER BY m.compatibilidad DESC, o.fecha_limite ASC NULLS LAST
     LIMIT $3`,
    [userId, minScore, limit]
  );
  return rows.map(toDomain);
}

export async function actualizarEstado(matchId, estado) {
  return actualizarFeedback(matchId, { estado });
}

/**
 * Cambia estado y, si es descarte, el tipo de senal al agente.
 * @param {string} matchId
 * @param {{ estado: string, tipoFeedback?: 'no_me_interesa'|'mala_info'|null, comentario?: string|null }} payload
 */
export async function actualizarFeedback(matchId, { estado, tipoFeedback = null, comentario = null }) {
  const esDescarte = estado === 'descartado';
  const tipo = esDescarte
    ? (tipoFeedback === 'mala_info' ? 'mala_info' : 'no_me_interesa')
    : null;
  const nota = esDescarte && comentario
    ? String(comentario).trim().slice(0, 500) || null
    : null;

  const row = await queryOne(
    `UPDATE matches
     SET estado = $2,
         tipo_feedback = $3,
         comentario_feedback = $4,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [matchId, estado, tipo, nota]
  );
  return toDomain(row);
}

/**
 * Recomendaciones que la persona puso en seguimiento y estan por cerrar.
 *
 * Es el lado del agente del mismo recordatorio que reciben las oportunidades
 * anotadas a mano: para quien esta buscando, un plazo es un plazo — que lo haya
 * encontrado Oppy o lo haya anotado ella no cambia nada.
 *
 * Solo lo que la persona guardo. Recordar un plazo de algo que apenas se le
 * recomendo y todavia no mirO seria empujar, no acompaniar.
 *
 * El NOT EXISTS es la idempotencia: se avisa una sola vez del cierre de cada
 * oportunidad, y es independiente del aviso de "match alto" porque cada uno
 * lleva su propio `tipo`.
 */
export async function pendientesDeCierre({ dias = 3 } = {}) {
  const { rows } = await query(
    `SELECT m.id, m.user_id, m.estado,
            o.id AS opportunity_id, o.titulo, o.fecha_limite, o.fuente_nombre,
            o.link_aplicacion, o.fuente_url,
            u.nombre AS persona_nombre, u.email, u.telefono
     FROM matches m
     JOIN opportunities o ON o.id = m.opportunity_id
     JOIN users u ON u.id = m.user_id
     WHERE m.estado IN ('guardado', 'preparando', 'aplicada', 'entrevista')
       AND o.estado = 'vigente'
       AND o.fecha_limite IS NOT NULL
       AND o.fecha_limite >= CURRENT_DATE
       AND o.fecha_limite <= CURRENT_DATE + ($1 || ' days')::interval
       AND u.acepta_notificaciones = TRUE
       AND (u.email IS NOT NULL OR u.telefono IS NOT NULL)
       AND NOT EXISTS (
         SELECT 1 FROM notificaciones n
         WHERE n.user_id = m.user_id
           AND n.opportunity_id = o.id
           AND n.tipo = 'cierre_proximo'
           AND n.estado = 'enviado'
       )
     ORDER BY o.fecha_limite ASC`,
    [String(dias)]
  );

  return rows.map((row) => ({
    matchId: row.id,
    estado: row.estado,
    oportunidad: {
      id: row.opportunity_id,
      titulo: row.titulo,
      fechaLimite: row.fecha_limite,
      fuente: { nombre: row.fuente_nombre, url: row.fuente_url },
      linkAplicacion: row.link_aplicacion
    },
    persona: {
      id: row.user_id,
      nombre: row.persona_nombre,
      email: row.email,
      telefono: row.telefono
    }
  }));
}

/** IDs ya evaluados con resultado estable: evita re-gastar tokens. */
export async function idsYaEvaluados(userId) {
  const { rows } = await query(
    `SELECT opportunity_id FROM matches
     WHERE user_id = $1
       AND (
         elegible = TRUE
         OR compatibilidad >= 30
         OR (razones[1] IS NOT NULL AND razones[1] LIKE 'Filtrado:%')
         OR (razones[1] IS NOT NULL AND razones[1] LIKE 'Descartada:%')
       )`,
    [userId]
  );
  return new Set(rows.map((row) => row.opportunity_id));
}

/**
 * Senales de usuario para alimentar al agente Oppy en el proximo match.
 * Preferidas = guardado / en seguimiento.
 * no_me_interesa = evita categorias/titulos similares.
 * mala_info = comentarios y titulos que el modelo invento o desalineo.
 */
export async function resumenFeedback(userId, { limit = 30 } = {}) {
  const { rows } = await query(
    `SELECT m.estado, m.tipo_feedback, m.comentario_feedback,
            o.categoria, o.skills, o.titulo
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
  const descartados = rows.filter((row) => row.estado === 'descartado');
  // Legacy sin tipo_feedback = "no me interesa".
  const noMeInteresa = descartados.filter(
    (row) => row.tipo_feedback !== 'mala_info'
  );
  const malaInfo = descartados.filter((row) => row.tipo_feedback === 'mala_info');

  const uniq = (valores) => [...new Set(valores.filter(Boolean))];

  return {
    skillsPreferidas: uniq(positivos.flatMap((row) => row.skills ?? [])).slice(0, 15),
    categoriasPreferidas: uniq(positivos.map((row) => row.categoria)).slice(0, 6),
    categoriasEvitadas: uniq(noMeInteresa.map((row) => row.categoria)).slice(0, 6),
    titulosPreferidos: uniq(positivos.map((row) => row.titulo)).slice(0, 5),
    titulosEvitados: uniq(noMeInteresa.map((row) => row.titulo)).slice(0, 5),
    titulosMalaInfo: uniq(malaInfo.map((row) => row.titulo)).slice(0, 8),
    comentariosMalaInfo: uniq(
      malaInfo.map((row) => row.comentario_feedback).filter(Boolean)
    ).slice(0, 10)
  };
}
