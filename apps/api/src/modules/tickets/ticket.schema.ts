import { z } from 'zod';
import { TICKET_PRIORITIES, TICKET_CATEGORIES } from './ticket.types';

const dateLike = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.').optional().nullable();

export const createTicketSchema = z.object({
  title: z.string().min(1, 'Subject is required.').max(200),
  description: z.string().max(5000).optional().nullable(),
  priority: z.enum(TICKET_PRIORITIES).default('MEDIUM'),
  category: z.enum(TICKET_CATEGORIES).optional().nullable(),
  assetId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
});

export const updateTicketSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  category: z.enum(TICKET_CATEGORIES).optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
});

export const assignTicketSchema = z.object({
  technicianId: z.string().uuid(),
  notes: z.string().max(1000).optional().nullable(),
});

export const resolveTicketSchema = z.object({
  resolution: z.string().min(1, 'Resolution is required.'),
});

export const cancelTicketSchema = z.object({
  reason: z.string().min(1, 'Reason is required.'),
});

export const addCommentSchema = z.object({
  comment: z.string().min(1).max(4000),
  isInternal: z.boolean().optional().default(false),
});

export const createMaintenanceFromTicketSchema = z.object({
  maintenanceTypeId: z.string().uuid().optional().nullable(),
  technicianId: z.string().uuid().optional().nullable(),
  vendorId: z.string().uuid().optional().nullable(),
  maintenanceCategory: z.enum(['PREVENTIVE', 'CORRECTIVE']).default('CORRECTIVE'),
});

export const ticketQuerySchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  category: z.string().optional(),
  assetId: z.string().uuid().optional(),
  reporterId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  dateFrom: dateLike,
  dateTo: dateLike,
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
