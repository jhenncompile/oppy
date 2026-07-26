import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { validarBody } from '../middleware/validate.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import * as accesoRepository from '../repositories/accesoRepository.js';
import * as userRepository from '../repositories/userRepository.js';
import { enviarNotificacion } from '../services/notifications/zavu.js';
import { mensajeDeAcceso } from '../services/notifications/templates.js';
import {
  coincide,
  derivar,
  generarCodigo,
  MAX_INTENTOS,
  MAX_PEDIDOS,
  VENTANA_PEDIDOS_MINUTOS,
  VIGENCIA_MINUTOS
} from '../services/auth/codigo.js';

const log = logger.child({ module: 'auth' });

export const authRouter = Router();

const contactoSchema = z.object({
  contacto: z.string().min(5).max(160)
});

const sesionSchema = z.object({
  contacto: z.string().min(5).max(160),
  codigo: z.string().regex(/^\d{6}$/, 'El codigo son 6 digitos')
});

/**
 * Capacidad. Lo primero que llama el frontend, una sola vez al arrancar.
 *
 * Si no hay Zavu configurado se responde `disponible: false` en vez de mentir:
 * sin canal de envio no hay codigo posible, y ofrecer un acceso que no puede
 * completarse es peor que no ofrecerlo. El frontend esconde todo solo.
 */
authRouter.get(
  '/estado',
  asyncHandler(async (_req, res) => {
    res.json({
      disponible: env.features.zavu,
      canal: env.features.zavu ? 'zavu' : null
    });
  })
);

/**
 * Pedir un codigo.
 *
 * SIEMPRE 202, exista el contacto o no. Si respondiera 404 cuando no existe,
 * cualquiera podria averiguar quien esta registrado probando correos — y la
 * lista de quien busca trabajo es exactamente lo que no puede filtrarse.
 *
 * Por la misma razon el limite de pedidos tampoco se comunica: el 202 es
 * identico se haya enviado algo o no.
 */
authRouter.post(
  '/codigo',
  validarBody(contactoSchema),
  asyncHandler(async (req, res) => {
    const contacto = req.body.contacto.trim();

    // La respuesta se manda primero y siempre igual. Todo lo que sigue puede
    // fallar sin que el cliente note la diferencia, que es justo lo que se
    // busca.
    res.status(202).json({ enviado: true, expiraEn: VIGENCIA_MINUTOS * 60 });

    if (!env.features.zavu) return;

    try {
      const usuario = await accesoRepository.findUserByContacto(contacto);
      if (!usuario) {
        log.info('Codigo pedido para un contacto sin perfil');
        return;
      }

      const pedidos = await accesoRepository.contarPedidosRecientes(
        usuario.id,
        VENTANA_PEDIDOS_MINUTOS
      );
      if (pedidos >= MAX_PEDIDOS) {
        log.warn('Limite de pedidos alcanzado', { userId: usuario.id, pedidos });
        return;
      }

      const codigo = generarCodigo();
      const expiraEn = new Date(Date.now() + VIGENCIA_MINUTOS * 60_000);
      await accesoRepository.crearCodigo(usuario.id, derivar(codigo), expiraEn);

      const texto = mensajeDeAcceso({
        perfil: usuario,
        codigo,
        minutos: VIGENCIA_MINUTOS
      });

      // enviarNotificacion nunca lanza: un canal caido se registra y ya.
      const envio = await enviarNotificacion(contacto, texto);
      if (!envio.exito) log.warn('Codigo no enviado', { error: envio.error });
    } catch (error) {
      // La respuesta ya salio: aca solo queda dejar rastro.
      log.error('Fallo al emitir el codigo', { error: error.message });
    }
  })
);

/**
 * Canjear el codigo.
 *
 * Devuelve el perfil completo y nada mas: no hay token, ni cookie, ni header de
 * sesion. El frontend guarda `perfil.id` en la misma clave de localStorage de
 * siempre y sigue funcionando igual que antes.
 */
authRouter.post(
  '/sesion',
  validarBody(sesionSchema),
  asyncHandler(async (req, res) => {
    const contacto = req.body.contacto.trim();
    const { codigo } = req.body;

    const usuario = await accesoRepository.findUserByContacto(contacto);
    const vigente = usuario ? await accesoRepository.buscarVigente(usuario.id) : null;

    // Contacto inexistente y codigo vencido dan el mismo error a proposito: la
    // respuesta no debe permitir distinguir los dos casos.
    if (!vigente) {
      throw AppError.badRequest('El codigo no es valido o ya vencio');
    }

    if (!coincide(codigo, vigente.codigo_hash)) {
      const intentos = await accesoRepository.registrarIntento(vigente.id);

      // Al quinto fallo el codigo se quema. Sin esto, seis digitos se prueban
      // enteros con un script.
      if (intentos >= MAX_INTENTOS) {
        await accesoRepository.marcarUsado(vigente.id);
        log.warn('Codigo quemado por intentos', { userId: usuario.id });
        throw new AppError('Demasiados intentos. Pedi un codigo nuevo.', {
          status: 429,
          code: 'demasiados_intentos'
        });
      }

      throw AppError.badRequest('El codigo no es valido o ya vencio');
    }

    // De un solo uso: un codigo que sigue sirviendo despues de entrar es un
    // codigo que puede reusar quien mire el historial del correo.
    await accesoRepository.marcarUsado(vigente.id);

    const perfil = await userRepository.findById(usuario.id);
    if (!perfil) throw AppError.notFound('Perfil no encontrado');

    log.info('Acceso recuperado', { userId: perfil.id });
    res.json({ perfil });
  })
);
