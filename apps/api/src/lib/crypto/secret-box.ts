import crypto from 'node:crypto';
import { env } from '@/config/env';

/**
 * Symmetric encryption for CCTV device credentials (ONVIF passwords).
 *
 * Design goals:
 * - Passwords are NEVER stored in plaintext, NEVER returned by the API and
 *   NEVER logged/audited.
 * - No native dependency: `node:crypto` AES-256-GCM (authenticated encryption).
 *
 * Key resolution:
 * 1. `CCTV_CREDENTIAL_KEY` when set (recommended in production). Any non-empty
 *    string is accepted and stretched with scrypt to 32 bytes.
 * 2. Fallback: derive from `JWT_SECRET` with a fixed application salt. This
 *    keeps development working without extra setup while still avoiding
 *    plaintext. Changing `JWT_SECRET` invalidates previously stored secrets,
 *    which is acceptable for a recoverable device credential.
 *
 * Ciphertext format (versioned so the algorithm can be rotated later):
 *   v1:<iv base64>:<auth tag base64>:<ciphertext base64>
 */

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const SALT = 'bbp-cctv-credential-v1';

let cachedKey: Buffer | null = null;

function resolveKey(): Buffer {
  if (cachedKey) return cachedKey;
  const material = env.CCTV_CREDENTIAL_KEY?.trim()
    ? env.CCTV_CREDENTIAL_KEY
    : `jwt-fallback:${env.JWT_SECRET}`;
  cachedKey = crypto.scryptSync(material, SALT, KEY_LENGTH);
  return cachedKey;
}

/** Returns true when `value` looks like a value produced by `encryptSecret`. */
export function isEncryptedSecret(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(`${VERSION}:`);
}

/**
 * Encrypts a plaintext secret. Empty/blank input returns `null` so a device
 * without a password never stores an encrypted empty string.
 */
export function encryptSecret(plain: string | null | undefined): string | null {
  if (plain === null || plain === undefined) return null;
  const value = String(plain);
  if (value.length === 0) return null;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, resolveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [VERSION, iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

/**
 * Decrypts a value produced by `encryptSecret`. Returns `null` for empty input
 * or for values that cannot be decrypted (e.g. after a key change) instead of
 * throwing, so a credential problem degrades to "authentication failed" rather
 * than a crash.
 */
export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!isEncryptedSecret(value)) return null;

  const parts = value.split(':');
  if (parts.length !== 4) return null;

  const [, ivB64, tagB64, dataB64] = parts;
  try {
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, resolveKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

/** Test-only helper: clears the memoized key so a changed env is re-read. */
export function resetSecretKeyCache(): void {
  cachedKey = null;
}
