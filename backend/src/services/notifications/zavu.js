import Zavudev from '@zavudev/sdk';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ module: 'zavu' });

/**
 * Cliente de Zavu — API unificada de mensajeria (SMS, Telegram, Email, Voz).
 *
 * Se instancia una sola vez y de forma perezosa: crear el cliente en el import
 * obligaria a tener la clave para arrancar el servidor, y el resto de Oppy
 * funciona perfectamente sin notificaciones.
 *
 * Zavu elige el canal segun el formato del destinatario y reintenta por otro si
 * el primero falla. Ese fallback automatico es justo lo que se necesita y no
 * hace falta escribirlo: forzar un canal a mano seria trabajo extra para
 * conseguir menos entregabilidad.
 */
let cliente = null;

function obtenerCliente() {
  if (!cliente) cliente = new Zavudev({ apiKey: env.ZAVUDEV_API_KEY });
  return cliente;
}

/**
 * Envia un mensaje y devuelve un resultado normalizado.
 *
 * NUNCA lanza. Un canal caido no puede tumbar la corrida del agente, igual que
 * una fuente de scraping que no responde. El fallo se devuelve como dato para
 * que quede registrado en la tabla `notificaciones`: un envio que no salio es
 * informacion, no ruido.
 *
 * @param {string} destinatario  Email o telefono en formato internacional
 * @param {string} texto
 * @returns {Promise<{exito: boolean, canal: string|null, mensajeId: string|null, error: string|null}>}
 */
export async function enviarNotificacion(destinatario, texto) {
  if (!env.features.zavu) {
    return { exito: false, canal: null, mensajeId: null, error: 'ZAVUDEV_API_KEY ausente' };
  }

  if (!destinatario) {
    return { exito: false, canal: null, mensajeId: null, error: 'Sin destinatario' };
  }

  try {
    const mensaje = await obtenerCliente().messages.send({ to: destinatario, text: texto });

    const resultado = {
      exito: true,
      canal: mensaje?.channel ?? null,
      mensajeId: mensaje?.id ?? null,
      error: null
    };

    log.info('Notificacion enviada', resultado);
    return resultado;
  } catch (error) {
    log.warn('Notificacion fallida', { error: error.message });
    return { exito: false, canal: null, mensajeId: null, error: error.message };
  }
}
