export type ScheduleFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'CUSTOM';
export type ScheduleState = 'UPCOMING' | 'DUE_TODAY' | 'OVERDUE' | 'COMPLETED';
export type ReminderType = 'UPCOMING' | 'DUE' | 'OVERDUE';

export interface ScheduleAsset {
  id: string;
  assetCode: string;
  assetName: string;
}

export interface MaintenanceSchedule {
  id: string;
  assetId: string;
  maintenanceTypeId: string | null;
  frequencyType: ScheduleFrequency;
  frequencyValue: number;
  startDate: string | null;
  lastMaintenanceDate: string | null;
  nextMaintenanceDate: string | null;
  reminderDays: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  asset: ScheduleAsset | null;
  maintenanceType: { id: string; name: string } | null;
  state?: ScheduleState;
  daysUntil?: number;
  daysOverdue?: number;
}

export interface ScheduleFilters {
  page?: number;
  limit?: number;
  search?: string;
  assetId?: string;
  typeId?: string;
  isActive?: boolean;
  days?: number;
}

export interface Reminder {
  id: string;
  scheduleId: string | null;
  maintenanceId: string | null;
  reminderType: ReminderType;
  offsetDays: number;
  dueDate: string | null;
  title: string;
  message: string | null;
  status: 'PENDING' | 'READ' | 'RESOLVED';
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: PaginationMeta;
}
