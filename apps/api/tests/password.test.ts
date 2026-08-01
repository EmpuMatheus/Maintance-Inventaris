import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/password';

describe('Password Hashing', () => {
  it('hashPassword produces a non-plaintext hash', async () => {
    const hash = await hashPassword('testpassword');
    expect(hash).not.toBe('testpassword');
    expect(hash).toContain('$argon2id');
  });

  it('verifyPassword returns true for correct password', async () => {
    const hash = await hashPassword('correctpassword');
    const result = await verifyPassword(hash, 'correctpassword');
    expect(result).toBe(true);
  });

  it('verifyPassword returns false for wrong password', async () => {
    const hash = await hashPassword('correctpassword');
    const result = await verifyPassword(hash, 'wrongpassword');
    expect(result).toBe(false);
  });
});
