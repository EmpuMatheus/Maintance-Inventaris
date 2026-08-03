import { describe, it, expect } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { rateLimit, cleanupRateLimitBuckets } from '@/middleware/rate-limit';

function mockReq(ip: string, body?: unknown): Request {
  return { ip, body } as unknown as Request;
}

function mockRes() {
  let status = 200;
  let jsonPayload: unknown;
  return {
    status(c: number) { status = c; return this; },
    json(p: unknown) { jsonPayload = p; return this; },
    get statusCode() { return status; },
    get payload() { return jsonPayload; },
  } as unknown as Response;
}

describe('Rate limiter', () => {
  it('allows requests under the limit and blocks beyond it', () => {
    cleanupRateLimitBuckets(0);
    const limiter = rateLimit({ windowMs: 60_000, max: 3 });
    const res = mockRes();
    const seen: number[] = [];
    const next: NextFunction = () => seen.push(1);

    for (let i = 0; i < 5; i += 1) {
      limiter(mockReq('1.1.1.1'), res, next);
    }
    expect(seen.length).toBe(3);
    expect(res.statusCode).toBe(429);
    expect((res as unknown as { payload: { error: { code: string } } }).payload.error.code).toBe('RATE_LIMITED');
    cleanupRateLimitBuckets(0);
  });

  it('uses a custom key function to scope limits', () => {
    cleanupRateLimitBuckets(0);
    const limiter = rateLimit({ windowMs: 60_000, max: 2, keyFn: (req) => `user:${String((req.body as { username?: string })?.username)}` });
    const resA = mockRes();
    const resB = mockRes();
    const next = () => undefined as unknown as void;
    limiter(mockReq('1.1.1.1', { username: 'alice' }), resA, next);
    limiter(mockReq('1.1.1.1', { username: 'bob' }), resB, next);
    limiter(mockReq('1.1.1.1', { username: 'alice' }), resA, next);
    limiter(mockReq('1.1.1.1', { username: 'alice' }), resA, next);
    expect(resA.statusCode).toBe(429);
    expect(resB.statusCode).toBe(200);
    cleanupRateLimitBuckets(0);
  });

  it('resets after the window expires', () => {
    cleanupRateLimitBuckets(0);
    const limiter = rateLimit({ windowMs: 1000, max: 1 });
    const res = mockRes();
    limiter(mockReq('2.2.2.2'), res, () => undefined);
    limiter(mockReq('2.2.2.2'), res, () => undefined);
    expect(res.statusCode).toBe(429);
    // Simulate the window passing: expired buckets are evicted by cleanup.
    cleanupRateLimitBuckets(Date.now() + 5000);
    const res2 = mockRes();
    limiter(mockReq('2.2.2.2'), res2, () => undefined);
    expect(res2.statusCode).toBe(200);
    cleanupRateLimitBuckets(0);
  });
});
