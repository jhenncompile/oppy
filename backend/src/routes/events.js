import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validarBody } from '../middleware/validate.js';
import * as eventRepository from '../repositories/eventRepository.js';

export const eventsRouter = Router();

const eventoSchema = z.object({
  userId: z.string().uuid().nullish(),
  opportunityId: z.string().uuid(),
  tipo: z.enum(['impresion', 'clic', 'guardado', 'descarte'])
});

/**
 * Telemetria de producto. Responde 202 y no devuelve cuerpo: es un canal de
 * escritura al que al cliente no le interesa esperar.
 */
eventsRouter.post(
  '/',
  validarBody(eventoSchema),
  asyncHandler(async (req, res) => {
    await eventRepository.registrar({
      userId: req.body.userId ?? null,
      opportunityId: req.body.opportunityId,
      tipo: req.body.tipo
    });
    res.status(202).end();
  })
);
