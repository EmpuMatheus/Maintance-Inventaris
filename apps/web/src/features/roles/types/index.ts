export interface Permission {
  id: string;
  code: string;
  name: string;
  group: string;
}

export interface RoleUser {
  id: string;
  name: string;
  username: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  permissionCount: number;
  userCount: number;
  createdAt: string;
  permissions?: Permission[];
  users?: RoleUser[];
}
