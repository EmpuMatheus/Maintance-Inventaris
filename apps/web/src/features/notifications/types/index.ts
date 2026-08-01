export type NotificationType = 'ASSET' | 'MAINTENANCE' | 'SCHEDULE' | 'TICKET' | 'ASSIGNMENT' | 'MOVEMENT' | 'REMINDER' | 'SYSTEM';
export type NotificationPriority = 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string | null;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
}

export interface NotificationFilters {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  priority?: string;
  unread?: boolean;
  archived?: boolean;
}

export interface NotificationSettings {
  asset: boolean;
  maintenance: boolean;
  schedule: boolean;
  ticket: boolean;
  assignment: boolean;
  movement: boolean;
  reminder: boolean;
  system: boolean;
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
