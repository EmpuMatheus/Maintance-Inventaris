import { apiGet } from '@/lib/api-client';
import type { AuditFilters, AuditLog, AuditSummary, PaginationMeta } from '../types';

export function listAudits(filters?: AuditFilters) {
  return apiGet<{ success: boolean; data: AuditLog[]; meta: PaginationMeta }>(
    '/audit',
    filters as Record<string, string | number | undefined>,
  );
}

export function getAudit(id: string) {
  return apiGet<{ success: boolean; data: AuditLog }>(`/audit/${id}`);
}

export function getAuditModules() {
  return apiGet<{ success: boolean; data: string[] }>('/audit/modules');
}

export function getAuditActions() {
  return apiGet<{ success: boolean; data: string[] }>('/audit/actions');
}

export function getAuditSummary() {
  return apiGet<{ success: boolean; data: AuditSummary }>('/audit/summary');
}

export const auditKeys = {
  all: ['audit'] as const,
  list: (filters: AuditFilters) => ['audit', 'list', filters] as const,
  detail: (id: string) => ['audit', 'detail', id] as const,
  modules: ['audit', 'modules'] as const,
  actions: ['audit', 'actions'] as const,
  summary: ['audit', 'summary'] as const,
};
