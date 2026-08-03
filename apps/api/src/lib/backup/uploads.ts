import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, readdirSync, statSync, rmSync, mkdirSync, copyFileSync } from 'fs';
import path from 'path';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { ensureDir, listBackupFiles, timestampSlug, type BackupFile } from './index';

const execFileAsync = promisify(execFile);

function uploadsSourceDir(): string {
  return path.join(env.storageRoot, 'uploads');
}

function countFiles(dir: string): number {
  if (!existsSync(dir)) return 0;
  let count = 0;
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        count += 1;
      }
    }
  };
  walk(dir);
  return count;
}

function copyDirectory(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(from, to);
    } else if (entry.isFile()) {
      copyFileSync(from, to);
    }
  }
}

async function tryCreateTarGz(srcDir: string, archive: string): Promise<boolean> {
  try {
    await execFileAsync('tar', ['-czf', archive, '-C', srcDir, '.'], { timeout: 5 * 60 * 1000 });
    return true;
  } catch {
    return false;
  }
}

/** Counts file entries in a `tar -tzf` listing (handles CRLF line endings). */
export function countTarEntries(listing: string): number {
  return listing
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0 && !l.endsWith('/')).length;
}

async function verifyTarArchive(archive: string, expectedFiles: number): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('tar', ['-tzf', archive], { timeout: 60 * 1000 });
    return countTarEntries(stdout) === expectedFiles;
  } catch {
    return false;
  }
}

/**
 * Creates a backup of the uploads directory. Files are copied into a dated
 * snapshot folder; when the `tar` binary is available the snapshot is also
 * compressed into a `.tar.gz` and the folder removed. Integrity is verified by
 * comparing the file count between the source and the backup.
 */
export async function createUploadBackup(now = new Date()): Promise<BackupFile> {
  ensureDir(env.backupUploadsDir);
  const source = uploadsSourceDir();
  const slug = timestampSlug(now);
  const snapshot = path.join(env.backupUploadsDir, `uploads-${slug}`);
  const archive = path.join(env.backupUploadsDir, `uploads-${slug}.tar.gz`);

  const expected = countFiles(source);
  if (expected === 0) {
    throw new Error('Upload backup failed: no files found in the uploads directory.');
  }

  ensureDir(snapshot);
  copyDirectory(source, snapshot);

  let verified = countFiles(snapshot) === expected;
  if (verified) {
    const compressed = await tryCreateTarGz(snapshot, archive);
    if (compressed) {
      verified = await verifyTarArchive(archive, expected);
      if (verified) {
        rmSync(snapshot, { recursive: true, force: true });
      } else {
        rmSync(archive, { force: true });
      }
    }
  }

  if (!verified) {
    rmSync(snapshot, { recursive: true, force: true });
    throw new Error('Upload backup failed: integrity verification did not match.');
  }

  const finalPath = existsSync(archive) ? archive : snapshot;
  const st = statSync(finalPath);
  logger.info({ file: path.basename(finalPath), size: st.size, files: expected }, 'Upload backup created');
  return { name: path.basename(finalPath), path: finalPath, size: st.size, createdAt: new Date().toISOString() };
}

export function listUploadBackups(): BackupFile[] {
  const archives = listBackupFiles(env.backupUploadsDir, 'uploads-', '.tar.gz');
  const snapshots = listBackupFiles(env.backupUploadsDir, 'uploads-', '')
    .filter((f) => !f.name.endsWith('.tar.gz'))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return [...archives, ...snapshots];
}

export function rotateUploadBackups(now = Date.now()): string[] {
  const files = listUploadBackups();
  const retentionMs = env.BACKUP_UPLOADS_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const removed: string[] = [];
  for (const f of files) {
    if (now - new Date(f.createdAt).getTime() > retentionMs) {
      rmSync(f.path, { recursive: true, force: true });
      removed.push(f.name);
    }
  }
  return removed;
}
