CREATE TABLE "notification_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"asset" boolean DEFAULT true NOT NULL,
	"maintenance" boolean DEFAULT true NOT NULL,
	"schedule" boolean DEFAULT true NOT NULL,
	"ticket" boolean DEFAULT true NOT NULL,
	"assignment" boolean DEFAULT true NOT NULL,
	"movement" boolean DEFAULT true NOT NULL,
	"reminder" boolean DEFAULT true NOT NULL,
	"system" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "priority" varchar(20) DEFAULT 'INFO' NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_settings_user_id_unique" ON "notification_settings" USING btree ("user_id");