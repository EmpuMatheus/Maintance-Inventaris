import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'fs';
import path from 'path';

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/** A human-safe, sortable timestamp slug: YYYY-MM-DD_HH-MM-SS */
export function timestampSlug(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
}

export interface BackupFile {
  name: string;
  path: string;
  size: number;
  createdAt: string;
}

/** Lists backup files (oldest first) matching `prefix` + `extension` in `dir`. */
export function listBackupFiles(dir: string, prefix: string, extension: string): BackupFile[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(extension))
    .map((f) => {
      const full = path.join(dir, f);
      const st = statSync(full);
      return { name: f, path: full, size: st.size, createdAt: st.mtime.toISOString() };
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * Deletes backups older than `retentionDays` and returns the removed file names.
 * `now` is injectable for deterministic tests.
 */
export function rotateBackups(dir: string, prefix: string, extension: string, retentionDays: number, now = Date.now()): string[] {
  const files = listBackupFiles(dir, prefix, extension);
  const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
  const removed: string[] = [];
  for (const f of files) {
    const age = now - new Date(f.createdAt).getTime();
    if (age > retentionMs) {
      rmSync(f.path, { force: true });
      removed.push(f.name);
    }
  }
  return removed;
}
