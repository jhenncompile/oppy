import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { closePool } from '../db/index.js';
import { enviarNotificacion } from '../services/notifications/zavu.js';
import {
  mensajeDeRecordatorio,
  mensajeDeCierreGuardada
} from '../services/notifications/templates.js';
import * as propiaRepository from '../repositories/propiaRepository.js';
import * as matchRepository from '../repositories/matchRepository.js';
import * as notificationRepository from '../repositories/notificationRepository.js';

const log = logger.child({ module: 'job/recordatorios' });

/**
 * Avisa de los plazos que se vienen, de las DOS fuentes: las oportunidades que
 * Oppy encontro y la persona guardo, y las que anoto ella por su cuenta.
 *
 * Que las dos entren por el mismo job no es comodidad — es la misma razon por
 * la que entran al mismo calendario: para quien esta buscando, un plazo es un
 * plazo. Un recordatorio que solo conoce la mitad de sus compromisos lo deja
 * igual de solo que antes.
 *
 * Es tambien el unico job que no depende del modelo: no descubre, no normaliza
 * y no puntua — solo mira fechas. Por eso corre y sirve aunque no haya un LLM
 * servido en ningun lado, y por eso es la forma mas barata de comprobar que el
 * canal de Zavu funciona de punta a punta.
 *
 * Idempotencia, distinta en cada lado por como esta modelado cada uno:
 *   - las anotadas, en su propia fila (`recordatorio_enviado_en`)
 *   - las guardadas, en `notificaciones` con `tipo = 'cierre_proximo'`, que es
 *     independiente del aviso de match alto sobre la misma oportunidad
 *
 * Nunca se avisa dos veces de lo mismo: recordar dos veces es como Oppy dejaria
 * de ser un acompaniante y empezaria a ser ruido.
 */
export async function correrRecordatorios({ dias = 3 } = {}) {
  const inicio = Date.now();

  if (!env.features.zavu) {
    log.warn('ZAVUDEV_API_KEY ausente: no se envian recordatorios');
    return { candidatas: 0, enviados: 0, fallidos: 0 };
  }

  const [guardadas, anotadas] = await Promise.all([
    matchRepository.pendientesDeCierre({ dias }),
    propiaRepository.pendientesDeRecordatorio({ dias })
  ]);

  const candidatas = guardadas.length + anotadas.length;

  if (candidatas === 0) {
    log.info('Ningun plazo cerca: no hay a quien recordarle nada', { dias });
    return { candidatas: 0, enviados: 0, fallidos: 0 };
  }

  let enviados = 0;
  let fallidos = 0;

  // 1. Lo que encontro el agente y la persona guardo.
  for (const match of guardadas) {
    const texto = mensajeDeCierreGuardada({ persona: match.persona, match });
    const resultado = await enviarNotificacion(destinatarioDe(match.persona), texto);

    // El fallo tambien se guarda: un envio que no salio es informacion. Y como
    // solo los 'enviado' cuentan para el NOT EXISTS, se reintenta solo.
    await notificationRepository.registrar({
      userId: match.persona.id,
      opportunityId: match.oportunidad.id,
      canal: resultado.canal,
      estado: resultado.exito ? 'enviado' : 'fallido',
      mensajeId: resultado.mensajeId,
      error: resultado.error,
      tipo: 'cierre_proximo'
    });

    if (resultado.exito) enviados += 1;
    else {
      log.warn('Recordatorio de guardada fallido', {
        opportunityId: match.oportunidad.id,
        error: resultado.error
      });
      fallidos += 1;
    }
  }

  // 2. Lo que la persona anoto por su cuenta.
  for (const propia of anotadas) {
    const texto = mensajeDeRecordatorio({ persona: propia.persona, propia });
    const resultado = await enviarNotificacion(destinatarioDe(propia.persona), texto);

    if (resultado.exito) {
      // Solo se marca cuando salio: un envio fallido tiene que reintentarse en
      // la corrida siguiente, no perderse.
      await propiaRepository.marcarRecordatorioEnviado(propia.id);
      enviados += 1;
    } else {
      log.warn('Recordatorio de anotada fallido', {
        propiaId: propia.id,
        error: resultado.error
      });
      fallidos += 1;
    }
  }

  const resumen = {
    candidatas,
    guardadas: guardadas.length,
    anotadas: anotadas.length,
    enviados,
    fallidos,
    ms: Date.now() - inicio
  };
  log.info('Recordatorios completados', resumen);
  return resumen;
}

/**
 * Zavu detecta el canal por el formato del destinatario, asi que basta con
 * elegir uno. Se prefiere el email, igual que en el job de notificaciones.
 */
function destinatarioDe(persona) {
  return persona.email ?? persona.telefono ?? null;
}

// Corrible solo, sin el resto del cron: `npm run recordatorios`. Es lo que
// permite probar el canal completo — base, plazo, redaccion y envio — sin
// modelo, sin scraping y sin esperar a las 06:00.
const isEntryPoint = process.argv[1] === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  try {
    await correrRecordatorios();
  } catch (error) {
    log.error('Recordatorios fallidos', { error: error.message });
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
