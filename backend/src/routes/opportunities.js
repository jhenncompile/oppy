import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { validarQuery, validarParamUuid } from '../middleware/validate.js';
import { CATEGORIAS } from '../services/agent/normalizer.js';
import * as opportunityRepository from '../repositories/opportunityRepository.js';

export const opportunitiesRouter = Router();

const listadoSchema = z.object({
  categoria: z.enum(CATEGORIAS).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40)
});

/** El indice compartido, sin personalizar. Util para explorar y para depurar. */
opportunitiesRouter.get(
  '/',
  validarQuery(listadoSchema),
  asyncHandler(async (req, res) => {
    const { categoria, limit } = req.validatedQuery;
    const oportunidades = await opportunityRepository.findCandidatas({
      categorias: categoria ? [categoria] : null,
      limit
    });
    res.json({ oportunidades, total: oportunidades.length });
  })
);

opportunitiesRouter.get(
  '/:id',
  validarParamUuid(),
  asyncHandler(async (req, res) => {
    const oportunidad = await opportunityRepository.findById(req.params.id);
    if (!oportunidad) throw AppError.notFound('Oportunidad no encontrada');
    res.json({ oportunidad });
  })
);
