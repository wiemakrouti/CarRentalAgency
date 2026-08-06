import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { carsRouter } from './routes/cars.routes.js';
import { clientsRouter } from './routes/clients.routes.js';
import { errorHandler } from './middleware/error-handler.js';
import { AppError } from './utils/app-error.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  const api = express.Router();
  api.use(healthRouter);
  api.use(authRouter);
  api.use(carsRouter);
  api.use(clientsRouter);
  // Feature routers (rentals, finances, maintenance, reports, settings,
  // audit-logs) are mounted here starting Phase 4.
  app.use('/api/v1', api);

  app.use((_req, _res, next) => {
    next(new AppError(404, 'NOT_FOUND', 'Resource not found.'));
  });

  app.use(errorHandler);

  return app;
}
