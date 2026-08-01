export interface AuditLog {
  id: string;
  auditCode: string;
  module: string;
  entityType: string;
  entityId: string | null;
  action: string;
  description: string | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  performedBy: string | null;
  performedByName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: string;
}

export interface AuditFilters {
  page?: number;
  limit?: number;
  search?: string;
  module?: string;
  action?: string;
  entity?: string;
  performedBy?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AuditSummary {
  total: number;
  today: number;
  byModule: { name: string; value: number }[];
  byAction: { name: string; value: number }[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
