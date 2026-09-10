import express, { Express, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import matchesRouter from './routes/matches';
import seasonsRouter from './routes/seasons';
import adminRouter from './routes/admin';
import adminAuthRouter from './routes/admin-auth';
import publicRouter from './routes/public';
import botRouter from './routes/bot';

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
  app.use('/api/admin-auth', adminAuthRouter);
  app.use('/api/public', publicRouter);
  app.use('/api/bot', botRouter);

  // Web UI（web/dist をビルド済みなら配信。開発中は vite dev server を使う）
  const webDist = path.resolve(__dirname, '../../web/dist');
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    // SPA フォールバック（/api 以外の GET は index.html を返す）
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

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
