ALTER TABLE "asset_transfers" DROP COLUMN "transfer_number";
DELETE FROM "__drizzle_migrations" WHERE version = '0032' AND tag = '0032_petite_yellow_claw';
DELETE FROM "__drizzle_migrations" WHERE version = '0033' AND tag = '0033_backfill_transfer_numbers';