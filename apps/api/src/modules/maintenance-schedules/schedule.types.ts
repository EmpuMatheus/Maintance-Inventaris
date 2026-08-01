export const SCHEDULE_FREQUENCIES = [
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'SEMI_ANNUAL',
  'ANNUAL',
  'CUSTOM',
] as const;

export type ScheduleFrequency = (typeof SCHEDULE_FREQUENCIES)[number];

export const SCHEDULE_FREQUENCY_LABELS: Record<ScheduleFrequency, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  SEMI_ANNUAL: 'Semi Annual',
  ANNUAL: 'Annual',
  CUSTOM: 'Custom Interval',
};

/** Date-based state of a schedule relative to today. */
export const SCHEDULE_STATES = ['UPCOMING', 'DUE_TODAY', 'OVERDUE', 'COMPLETED'] as const;
export type ScheduleState = (typeof SCHEDULE_STATES)[number];

export const REMINDER_TYPES = ['UPCOMING', 'DUE', 'OVERDUE'] as const;
export type ReminderType = (typeof REMINDER_TYPES)[number];

export const REMINDER_OFFSETS = [30, 14, 7, 3, 1] as const;

export const REMINDER_STATUSES = ['PENDING', 'READ', 'RESOLVED'] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];
