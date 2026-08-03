import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { listBackupFiles, rotateBackups, timestampSlug } from '@/lib/backup';
import { countTarEntries } from '@/lib/backup/uploads';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function touch(name: string, ageDays: number): void {
  const file = path.join(dir, name);
  fs.writeFileSync(file, 'x');
  const mtime = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000);
  fs.utimesSync(file, mtime, mtime);
}

describe('backup helpers', () => {
  it('produces sortable timestamp slugs', () => {
    expect(timestampSlug(new Date('2026-01-02T03:04:05Z'))).toBe('2026-01-02_03-04-05');
  });

  it('lists backups oldest first', () => {
    touch('db-2026-01-02_00-00-00.dump', 10);
    touch('db-2026-01-01_00-00-00.dump', 11);
    const files = listBackupFiles(dir, 'db-', '.dump');
    expect(files.map((f) => f.name)).toEqual(['db-2026-01-01_00-00-00.dump', 'db-2026-01-02_00-00-00.dump']);
  });

  it('keeps only files matching the prefix and extension', () => {
    touch('db-2026-01-01_00-00-00.dump', 1);
    touch('uploads-2026-01-01_00-00-00.tar.gz', 1);
    const files = listBackupFiles(dir, 'db-', '.dump');
    expect(files.map((f) => f.name)).toEqual(['db-2026-01-01_00-00-00.dump']);
  });

  it('rotates backups older than retention days', () => {
    touch('db-2026-01-01_00-00-00.dump', 5);
    touch('db-2026-01-02_00-00-00.dump', 1);
    const removed = rotateBackups(dir, 'db-', '.dump', 3);
    expect(removed).toEqual(['db-2026-01-01_00-00-00.dump']);
    expect(fs.existsSync(path.join(dir, 'db-2026-01-01_00-00-00.dump'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'db-2026-01-02_00-00-00.dump'))).toBe(true);
  });

  it('counts tar entries ignoring directories and CRLF line endings', () => {
    // Windows tar outputs CRLF; directory entries end with a slash.
    const listing = './\r\n./photo.jpg\r\n./docs/\r\n./docs/report.pdf\r\n';
    expect(countTarEntries(listing)).toBe(2);
  });
});
