import fs from 'fs';
import path from 'path';
import { env } from '@/config/env';

export interface HttpsOptions {
  key: Buffer;
  cert: Buffer;
}

/**
 * Builds the TLS options for the HTTPS server. When HTTPS is enabled, the key
 * and cert paths come from `HTTPS_KEY`/`HTTPS_CERT`; if unset, the development
 * self-signed certificate shipped in `certs/` is used.
 */
export function buildHttpsOptions(): HttpsOptions | null {
  if (!env.httpsEnabled) return null;

  const keyPath = env.HTTPS_KEY || path.resolve(process.cwd(), '../../certs/localhost+2-key.pem');
  const certPath = env.HTTPS_CERT || path.resolve(process.cwd(), '../../certs/localhost+2.pem');

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    throw new Error('HTTPS is enabled but the key/certificate files were not found. Set HTTPS_KEY and HTTPS_CERT.');
  }

  return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
}
