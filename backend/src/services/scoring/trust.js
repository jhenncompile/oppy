import { DOMINIOS_OFICIALES } from '../scraping/sources.js';

export const CONFIANZA = {
  VERIFICADA: 'verificada',
  POR_VALIDAR: 'por_validar',
  DESACTUALIZADA: 'desactualizada'
};

/**
 * Clasificacion de confianza de la fuente.
 *
 * Es una funcion pura y deliberadamente simple: la confianza no puede depender
 * del criterio de un modelo ni de quien pago. Reglas explicitas, auditables,
 * y que cualquiera puede leer.
 *
 *   verificada     — dominio oficial en lista blanca y convocatoria vigente
 *   por_validar    — fuente comunitaria o agregador; se muestra, marcada
 *   desactualizada — el plazo ya vencio, o no hay fecha detectable
 */
export function clasificar({ url, fechaLimite }) {
  if (yaVencio(fechaLimite)) return CONFIANZA.DESACTUALIZADA;
  if (esDominioOficial(url)) return CONFIANZA.VERIFICADA;
  return CONFIANZA.POR_VALIDAR;
}

export function esDominioOficial(url) {
  const host = hostnameDe(url);
  if (!host) return false;
  return DOMINIOS_OFICIALES.some(
    (dominio) => host === dominio || host.endsWith(`.${dominio}`)
  );
}

/**
 * Lleva cualquier fecha a "YYYY-MM-DD" para poder compararlas como calendario.
 *
 * Una cadena sin hora ("2026-07-26") se toma tal cual, sin pasarla por Date: si
 * se parsea, JavaScript la interpreta como medianoche UTC y en Bolivia (UTC-4)
 * eso cae el dia ANTERIOR. Un Date real — el que devuelve Postgres para una
 * columna DATE — viene en hora local, asi que se leen sus componentes locales.
 */
function aFechaCalendario(valor) {
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor)) {
    return valor.slice(0, 10);
  }

  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;

  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/**
 * Vencida es ANTES de hoy, nunca hoy.
 *
 * La comparacion se hace entre dos cadenas YYYY-MM-DD, que ordenan igual como
 * texto que como fecha. La version anterior comparaba una fecha parseada en UTC
 * contra la medianoche local, y en Bolivia esas cuatro horas de diferencia
 * hacian que TODA convocatoria que cerraba hoy se marcara como vencida — el
 * unico dia en que a alguien de verdad le urge postular.
 */
function yaVencio(fechaLimite) {
  if (!fechaLimite) return false;

  const limite = aFechaCalendario(fechaLimite);
  if (!limite) return false;

  return limite < aFechaCalendario(new Date());
}

export function hostnameDe(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}
