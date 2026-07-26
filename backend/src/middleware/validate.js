import { AppError } from '../utils/AppError.js';

/**
 * Valida y NORMALIZA. Tras pasar por aca, `req.body` es el objeto que definio
 * el schema — no lo que mando el cliente. Los handlers no vuelven a chequear.
 */
export const validarBody = (schema) => (req, _res, next) => {
  const resultado = schema.safeParse(req.body);

  if (!resultado.success) {
    return next(AppError.badRequest('Datos invalidos', resultado.error.flatten()));
  }

  req.body = resultado.data;
  next();
};

export const validarQuery = (schema) => (req, _res, next) => {
  const resultado = schema.safeParse(req.query);

  if (!resultado.success) {
    return next(AppError.badRequest('Parametros invalidos', resultado.error.flatten()));
  }

  req.validatedQuery = resultado.data;
  next();
};
