import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { env } from '@/config/env';

const SECRET = env.JWT_SECRET;

/**
 * Random value generated once per process start. Tokens carry this id so that
 * a server restart invalidates every previously issued token, forcing users to
 * sign in again. Tokens have no time-based expiry; logging out on the client
 * (removing the stored token) is what ends a session.
 */
const BOOT_ID = randomUUID();

export function signToken(payload: { sub: string }): string {
  return jwt.sign({ ...payload, sid: BOOT_ID }, SECRET);
}

export function verifyToken(token: string): { sub: string } {
  const decoded = jwt.verify(token, SECRET) as { sub: string; sid?: string };
  if (decoded.sid !== BOOT_ID) {
    throw new Error('Token issued before server restart.');
  }
  return { sub: decoded.sub };
}
