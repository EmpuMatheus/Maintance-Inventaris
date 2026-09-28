ALTER TABLE "network_devices" DROP CONSTRAINT "network_devices_device_type_check";--> statement-breakpoint
ALTER TABLE "network_devices" ALTER COLUMN "device_type" SET DATA TYPE varchar(150);--> statement-breakpoint
ALTER TABLE "network_devices" ALTER COLUMN "device_type" SET DEFAULT '';--> statement-breakpoint
-- Backfill: Device Type is now the Asset's Subcategory name. Devices linked to
-- an asset get that name; devices without a linked asset keep their old value.
UPDATE "network_devices" nd
SET "device_type" = COALESCE(NULLIF(BTRIM(s.name), ''), nd."device_type")
FROM "assets" a
JOIN "asset_subcategories" s ON s.id = a.subcategory_id
WHERE nd.asset_id = a.id;