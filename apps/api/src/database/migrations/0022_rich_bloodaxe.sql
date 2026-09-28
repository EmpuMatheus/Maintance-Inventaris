CREATE TABLE "transfer_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"roles" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"reason" text,
	"confirmed_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transfer_confirmations" ADD CONSTRAINT "transfer_confirmations_transfer_id_asset_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."asset_transfers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_confirmations" ADD CONSTRAINT "transfer_confirmations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "transfer_confirmations_transfer_id_user_id_unique" ON "transfer_confirmations" USING btree ("transfer_id","user_id");--> statement-breakpoint
CREATE INDEX "transfer_confirmations_transfer_id_idx" ON "transfer_confirmations" USING btree ("transfer_id");