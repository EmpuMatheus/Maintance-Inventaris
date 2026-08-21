ALTER TABLE "assets" ADD COLUMN "retired_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "retired_by" uuid;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "retire_reason" varchar(100);--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "retire_note" text;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_retired_by_users_id_fk" FOREIGN KEY ("retired_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;