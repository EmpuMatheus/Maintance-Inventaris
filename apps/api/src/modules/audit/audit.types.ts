export const AUDIT_MODULES = [
  'AUTH',
  'USER',
  'ROLE',
  'MASTER_DATA',
  'INVENTORY',
  'ASSIGNMENT',
  'MOVEMENT',
  'MAINTENANCE',
  'SCHEDULE',
  'TICKET',
  'REPORT',
  'SYSTEM',
] as const;

export type AuditModule = (typeof AUDIT_MODULES)[number];

export const AUDIT_ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'ASSIGN',
  'TRANSFER',
  'RETIRE',
  'EXPORT',
  'IMPORT',
  'UPLOAD',
  'DOWNLOAD',
  'START',
  'COMPLETE',
  'CANCEL',
  'APPROVE',
  'REJECT',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
