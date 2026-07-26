import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { validarBody, validarParamUuid } from '../middleware/validate.js';
import * as userRepository from '../repositories/userRepository.js';

export const profilesRouter = Router();

const idiomaSchema = z.object({
  idioma: z.string().min(2).max(40),
  nivel: z.string().min(1).max(20)
});

export const OBJETIVOS = [
  'empleo', 'reinsercion', 'beca', 'curso',
  'crecimiento', 'voluntariado', 'evento'
];

// El onboarding tiene que costar menos de un minuto: todo lo que no sea
// imprescindible es opcional, porque cada campo obligatorio de mas es gente que
// abandona antes de ver el valor.
const perfilSchema = z.object({
  nombre: z.string().min(1).max(120).optional(),
  edad: z.coerce.number().int().min(14).max(100).optional(),
  carrera: z.string().min(2).max(120),
  nivelEstudios: z.string().min(2).max(60),
  intereses: z.array(z.string().min(2).max(60)).max(10).default([]),
  ubicacion: z.string().min(2).max(80),
  idiomas: z.array(idiomaSchema).max(6).default([]),

  // Hasta 3: los perfiles reales persiguen varias cosas a la vez, pero cada
  // objetivo abre mas busquedas y el descubrimiento es lo que cuesta. El
  // primero es el que mas pesa para el orquestador.
  objetivos: z.array(z.enum(OBJETIVOS)).max(3).default([]),
  experiencia: z.array(z.string().min(2).max(60)).max(10).default([]),
  habilidades: z.array(z.string().min(2).max(60)).max(15).default([]),
  preferencias: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
  restricciones: z.array(z.string().min(2).max(80)).max(10).default([]),

  // Contacto para las notificaciones. Sin consentimiento explicito no se
  // notifica, aunque haya contacto: el opt-in es la condicion, no el dato.
  email: z.string().email().max(160).optional(),
  telefono: z.string().min(8).max(20).optional(),
  aceptaNotificaciones: z.boolean().default(false)
});

const visibilidadSchema = z.object({
  visibleParaEmpresas: z.boolean()
});

// Al menos uno de los dos contactos, o no hay a donde mandar nada. `refine` y
// no dos campos requeridos: obligar a los dos seria pedir un telefono a quien
// solo usa correo.
const contactoSchema = z
  .object({
    email: z.string().email().max(160).nullish(),
    telefono: z.string().min(8).max(20).nullish(),
    aceptaNotificaciones: z.boolean()
  })
  .refine((datos) => !datos.aceptaNotificaciones || datos.email || datos.telefono, {
    message: 'Hace falta un correo o un telefono para poder avisarte'
  });

profilesRouter.post(
  '/',
  validarBody(perfilSchema),
  asyncHandler(async (req, res) => {
    const perfil = await userRepository.create(req.body);

    // El consentimiento queda registrado con su fecha desde el minuto cero:
    // revocable y auditable, no un checkbox perdido en el formulario.
    if (perfil.aceptaNotificaciones) {
      await userRepository.registrarConsentimiento(perfil.id, 'notificaciones', true);
    }

    res.status(201).json({ perfil });
  })
);

profilesRouter.get(
  '/:id',
  validarParamUuid(),
  asyncHandler(async (req, res) => {
    const perfil = await userRepository.findById(req.params.id);
    if (!perfil) throw AppError.notFound('Perfil no encontrado');
    res.json({ perfil });
  })
);

/**
 * Contacto para avisos y para el acceso. Contrato en docs/12-auth.md.
 *
 * Es el mismo dato para las dos cosas y el mismo consentimiento: quien dijo que
 * no queria mensajes tampoco recibe codigos de acceso.
 */
profilesRouter.patch(
  '/:id/contacto',
  validarParamUuid(),
  validarBody(contactoSchema),
  asyncHandler(async (req, res) => {
    const perfil = await userRepository.setContacto(req.params.id, req.body);
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
  validarParamUuid(),
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
