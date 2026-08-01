export const NOTIFICATION_TYPES = [
  'ASSET',
  'MAINTENANCE',
  'SCHEDULE',
  'TICKET',
  'ASSIGNMENT',
  'MOVEMENT',
  'REMINDER',
  'SYSTEM',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_PRIORITIES = ['INFO', 'WARNING', 'CRITICAL', 'SUCCESS'] as const;
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

export const SETTING_KEYS = NOTIFICATION_TYPES;
