import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret, isEncryptedSecret, resetSecretKeyCache } from '@/lib/crypto/secret-box';

describe('secret-box (CCTV credential encryption)', () => {
  it('encrypts and decrypts a password round-trip', () => {
    const plain = 'S3cr3t-P@ssw0rd!';
    const encrypted = encryptSecret(plain);
    expect(encrypted).toBeTruthy();
    expect(encrypted).not.toContain(plain);
    expect(isEncryptedSecret(encrypted)).toBe(true);
    expect(decryptSecret(encrypted)).toBe(plain);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const a = encryptSecret('same-password');
    const b = encryptSecret('same-password');
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe('same-password');
    expect(decryptSecret(b)).toBe('same-password');
  });

  it('returns null for empty/null input', () => {
    expect(encryptSecret('')).toBeNull();
    expect(encryptSecret(null)).toBeNull();
    expect(encryptSecret(undefined)).toBeNull();
    expect(decryptSecret(null)).toBeNull();
    expect(decryptSecret('')).toBeNull();
  });

  it('returns null when decrypting a non-encrypted/plain value', () => {
    expect(isEncryptedSecret('plain-text')).toBe(false);
    expect(decryptSecret('plain-text')).toBeNull();
  });

  it('returns null for tampered ciphertext instead of throwing', () => {
    const encrypted = encryptSecret('apapun')!;
    const tampered = encrypted.slice(0, -4) + 'AAAA';
    expect(decryptSecret(tampered)).toBeNull();
  });

  it('resetSecretKeyCache keeps round-trip working', () => {
    const encrypted = encryptSecret('round-trip');
    resetSecretKeyCache();
    expect(decryptSecret(encrypted)).toBe('round-trip');
  });
});
