ALTER TABLE "cctv_devices" ADD COLUMN "asset_id" uuid;--> statement-breakpoint
ALTER TABLE "cctv_devices" ADD CONSTRAINT "cctv_devices_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cctv_devices_asset_id_idx" ON "cctv_devices" USING btree ("asset_id");