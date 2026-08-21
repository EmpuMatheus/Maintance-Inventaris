-- Development only. Revert to RESTRICT before production.
-- All foreign keys referencing asset_categories / asset_subcategories use
-- ON DELETE CASCADE (and ON UPDATE CASCADE) so test categories, subcategories
-- and assets can be cleaned up during development.
ALTER TABLE "user_categories" DROP CONSTRAINT "user_categories_category_id_asset_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "asset_subcategories" DROP CONSTRAINT "asset_subcategories_category_id_asset_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "assets" DROP CONSTRAINT "assets_category_id_asset_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "assets" DROP CONSTRAINT "assets_subcategory_id_asset_subcategories_id_fk";
--> statement-breakpoint
ALTER TABLE "user_categories" ADD CONSTRAINT "user_categories_category_id_asset_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."asset_categories"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "asset_subcategories" ADD CONSTRAINT "asset_subcategories_category_id_asset_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."asset_categories"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_category_id_asset_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."asset_categories"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_subcategory_id_asset_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."asset_subcategories"("id") ON DELETE cascade ON UPDATE cascade;