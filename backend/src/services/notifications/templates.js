/**
 * Redaccion de los mensajes que salen por Zavu.
 *
 * Funciones puras a proposito: mismo input, mismo output, sin red ni reloj
 * escondido. Eso permite probar el texto sin gastar un envio real, que es
 * justo lo que no se quiere hacer a mano en una demo.
 *
 * El tono es el mismo del producto — acompaniante, no buscador. Mucha gente que
 * recibe este mensaje nunca uso un producto con agentes: si el texto suena a
 * alerta de sistema, lo ignora o lo reporta como spam.
 */

const DIAS_MS = 86_400_000;

/** Dias que faltan para el cierre, o null si no hay fecha. */
function diasRestantes(fechaLimite, hoy) {
  if (!fechaLimite) return null;

  const limite = new Date(fechaLimite);
  if (Number.isNaN(limite.getTime())) return null;

  const desde = new Date(hoy);
  desde.setHours(0, 0, 0, 0);
  return Math.ceil((limite - desde) / DIAS_MS);
}

/**
 * El plazo se dice en lenguaje de persona, no en fecha ISO. "Cierra en 3 dias"
 * mueve a alguien; "2027-03-14" hay que traducirlo mentalmente.
 */
function textoPlazo(fechaLimite, hoy) {
  const dias = diasRestantes(fechaLimite, hoy);

  if (dias === null) return null;
  if (dias < 0) return null;
  if (dias === 0) return 'Cierra hoy';
  if (dias === 1) return 'Cierra maniana';
  return `Cierra en ${dias} dias`;
}

/**
 * Mensaje de una oportunidad nueva.
 *
 * @param {object} opciones
 * @param {object} opciones.perfil       Perfil de la persona
 * @param {object} opciones.match        Match con compatibilidad y razones
 * @param {Date}   [opciones.hoy]        Inyectable para poder probar el plazo
 * @returns {string}
 */
export function mensajeDeOportunidad({ perfil, match, hoy = new Date() }) {
  const { oportunidad } = match;
  const saludo = perfil.nombre ? `Hola ${perfil.nombre}` : 'Hola';

  const lineas = [
    `${saludo}, soy Oppy. Encontre algo que puede servirte:`,
    '',
    oportunidad.titulo,
    `${match.compatibilidad}% compatible con tu perfil.`
  ];

  // Una sola razon: es un mensaje, no una ficha. La razon es lo que separa
  // esto de una alerta generica — sin ella no hay motivo para abrirlo.
  const [primeraRazon] = match.razones ?? [];
  if (primeraRazon) lineas.push(`Por que: ${primeraRazon.toLowerCase()}.`);

  const plazo = textoPlazo(oportunidad.fechaLimite, hoy);
  if (plazo) lineas.push(plazo + '.');

  const enlace = oportunidad.linkAplicacion ?? oportunidad.fuente?.url;
  if (enlace) lineas.push('', enlace);

  return lineas.join('\n');
}
