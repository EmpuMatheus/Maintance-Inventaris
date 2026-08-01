export type TicketStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'ON_HOLD' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TicketCommentType = 'COMMENT' | 'INTERNAL' | 'SYSTEM';

export interface UserReference {
  id: string;
  name: string;
}

export interface TicketAssetRef {
  id: string;
  assetCode: string;
  assetName: string;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  userId: string | null;
  type: TicketCommentType;
  comment: string;
  isInternal: boolean;
  createdAt: string;
  userName: string | null;
}

export interface TicketAssignment {
  id: string;
  ticketId: string;
  technicianId: string | null;
  assignedBy: string | null;
  reassignedFromId: string | null;
  notes: string | null;
  assignedAt: string;
  technicianName: string | null;
  assignedByName: string | null;
  previousTechnicianName: string | null;
}

export interface TicketMaintenanceRef {
  id: string;
  maintenanceCode: string;
  status: string;
}

export interface Ticket {
  id: string;
  ticketCode: string;
  assetId: string | null;
  reporterId: string | null;
  departmentId: string | null;
  category: string | null;
  title: string;
  description: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  assignedTo: string | null;
  reportedAt: string;
  assignedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  asset: TicketAssetRef | null;
  reporter: UserReference | null;
  assignedToUser: UserReference | null;
  department: { id: string; name: string } | null;
  comments?: TicketComment[];
  assignments?: TicketAssignment[];
  maintenance?: TicketMaintenanceRef[];
}

export interface TicketFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  priority?: string;
  category?: string;
  assetId?: string;
  reporterId?: string;
  assignedTo?: string;
  departmentId?: string;
  dateFrom?: string;
  dateTo?: string;
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
