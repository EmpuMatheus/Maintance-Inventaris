import { getDb } from '@/database/client';
import { sql } from 'drizzle-orm';

const SENSITIVE_KEYS = /password|token|jwt|secret|otp|authorization/i;

/**
 * Recursively redacts sensitive fields (password, token, jwt, secret, otp,
 * authorization) from objects before they are persisted to the audit log.
 */
export function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[MAX_DEPTH]';
  if (Array.isArray(value)) {
    return value.map((v) => sanitize(v, depth + 1));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEYS.test(key) ? '[REDACTED]' : sanitize(val, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * Returns only the fields that changed between two objects, so the audit log
 * stores a compact, readable diff instead of full payloads.
 */
export function diffObjects(
  oldObj: unknown,
  newObj: unknown,
): { old: Record<string, unknown>; new: Record<string, unknown> } {
  const oldRecord = (oldObj && typeof oldObj === 'object' ? oldObj : {}) as Record<string, unknown>;
  const newRecord = (newObj && typeof newObj === 'object' ? newObj : {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)]);

  const oldDiff: Record<string, unknown> = {};
  const newDiff: Record<string, unknown> = {};

  for (const key of keys) {
    if (JSON.stringify(oldRecord[key]) !== JSON.stringify(newRecord[key])) {
      if (oldRecord[key] !== undefined) oldDiff[key] = oldRecord[key];
      if (newRecord[key] !== undefined) newDiff[key] = newRecord[key];
    }
  }

  return { old: oldDiff, new: newDiff };
}

/** Concurrency-safe audit code: ADT-2026-000001 */
export async function generateAuditCode(): Promise<string> {
  const db = getDb();
  const seq = await db.execute(sql`SELECT nextval('audit_code_seq') AS n`);
  const num = Number((seq as any)[0]?.n ?? 1);
  const year = new Date().getFullYear();
  return `ADT-${year}-${String(num).padStart(6, '0')}`;
}
