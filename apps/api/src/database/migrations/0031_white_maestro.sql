CREATE TABLE "maintenance_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"maintenance_id" uuid NOT NULL,
	"source_task_id" uuid,
	"task" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_type_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"maintenance_type_id" uuid NOT NULL,
	"task" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_maintenance_id_maintenance_records_id_fk" FOREIGN KEY ("maintenance_id") REFERENCES "public"."maintenance_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_type_tasks" ADD CONSTRAINT "maintenance_type_tasks_maintenance_type_id_maintenance_types_id_fk" FOREIGN KEY ("maintenance_type_id") REFERENCES "public"."maintenance_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "maintenance_tasks_maintenance_id_idx" ON "maintenance_tasks" USING btree ("maintenance_id");--> statement-breakpoint
CREATE INDEX "maintenance_type_tasks_type_id_idx" ON "maintenance_type_tasks" USING btree ("maintenance_type_id");