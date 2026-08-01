CREATE TABLE "maintenance_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid,
	"maintenance_id" uuid,
	"reminder_type" varchar(50) NOT NULL,
	"offset_days" integer DEFAULT 0 NOT NULL,
	"due_date" date,
	"title" varchar(200) NOT NULL,
	"message" text,
	"status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"target_user_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_schedule_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"maintenance_id" uuid,
	"due_date" date NOT NULL,
	"status" varchar(50) DEFAULT 'GENERATED' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "maintenance_schedules" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "maintenance_schedules" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "maintenance_reminders" ADD CONSTRAINT "maintenance_reminders_schedule_id_maintenance_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."maintenance_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_reminders" ADD CONSTRAINT "maintenance_reminders_maintenance_id_maintenance_records_id_fk" FOREIGN KEY ("maintenance_id") REFERENCES "public"."maintenance_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_reminders" ADD CONSTRAINT "maintenance_reminders_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_schedule_logs" ADD CONSTRAINT "maintenance_schedule_logs_schedule_id_maintenance_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."maintenance_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_schedule_logs" ADD CONSTRAINT "maintenance_schedule_logs_maintenance_id_maintenance_records_id_fk" FOREIGN KEY ("maintenance_id") REFERENCES "public"."maintenance_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "maintenance_reminders_schedule_due_type_offset_unique" ON "maintenance_reminders" USING btree ("schedule_id","due_date","reminder_type","offset_days");--> statement-breakpoint
CREATE UNIQUE INDEX "maintenance_schedule_logs_schedule_due_unique" ON "maintenance_schedule_logs" USING btree ("schedule_id","due_date");