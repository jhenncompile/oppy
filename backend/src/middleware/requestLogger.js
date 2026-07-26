import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'http' });

export function requestLogger(req, res, next) {
  const startedAt = Date.now();

  res.on('finish', () => {
    log.info(`${req.method} ${req.originalUrl}`, {
      status: res.statusCode,
      ms: Date.now() - startedAt
    });
  });

  next();
}
