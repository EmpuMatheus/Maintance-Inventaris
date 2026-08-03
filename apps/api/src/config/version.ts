import fs from 'fs';
import path from 'path';
import { env } from '@/config/env';

interface BuildInfo {
  version: string;
  buildTime: string;
  commit?: string;
}

/**
 * Reads the `build-info.json` file written at the repository root by
 * `scripts/write-build-info.mjs` during a production build. Falls back to
 * environment values or defaults when the file is absent (development).
 */
function readBuildInfo(): BuildInfo | null {
  const candidates = [
    path.resolve(process.cwd(), 'build-info.json'),
    path.resolve(process.cwd(), '../../build-info.json'),
  ];
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf8')) as BuildInfo;
      }
    } catch {
      // ignore malformed/missing build info
    }
  }
  return null;
}

const buildInfo = readBuildInfo();

export const appVersion = env.APP_VERSION || buildInfo?.version || '1.0.0';
export const buildTimestamp = env.APP_BUILD_TIME || buildInfo?.buildTime || '';
export const buildCommit = buildInfo?.commit ?? '';
