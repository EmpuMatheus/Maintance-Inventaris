import http from 'http';
import https from 'https';
import app from './app';
import { env } from '@/config/env';
import { buildHttpsOptions } from '@/config/https';
import { logger } from '@/lib/logger';
import { startMaintenanceScheduler } from '@/lib/scheduler';
import { startBackupScheduler } from '@/lib/backup/scheduler';
import { setupNotificationConsumer } from '@/modules/notifications/notification.service';

setupNotificationConsumer();

const httpsOptions = buildHttpsOptions();
const protocol = httpsOptions ? 'https' : 'http';
const server = httpsOptions ? https.createServer(httpsOptions, app) : http.createServer(app);

server.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, protocol, prefix: env.API_PREFIX, environment: env.appEnv, version: process.env.npm_package_version ?? '1.0.0' },
    `Server started`,
  );
  startMaintenanceScheduler();
  startBackupScheduler();
  startParentWatchdog();
});

/**
 * When spawned by the desktop launcher (which sets PARENT_PID), shuts the
 * server down if the launcher process disappears, so a force-closed launcher
 * never leaves an orphaned backend running.
 */
function startParentWatchdog(): void {
  const parentPid = Number(process.env.PARENT_PID ?? '0');
  if (!parentPid || Number.isNaN(parentPid)) return;
  const timer = setInterval(() => {
    try {
      process.kill(parentPid, 0);
    } catch {
      clearInterval(timer);
      logger.info('Launcher process stopped; shutting down backend.');
      server.close(() => process.exit(0));
    }
  }, 5000);
  timer.unref();
}

const shutdown = (signal: string): void => {
  logger.info({ signal }, 'Received shutdown signal, closing server');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
