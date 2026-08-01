export const TICKET_STATUSES = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'ON_HOLD',
  'RESOLVED',
  'CLOSED',
  'CANCELLED',
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_COMMENT_TYPES = ['COMMENT', 'INTERNAL', 'SYSTEM'] as const;
export type TicketCommentType = (typeof TICKET_COMMENT_TYPES)[number];

export const TICKET_CATEGORIES = [
  'HARDWARE',
  'SOFTWARE',
  'NETWORK',
  'PERIPHERAL',
  'PRINTER',
  'ACCESS',
  'OTHER',
] as const;

export interface TicketStateMachine {
  [status: string]: TicketStatus[];
}

export const TICKET_TRANSITIONS: TicketStateMachine = {
  OPEN: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'ASSIGNED', 'CANCELLED'],
  IN_PROGRESS: ['ON_HOLD', 'RESOLVED', 'ASSIGNED', 'CANCELLED'],
  ON_HOLD: ['IN_PROGRESS', 'ASSIGNED', 'CANCELLED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
};
