export type MaintenanceStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'WAITING_PART'
  | 'TESTING'
  | 'COMPLETED'
  | 'CANCELLED';

export type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type MaintenanceCategory = 'PREVENTIVE' | 'CORRECTIVE';

export interface AssetReference {
  id: string;
  assetCode: string;
  assetName: string;
}

export interface MaintenanceTypeReference {
  id: string;
  name: string;
  maintenanceCategory?: string | null;
}

export interface UserReference {
  id: string;
  name: string;
  username?: string;
}

export interface MaintenanceListItem {
  id: string;
  maintenanceCode: string;
  maintenanceCategory: string;
  problem?: string | null;
  priority?: string | null;
  status: MaintenanceStatus;
  scheduledDate?: string | null;
  startDate?: string | null;
  finishDate?: string | null;
  createdAt: string;
  asset: AssetReference | null;
  maintenanceType: MaintenanceTypeReference | null;
  technician: UserReference | null;
}

export interface MaintenanceAssetDetail {
  id: string;
  assetCode: string;
  assetName: string;
  condition?: string | null;
  status?: string | null;
  categoryName?: string | null;
  picName?: string | null;
  location?: string | null;
  departmentName?: string | null;
}

export interface MaintenanceDetail extends MaintenanceListItem {
  diagnosis?: string | null;
  actionTaken?: string | null;
  result?: string | null;
  notes?: string | null;
  laborCost?: string | number | null;
  partsCost?: string | number | null;
  otherCost?: string | number | null;
  totalCost?: string | number | null;
  downtimeMinutes?: number | null;
  updatedAt: string;
  asset: MaintenanceAssetDetail | null;
  maintenanceType: MaintenanceTypeReference | null;
  technician: UserReference | null;
  vendor: { id: string; name: string } | null;
  createdByUser: UserReference | null;
  ticket?: { id: string; ticketCode: string } | null;
}

export interface MaintenancePart {
  id: string;
  maintenanceId: string;
  partName: string;
  partNumber?: string | null;
  quantity: number;
  unitPrice: string | number;
  totalPrice: string | number;
  vendorId?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface MaintenanceDocument {
  id: string;
  maintenanceId: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  description?: string | null;
  uploadedBy?: string | null;
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

export interface DetailResponse<T> {
  success: boolean;
  data: T;
}
