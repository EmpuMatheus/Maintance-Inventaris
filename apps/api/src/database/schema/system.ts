import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './auth';

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  type: varchar('type', { length: 50 }).notNull(),
  priority: varchar('priority', { length: 20 }).notNull().default('INFO'),
  title: varchar('title', { length: 200 }).notNull(),
  message: text('message'),
  entityType: varchar('entity_type', { length: 50 }),
  entityId: uuid('entity_id'),
  isRead: boolean('is_read').default(false).notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const notificationSettings = pgTable('notification_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  asset: boolean('asset').default(true).notNull(),
  maintenance: boolean('maintenance').default(true).notNull(),
  schedule: boolean('schedule').default(true).notNull(),
  ticket: boolean('ticket').default(true).notNull(),
  assignment: boolean('assignment').default(true).notNull(),
  movement: boolean('movement').default(true).notNull(),
  reminder: boolean('reminder').default(true).notNull(),
  system: boolean('system').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userUnique: uniqueIndex('notification_settings_user_id_unique').on(table.userId),
}));

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  auditCode: varchar('audit_code', { length: 50 }).unique().notNull(),
  module: varchar('module', { length: 50 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: varchar('entity_id', { length: 50 }),
  action: varchar('action', { length: 100 }).notNull(),
  description: text('description'),
  oldData: jsonb('old_data'),
  newData: jsonb('new_data'),
  userId: uuid('user_id').references(() => users.id),
  performedByName: varchar('performed_by_name', { length: 150 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  requestId: varchar('request_id', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  moduleIdx: index('audit_logs_module_idx').on(table.module),
  entityTypeIdx: index('audit_logs_entity_type_idx').on(table.entityType),
  performedByIdx: index('audit_logs_user_id_idx').on(table.userId),
  createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
}));
