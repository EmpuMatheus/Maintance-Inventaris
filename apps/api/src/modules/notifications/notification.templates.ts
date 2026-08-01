import type { NotificationEvent } from '@/lib/event-bus';
import type { NotificationPriority } from './notification.types';

export interface FormattedNotification {
  title: string;
  message: string;
  priority: NotificationPriority;
}

function s(data: Record<string, unknown>, key: string): string {
  const v = data[key];
  return v == null || v === '' ? '' : String(v);
}

/**
 * Reusable notification formatter: maps a domain event to a human-readable
 * title, message and priority. All modules share these templates.
 */
export function formatNotificationEvent(event: NotificationEvent): FormattedNotification | null {
  const asset = `${s(event.data, 'assetName')}${s(event.data, 'assetCode') ? ` (${s(event.data, 'assetCode')})` : ''}`.trim();

  switch (event.type) {
    case 'ASSET':
      if (event.action === 'created') {
        return { title: '📦 Asset Registered', message: `${asset || 'A new asset'} was registered.`, priority: 'INFO' };
      }
      if (event.action === 'updated') {
        return { title: '📦 Asset Updated', message: `${asset || 'An asset'} was updated.`, priority: 'INFO' };
      }
      if (event.action === 'condition_changed') {
        return {
          title: '🏷️ Asset Condition Changed',
          message: `${asset} condition changed to ${s(event.data, 'newCondition')}.`,
          priority: s(event.data, 'newCondition') === 'BROKEN' || s(event.data, 'newCondition') === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        };
      }
      break;

    case 'ASSIGNMENT':
      if (event.action === 'assigned') {
        return { title: '📦 Asset Assigned', message: `${asset || 'An asset'} was assigned to you.`, priority: 'INFO' };
      }
      if (event.action === 'returned') {
        return { title: '📦 Asset Returned', message: `${asset || 'An asset'} was returned.`, priority: 'INFO' };
      }
      break;

    case 'MOVEMENT':
      return { title: '🚚 Asset Moved', message: `${asset || 'An asset'} was moved to a new location.`, priority: 'INFO' };

    case 'MAINTENANCE':
      if (event.action === 'created') {
        return { title: '🔧 Maintenance Created', message: `${s(event.data, 'maintenanceCode')} created for ${asset || 'asset'}.`, priority: 'INFO' };
      }
      if (event.action === 'assigned') {
        return { title: '🔧 Maintenance Assigned', message: `${s(event.data, 'maintenanceCode')} was assigned to you.`, priority: 'INFO' };
      }
      if (event.action === 'started') {
        return { title: '🔧 Maintenance Started', message: `${s(event.data, 'maintenanceCode')} work started.`, priority: 'INFO' };
      }
      if (event.action === 'completed') {
        return { title: '🔧 Maintenance Completed', message: `${s(event.data, 'maintenanceCode')} was completed.`, priority: 'SUCCESS' };
      }
      break;

    case 'TICKET':
      if (event.action === 'created') {
        return { title: '🎫 Ticket Created', message: `${s(event.data, 'ticketCode')} — ${s(event.data, 'title')}`, priority: 'INFO' };
      }
      if (event.action === 'assigned') {
        return { title: '🎫 Ticket Assigned', message: `${s(event.data, 'ticketCode')} was assigned to you.`, priority: 'INFO' };
      }
      if (event.action === 'resolved') {
        return { title: '🎫 Ticket Resolved', message: `${s(event.data, 'ticketCode')} has been resolved.`, priority: 'SUCCESS' };
      }
      break;

    case 'SCHEDULE':
      if (event.action === 'due') {
        return {
          title: '📅 Preventive Maintenance Due',
          message: `${asset || 'An asset'} preventive maintenance is due${s(event.data, 'dueDate') ? ` on ${s(event.data, 'dueDate')}` : ''}.`,
          priority: 'WARNING',
        };
      }
      break;

    case 'REMINDER':
      return {
        title: '⏰ Maintenance Reminder',
        message: s(event.data, 'message') || 'You have a maintenance reminder.',
        priority: s(event.data, 'priority') === 'OVERDUE' ? 'CRITICAL' : 'WARNING',
      };

    case 'SYSTEM':
      return { title: '⚙️ System', message: s(event.data, 'message') || 'System notification.', priority: 'INFO' };
  }

  return null;
}
