import type { ScheduleFrequency } from '../types';

export const SCHEDULE_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'CUSTOM'] as const;

export const SCHEDULE_FREQUENCY_LABELS: Record<ScheduleFrequency, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  SEMI_ANNUAL: 'Semi Annual',
  ANNUAL: 'Annual',
  CUSTOM: 'Custom Interval',
};
