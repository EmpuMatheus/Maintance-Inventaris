import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '@/lib/api-client';
import type { Permission, Role } from '../types';

export function listRoles() {
  return apiGet<{ success: boolean; data: Role[] }>('/roles');
}

export function getRole(id: string) {
  return apiGet<{ success: boolean; data: Role }>(`/roles/${id}`);
}

export function listPermissions() {
  return apiGet<{ success: boolean; data: Permission[] }>('/roles/permissions');
}

export function createRole(data: Record<string, unknown>) {
  return apiPost<{ success: boolean; data: Role }>('/roles', data);
}

export function updateRole(id: string, data: Record<string, unknown>) {
  return apiPut<{ success: boolean; data: Role }>(`/roles/${id}`, data);
}

export function deleteRole(id: string) {
  return apiDelete<{ success: boolean; data: { success: boolean } }>(`/roles/${id}`);
}

export function setRolePermissions(id: string, permissions: string[]) {
  return apiPatch<{ success: boolean; data: Role }>(`/roles/${id}/permissions`, { permissions });
}

export function setRoleUsers(id: string, userIds: string[]) {
  return apiPatch<{ success: boolean; data: Role }>(`/roles/${id}/users`, { userIds });
}

export const roleKeys = {
  all: ['roles'] as const,
  list: ['roles', 'list'] as const,
  detail: (id: string) => ['roles', 'detail', id] as const,
  permissions: ['roles', 'permissions'] as const,
};
