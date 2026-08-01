import { describe, it, expect } from 'vitest';
import { isPrivateDevelopmentOrigin, buildCorsOptions } from '@/config/cors';

type OriginCallback = (err: Error | null, allow?: boolean) => void;

function evaluateOrigin(
  origin: string | undefined,
  isDevelopment: boolean,
): Promise<boolean> {
  const options = buildCorsOptions({
    isDevelopment,
    allowedOrigins: ['https://allowed.example.com'],
  });

  return new Promise((resolve) => {
    const callback: OriginCallback = (err, allow) => {
      resolve(!err && !!allow);
    };
    (options.origin as (origin: string | undefined, cb: OriginCallback) => void)(origin, callback);
  });
}

describe('isPrivateDevelopmentOrigin', () => {
  it('accepts localhost origins over http and https', () => {
    expect(isPrivateDevelopmentOrigin('http://localhost:5173')).toBe(true);
    expect(isPrivateDevelopmentOrigin('https://localhost:5173')).toBe(true);
    expect(isPrivateDevelopmentOrigin('http://localhost')).toBe(true);
    expect(isPrivateDevelopmentOrigin('http://LOCALHOST:5173')).toBe(true);
  });

  it('accepts loopback origins', () => {
    expect(isPrivateDevelopmentOrigin('https://127.0.0.1:5173')).toBe(true);
    expect(isPrivateDevelopmentOrigin('http://127.0.0.1:5173')).toBe(true);
  });

  it('accepts private LAN origins', () => {
    expect(isPrivateDevelopmentOrigin('https://192.168.1.100:5173')).toBe(true);
    expect(isPrivateDevelopmentOrigin('https://10.0.0.5:5173')).toBe(true);
    expect(isPrivateDevelopmentOrigin('https://172.16.0.1:5173')).toBe(true);
    expect(isPrivateDevelopmentOrigin('https://172.20.13.75:5173')).toBe(true);
    expect(isPrivateDevelopmentOrigin('https://172.31.255.255:5173')).toBe(true);
  });

  it('rejects public and malformed origins', () => {
    expect(isPrivateDevelopmentOrigin('https://8.8.8.8:5173')).toBe(false);
    expect(isPrivateDevelopmentOrigin('https://example.com')).toBe(false);
    expect(isPrivateDevelopmentOrigin('https://192.168.1.1.example.com')).toBe(false);
    expect(isPrivateDevelopmentOrigin('https://192.168.300.1:5173')).toBe(false);
    expect(isPrivateDevelopmentOrigin('https://172.15.0.1:5173')).toBe(false);
    expect(isPrivateDevelopmentOrigin('https://172.32.0.1:5173')).toBe(false);
    expect(isPrivateDevelopmentOrigin('ftp://192.168.1.1:5173')).toBe(false);
  });
});

describe('buildCorsOptions', () => {
  it('enables credentials', () => {
    const options = buildCorsOptions({ isDevelopment: true, allowedOrigins: [] });
    expect(options.credentials).toBe(true);
    expect(options.preflightContinue).toBe(false);
  });

  it('allows requests without an origin header', async () => {
    await expect(evaluateOrigin(undefined, true)).resolves.toBe(true);
  });

  it('allows dev private origins only in development', async () => {
    await expect(evaluateOrigin('https://192.168.1.50:5173', true)).resolves.toBe(true);
    await expect(evaluateOrigin('https://192.168.1.50:5173', false)).resolves.toBe(false);
  });

  it('always honours the explicit allowlist', async () => {
    await expect(evaluateOrigin('https://allowed.example.com', false)).resolves.toBe(true);
    await expect(evaluateOrigin('https://allowed.example.com', true)).resolves.toBe(true);
  });

  it('rejects public origins in both modes', async () => {
    await expect(evaluateOrigin('https://example.com', true)).resolves.toBe(false);
    await expect(evaluateOrigin('https://example.com', false)).resolves.toBe(false);
  });
});
