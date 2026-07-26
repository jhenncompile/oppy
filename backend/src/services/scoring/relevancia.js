/**
 * Filtros determinísticos post-descubrimiento: el LoRA a veces inventa fechas
 * o ignora la ciudad del perfil. Estas reglas no "razonan"; cortan basura.
 */

const CIUDADES = [
  { id: 'la_paz', aliases: ['la paz', 'el alto', 'paceño', 'paceña'] },
  { id: 'santa_cruz', aliases: ['santa cruz', 'cruceño', 'cruceña', 'scz'] },
  { id: 'cochabamba', aliases: ['cochabamba', 'cocha', 'cbba', 'valluno'] },
  { id: 'sucre', aliases: ['sucre', 'chuquisaca'] },
  { id: 'oruro', aliases: ['oruro'] },
  { id: 'potosi', aliases: ['potosi', 'potosí'] },
  { id: 'tarija', aliases: ['tarija'] },
  { id: 'beni', aliases: ['beni', 'trinidad'] },
  { id: 'pando', aliases: ['pando', 'cobija'] }
];

const AMPLIO = [
  'bolivia',
  'nacional',
  'todo el pais',
  'todo el país',
  'a nivel nacional',
  'remoto',
  'online',
  'virtual',
  'hibrido',
  'híbrido',
  'desde cualquier',
  'cualquier departamento',
  'latinoamerica',
  'latinoamérica',
  'internacional'
];

function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function ciudadesEn(texto) {
  const t = normalizar(texto);
  return CIUDADES.filter((c) => c.aliases.some((a) => t.includes(normalizar(a)))).map((c) => c.id);
}

function esAmplio(texto) {
  const t = normalizar(texto);
  return AMPLIO.some((p) => t.includes(normalizar(p)));
}

/** Ciudad pedida en el perfil, o null si es genérico ("Bolivia"). */
export function ciudadDePerfil(ubicacion) {
  const halladas = ciudadesEn(ubicacion);
  return halladas[0] ?? null;
}

/** Texto de la oferta donde puede aparecer la ciudad. */
export function textoUbicacionOportunidad(oportunidad) {
  return [
    oportunidad.titulo,
    oportunidad.descripcion,
    oportunidad.elegibilidad,
    oportunidad.fuente?.nombre,
    oportunidad.fuente?.url
  ]
    .filter(Boolean)
    .join(' \n ');
}

/**
 * true si la oferta no contradice la ciudad del perfil.
 * Si el perfil no pide ciudad concreta, siempre pasa.
 */
export function ubicacionCompatible(perfil, oportunidad) {
  const pedida = ciudadDePerfil(perfil?.ubicacion);
  if (!pedida) return true;

  const texto = textoUbicacionOportunidad(oportunidad);
  if (!texto.trim()) return true;
  if (esAmplio(texto)) return true;

  const mencionadas = ciudadesEn(texto);
  if (mencionadas.length === 0) return true;
  if (mencionadas.includes(pedida)) return true;

  // Menciona otra(s) ciudad(es) y no la pedida → rechazo duro.
  return false;
}

export function fechaVigente(fechaLimite, { hoy = new Date() } = {}) {
  if (!fechaLimite) return true;
  const fecha = new Date(`${String(fechaLimite).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(fecha.getTime())) return true;
  const corte = new Date(hoy);
  corte.setHours(0, 0, 0, 0);
  return fecha >= corte;
}

/**
 * Gate antes de gastar match / mostrar.
 * @returns {{ ok: true } | { ok: false, motivo: string, codigo: string }}
 */
export function evaluarRelevancia(perfil, oportunidad) {
  if (!fechaVigente(oportunidad.fechaLimite)) {
    return {
      ok: false,
      codigo: 'fecha_vencida',
      motivo: 'Filtrado: la fecha límite ya pasó'
    };
  }

  if (!ubicacionCompatible(perfil, oportunidad)) {
    const pedida = ciudadDePerfil(perfil.ubicacion);
    return {
      ok: false,
      codigo: 'ubicacion',
      motivo: `Filtrado: no coincide con tu ubicación (${pedida?.replace('_', ' ') ?? 'perfil'})`
    };
  }

  return { ok: true };
}

/** Inferir location string para Oppy a partir del texto de la oferta. */
export function ubicacionInferida(oportunidad) {
  const texto = textoUbicacionOportunidad(oportunidad);
  const ids = ciudadesEn(texto);
  if (ids.length === 0) {
    return esAmplio(texto) ? 'Bolivia' : null;
  }
  const etiquetas = {
    la_paz: 'La Paz',
    santa_cruz: 'Santa Cruz',
    cochabamba: 'Cochabamba',
    sucre: 'Sucre',
    oruro: 'Oruro',
    potosi: 'Potosí',
    tarija: 'Tarija',
    beni: 'Beni',
    pando: 'Pando'
  };
  return etiquetas[ids[0]] ?? null;
}

const TITULOS_GENERICOS = new Set([
  'beca',
  'evento',
  'curso',
  'empleo',
  'pasantia',
  'pasantía',
  'voluntariado',
  'concurso',
  'intercambio',
  'financiamiento',
  'programa',
  'oportunidad'
]);

/**
 * El LoRA a veces inventa un titulo = categoria ("beca"). Eso no se puede
 * mostrar ni puntuar con confianza.
 */
export function tituloConfiable(titulo) {
  const t = String(titulo ?? '').trim();
  if (t.length < 8) return false;
  return !TITULOS_GENERICOS.has(t.toLowerCase());
}
