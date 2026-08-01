import { sql } from 'drizzle-orm';
import { AppError } from '@/middleware/error-handler';
import { eventBus, type NotificationEvent } from '@/lib/event-bus';
import { formatNotificationEvent } from './notification.templates';
import * as repo from './notification.repository';
import type { NotificationFilters } from './notification.repository';
import type { NotificationType } from './notification.types';

async function createForUser(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  priority?: string;
  entityType?: string;
  entityId?: string | null;
}) {
  const settings = await repo.getSettings(params.userId);
  const settingKey = params.type.toLowerCase();
  if (settings[settingKey] === false) return;
  await repo.insertNotification({
    userId: sql`${params.userId}::uuid`,
    type: params.type,
    priority: params.priority ?? 'INFO',
    title: params.title,
    message: params.message || undefined,
    entityType: params.entityType,
    entityId: params.entityId ? sql`${params.entityId}::uuid` : undefined,
  });
}

/** Consumes a domain event and persists an in-app notification (if enabled). */
async function consumeEvent(event: NotificationEvent) {
  if (!event.targetUserId) return;
  const formatted = formatNotificationEvent(event);
  if (!formatted) return;
  await createForUser({
    userId: event.targetUserId,
    type: event.type,
    title: formatted.title,
    message: formatted.message,
    priority: formatted.priority,
    entityType: event.entityType,
    entityId: event.entityId,
  });
}

let subscribed = false;

/** Subscribes the notification consumer to the event bus (idempotent). */
export function setupNotificationConsumer(): void {
  if (subscribed) return;
  subscribed = true;
  eventBus.subscribe((event) => {
    void consumeEvent(event);
  });
}

export async function list(userId: string, filters: NotificationFilters) {
  return repo.findMany(userId, filters);
}

export async function unreadCount(userId: string) {
  return repo.countUnread(userId);
}

export async function markRead(userId: string, id: string) {
  const row = await repo.markRead(userId, id);
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Notification not found.');
  return row;
}

export async function markAllRead(userId: string) {
  const count = await repo.markAllRead(userId);
  return { updated: count };
}

export async function archive(userId: string, id: string) {
  const row = await repo.archive(userId, id);
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Notification not found.');
  return row;
}

export async function remove(userId: string, id: string) {
  await repo.remove(userId, id);
  return { success: true };
}

export async function getSettings(userId: string) {
  return repo.getSettings(userId);
}

export async function updateSettings(userId: string, patch: Record<string, unknown>) {
  const clean: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (typeof value === 'boolean') clean[key] = value;
  }
  return repo.upsertSettings(userId, clean);
}
