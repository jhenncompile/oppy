import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validarQuery, validarParamUuid } from '../middleware/validate.js';
import * as opportunityRepository from '../repositories/opportunityRepository.js';
import * as eventRepository from '../repositories/eventRepository.js';

export const insightsRouter = Router();

const ventanaSchema = z.object({
  dias: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(50).default(10)
});

/**
 * Inteligencia de oportunidades.
 *
 * El indice de Oppy es, sin proponerselo, un censo de lo que el mercado pide.
 * Este endpoint es la version minima de ese producto: que habilidades aparecen
 * en las convocatorias bolivianas y con que frecuencia.
 */
insightsRouter.get(
  '/skills',
  validarQuery(ventanaSchema),
  asyncHandler(async (req, res) => {
    const { dias, limit } = req.validatedQuery;
    const habilidades = await opportunityRepository.habilidadesMasPedidas({ dias, limit });
    res.json({ ventanaDias: dias, habilidades });
  })
);

insightsRouter.get(
  '/categorias',
  asyncHandler(async (_req, res) => {
    const categorias = await opportunityRepository.contarPorCategoria();
    res.json({ categorias });
  })
);

/** Reporte de alcance para una organizacion que publica o patrocina. */
insightsRouter.get(
  '/orgs/:orgId/alcance',
  validarParamUuid('orgId'),
  validarQuery(ventanaSchema),
  asyncHandler(async (req, res) => {
    const alcance = await eventRepository.alcancePorOrg(req.params.orgId, {
      dias: req.validatedQuery.dias
    });
    res.json({ alcance });
  })
);
