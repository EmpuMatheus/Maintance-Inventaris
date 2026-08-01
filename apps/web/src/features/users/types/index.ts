export interface User {
  id: string;
  employeeCode: string;
  name: string;
  email: string | null;
  username: string;
  departmentId: string | null;
  department: string | null;
  phone: string | null;
  position: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  roles: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserFilters {
  page?: number;
  limit?: number;
  search?: string;
  departmentId?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface RoleOption {
  id: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
}
