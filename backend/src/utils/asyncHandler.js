/**
 * Express 4 no captura rechazos de promesas en los handlers. Este wrapper
 * los reenvia a next() para que lleguen al manejador central de errores.
 */
export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};
