import { createWriteStream, type WriteStream } from 'fs';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { Writable } from 'stream';
import path from 'path';

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function dateStamp(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface RotatingFileStreamOptions {
  dir: string;
  prefix: string;
  retentionDays?: number;
  /** Also write every error-level (>=50) pino line to `error-<date>.log`. */
  mirrorErrorLevel?: boolean;
}

/**
 * A writable stream that writes pino JSON lines to a daily file
 * (`<prefix>-YYYY-MM-DD.log`), rotating at midnight and pruning files older
 * than `retentionDays`. When `mirrorErrorLevel` is enabled, error-level lines
 * are additionally written to a dedicated `error-YYYY-MM-DD.log`.
 */
export function createRotatingFileStream(options: RotatingFileStreamOptions): Writable {
  const { dir, prefix, retentionDays = 0, mirrorErrorLevel = false } = options;
  ensureDir(dir);

  let currentDate = dateStamp();
  let appStream: WriteStream | null = null;
  let errorStream: WriteStream | null = null;

  const openStreams = (): void => {
    appStream = createWriteStream(path.join(dir, `${prefix}-${currentDate}.log`), { flags: 'a' });
    if (mirrorErrorLevel) {
      errorStream = createWriteStream(path.join(dir, `error-${currentDate}.log`), { flags: 'a' });
    }
  };

  const cleanupOldFiles = (): void => {
    if (!retentionDays || retentionDays <= 0) return;
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const match = /^(.+)-(\d{4}-\d{2}-\d{2})\.log$/.exec(name);
      if (!match) continue;
      const filePrefix = match[1];
      if (filePrefix !== prefix && filePrefix !== 'error') continue;
      const fileDate = new Date(`${match[2]}T00:00:00Z`);
      if (fileDate.getTime() < cutoff) {
        rmSync(path.join(dir, name), { force: true });
      }
    }
  };

  const writable = new Writable({
    write(chunk: Buffer, _encoding: string, callback: (error?: Error | null) => void): void {
      try {
        const today = dateStamp();
        if (!appStream || today !== currentDate) {
          if (appStream) appStream.end();
          if (errorStream) errorStream.end();
          currentDate = today;
          openStreams();
          cleanupOldFiles();
        }

        const line = chunk.toString('utf8');
        if (!appStream) {
          callback(new Error('Log stream is not ready.'));
          return;
        }
        appStream.write(chunk);

        if (mirrorErrorLevel && errorStream) {
          try {
            const parsed = JSON.parse(line);
            if (typeof parsed.level === 'number' && parsed.level >= 50) {
              errorStream.write(chunk);
            }
          } catch {
            // not a JSON pino line — skip error mirroring
          }
        }

        callback();
      } catch (error) {
        callback(error as Error);
      }
    },
  });

  openStreams();
  cleanupOldFiles();

  writable.on('finish', () => {
    if (appStream) appStream.end();
    if (errorStream) errorStream.end();
  });

  return writable;
}
