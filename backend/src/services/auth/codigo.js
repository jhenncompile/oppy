import crypto from 'node:crypto';

/**
 * Generacion y verificacion del codigo de acceso. Contrato en docs/12-auth.md.
 *
 * Vive aca y no en la ruta porque es logica de dominio, y porque asi se puede
 * probar sin levantar el servidor ni tocar Postgres — que es justo lo que hace
 * falta para confiar en un mecanismo de acceso.
 *
 * Funciones puras salvo `generarCodigo`, que por definicion no puede serlo.
 */

export const LARGO_CODIGO = 6;
export const VIGENCIA_MINUTOS = 10;
export const MAX_INTENTOS = 5;
export const MAX_PEDIDOS = 3;
export const VENTANA_PEDIDOS_MINUTOS = 15;

// pbkdf2 con sal por codigo. Seis digitos son solo 10^6 combinaciones: un
// sha256 pelado se revierte con una tabla precalculada en segundos, asi que lo
// que protege el codigo guardado es el costo de derivarlo, no su longitud.
const ITERACIONES = 100_000;
const LARGO_CLAVE = 32;

function hashear(codigo, sal) {
  return crypto.pbkdf2Sync(codigo, sal, ITERACIONES, LARGO_CLAVE, 'sha256').toString('hex');
}

/** randomInt y no Math.random: este numero es la unica credencial que existe. */
export function generarCodigo() {
  return String(crypto.randomInt(0, 10 ** LARGO_CODIGO)).padStart(LARGO_CODIGO, '0');
}

/** Devuelve `sal:derivado` en un solo texto: no hace falta una segunda columna. */
export function derivar(codigo) {
  const sal = crypto.randomBytes(16).toString('hex');
  return `${sal}:${hashear(codigo, sal)}`;
}

/**
 * Compara en tiempo constante. Un `===` filtra cuantos caracteres acertaste por
 * lo que tarda en responder.
 */
export function coincide(codigo, guardado) {
  const [sal, esperado] = String(guardado ?? '').split(':');
  if (!sal || !esperado) return false;

  const calculado = Buffer.from(hashear(codigo, sal), 'hex');
  const referencia = Buffer.from(esperado, 'hex');

  return (
    calculado.length === referencia.length &&
    crypto.timingSafeEqual(calculado, referencia)
  );
}
