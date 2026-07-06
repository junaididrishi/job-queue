import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/job_queue',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'),
    pollTimeoutSeconds: parseInt(process.env.WORKER_POLL_TIMEOUT || '5'),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
    heartbeatIntervalMs: 10_000,
  },
  webhook: {
    secret: process.env.WEBHOOK_SECRET || 'webhook-secret',
    timeoutMs: 10_000,
  },
  queue: {
    highPriority: 'tasks:high',
    normalPriority: 'tasks:normal',
    lowPriority: 'tasks:low',
    deadLetter: 'tasks:dead',
  },
} as const;
