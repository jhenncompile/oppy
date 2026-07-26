import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { validarBody } from '../middleware/validate.js';
import * as userRepository from '../repositories/userRepository.js';

export const profilesRouter = Router();

const idiomaSchema = z.object({
  idioma: z.string().min(2).max(40),
  nivel: z.string().min(1).max(20)
});

// Cuatro campos. El onboarding tiene que costar menos de un minuto: cada campo
// extra es gente que abandona antes de ver el valor.
const perfilSchema = z.object({
  nombre: z.string().min(1).max(120).optional(),
  carrera: z.string().min(2).max(120),
  nivelEstudios: z.string().min(2).max(60),
  intereses: z.array(z.string().min(2).max(60)).max(10).default([]),
  ubicacion: z.string().min(2).max(80),
  idiomas: z.array(idiomaSchema).max(6).default([])
});

const visibilidadSchema = z.object({
  visibleParaEmpresas: z.boolean()
});

profilesRouter.post(
  '/',
  validarBody(perfilSchema),
  asyncHandler(async (req, res) => {
    const perfil = await userRepository.create(req.body);
    res.status(201).json({ perfil });
  })
);

profilesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const perfil = await userRepository.findById(req.params.id);
    if (!perfil) throw AppError.notFound('Perfil no encontrado');
    res.json({ perfil });
  })
);

/**
 * Opt-in del matching inverso. Queda registrado en `consents` con su fecha:
 * el consentimiento es revocable y auditable, no un checkbox perdido.
 */
profilesRouter.patch(
  '/:id/visibilidad',
  validarBody(visibilidadSchema),
  asyncHandler(async (req, res) => {
    const perfil = await userRepository.setVisibilidadEmpresas(
      req.params.id,
      req.body.visibleParaEmpresas
    );
    if (!perfil) throw AppError.notFound('Perfil no encontrado');
    res.json({ perfil });
  })
);
