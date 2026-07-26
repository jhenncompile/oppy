import { env } from '../config/env.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = env.isDevelopment ? LEVELS.debug : LEVELS.info;

function format(level, message, context) {
  const timestamp = new Date().toISOString();

  if (env.isProduction) {
    return JSON.stringify({ timestamp, level, message, ...context });
  }

  const suffix = context && Object.keys(context).length > 0
    ? ` ${JSON.stringify(context)}`
    : '';
  return `${timestamp} ${level.toUpperCase().padEnd(5)} ${message}${suffix}`;
}

function emit(level, message, context) {
  if (LEVELS[level] < threshold) return;
  const line = format(level, message, context);
  if (level === 'error' || level === 'warn') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

export const logger = {
  debug: (message, context) => emit('debug', message, context),
  info: (message, context) => emit('info', message, context),
  warn: (message, context) => emit('warn', message, context),
  error: (message, context) => emit('error', message, context),

  /** Devuelve un logger que agrega el mismo contexto a cada linea. */
  child(base) {
    return {
      debug: (message, context) => emit('debug', message, { ...base, ...context }),
      info: (message, context) => emit('info', message, { ...base, ...context }),
      warn: (message, context) => emit('warn', message, { ...base, ...context }),
      error: (message, context) => emit('error', message, { ...base, ...context }),
      child: (extra) => logger.child({ ...base, ...extra })
    };
  }
};
