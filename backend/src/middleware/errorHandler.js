import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/AppError.js';

const log = logger.child({ module: 'http' });

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'not_found', message: `No existe ${req.method} ${req.path}` }
  });
}

/**
 * Punto unico de salida de errores.
 *
 * Solo los AppError — errores que el sistema anticipo — llegan al cliente con
 * su mensaje. Cualquier otro se registra completo y se responde en generico:
 * un stack trace en la respuesta es una fuga de informacion.
 */
export function errorHandler(error, req, res, _next) {
  if (error instanceof AppError) {
    log.warn('Error esperado', {
      code: error.code,
      status: error.status,
      path: req.path,
      message: error.message
    });

    return res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {})
      }
    });
  }

  log.error('Error inesperado', {
    path: req.path,
    message: error.message,
    stack: error.stack
  });

  res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'Ocurrio un error inesperado',
      ...(env.isProduction ? {} : { debug: error.message })
    }
  });
}
