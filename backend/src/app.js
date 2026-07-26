import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function crearApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') }));
  app.use(express.json({ limit: '256kb' }));
  app.use(requestLogger);

  // Sonda de salud. Render la usa para saber si el servicio esta vivo, y sirve
  // para verificar de un vistazo que capacidades opcionales estan activas.
  app.get('/health', (_req, res) => {
    res.json({
      estado: 'ok',
      entorno: env.NODE_ENV,
      capacidades: env.features,
      cron: env.cronEnabled
    });
  });

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
