import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { validarBody, validarQuery } from '../middleware/validate.js';
import * as matchRepository from '../repositories/matchRepository.js';
import * as eventRepository from '../repositories/eventRepository.js';

export const matchesRouter = Router();

const consultaSchema = z.object({
  userId: z.string().uuid(),
  minScore: z.coerce.number().int().min(0).max(100).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

// El seguimiento avanza: guardado -> preparando -> aplicada -> entrevista ->
// finalizada. 'descartado' se puede elegir en cualquier momento.
const estadoSchema = z.object({
  estado: z.enum([
    'visto', 'guardado', 'preparando',
    'aplicada', 'entrevista', 'finalizada', 'descartado'
  ])
});

/** Recomendaciones de una persona, ordenadas por compatibilidad. */
matchesRouter.get(
  '/',
  validarQuery(consultaSchema),
  asyncHandler(async (req, res) => {
    const { userId, minScore, limit } = req.validatedQuery;
    const matches = await matchRepository.findByUser(userId, { minScore, limit });
    res.json({ matches, total: matches.length });
  })
);

/**
 * Guardar o descartar. Ademas de actualizar el match, deja el evento: sin esa
 * telemetria los reportes de alcance para organizaciones no tienen que medir.
 */
matchesRouter.patch(
  '/:id',
  validarBody(estadoSchema),
  asyncHandler(async (req, res) => {
    const match = await matchRepository.actualizarEstado(req.params.id, req.body.estado);
    if (!match) throw AppError.notFound('Recomendacion no encontrada');

    // Solo los dos estados que la telemetria de producto ya modela. Los del
    // seguimiento posterior son del usuario, no metricas de alcance.
    const tipoEvento = { guardado: 'guardado', descartado: 'descarte' }[req.body.estado];
    if (tipoEvento) {
      await eventRepository.registrar({
        userId: match.userId,
        opportunityId: match.oportunidad.id,
        tipo: tipoEvento
      });
    }

    res.json({ match });
  })
);
