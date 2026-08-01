import { describe, it, expect } from 'vitest';
import { formatNotificationEvent } from '@/modules/notifications/notification.templates';
import { eventBus } from '@/lib/event-bus';
import { NOTIFICATION_TYPES, NOTIFICATION_PRIORITIES } from '@/modules/notifications/notification.types';

describe('Notification templates', () => {
  it('formats asset events', () => {
    const r = formatNotificationEvent({ type: 'ASSET', action: 'created', targetUserId: 'u1', data: { assetCode: 'AST-001', assetName: 'Laptop' } });
    expect(r?.title).toContain('Asset Registered');
    expect(r?.message).toContain('Laptop');
    expect(r?.priority).toBe('INFO');
  });

  it('formats assignment events', () => {
    const r = formatNotificationEvent({ type: 'ASSIGNMENT', action: 'assigned', targetUserId: 'u1', data: { assetCode: 'AST-001' } });
    expect(r?.title).toContain('Asset Assigned');
  });

  it('formats maintenance completed as SUCCESS', () => {
    const r = formatNotificationEvent({ type: 'MAINTENANCE', action: 'completed', targetUserId: 'u1', data: { maintenanceCode: 'MNT-001' } });
    expect(r?.title).toContain('Maintenance Completed');
    expect(r?.priority).toBe('SUCCESS');
  });

  it('formats ticket events', () => {
    const r = formatNotificationEvent({ type: 'TICKET', action: 'resolved', targetUserId: 'u1', data: { ticketCode: 'TKT-001' } });
    expect(r?.title).toContain('Ticket Resolved');
    expect(r?.priority).toBe('SUCCESS');
  });

  it('formats schedule due as WARNING', () => {
    const r = formatNotificationEvent({ type: 'SCHEDULE', action: 'due', targetUserId: 'u1', data: { assetName: 'UPS', dueDate: '2026-08-01' } });
    expect(r?.title).toContain('Preventive Maintenance Due');
    expect(r?.priority).toBe('WARNING');
  });

  it('formats reminder with OVERDUE priority as CRITICAL', () => {
    const r = formatNotificationEvent({ type: 'REMINDER', action: 'generated', targetUserId: 'u1', data: { message: 'x overdue', priority: 'OVERDUE' } });
    expect(r?.priority).toBe('CRITICAL');
  });

  it('returns null for unknown action', () => {
    expect(formatNotificationEvent({ type: 'ASSET', action: 'bogus', targetUserId: 'u1', data: {} })).toBeNull();
  });
});

describe('Notification event bus', () => {
  it('delivers events to subscribers', () => {
    const received: string[] = [];
    const unsubscribe = eventBus.subscribe((e) => received.push(e.action));
    eventBus.publish({ type: 'SYSTEM', action: 'ping', targetUserId: 'u1', data: {} });
    expect(received).toEqual(['ping']);
    unsubscribe();
    eventBus.publish({ type: 'SYSTEM', action: 'ping2', targetUserId: 'u1', data: {} });
    expect(received).toEqual(['ping']);
  });

  it('does not let a throwing subscriber break other subscribers', () => {
    eventBus.subscribe(() => { throw new Error('boom'); });
    expect(() => eventBus.publish({ type: 'SYSTEM', action: 'x', targetUserId: 'u1', data: {} })).not.toThrow();
  });
});

describe('Notification enums', () => {
  it('exposes documented types and priorities', () => {
    expect(NOTIFICATION_TYPES).toContain('TICKET');
    expect(NOTIFICATION_TYPES).toContain('SCHEDULE');
    expect(NOTIFICATION_PRIORITIES).toEqual(['INFO', 'WARNING', 'CRITICAL', 'SUCCESS']);
  });
});
