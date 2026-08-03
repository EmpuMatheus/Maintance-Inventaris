import { execFile } from 'child_process';
import { promisify } from 'util';
import { statSync, rmSync } from 'fs';
import path from 'path';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { ensureDir, listBackupFiles, rotateBackups, timestampSlug, type BackupFile } from './index';

const execFileAsync = promisify(execFile);

function pgDumpBinary(): string {
  return env.PG_DUMP_PATH || 'pg_dump';
}

/**
 * Creates a PostgreSQL backup in pg_dump custom format. Throws with a clear
 * message when pg_dump is unavailable or fails. On failure the partial file is
 * removed so a broken backup is never kept.
 */
export async function createDatabaseBackup(now = new Date()): Promise<BackupFile> {
  ensureDir(env.backupDatabaseDir);
  const file = path.join(env.backupDatabaseDir, `db-${timestampSlug(now)}.dump`);

  try {
    await execFileAsync(pgDumpBinary(), ['--format=custom', '--no-owner', '--file', file, env.DATABASE_URL], {
      timeout: 5 * 60 * 1000,
    });
  } catch (error) {
    rmSync(file, { force: true });
    const reason = error instanceof Error ? error.message : String(error);
    logger.error({ error: reason }, 'Database backup failed');
    throw new Error(
      `Database backup failed. Ensure pg_dump is installed and on PATH (or set PG_DUMP_PATH). ${reason}`,
    );
  }

  const st = statSync(file);
  logger.info({ file: path.basename(file), size: st.size }, 'Database backup created');
  return { name: path.basename(file), path: file, size: st.size, createdAt: new Date().toISOString() };
}

export function listDatabaseBackups(): BackupFile[] {
  return listBackupFiles(env.backupDatabaseDir, 'db-', '.dump');
}

export function rotateDatabaseBackups(now = Date.now()): string[] {
  return rotateBackups(env.backupDatabaseDir, 'db-', '.dump', env.BACKUP_DATABASE_RETENTION_DAYS, now);
}
