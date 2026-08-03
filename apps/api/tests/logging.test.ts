import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import pino from 'pino';
import { createRotatingFileStream } from '@/lib/logging/rotating-stream';

const dirs: string[] = [];

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'log-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  dirs.length = 0;
});

async function flush(ms = 150): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe('rotating file stream', () => {
  it('writes pino lines to a dated app file', async () => {
    const dir = tempDir();
    const stream = createRotatingFileStream({ dir, prefix: 'app', retentionDays: 30 });
    const log = pino({ level: 'info' }, stream);
    log.info({ hello: 'world' }, 'first');
    await flush();
    stream.end();

    const files = fs.readdirSync(dir);
    const appFile = files.find((f) => /^app-\d{4}-\d{2}-\d{2}\.log$/.test(f));
    expect(appFile).toBeTruthy();
    const content = fs.readFileSync(path.join(dir, appFile as string), 'utf8');
    expect(content).toContain('hello');
    expect(content).toContain('world');
  });

  it('mirrors error-level lines to a dedicated error file', async () => {
    const dir = tempDir();
    const stream = createRotatingFileStream({ dir, prefix: 'app', retentionDays: 30, mirrorErrorLevel: true });
    const log = pino({ level: 'debug' }, stream);
    log.info({ ok: true }, 'info line');
    log.error(new Error('boom'), 'error line');
    await flush();
    stream.end();

    const files = fs.readdirSync(dir);
    const errorFile = files.find((f) => /^error-\d{4}-\d{2}-\d{2}\.log$/.test(f));
    expect(errorFile).toBeTruthy();
    const errorContent = fs.readFileSync(path.join(dir, errorFile as string), 'utf8');
    expect(errorContent).toContain('boom');
    expect(errorContent).not.toContain('info line');

    const appFile = files.find((f) => /^app-\d{4}-\d{2}-\d{2}\.log$/.test(f));
    const appContent = fs.readFileSync(path.join(dir, appFile as string), 'utf8');
    expect(appContent).toContain('info line');
  });
});
