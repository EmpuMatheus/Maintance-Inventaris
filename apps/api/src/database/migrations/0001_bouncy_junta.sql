DROP SEQUENCE IF EXISTS asset_code_seq;
--> statement-breakpoint
CREATE TABLE "asset_code_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"subcategory_id" uuid NOT NULL,
	"last_sequence" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "asset_code_counters_cat_sub_unique" ON "asset_code_counters" USING btree ("category_id","subcategory_id");