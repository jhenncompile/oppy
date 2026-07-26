import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { validarBody } from '../middleware/validate.js';
import { logger } from '../utils/logger.js';
import * as userRepository from '../repositories/userRepository.js';
import * as agentRunRepository from '../repositories/agentRunRepository.js';
import * as runTracker from '../services/agent/runTracker.js';
import { iniciar } from '../services/agent/pipeline.js';

const log = logger.child({ module: 'routes/agent' });

export const agentRouter = Router();

const disparoSchema = z.object({
  userId: z.string().uuid()
});

/**
 * Dispara una corrida y responde de inmediato con el runId.
 *
 * La corrida tarda decenas de segundos; dejar la peticion HTTP abierta seria
 * fragil y no permitiria narrar el progreso. El cliente se suscribe al stream
 * con el runId que recibe aca.
 */
agentRouter.post(
  '/run',
  validarBody(disparoSchema),
  asyncHandler(async (req, res) => {
    const perfil = await userRepository.findById(req.body.userId);
    if (!perfil) throw AppError.notFound('Perfil no encontrado');

    const { runId, completado } = await iniciar({ perfil, disparador: 'manual' });

    // El fallo ya queda registrado en agent_runs y viaja por el stream; aca
    // solo se evita un unhandled rejection.
    completado.catch((error) => {
      log.warn('Corrida manual fallida', { runId, error: error.message });
    });

    res.status(202).json({ runId, estado: 'en_curso' });
  })
);

/**
 * Progreso en vivo por Server-Sent Events.
 *
 * SSE y no WebSocket: el flujo es de una sola direccion, sobrevive a proxies
 * HTTP y no agrega dependencias.
 */
agentRouter.get('/runs/:id/stream', (req, res) => {
  if (!runTracker.obtener(req.params.id)) {
    res.status(404).json({
      error: { code: 'not_found', message: 'Corrida no encontrada o expirada' }
    });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    // Render y otros proxies bufferizan respuestas por defecto, lo que anula
    // el streaming: esta cabecera lo desactiva.
    'X-Accel-Buffering': 'no'
  });

  let latido = null;
  let cerrado = false;

  const enviar = (evento, datos) => {
    if (!cerrado) res.write(`event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`);
  };

  const cerrar = () => {
    if (cerrado) return;
    cerrado = true;
    if (latido) clearInterval(latido);
    res.end();
  };

  // Si la corrida ya termino, `suscribir` invoca onFin de forma sincrona:
  // por eso el cierre no puede depender de nada declarado despues.
  const cancelar = runTracker.suscribir(req.params.id, {
    onPaso: (paso) => enviar('paso', paso),
    onFin: (fin) => {
      enviar('fin', fin);
      cerrar();
    }
  });

  // Evita que un proxy corte una conexion aparentemente inactiva.
  if (!cerrado) latido = setInterval(() => res.write(': latido\n\n'), 15_000);

  req.on('close', () => {
    if (latido) clearInterval(latido);
    cancelar?.();
  });
});

/** Bitacora publica: la prueba auditable de que el agente corre solo. */
agentRouter.get(
  '/runs',
  asyncHandler(async (_req, res) => {
    const corridas = await agentRunRepository.recientes({ limit: 20 });
    res.json({ corridas });
  })
);
