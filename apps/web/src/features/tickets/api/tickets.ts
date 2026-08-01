import { apiGet, apiPost, apiPatch } from '@/lib/api-client';
import type { PaginatedResponse, Ticket, TicketAssignment, TicketComment, TicketFilters } from '../types';

export function listTickets(filters?: TicketFilters) {
  return apiGet<PaginatedResponse<Ticket>>('/tickets', filters as Record<string, string | number | undefined>);
}

export function getTicket(id: string) {
  return apiGet<{ success: boolean; data: Ticket }>(`/tickets/${id}`);
}

export function createTicket(data: Record<string, unknown>) {
  return apiPost<{ success: boolean; data: Ticket }>('/tickets', data);
}

export function updateTicket(id: string, data: Record<string, unknown>) {
  return apiPatch<{ success: boolean; data: Ticket }>(`/tickets/${id}`, data);
}

export function assignTicket(id: string, data: Record<string, unknown>) {
  return apiPost<{ success: boolean; data: Ticket }>(`/tickets/${id}/assign`, data);
}

export function startTicket(id: string) {
  return apiPost<{ success: boolean; data: Ticket }>(`/tickets/${id}/start`);
}

export function holdTicket(id: string) {
  return apiPost<{ success: boolean; data: Ticket }>(`/tickets/${id}/hold`);
}

export function resumeTicket(id: string) {
  return apiPost<{ success: boolean; data: Ticket }>(`/tickets/${id}/resume`);
}

export function resolveTicket(id: string, data: Record<string, unknown>) {
  return apiPost<{ success: boolean; data: Ticket }>(`/tickets/${id}/resolve`, data);
}

export function closeTicket(id: string) {
  return apiPost<{ success: boolean; data: Ticket }>(`/tickets/${id}/close`);
}

export function cancelTicket(id: string, data: Record<string, unknown>) {
  return apiPost<{ success: boolean; data: Ticket }>(`/tickets/${id}/cancel`, data);
}

export function listTicketComments(id: string) {
  return apiGet<{ success: boolean; data: TicketComment[] }>(`/tickets/${id}/comments`);
}

export function addTicketComment(id: string, data: Record<string, unknown>) {
  return apiPost<{ success: boolean; data: TicketComment }>(`/tickets/${id}/comments`, data);
}

export function getTicketAssignments(id: string) {
  return apiGet<{ success: boolean; data: TicketAssignment[] }>(`/tickets/${id}/assignments`);
}

export function createTicketMaintenance(id: string, data: Record<string, unknown>) {
  return apiPost<{ success: boolean; data: { ticket: Ticket; maintenance: { id: string; maintenanceCode: string } } }>(
    `/tickets/${id}/create-maintenance`,
    data,
  );
}

export const ticketKeys = {
  all: ['tickets'] as const,
  list: (filters: TicketFilters) => ['tickets', 'list', filters] as const,
  detail: (id: string) => ['tickets', 'detail', id] as const,
  comments: (id: string) => ['tickets', 'comments', id] as const,
  assignments: (id: string) => ['tickets', 'assignments', id] as const,
};
