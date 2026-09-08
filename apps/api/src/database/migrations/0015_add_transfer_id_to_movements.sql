ALTER TABLE "asset_movements" ADD COLUMN "transfer_id" uuid;
--> statement-breakpoint
ALTER TABLE "asset_movements" ADD CONSTRAINT "asset_movements_transfer_id_asset_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."asset_transfers"("id") ON DELETE set null ON UPDATE no action