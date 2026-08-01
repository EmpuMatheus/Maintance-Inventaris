import { pgTable, uuid, varchar, text, timestamp, date, numeric, integer, boolean, uniqueIndex } from 'drizzle-orm/pg-core';
import { assets } from './assets';
import { maintenanceTypes, vendors } from './master-data';
import { users } from './auth';
import { tickets } from './tickets';

export const maintenanceRecords = pgTable('maintenance_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  maintenanceCode: varchar('maintenance_code', { length: 50 }).unique().notNull(),
  assetId: uuid('asset_id').notNull().references(() => assets.id),
  maintenanceTypeId: uuid('maintenance_type_id').references(() => maintenanceTypes.id),
  maintenanceCategory: varchar('maintenance_category', { length: 50 }).notNull(),
  ticketId: uuid('ticket_id').references(() => tickets.id),
  problem: text('problem'),
  diagnosis: text('diagnosis'),
  actionTaken: text('action_taken'),
  technicianId: uuid('technician_id').references(() => users.id),
  vendorId: uuid('vendor_id').references(() => vendors.id),
  priority: varchar('priority', { length: 50 }).notNull().default('MEDIUM'),
  status: varchar('status', { length: 50 }).notNull().default('OPEN'),
  scheduledDate: date('scheduled_date'),
  startDate: timestamp('start_date', { withTimezone: true }),
  finishDate: timestamp('finish_date', { withTimezone: true }),
  downtimeMinutes: integer('downtime_minutes'),
  laborCost: numeric('labor_cost', { precision: 15, scale: 2 }).default('0'),
  partsCost: numeric('parts_cost', { precision: 15, scale: 2 }).default('0'),
  otherCost: numeric('other_cost', { precision: 15, scale: 2 }).default('0'),
  totalCost: numeric('total_cost', { precision: 15, scale: 2 }).default('0'),
  result: text('result'),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const maintenanceParts = pgTable('maintenance_parts', {
  id: uuid('id').defaultRandom().primaryKey(),
  maintenanceId: uuid('maintenance_id').notNull().references(() => maintenanceRecords.id),
  partName: varchar('part_name', { length: 150 }).notNull(),
  partNumber: varchar('part_number', { length: 100 }),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: numeric('unit_price', { precision: 15, scale: 2 }).notNull().default('0'),
  totalPrice: numeric('total_price', { precision: 15, scale: 2 }).notNull().default('0'),
  vendorId: uuid('vendor_id').references(() => vendors.id),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const maintenanceDocuments = pgTable('maintenance_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  maintenanceId: uuid('maintenance_id').notNull().references(() => maintenanceRecords.id),
  documentType: varchar('document_type', { length: 50 }).notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileUrl: text('file_url').notNull(),
  description: text('description'),
  uploadedBy: uuid('uploaded_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const maintenanceSchedules = pgTable('maintenance_schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  assetId: uuid('asset_id').notNull().references(() => assets.id),
  maintenanceTypeId: uuid('maintenance_type_id').references(() => maintenanceTypes.id),
  frequencyType: varchar('frequency_type', { length: 50 }).notNull(),
  frequencyValue: integer('frequency_value').notNull(),
  startDate: date('start_date'),
  lastMaintenanceDate: date('last_maintenance_date'),
  nextMaintenanceDate: date('next_maintenance_date'),
  reminderDays: integer('reminder_days').default(7),
  notes: text('notes'),
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const maintenanceScheduleLogs = pgTable('maintenance_schedule_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  scheduleId: uuid('schedule_id').notNull().references(() => maintenanceSchedules.id),
  maintenanceId: uuid('maintenance_id').references(() => maintenanceRecords.id),
  dueDate: date('due_date').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('GENERATED'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  scheduleDueUnique: uniqueIndex('maintenance_schedule_logs_schedule_due_unique').on(table.scheduleId, table.dueDate),
}));

export const maintenanceReminders = pgTable('maintenance_reminders', {
  id: uuid('id').defaultRandom().primaryKey(),
  scheduleId: uuid('schedule_id').references(() => maintenanceSchedules.id),
  maintenanceId: uuid('maintenance_id').references(() => maintenanceRecords.id),
  reminderType: varchar('reminder_type', { length: 50 }).notNull(),
  offsetDays: integer('offset_days').notNull().default(0),
  dueDate: date('due_date'),
  title: varchar('title', { length: 200 }).notNull(),
  message: text('message'),
  status: varchar('status', { length: 50 }).notNull().default('PENDING'),
  targetUserId: uuid('target_user_id').references(() => users.id),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  reminderUnique: uniqueIndex('maintenance_reminders_schedule_due_type_offset_unique').on(
    table.scheduleId,
    table.dueDate,
    table.reminderType,
    table.offsetDays,
  ),
}));
