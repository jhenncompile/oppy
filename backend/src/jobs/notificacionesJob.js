import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { enviarNotificacion } from '../services/notifications/zavu.js';
import { mensajeDeOportunidad } from '../services/notifications/templates.js';
import * as userRepository from '../repositories/userRepository.js';
import * as matchRepository from '../repositories/matchRepository.js';
import * as notificationRepository from '../repositories/notificationRepository.js';

const log = logger.child({ module: 'job/notificaciones' });

/**
 * Avisa por Zavu de las oportunidades que valen la pena.
 *
 * Corre sola, desde el cron: si hiciera falta apretar un boton, Oppy seria un
 * buscador con alertas y no un agente que trabaja mientras la persona no esta.
 *
 * El modulo no sabe nada de scraping ni de scoring. Recibe perfiles y matches
 * ya evaluados, decide a quien avisar, y delega el texto y el envio.
 *
 * Tres filtros, en este orden:
 *   1. la persona dio consentimiento y dejo un contacto
 *   2. la compatibilidad supera el umbral
 *   3. no se le aviso antes de esa misma oportunidad
 */
export async function correrNotificaciones({ maxPerfiles = 50 } = {}) {
  const inicio = Date.now();

  if (!env.features.zavu) {
    log.warn('ZAVUDEV_API_KEY ausente: no se envian notificaciones');
    return { perfiles: 0, enviadas: 0, fallidas: 0 };
  }

  const perfiles = await userRepository.findNotificables({ limit: maxPerfiles });

  if (perfiles.length === 0) {
    log.info('Nadie con consentimiento y contacto: no hay a quien avisar');
    return { perfiles: 0, enviadas: 0, fallidas: 0 };
  }

  let enviadas = 0;
  let fallidas = 0;

  for (const perfil of perfiles) {
    try {
      const resultado = await notificarPerfil(perfil);
      enviadas += resultado.enviadas;
      fallidas += resultado.fallidas;
    } catch (error) {
      // Un perfil que falla no puede frenar a los demas.
      log.warn('Notificacion fallida para un perfil', {
        userId: perfil.id,
        error: error.message
      });
    }
  }

  const resumen = { perfiles: perfiles.length, enviadas, fallidas, ms: Date.now() - inicio };
  log.info('Notificaciones completadas', resumen);
  return resumen;
}

async function notificarPerfil(perfil) {
  const [candidatos, yaNotificados] = await Promise.all([
    matchRepository.findByUser(perfil.id, {
      minScore: env.NOTIF_MATCH_THRESHOLD,
      limit: 20
    }),
    notificationRepository.idsYaNotificados(perfil.id, 'match_alto')
  ]);

  // El tope por corrida es deliberado: cinco mensajes seguidos no son un
  // acompaniante, son spam — y la persona silencia el canal entero.
  const pendientes = candidatos
    .filter((match) => !yaNotificados.has(match.oportunidad.id))
    .slice(0, env.NOTIF_MAX_POR_USUARIO);

  let enviadas = 0;
  let fallidas = 0;

  for (const match of pendientes) {
    const texto = mensajeDeOportunidad({ perfil, match });
    const resultado = await enviarNotificacion(destinatarioDe(perfil), texto);

    await notificationRepository.registrar({
      userId: perfil.id,
      opportunityId: match.oportunidad.id,
      canal: resultado.canal,
      estado: resultado.exito ? 'enviado' : 'fallido',
      mensajeId: resultado.mensajeId,
      error: resultado.error,
      // Este job avisa de lo que aparecio; el recordatorio de cierre es otro
      // aviso sobre la misma oportunidad y lleva su propio tipo.
      tipo: 'match_alto'
    });

    if (resultado.exito) enviadas += 1;
    else fallidas += 1;
  }

  return { enviadas, fallidas };
}

/**
 * Zavu detecta el canal por el formato del destinatario, asi que basta con
 * elegir uno. Se prefiere el email: un telefono puede enrutar a un canal que el
 * desafio excluye, y el correo llega igual.
 */
function destinatarioDe(perfil) {
  return perfil.email ?? perfil.telefono ?? null;
}
