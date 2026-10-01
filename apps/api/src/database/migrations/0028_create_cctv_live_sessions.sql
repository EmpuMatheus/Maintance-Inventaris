CREATE TABLE "cctv_live_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"gateway_path" varchar(120) NOT NULL,
	"stream_kind" varchar(10) DEFAULT 'MAIN' NOT NULL,
	"status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"stopped_at" timestamp with time zone,
	CONSTRAINT "cctv_live_sessions_stream_kind_check" CHECK ("cctv_live_sessions"."stream_kind" in ('MAIN', 'SUB')),
	CONSTRAINT "cctv_live_sessions_status_check" CHECK ("cctv_live_sessions"."status" in ('ACTIVE', 'STOPPED'))
);
--> statement-breakpoint
ALTER TABLE "cctv_live_sessions" ADD CONSTRAINT "cctv_live_sessions_device_id_cctv_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."cctv_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cctv_live_sessions" ADD CONSTRAINT "cctv_live_sessions_channel_id_cctv_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."cctv_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cctv_live_sessions" ADD CONSTRAINT "cctv_live_sessions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cctv_live_sessions_gateway_path_unique" ON "cctv_live_sessions" USING btree ("gateway_path");--> statement-breakpoint
CREATE INDEX "cctv_live_sessions_device_id_idx" ON "cctv_live_sessions" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "cctv_live_sessions_status_idx" ON "cctv_live_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cctv_live_sessions_expires_at_idx" ON "cctv_live_sessions" USING btree ("expires_at");