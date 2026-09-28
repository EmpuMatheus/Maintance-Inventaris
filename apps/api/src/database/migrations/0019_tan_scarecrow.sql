-- Add the network-device flag to subcategories (defaults to false for existing rows).
ALTER TABLE "asset_subcategories" ADD COLUMN "is_network_device" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Safety: resolve pre-existing duplicates before adding the composite unique
-- indexes. The oldest row per (parent, code) keeps its code; later duplicates
-- are renamed with a deterministic suffix derived from their primary key so no
-- data is lost and no foreign key is touched. This is required because the
-- code uniqueness was previously not enforced at the database level.
-- ---------------------------------------------------------------------------
UPDATE "asset_subcategories" s
SET "code" = LEFT(s."code", 17) || '-' || REPLACE(s."id"::text, '-', '')
WHERE s."id" IN (
  SELECT "id" FROM (
    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "category_id", "code" ORDER BY "created_at", "id") AS rn
    FROM "asset_subcategories"
  ) ranked WHERE ranked.rn > 1
);--> statement-breakpoint

UPDATE "buildings" b
SET "code" = LEFT(b."code", 17) || '-' || REPLACE(b."id"::text, '-', '')
WHERE b."id" IN (
  SELECT "id" FROM (
    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "site_id", "code" ORDER BY "created_at", "id") AS rn
    FROM "buildings"
  ) ranked WHERE ranked.rn > 1
);--> statement-breakpoint

UPDATE "floors" f
SET "code" = LEFT(f."code", 17) || '-' || REPLACE(f."id"::text, '-', '')
WHERE f."id" IN (
  SELECT "id" FROM (
    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "building_id", "code" ORDER BY "created_at", "id") AS rn
    FROM "floors"
  ) ranked WHERE ranked.rn > 1
);--> statement-breakpoint

UPDATE "rooms" r
SET "code" = LEFT(r."code", 17) || '-' || REPLACE(r."id"::text, '-', '')
WHERE r."id" IN (
  SELECT "id" FROM (
    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "floor_id", "code" ORDER BY "created_at", "id") AS rn
    FROM "rooms"
  ) ranked WHERE ranked.rn > 1
);--> statement-breakpoint

CREATE UNIQUE INDEX "asset_subcategories_category_id_code_unique" ON "asset_subcategories" USING btree ("category_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "buildings_site_id_code_unique" ON "buildings" USING btree ("site_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "floors_building_id_code_unique" ON "floors" USING btree ("building_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_floor_id_code_unique" ON "rooms" USING btree ("floor_id","code");
