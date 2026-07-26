/**
 * Error con intencion HTTP. Todo lo que no sea un AppError se trata como
 * fallo inesperado y no se filtra al cliente.
 */
export class AppError extends Error {
  constructor(message, { status = 500, code = 'internal_error', details = null } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.expected = true;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message, details) {
    return new AppError(message, { status: 400, code: 'bad_request', details });
  }

  static notFound(message = 'Recurso no encontrado') {
    return new AppError(message, { status: 404, code: 'not_found' });
  }

  static conflict(message, details) {
    return new AppError(message, { status: 409, code: 'conflict', details });
  }

  static unavailable(message, details) {
    return new AppError(message, { status: 503, code: 'service_unavailable', details });
  }
}
