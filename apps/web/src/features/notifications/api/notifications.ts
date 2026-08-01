import { apiGet, apiPatch, apiDelete } from '@/lib/api-client';
import type { AppNotification, NotificationFilters, NotificationSettings, PaginatedResponse } from '../types';

export function listNotifications(filters?: NotificationFilters) {
  return apiGet<PaginatedResponse<AppNotification>>(
    '/notifications',
    filters as Record<string, string | number | undefined>,
  );
}

export function getUnreadCount() {
  return apiGet<{ success: boolean; data: { count: number } }>('/notifications/unread-count');
}

export function markNotificationRead(id: string) {
  return apiPatch<{ success: boolean; data: AppNotification }>(`/notifications/${id}/read`, {});
}

export function markAllNotificationsRead() {
  return apiPatch<{ success: boolean; data: { updated: number } }>('/notifications/read-all', {});
}

export function archiveNotification(id: string) {
  return apiPatch<{ success: boolean; data: AppNotification }>(`/notifications/${id}/archive`, {});
}

export function deleteNotification(id: string) {
  return apiDelete<{ success: boolean; data: { success: boolean } }>(`/notifications/${id}`);
}

export function getNotificationSettings() {
  return apiGet<{ success: boolean; data: NotificationSettings }>('/notifications/settings');
}

export function updateNotificationSettings(patch: Partial<NotificationSettings>) {
  return apiPatch<{ success: boolean; data: NotificationSettings }>('/notifications/settings', patch);
}

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (filters: NotificationFilters) => ['notifications', 'list', filters] as const,
  unread: ['notifications', 'unread'] as const,
  settings: ['notifications', 'settings'] as const,
};
