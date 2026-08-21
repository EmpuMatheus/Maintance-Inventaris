import { pgTable, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { assets } from './assets';
import { users } from './auth';
import { departments } from './master-data';

export const tickets = pgTable('tickets', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketCode: varchar('ticket_code', { length: 50 }).unique().notNull(),
  assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'cascade' }),
  reporterId: uuid('reporter_id').references(() => users.id),
  departmentId: uuid('department_id').references(() => departments.id),
  category: varchar('category', { length: 50 }),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  priority: varchar('priority', { length: 50 }).notNull().default('MEDIUM'),
  status: varchar('status', { length: 50 }).notNull().default('OPEN'),
  assignedTo: uuid('assigned_to').references(() => users.id),
  reportedAt: timestamp('reported_at', { withTimezone: true }).defaultNow().notNull(),
  assignedAt: timestamp('assigned_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  resolution: text('resolution'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const ticketComments = pgTable('ticket_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id),
  type: varchar('type', { length: 20 }).notNull().default('COMMENT'),
  comment: text('comment').notNull(),
  isInternal: boolean('is_internal').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const ticketDocuments = pgTable('ticket_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileUrl: text('file_url').notNull(),
  fileType: varchar('file_type', { length: 50 }),
  uploadedBy: uuid('uploaded_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const ticketAssignments = pgTable('ticket_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  technicianId: uuid('technician_id').references(() => users.id),
  assignedBy: uuid('assigned_by').references(() => users.id),
  reassignedFromId: uuid('reassigned_from_id').references(() => users.id),
  notes: text('notes'),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
