import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { validarBody, validarQuery, validarParamUuid } from '../middleware/validate.js';
import * as matchRepository from '../repositories/matchRepository.js';
import * as eventRepository from '../repositories/eventRepository.js';

export const matchesRouter = Router();

const consultaSchema = z.object({
  userId: z.string().uuid(),
  minScore: z.coerce.number().int().min(0).max(100).default(30),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

// El seguimiento avanza: guardado -> preparando -> aplicada -> entrevista ->
// finalizada. 'descartado' se puede elegir en cualquier momento.
const estadoSchema = z.object({
  estado: z.enum([
    'visto', 'guardado', 'preparando',
    'aplicada', 'entrevista', 'finalizada', 'descartado'
  ]),
  tipoFeedback: z.enum(['no_me_interesa', 'mala_info']).nullish(),
  comentario: z.string().max(500).nullish()
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
 * Guardar, avanzar seguimiento o descartar.
 * Descarte con tipoFeedback=mala_info alimenta al agente distinto que "no me interesa".
 */
matchesRouter.patch(
  '/:id',
  validarParamUuid(),
  validarBody(estadoSchema),
  asyncHandler(async (req, res) => {
    const { estado, tipoFeedback, comentario } = req.body;
    const match = await matchRepository.actualizarFeedback(req.params.id, {
      estado,
      tipoFeedback: tipoFeedback ?? null,
      comentario: comentario ?? null
    });
    if (!match) throw AppError.notFound('Recomendacion no encontrada');

    if (estado === 'guardado') {
      await eventRepository.registrar({
        userId: match.userId,
        opportunityId: match.oportunidad.id,
        tipo: 'guardado'
      });
    } else if (estado === 'descartado' && tipoFeedback === 'mala_info') {
      await eventRepository.registrar({
        userId: match.userId,
        opportunityId: match.oportunidad.id,
        tipo: 'mala_info'
      });
    } else if (estado === 'descartado') {
      await eventRepository.registrar({
        userId: match.userId,
        opportunityId: match.oportunidad.id,
        tipo: 'descarte'
      });
    }

    res.json({ match });
  })
);
