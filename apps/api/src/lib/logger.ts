import pino from 'pino';
import { env } from '@/config/env';
import { appVersion } from '@/config/version';
import { createRotatingFileStream } from '@/lib/logging/rotating-stream';

const redact = {
  paths: ['req.headers.authorization', 'req.headers.cookie', 'body.password', 'body.token'],
  censor: '[REDACTED]',
};

const base = {
  app: 'office-inventory',
  version: appVersion,
  env: env.appEnv,
};

/**
 * Application logger.
 *
 * - Development/test: writes to stdout.
 * - Production: writes to daily rotating files in `LOG_DIR`
 *   (`app-YYYY-MM-DD.log`), mirroring error-level lines to `error-YYYY-MM-DD.log`.
 */
export const logger = env.isDevelopment
  ? pino({ level: env.LOG_LEVEL, base, redact }, pino.destination(1))
  : pino(
      {
        level: env.LOG_LEVEL,
        base,
        redact,
      },
      createRotatingFileStream({
        dir: env.logDir,
        prefix: 'app',
        retentionDays: env.LOG_RETENTION_DAYS,
        mirrorErrorLevel: true,
      }),
    );

/**
 * HTTP access logger used by pino-http. In production it writes to
 * `access-YYYY-MM-DD.log` with its own retention; in development it shares the
 * stdout logger.
 */
export const accessLogger = env.isDevelopment
  ? logger
  : pino(
      { level: 'info', base: { ...base, stream: 'access' }, redact },
      createRotatingFileStream({
        dir: env.logDir,
        prefix: 'access',
        retentionDays: env.LOG_RETENTION_DAYS,
      }),
    );
