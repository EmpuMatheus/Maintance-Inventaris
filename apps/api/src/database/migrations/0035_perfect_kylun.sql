CREATE TABLE "maintenance_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"maintenance_id" uuid NOT NULL,
	"from_status" varchar(50),
	"to_status" varchar(50) NOT NULL,
	"reason" text,
	"notes" text,
	"changed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "maintenance_status_history" ADD CONSTRAINT "maintenance_status_history_maintenance_id_maintenance_records_id_fk" FOREIGN KEY ("maintenance_id") REFERENCES "public"."maintenance_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_status_history" ADD CONSTRAINT "maintenance_status_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "maintenance_status_history_maintenance_created_at_idx" ON "maintenance_status_history" USING btree ("maintenance_id","created_at");