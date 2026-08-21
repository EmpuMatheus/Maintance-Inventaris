-- DEVELOPMENT ONLY
-- TODO: Before production, this foreign key MUST be changed back to ON DELETE
-- RESTRICT. CASCADE is enabled temporarily so that test categories and assets
-- can be cleaned up during development. It must NOT ship to production.
ALTER TABLE "assets" DROP CONSTRAINT "assets_category_id_asset_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_category_id_asset_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."asset_categories"("id") ON DELETE cascade ON UPDATE no action;