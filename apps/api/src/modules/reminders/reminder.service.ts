import * as repo from '@/modules/maintenance-schedules/schedule.repository';
import { daysBetween, todayString } from '@/modules/maintenance-schedules/schedule.date';
import { REMINDER_OFFSETS } from '@/modules/maintenance-schedules/schedule.types';
import { AppError } from '@/middleware/error-handler';
import { logger } from '@/lib/logger';
import { eventBus } from '@/lib/event-bus';

/**
 * Reminder domain.
 *
 * Reminders are persisted in the database. No external delivery (email /
 * WhatsApp) is implemented yet; the `ReminderChannel` contract exists so
 * future integrations can be plugged in without changing the domain.
 */

export interface ReminderPayload {
  title: string;
  message: string;
  targetUserId: string | null;
}

export interface ReminderChannel {
  name: string;
  deliver(payload: ReminderPayload): Promise<void>;
}

const channels: ReminderChannel[] = [];

export function registerChannel(channel: ReminderChannel): void {
  channels.push(channel);
}

/**
 * Creates PENDING reminder rows for every active schedule based on its next
 * due date. Idempotent: the unique constraint on
 * (schedule_id, due_date, reminder_type, offset_days) prevents duplicates.
 */
export async function generateReminders(): Promise<number> {
  const today = todayString();
  const schedules = await repo.findAllActive();
  let created = 0;

  for (const schedule of schedules) {
    const dueDate = schedule.nextMaintenanceDate;
    if (!dueDate) continue;
    const diff = daysBetween(today, dueDate);
    const targetUserId = schedule.createdBy ?? null;
    const assetLabel = `${schedule.asset?.assetCode ?? ''} ${schedule.asset?.assetName ?? ''}`.trim();

    if (diff < 0) {
      const inserted = await repo.insertReminder({
        scheduleId: schedule.id,
        reminderType: 'OVERDUE',
        offsetDays: 0,
        dueDate,
        title: 'Maintenance Overdue',
        message: `${assetLabel} maintenance is ${Math.abs(diff)} days overdue.`,
        status: 'PENDING',
        targetUserId: targetUserId || undefined,
      });
      if (inserted) {
        created += 1;
        publishReminderEvent(targetUserId, 'OVERDUE', inserted.message as string);
      }
      continue;
    }

    if (diff === 0) {
      const inserted = await repo.insertReminder({
        scheduleId: schedule.id,
        reminderType: 'DUE',
        offsetDays: 0,
        dueDate,
        title: 'Maintenance Due Today',
        message: `${assetLabel} preventive maintenance is due today.`,
        status: 'PENDING',
        targetUserId: targetUserId || undefined,
      });
      if (inserted) {
        created += 1;
        publishReminderEvent(targetUserId, 'DUE', inserted.message as string);
      }
      continue;
    }

    for (const offset of REMINDER_OFFSETS) {
      if (diff < offset) continue;
      const inserted = await repo.insertReminder({
        scheduleId: schedule.id,
        reminderType: 'UPCOMING',
        offsetDays: offset,
        dueDate,
        title: `Maintenance Due in ${offset} Days`,
        message: `${assetLabel} preventive maintenance is due in ${offset} days.`,
        status: 'PENDING',
        targetUserId: targetUserId || undefined,
      });
      if (inserted) {
        created += 1;
        publishReminderEvent(targetUserId, 'UPCOMING', inserted.message as string);
      }
    }
  }

  return created;
}

function publishReminderEvent(targetUserId: string | null, reminderType: string, message: string) {
  eventBus.publish({
    type: 'REMINDER',
    action: 'generated',
    targetUserId,
    entityType: 'maintenance',
    data: { message, priority: reminderType === 'OVERDUE' ? 'OVERDUE' : 'UPCOMING' },
  });
}

/**
 * Delivery entry point for future integrations (email / WhatsApp / in-app).
 * Currently only logs what would be delivered; external channels can be added
 * via `registerChannel`.
 */
export async function dispatchPendingReminders(): Promise<number> {
  const pending = await repo.findReminders({ status: 'PENDING', limit: 200 });
  for (const reminder of pending) {
    const payload: ReminderPayload = {
      title: reminder.title,
      message: reminder.message ?? '',
      targetUserId: reminder.targetUserId ?? null,
    };
    for (const channel of channels) {
      try {
        await channel.deliver(payload);
      } catch (error) {
        logger.error({ error, channel: channel.name }, 'Reminder channel delivery failed');
      }
    }
  }
  return pending.length;
}

export async function listReminders(filters: { status?: string; userId?: string; limit?: number }) {
  return repo.findReminders(filters);
}

export async function markRead(id: string) {
  const reminder = await repo.markReminderRead(id);
  if (!reminder) throw new AppError(404, 'NOT_FOUND', 'Reminder not found.');
  return reminder;
}
