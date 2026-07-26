import { logger } from '../utils/logger.js';
import { ejecutar } from '../services/agent/pipeline.js';
import * as userRepository from '../repositories/userRepository.js';
import * as opportunityRepository from '../repositories/opportunityRepository.js';

const log = logger.child({ module: 'job/descubrimiento' });

/**
 * La corrida autonoma.
 *
 * Es el corazon del sistema, no un extra para el pitch: el indice es
 * compartido, asi que este job es el que descubre para todos. El boton del
 * dashboard dispara exactamente el mismo pipeline.
 *
 * Los perfiles se procesan en serie a proposito: en background no hay nadie
 * esperando, y ser amable con los proveedores externos vale mas que terminar
 * unos minutos antes.
 */
export async function correrDescubrimiento({ maxPerfiles = 5 } = {}) {
  const inicio = Date.now();

  const vencidas = await opportunityRepository.marcarVencidas();
  if (vencidas > 0) log.info('Convocatorias marcadas como vencidas', { vencidas });

  const perfiles = await userRepository.findAll({ limit: maxPerfiles });

  if (perfiles.length === 0) {
    log.warn('No hay perfiles: no hay para quien descubrir');
    return { perfiles: 0, nuevas: 0 };
  }

  let nuevas = 0;

  for (const perfil of perfiles) {
    try {
      const resultado = await ejecutar({ perfil, disparador: 'cron' });
      nuevas += resultado.oportunidadesNuevas;
    } catch (error) {
      // Un perfil que falla no puede frenar a los demas.
      log.warn('Corrida fallida para un perfil', {
        userId: perfil.id,
        error: error.message
      });
    }
  }

  const resumen = { perfiles: perfiles.length, nuevas, ms: Date.now() - inicio };
  log.info('Descubrimiento autonomo completado', resumen);
  return resumen;
}
