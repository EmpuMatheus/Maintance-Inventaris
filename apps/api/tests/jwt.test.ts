import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from '@/lib/jwt';

describe('JWT Token', () => {
  it('signToken creates a valid token', () => {
    const token = signToken({ sub: 'user-123' });
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('verifyToken decodes a valid token', () => {
    const token = signToken({ sub: 'user-123' });
    const payload = verifyToken(token);
    expect(payload.sub).toBe('user-123');
  });

  it('verifyToken throws for invalid token', () => {
    expect(() => verifyToken('invalid-token')).toThrow();
  });
});
