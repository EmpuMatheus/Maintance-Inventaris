CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid,
	"event_type" varchar(100) NOT NULL,
	"severity" varchar(20) DEFAULT 'INFO' NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "health_score_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "repeated_failure" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_events_asset_created_idx" ON "analytics_events" USING btree ("asset_id","created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_type_idx" ON "analytics_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "assets_condition_idx" ON "assets" USING btree ("condition");--> statement-breakpoint
CREATE INDEX "assets_health_score_idx" ON "assets" USING btree ("health_score");