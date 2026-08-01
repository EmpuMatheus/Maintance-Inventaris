import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '@/lib/api-client';
import type { User, UserFilters } from '../types';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export function listUsers(filters?: UserFilters) {
  return apiGet<{ success: boolean; data: User[]; meta: PaginationMeta }>(
    '/users',
    filters as Record<string, string | number | undefined>,
  );
}

export function getUser(id: string) {
  return apiGet<{ success: boolean; data: User }>(`/users/${id}`);
}

export function createUser(data: Record<string, unknown>) {
  return apiPost<{ success: boolean; data: User }>('/users', data);
}

export function updateUser(id: string, data: Record<string, unknown>) {
  return apiPut<{ success: boolean; data: User }>(`/users/${id}`, data);
}

export function deleteUser(id: string) {
  return apiDelete<{ success: boolean; data: { success: boolean } }>(`/users/${id}`);
}

export function setUserStatus(id: string, isActive: boolean) {
  return apiPatch<{ success: boolean; data: User }>(`/users/${id}/status`, { isActive });
}

export function setUserPassword(id: string, password: string) {
  return apiPatch<{ success: boolean; data: { success: boolean } }>(`/users/${id}/password`, { password });
}

export function setUserRoles(id: string, roles: string[]) {
  return apiPatch<{ success: boolean; data: User }>(`/users/${id}/roles`, { roles });
}

export const userKeys = {
  all: ['users'] as const,
  list: (filters: UserFilters) => ['users', 'list', filters] as const,
  detail: (id: string) => ['users', 'detail', id] as const,
};
