import { describe, it, expect } from 'vitest';
import { createTicketSchema, updateTicketSchema, assignTicketSchema, resolveTicketSchema, cancelTicketSchema, addCommentSchema, createMaintenanceFromTicketSchema, ticketQuerySchema } from '@/modules/tickets/ticket.schema';
import { TICKET_TRANSITIONS, TICKET_STATUSES, TICKET_PRIORITIES } from '@/modules/tickets/ticket.types';

const TICKET_ID = '00000000-0000-0000-0000-000000000001';

describe('Ticket schema validation', () => {
  it('accepts a valid create payload', () => {
    const r = createTicketSchema.safeParse({ title: 'Laptop cannot turn on', priority: 'HIGH', category: 'HARDWARE', assetId: TICKET_ID });
    expect(r.success).toBe(true);
  });

  it('rejects empty title', () => {
    expect(createTicketSchema.safeParse({ title: '' }).success).toBe(false);
  });

  it('rejects unknown priority', () => {
    expect(createTicketSchema.safeParse({ title: 'x', priority: 'URGENT' }).success).toBe(false);
  });

  it('rejects unknown category', () => {
    expect(createTicketSchema.safeParse({ title: 'x', category: 'BOGUS' }).success).toBe(false);
  });

  it('allows partial updates', () => {
    expect(updateTicketSchema.safeParse({ priority: 'CRITICAL' }).success).toBe(true);
  });

  it('validates assignment', () => {
    expect(assignTicketSchema.safeParse({ technicianId: TICKET_ID }).success).toBe(true);
    expect(assignTicketSchema.safeParse({}).success).toBe(false);
  });

  it('requires resolution and cancellation reason', () => {
    expect(resolveTicketSchema.safeParse({ resolution: 'Replaced part' }).success).toBe(true);
    expect(resolveTicketSchema.safeParse({}).success).toBe(false);
    expect(cancelTicketSchema.safeParse({ reason: 'Duplicate' }).success).toBe(true);
  });

  it('validates comments', () => {
    expect(addCommentSchema.safeParse({ comment: 'Checking', isInternal: true }).success).toBe(true);
    expect(addCommentSchema.safeParse({}).success).toBe(false);
  });

  it('validates maintenance-from-ticket', () => {
    expect(createMaintenanceFromTicketSchema.safeParse({}).success).toBe(true);
    expect(createMaintenanceFromTicketSchema.safeParse({ maintenanceCategory: 'PREVENTIVE' }).success).toBe(true);
  });

  it('validates list query', () => {
    expect(ticketQuerySchema.safeParse({ status: 'OPEN', page: 1, limit: 25 }).success).toBe(true);
    expect(ticketQuerySchema.safeParse({ priority: 'LOW' }).success).toBe(true);
  });
});

describe('Ticket workflow', () => {
  it('covers all documented statuses', () => {
    expect(TICKET_STATUSES).toEqual(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED', 'CANCELLED']);
  });

  it('covers all documented priorities', () => {
    expect(TICKET_PRIORITIES).toEqual(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
  });

  it('allows the happy-path transitions', () => {
    expect(TICKET_TRANSITIONS.OPEN).toContain('ASSIGNED');
    expect(TICKET_TRANSITIONS.ASSIGNED).toContain('IN_PROGRESS');
    expect(TICKET_TRANSITIONS.IN_PROGRESS).toContain('RESOLVED');
    expect(TICKET_TRANSITIONS.RESOLVED).toContain('CLOSED');
  });

  it('allows ON_HOLD as an alternative', () => {
    expect(TICKET_TRANSITIONS.IN_PROGRESS).toContain('ON_HOLD');
    expect(TICKET_TRANSITIONS.ON_HOLD).toContain('IN_PROGRESS');
  });

  it('does not allow CLOSED tickets to transition', () => {
    expect(TICKET_TRANSITIONS.CLOSED).toHaveLength(0);
    expect(TICKET_TRANSITIONS.CANCELLED).toHaveLength(0);
  });

  it('disallows completing from OPEN directly to RESOLVED', () => {
    expect(TICKET_TRANSITIONS.OPEN).not.toContain('RESOLVED');
    expect(TICKET_TRANSITIONS.OPEN).not.toContain('CLOSED');
  });
});
