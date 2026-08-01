import { describe, it, expect } from 'vitest';
import { calculateNextDueDate, daysBetween, todayString, toDateString } from '@/modules/maintenance-schedules/schedule.date';
import { createScheduleSchema, updateScheduleSchema, dueQuerySchema } from '@/modules/maintenance-schedules/schedule.schema';
import { SCHEDULE_FREQUENCIES } from '@/modules/maintenance-schedules/schedule.types';

describe('calculateNextDueDate', () => {
  it('handles daily frequency', () => {
    expect(calculateNextDueDate('2026-01-15', 'DAILY', 1)).toBe('2026-01-16');
  });

  it('handles weekly frequency', () => {
    expect(calculateNextDueDate('2026-01-15', 'WEEKLY', 2)).toBe('2026-01-29');
  });

  it('handles monthly frequency', () => {
    expect(calculateNextDueDate('2026-01-15', 'MONTHLY', 1)).toBe('2026-02-15');
  });

  it('clamps to last day of shorter months', () => {
    expect(calculateNextDueDate('2026-01-31', 'MONTHLY', 1)).toBe('2026-02-28');
    expect(calculateNextDueDate('2026-08-31', 'MONTHLY', 1)).toBe('2026-09-30');
  });

  it('handles quarterly frequency', () => {
    expect(calculateNextDueDate('2026-01-15', 'QUARTERLY', 1)).toBe('2026-04-15');
  });

  it('handles semi-annual frequency', () => {
    expect(calculateNextDueDate('2026-01-15', 'SEMI_ANNUAL', 1)).toBe('2026-07-15');
  });

  it('handles annual frequency including leap years', () => {
    expect(calculateNextDueDate('2026-02-28', 'ANNUAL', 1)).toBe('2027-02-28');
    expect(calculateNextDueDate('2024-02-29', 'ANNUAL', 1)).toBe('2025-02-28');
    expect(calculateNextDueDate('2024-02-29', 'ANNUAL', 4)).toBe('2028-02-29');
  });

  it('handles custom interval in days', () => {
    expect(calculateNextDueDate('2026-01-15', 'CUSTOM', 10)).toBe('2026-01-25');
  });

  it('ignores invalid intervals and defaults to at least 1', () => {
    expect(calculateNextDueDate('2026-01-15', 'MONTHLY', 0)).toBe('2026-02-15');
  });
});

describe('daysBetween / overdue detection', () => {
  it('returns positive days until due', () => {
    expect(daysBetween('2026-08-01', '2026-08-10')).toBe(9);
  });

  it('returns negative days when overdue', () => {
    expect(daysBetween('2026-08-10', '2026-08-01')).toBe(-9);
  });

  it('returns zero when due today', () => {
    expect(daysBetween('2026-08-01', '2026-08-01')).toBe(0);
  });

  it('normalises DB dates without timezone drift', () => {
    const d = new Date(Date.UTC(2026, 7, 1));
    expect(toDateString(d)).toBe('2026-08-01');
    expect(toDateString(new Date(Date.UTC(2026, 0, 31)))).toBe('2026-01-31');
    expect(toDateString('2026-08-01T00:00:00.000Z')).toBe('2026-08-01');
    expect(toDateString(null)).toBeNull();
  });

  it('todayString returns a parseable date', () => {
    const value = todayString();
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('Schedule schema validation', () => {
  it('accepts a valid create payload', () => {
    const r = createScheduleSchema.safeParse({
      assetId: '00000000-0000-0000-0000-000000000001',
      frequencyType: 'MONTHLY',
      frequencyValue: 3,
      startDate: '2026-01-15',
    });
    expect(r.success).toBe(true);
  });

  it('rejects unknown frequency types', () => {
    const r = createScheduleSchema.safeParse({
      assetId: '00000000-0000-0000-0000-000000000001',
      frequencyType: 'YEARLY',
      frequencyValue: 1,
    });
    expect(r.success).toBe(false);
  });

  it('rejects invalid dates', () => {
    const r = createScheduleSchema.safeParse({
      assetId: '00000000-0000-0000-0000-000000000001',
      frequencyType: 'MONTHLY',
      frequencyValue: 1,
      startDate: '15/01/2026',
    });
    expect(r.success).toBe(false);
  });

  it('exposes the full frequency enum', () => {
    expect(SCHEDULE_FREQUENCIES).toContain('CUSTOM');
    expect(SCHEDULE_FREQUENCIES).toHaveLength(7);
  });

  it('validates due query params', () => {
    expect(dueQuerySchema.safeParse({ days: 30 }).success).toBe(true);
    expect(dueQuerySchema.safeParse({ days: -1 }).success).toBe(false);
  });

  it('allows partial updates', () => {
    const r = updateScheduleSchema.safeParse({ frequencyValue: 6 });
    expect(r.success).toBe(true);
  });
});
