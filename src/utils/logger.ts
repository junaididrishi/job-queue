import { config } from '../config';

type Level = 'info' | 'warn' | 'error' | 'debug';

function log(level: Level, context: string, message: string, meta?: unknown) {
  const ts = new Date().toISOString();
  const metaStr = meta ? ' ' + JSON.stringify(meta) : '';
  const line = `[${ts}] [${level.toUpperCase()}] [${context}] ${message}${metaStr}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else if (level === 'debug' && config.nodeEnv === 'production') return;
  else console.log(line);
}

export const logger = {
  info: (ctx: string, msg: string, meta?: unknown) => log('info', ctx, msg, meta),
  warn: (ctx: string, msg: string, meta?: unknown) => log('warn', ctx, msg, meta),
  error: (ctx: string, msg: string, meta?: unknown) => log('error', ctx, msg, meta),
  debug: (ctx: string, msg: string, meta?: unknown) => log('debug', ctx, msg, meta),
};
