import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { assets } from './assets';

/**
 * Timeline of analytics events (health changes, repeated failures, replacement
 * recommendations) used by the analytics dashboard timeline.
 */
export const analyticsEvents = pgTable('analytics_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  assetId: uuid('asset_id').references(() => assets.id),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull().default('INFO'),
  title: varchar('title', { length: 200 }).notNull(),
  message: text('message'),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  assetCreatedIdx: index('analytics_events_asset_created_idx').on(table.assetId, table.createdAt),
  typeIdx: index('analytics_events_type_idx').on(table.eventType),
}));
