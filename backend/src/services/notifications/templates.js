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

/**
 * Recordatorio de una oportunidad que la persona anoto ella misma.
 *
 * Es el reverso del mensaje de arriba y por eso esta escrito al reves: aquel
 * dice "encontre algo", este dice "vos anotaste algo". Oppy no esta
 * recomendando nada aca — esta cumpliendo un encargo, y el texto tiene que
 * dejarlo claro, porque es lo unico que separa un recordatorio util de un
 * mensaje no pedido.
 *
 * Nunca se manda sobre algo que Oppy no verifico y que la persona no eligio:
 * los avisos sobre convocatorias sin verificar son la forma exacta de una
 * estafa laboral, y quien usa Oppy es la mas expuesta a eso.
 *
 * @param {object} opciones
 * @param {object} opciones.persona   Nombre de quien la anoto
 * @param {object} opciones.propia    La oportunidad de la libreta
 * @param {Date}   [opciones.hoy]     Inyectable para poder probar el plazo
 * @returns {string}
 */
export function mensajeDeRecordatorio({ persona, propia, hoy = new Date() }) {
  const saludo = persona?.nombre ? `Hola ${persona.nombre}` : 'Hola';
  const plazo = textoPlazo(propia.fechaLimite, hoy);

  const lineas = [
    `${saludo}, soy Oppy. Te recuerdo algo que anotaste vos:`,
    '',
    propia.titulo
  ];

  if (propia.organizacion) lineas.push(propia.organizacion);
  if (plazo) lineas.push(`${plazo}.`);
  if (propia.donde) lineas.push(`La anotaste asi: ${propia.donde}.`);
  if (propia.enlace) lineas.push('', propia.enlace);

  return lineas.join('\n');
}

/**
 * Recordatorio de una oportunidad que Oppy encontro y la persona guardo.
 *
 * Hermano del de arriba y escrito distinto a proposito. Aca Oppy SI reviso la
 * fuente, asi que puede nombrarla — y nombrarla es lo que hace que el mensaje
 * se pueda comprobar. En el de la libreta no puede, y no lo finge.
 *
 * Los dos empiezan igual en lo que importa: recordando algo que la persona
 * eligio. Ninguno de los dos es una recomendacion nueva; para eso esta
 * `mensajeDeOportunidad`.
 *
 * @param {object} opciones
 * @param {object} opciones.persona   Nombre de quien la guardo
 * @param {object} opciones.match     Match con su oportunidad
 * @param {Date}   [opciones.hoy]     Inyectable para poder probar el plazo
 * @returns {string}
 */
export function mensajeDeCierreGuardada({ persona, match, hoy = new Date() }) {
  const { oportunidad } = match;
  const saludo = persona?.nombre ? `Hola ${persona.nombre}` : 'Hola';
  const plazo = textoPlazo(oportunidad.fechaLimite, hoy);

  const lineas = [
    `${saludo}, soy Oppy. Te recuerdo la que guardaste:`,
    '',
    oportunidad.titulo
  ];

  if (oportunidad.fuente?.nombre) lineas.push(oportunidad.fuente.nombre);
  if (plazo) lineas.push(`${plazo}.`);

  const enlace = oportunidad.linkAplicacion ?? oportunidad.fuente?.url;
  if (enlace) lineas.push('', enlace);

  return lineas.join('\n');
}

/**
 * Mensaje con el codigo para volver a entrar. Contrato en docs/12-auth.md.
 *
 * Dice de entrada que alguien lo pidio y que se puede ignorar. Este mensaje le
 * llega a la persona sin que lo espere si alguien escribio mal su correo, y en
 * ese caso lo unico que necesita saber es que no tiene que hacer nada.
 *
 * No lleva enlace a proposito: un mensaje inesperado con un enlace para
 * apretar es exactamente la forma de una estafa, y la gente a la que Oppy
 * quiere llegar es la mas expuesta a eso. El codigo se escribe a mano en una
 * pantalla que la persona ya tiene abierta.
 *
 * @param {object} opciones
 * @param {object} opciones.perfil    Perfil de la persona
 * @param {string} opciones.codigo    Los 6 digitos
 * @param {number} opciones.minutos   Vigencia
 * @returns {string}
 */
export function mensajeDeAcceso({ perfil, codigo, minutos }) {
  const saludo = perfil?.nombre ? `Hola ${perfil.nombre}` : 'Hola';

  return [
    `${saludo}, soy Oppy. Alguien pidio volver a entrar a tu perfil.`,
    '',
    `Tu codigo es ${codigo}`,
    `Vence en ${minutos} minutos.`,
    '',
    'Si no lo pediste vos, no hagas nada: sin el codigo nadie entra.'
  ].join('\n');
}
