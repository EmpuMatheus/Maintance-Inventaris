import { describe, it, expect } from 'vitest';
import { sanitize, diffObjects } from '@/modules/audit/audit.utils';
import { AUDIT_MODULES, AUDIT_ACTIONS } from '@/modules/audit/audit.types';

describe('Audit sanitize', () => {
  it('redacts sensitive keys', () => {
    const input = { username: 'admin', password: 'secret', token: 'abc', jwt: 'x', nested: { otp: '123', name: 'ok' } };
    const out = sanitize(input) as Record<string, unknown>;
    expect(out.password).toBe('[REDACTED]');
    expect(out.token).toBe('[REDACTED]');
    expect(out.jwt).toBe('[REDACTED]');
    expect((out.nested as Record<string, unknown>).otp).toBe('[REDACTED]');
    expect((out.nested as Record<string, unknown>).name).toBe('ok');
    expect(out.username).toBe('admin');
  });

  it('handles primitives and arrays', () => {
    expect(sanitize(null)).toBeNull();
    expect(sanitize([{ password: 'x' }])).toEqual([{ password: '[REDACTED]' }]);
  });
});

describe('Audit diff', () => {
  it('returns only changed fields', () => {
    const { old, new: next } = diffObjects(
      { name: 'A', status: 'OPEN', notes: 'same' },
      { name: 'B', status: 'OPEN', notes: 'same', extra: 1 },
    );
    expect(old).toEqual({ name: 'A' });
    expect(next).toEqual({ name: 'B', extra: 1 });
  });

  it('returns empty diffs for equal objects', () => {
    const { old, new: next } = diffObjects({ a: 1 }, { a: 1 });
    expect(old).toEqual({});
    expect(next).toEqual({});
  });
});

describe('Audit enums', () => {
  it('exposes modules', () => {
    expect(AUDIT_MODULES).toContain('AUTH');
    expect(AUDIT_MODULES).toContain('INVENTORY');
    expect(AUDIT_MODULES).toContain('SYSTEM');
  });

  it('exposes actions', () => {
    expect(AUDIT_ACTIONS).toContain('CREATE');
    expect(AUDIT_ACTIONS).toContain('EXPORT');
    expect(AUDIT_ACTIONS).toContain('COMPLETE');
  });
});
