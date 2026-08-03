import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { createDatabaseBackup, rotateDatabaseBackups } from './database';

let timer: NodeJS.Timeout | null = null;

/**
 * Starts the scheduled database backup loop. The interval is configured via
 * `BACKUP_INTERVAL_MINUTES`; a value of 0 (or a non-production environment)
 * disables it. Rotation runs after every successful backup.
 */
export function startBackupScheduler(): void {
  stopBackupScheduler();
  if (!env.isProduction || env.BACKUP_INTERVAL_MINUTES <= 0) {
    return;
  }

  const run = async (): Promise<void> => {
    try {
      const backup = await createDatabaseBackup();
      rotateDatabaseBackups();
      logger.info({ file: backup.name }, 'Scheduled database backup completed');
    } catch (error) {
      logger.error({ error }, 'Scheduled database backup failed');
    }
  };

  timer = setInterval(run, env.BACKUP_INTERVAL_MINUTES * 60 * 1000);
  timer.unref();
  logger.info({ intervalMinutes: env.BACKUP_INTERVAL_MINUTES }, 'Backup scheduler started');
}

export function stopBackupScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
