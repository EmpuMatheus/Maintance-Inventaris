import { describe, it, expect, vi } from 'vitest';
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

  it('signToken does not set a time-based expiry', () => {
    const token = signToken({ sub: 'user-123' });
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as {
      exp?: number;
      iat?: number;
    };
    expect(payload.exp).toBeUndefined();
  });

  it('rejects a token issued before the server restarted', async () => {
    const oldToken = signToken({ sub: 'user-123' });
    expect(verifyToken(oldToken).sub).toBe('user-123');

    vi.resetModules();
    const restarted = await import('@/lib/jwt');

    expect(() => restarted.verifyToken(oldToken)).toThrow();
  });
});
