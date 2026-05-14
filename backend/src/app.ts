import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import matchesRouter from './routes/matches';
import seasonsRouter from './routes/seasons';
import adminRouter from './routes/admin';

export function createApp(): Express {
  const app = express();

  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/matches', matchesRouter);
  app.use('/api/seasons', seasonsRouter);
  app.use('/api/admin', adminRouter);

  app.use((req, res) => {
    res.status(404).json({ error: 'Not Found', path: req.path });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[error]', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  });

  return app;
}
