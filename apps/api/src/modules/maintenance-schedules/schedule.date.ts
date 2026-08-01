import type { ScheduleFrequency } from './schedule.types';

/**
 * Date helpers for maintenance schedules.
 *
 * All computation happens on ISO date strings (`YYYY-MM-DD`) to avoid
 * timezone drift. Dates coming back from PostgreSQL `date` columns are
 * normalised to a string before any arithmetic.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function parse(value: string): { y: number; m: number; d: number } {
  const [y, m, d] = value.split('-').map(Number);
  return { y, m, d };
}

function toUTC(value: string): Date {
  const { y, m, d } = parse(value);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Converts a DB `date` value to `YYYY-MM-DD`.
 *
 * The PostgreSQL driver returns `date` columns as `Date` objects at UTC
 * midnight. UTC getters must be used so the calendar day never shifts when the
 * server runs in a non-zero UTC offset.
 */
export function toDateString(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

/** Today's date in the server local timezone, as `YYYY-MM-DD`. */
export function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Whole days from `from` to `to` (negative when `to` is before `from`). */
export function daysBetween(from: string, to: string): number {
  const a = toUTC(from).getTime();
  const b = toUTC(to).getTime();
  return Math.round((b - a) / DAY_MS);
}

function addDays(date: string, days: number): string {
  const d = toUTC(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUTC(d);
}

/**
 * Adds `months` calendar months while clamping to the last day of the target
 * month. This correctly handles variable month lengths and leap years
 * (e.g. Jan 31 + 1 month = Feb 28 / Feb 29).
 */
function addMonths(date: string, months: number): string {
  const { y, m, d } = parse(date);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return fromUTC(target);
}

/**
 * Computes the next due date for a schedule.
 *
 * @param fromDate ISO date (`YYYY-MM-DD`) the next due date is derived from.
 * @param frequency Schedule frequency.
 * @param interval Multiplier / custom interval value (>= 1).
 */
export function calculateNextDueDate(fromDate: string, frequency: ScheduleFrequency, interval: number): string {
  const n = Math.max(1, Math.floor(interval) || 1);
  switch (frequency) {
    case 'DAILY':
      return addDays(fromDate, n);
    case 'WEEKLY':
      return addDays(fromDate, 7 * n);
    case 'MONTHLY':
      return addMonths(fromDate, n);
    case 'QUARTERLY':
      return addMonths(fromDate, 3 * n);
    case 'SEMI_ANNUAL':
      return addMonths(fromDate, 6 * n);
    case 'ANNUAL':
      return addMonths(fromDate, 12 * n);
    case 'CUSTOM':
      return addDays(fromDate, n);
  }
}
