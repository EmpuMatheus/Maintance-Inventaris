import { describe, it, expect } from 'vitest';
import { updateConditionSchema } from '@/modules/assets/condition.schema';

describe('Condition Update Schema', () => {
  it('accepts valid condition update', () => {
    const result = updateConditionSchema.safeParse({ condition: 'FAIR', reason: 'Battery issue', notes: 'Needs replacement' });
    expect(result.success).toBe(true);
  });

  it('rejects missing condition', () => {
    const result = updateConditionSchema.safeParse({ reason: 'test' });
    expect(result.success).toBe(false);
  });

  it('accepts condition with only reason', () => {
    const result = updateConditionSchema.safeParse({ condition: 'BROKEN', reason: 'Physically damaged' });
    expect(result.success).toBe(true);
  });

  it('accepts condition with only notes', () => {
    const result = updateConditionSchema.safeParse({ condition: 'NEED_ATTENTION', notes: 'Unusual noise' });
    expect(result.success).toBe(true);
  });

  it('accepts condition with no optional fields', () => {
    const result = updateConditionSchema.safeParse({ condition: 'GOOD' });
    expect(result.success).toBe(true);
  });
});
