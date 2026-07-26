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

function yaVencio(fechaLimite) {
  if (!fechaLimite) return false;
  const limite = new Date(fechaLimite);
  if (Number.isNaN(limite.getTime())) return false;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return limite < hoy;
}

export function hostnameDe(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}
