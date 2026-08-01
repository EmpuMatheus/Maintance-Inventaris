import { pgTable, uuid, integer, uniqueIndex } from 'drizzle-orm/pg-core';

export const assetCodeCounters = pgTable('asset_code_counters', {
  id: uuid('id').defaultRandom().primaryKey(),
  categoryId: uuid('category_id').notNull(),
  subcategoryId: uuid('subcategory_id').notNull(),
  lastSequence: integer('last_sequence').notNull().default(0),
}, (table) => ({
  uniqueCatSub: uniqueIndex('asset_code_counters_cat_sub_unique').on(table.categoryId, table.subcategoryId),
}));
