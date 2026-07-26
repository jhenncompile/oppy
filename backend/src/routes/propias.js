import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { validarBody, validarQuery, validarParamUuid } from '../middleware/validate.js';
import * as propiaRepository from '../repositories/propiaRepository.js';

export const propiasRouter = Router();

// Los estados de una propia son los de `matches` menos 'nuevo' y 'visto': la
// persona no descubre estas oportunidades, las anota.
const ESTADOS = ['guardado', 'preparando', 'aplicada', 'entrevista', 'finalizada', 'descartado'];

/**
 * Solo el titulo es obligatorio.
 *
 * Es deliberado: mucho de lo que la gente anota viene de un mensaje de
 * WhatsApp o de un cartel, y no tiene enlace, ni organizacion, ni fecha. Un
 * formulario que exige todo eso es un formulario que no se completa, y la
 * oportunidad se pierde igual que si Oppy no existiera.
 */
const propiaSchema = z.object({
  userId: z.string().uuid(),
  titulo: z.string().min(2).max(160),
  organizacion: z.string().max(120).optional(),
  enlace: z.string().url().max(500).optional(),
  donde: z.string().max(160).optional(),
  notas: z.string().max(1000).optional(),
  fechaLimite: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD').optional(),
  estado: z.enum(ESTADOS).optional()
});

const consultaSchema = z.object({
  userId: z.string().uuid()
});

const estadoSchema = z.object({
  userId: z.string().uuid(),
  estado: z.enum(ESTADOS)
});

/** La libreta de una persona. */
propiasRouter.get(
  '/',
  validarQuery(consultaSchema),
  asyncHandler(async (req, res) => {
    const propias = await propiaRepository.findByUser(req.validatedQuery.userId);
    res.json({ propias, total: propias.length });
  })
);

propiasRouter.post(
  '/',
  validarBody(propiaSchema),
  asyncHandler(async (req, res) => {
    const propia = await propiaRepository.crear(req.body);
    res.status(201).json({ propia });
  })
);

/**
 * El `userId` viaja en el cuerpo y el repositorio filtra por el. Sin eso,
 * conocer el id de una fila alcanzaria para modificar la libreta de otra
 * persona.
 */
propiasRouter.patch(
  '/:id',
  validarParamUuid(),
  validarBody(estadoSchema),
  asyncHandler(async (req, res) => {
    const propia = await propiaRepository.actualizarEstado(
      req.params.id,
      req.body.userId,
      req.body.estado
    );
    if (!propia) throw AppError.notFound('Oportunidad no encontrada');
    res.json({ propia });
  })
);

propiasRouter.delete(
  '/:id',
  validarParamUuid(),
  validarQuery(consultaSchema),
  asyncHandler(async (req, res) => {
    const borrada = await propiaRepository.eliminar(req.params.id, req.validatedQuery.userId);
    if (!borrada) throw AppError.notFound('Oportunidad no encontrada');
    res.status(204).end();
  })
);
