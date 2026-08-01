import { apiGet, apiPost, apiPatch } from '@/lib/api-client';
import type {
  MaintenanceSchedule,
  PaginatedResponse,
  Reminder,
  ScheduleFilters,
} from '../types';

type ListResponse = PaginatedResponse<MaintenanceSchedule>;

export function listSchedules(filters?: ScheduleFilters) {
  return apiGet<ListResponse>('/maintenance-schedules', filters as Record<string, string | number | undefined>);
}

export function getSchedule(id: string) {
  return apiGet<{ success: boolean; data: MaintenanceSchedule }>(`/maintenance-schedules/${id}`);
}

export function createSchedule(data: Record<string, unknown>) {
  return apiPost<{ success: boolean; data: MaintenanceSchedule }>('/maintenance-schedules', data);
}

export function updateSchedule(id: string, data: Record<string, unknown>) {
  return apiPatch<{ success: boolean; data: MaintenanceSchedule }>(`/maintenance-schedules/${id}`, data);
}

export function setScheduleStatus(id: string, isActive: boolean) {
  return apiPatch<{ success: boolean; data: MaintenanceSchedule }>(`/maintenance-schedules/${id}/status`, { isActive });
}

export function upcomingSchedules(filters?: ScheduleFilters) {
  return apiGet<ListResponse>('/maintenance-schedules/upcoming', filters as Record<string, string | number | undefined>);
}

export function dueTodaySchedules(filters?: ScheduleFilters) {
  return apiGet<ListResponse>('/maintenance-schedules/due-today', filters as Record<string, string | number | undefined>);
}

export function overdueSchedules(filters?: ScheduleFilters) {
  return apiGet<ListResponse>('/maintenance-schedules/overdue', filters as Record<string, string | number | undefined>);
}

export function completedSchedules(filters?: ScheduleFilters) {
  return apiGet<ListResponse>('/maintenance-schedules/completed', filters as Record<string, string | number | undefined>);
}

export function processDueSchedules() {
  return apiPost<{ success: boolean; data: { processed: number } }>('/maintenance-schedules/process-due');
}

export function listReminders(params?: { status?: string; limit?: number; mine?: boolean }) {
  return apiGet<{ success: boolean; data: Reminder[] }>('/reminders', {
    status: params?.status,
    limit: params?.limit,
    mine: params?.mine === true ? 'true' : undefined,
  });
}

export function markReminderRead(id: string) {
  return apiPatch<{ success: boolean; data: Reminder }>(`/reminders/${id}/read`, {});
}

export const scheduleKeys = {
  all: ['maintenance-schedules'] as const,
  list: (filters: ScheduleFilters) => ['maintenance-schedules', 'list', filters] as const,
  detail: (id: string) => ['maintenance-schedules', 'detail', id] as const,
  upcoming: (params: ScheduleFilters) => ['maintenance-schedules', 'upcoming', params] as const,
  dueToday: (params: ScheduleFilters) => ['maintenance-schedules', 'due-today', params] as const,
  overdue: (params: ScheduleFilters) => ['maintenance-schedules', 'overdue', params] as const,
  completed: (params: ScheduleFilters) => ['maintenance-schedules', 'completed', params] as const,
  reminders: ['maintenance-schedules', 'reminders'] as const,
};
