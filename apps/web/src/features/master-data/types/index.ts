export interface MasterDataRecord {
  id: string;
  code?: string;
  name?: string;
  description?: string | null;
  icon?: string | null;
  isActive?: boolean;
  siteId?: string;
  buildingId?: string;
  floorId?: string;
  categoryId?: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  maintenanceCategory?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface FieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'select' | 'textarea' | 'email' | 'hidden';
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export interface ModuleConfig {
  label: string;
  path: string;
  columns: { key: string; label: string; sortable?: boolean }[];
  fields: FieldDefinition[];
  searchFields?: string[];
}
