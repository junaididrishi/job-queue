import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { connectRedis } from '../queue/redis';
import { getDashboardHTML } from '../dashboard';
import authRouter from './routes/auth';
import tasksRouter from './routes/tasks';
import statsRouter from './routes/stats';
import { logger } from '../utils/logger';

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Basic request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info('HTTP', `${req.method} ${req.path}`);
  next();
});

// Health check — no auth required (used by Railway/Docker health checks)
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime(), ts: new Date().toISOString() });
});

// Dashboard — served at root, no auth at HTTP level (JS handles login)
app.get('/dashboard', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(getDashboardHTML());
});

// Redirect root to dashboard
app.get('/', (_req: Request, res: Response) => res.redirect('/dashboard'));

// API routes
app.use('/api/auth', authRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/stats', statsRouter);

// 404
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Server', err.message, err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await connectRedis();

  app.listen(config.port, () => {
    logger.info('Server', `API running on http://localhost:${config.port}`);
    logger.info('Server', `Dashboard: http://localhost:${config.port}/dashboard`);
    logger.info('Server', `Health: http://localhost:${config.port}/health`);
  });
}

start().catch((err) => {
  logger.error('Server', 'Failed to start', err);
  process.exit(1);
});
