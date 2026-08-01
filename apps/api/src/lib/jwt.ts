import jwt from 'jsonwebtoken';
import { env } from '@/config/env';

const SECRET = env.JWT_SECRET;
const EXPIRES_IN = env.JWT_EXPIRES_IN;

export function signToken(payload: { sub: string }): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): { sub: string } {
  return jwt.verify(token, SECRET) as { sub: string };
}
