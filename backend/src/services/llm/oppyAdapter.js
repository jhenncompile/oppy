/**
 * Traduce entre el dominio del producto (Express) y el contrato del LoRA
 * (serve_oppy_api.py / schemas del dataset). Sin esto, el modelo ve campos
 * que no entrenó y el pipeline recibe formas que no persiste.
 */

const TIPO_A_CATEGORIA = {
  beca: 'beca',
  pasantia: 'pasantia',
  curso: 'curso',
  evento: 'evento',
  empleo_junior: 'empleo',
  empleo: 'empleo',
  voluntariado: 'voluntariado',
  intercambio: 'intercambio',
  concurso: 'concurso',
  financiamiento: 'financiamiento',
  programa_social: 'programa_social'
};

const CATEGORIA_A_TIPO = {
  beca: 'beca',
  pasantia: 'pasantia',
  curso: 'curso',
  evento: 'evento',
  empleo: 'empleo_junior',
  voluntariado: 'voluntariado',
  intercambio: 'pasantia',
  concurso: 'evento',
  financiamiento: 'beca',
  programa_social: 'voluntariado'
};

/** Perfil del producto → user del schema de matching Oppy. */
export function perfilAOppy(perfil) {
  return {
    career: perfil.carrera ?? '',
    skills: perfil.habilidades ?? [],
    interests: [
      ...(perfil.objetivo ? [perfil.objetivo] : []),
      ...(perfil.intereses ?? []),
      ...(perfil.experiencia ?? [])
    ],
    location: perfil.ubicacion ?? null,
    level: perfil.nivelEstudios ?? null
  };
}

/** Oportunidad del producto → opportunity del schema Oppy. */
export function oportunidadAOppy(oportunidad) {
  return {
    type: CATEGORIA_A_TIPO[oportunidad.categoria] ?? 'empleo_junior',
    area: oportunidad.descripcion?.slice(0, 120) ?? oportunidad.titulo ?? null,
    skills: oportunidad.skills ?? [],
    location: null,
    requirements: oportunidad.elegibilidad
      ? [oportunidad.elegibilidad]
      : [],
    deadline_status: deadlineStatusDe(oportunidad.fechaLimite),
    title: oportunidad.titulo,
    description: oportunidad.descripcion ?? oportunidad.titulo ?? ''
  };
}

/**
 * Extraccion LoRA → campos crudos del normalizer (antes de aDominio).
 * Devuelve null si falta lo minimo para persistir.
 */
export function extraccionACruda(data, classification = null) {
  if (!data || typeof data !== 'object') return null;

  const titulo = (data.title ?? data.titulo ?? '').toString().trim();
  if (titulo.length < 3) return null;

  const tipo = classification?.type ?? data.type ?? data.categoria ?? 'empleo_junior';
  const categoria = TIPO_A_CATEGORIA[tipo] ?? 'empleo';

  return {
    titulo,
    categoria,
    descripcion: data.description ?? data.descripcion ?? data.area ?? null,
    elegibilidad: Array.isArray(data.requirements)
      ? data.requirements.join('; ')
      : (data.elegibilidad ?? null),
    monto_beneficio: data.monto_beneficio ?? null,
    skills: Array.isArray(data.skills) ? data.skills : [],
    fecha_limite: data.deadline ?? data.fecha_limite ?? null,
    link_aplicacion: data.url ?? data.link_aplicacion ?? null
  };
}

/**
 * Matching LoRA → evaluacion del producto.
 * score Oppy es 0–100; reason es un string → razones[].
 */
export function matchingAEvaluacion(data) {
  if (!data || typeof data !== 'object') return null;

  const score = Number(data.score);
  if (!Number.isFinite(score)) return null;

  const compatibilidad = Math.max(0, Math.min(100, Math.round(score)));
  const nivel = String(data.match ?? '').toLowerCase();
  const elegible = nivel !== 'nulo' && compatibilidad >= 30;

  const reason = typeof data.reason === 'string' ? data.reason.trim() : '';
  const razones = reason.length >= 4
    ? [reason.slice(0, 200)]
    : [`Compatibilidad ${nivel || 'evaluada'} (${compatibilidad}%)`];

  return {
    compatibilidad,
    elegible,
    razones,
    brechas: []
  };
}

export function deadlineStatusDe(fechaLimite) {
  if (!fechaLimite) return 'sin_fecha';
  const fecha = new Date(fechaLimite);
  if (Number.isNaN(fecha.getTime())) return 'sin_fecha';
  return fecha < new Date() ? 'vencida' : 'vigente';
}

export { TIPO_A_CATEGORIA, CATEGORIA_A_TIPO };
