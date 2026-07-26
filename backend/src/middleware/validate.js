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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Valida que un parametro de ruta sea un UUID antes de que llegue al SQL.
 *
 * Sin esto, un id mal formado viaja hasta Postgres, que lo rechaza con
 * "invalid input syntax for type uuid" y sale como 500 — o sea, un pedido mal
 * escrito se reporta como si el servidor se hubiera caido. Con esto es un 400,
 * que es lo que realmente paso.
 */
export const validarParamUuid = (nombre = 'id') => (req, _res, next) => {
  if (!UUID.test(req.params[nombre] ?? '')) {
    return next(AppError.badRequest(`El parametro "${nombre}" no es un identificador valido`));
  }
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
