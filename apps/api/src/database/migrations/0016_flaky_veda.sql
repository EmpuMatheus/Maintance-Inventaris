CREATE TABLE "network_connection_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"network_device_id" uuid NOT NULL,
	"event_type" varchar(50) DEFAULT 'CONNECTION_LOST' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"duration_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "network_connection_events_event_type_check" CHECK ("network_connection_events"."event_type" in ('CONNECTION_LOST')),
	CONSTRAINT "network_connection_events_active_consistency" CHECK ((
      ("network_connection_events"."resolved_at" IS NULL AND "network_connection_events"."duration_seconds" IS NULL)
      OR ("network_connection_events"."resolved_at" IS NOT NULL AND "network_connection_events"."duration_seconds" IS NOT NULL)
    )),
	CONSTRAINT "network_connection_events_duration_nonnegative" CHECK ("network_connection_events"."duration_seconds" IS NULL OR "network_connection_events"."duration_seconds" >= 0)
);
--> statement-breakpoint
CREATE TABLE "network_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"device_type" varchar(50) DEFAULT 'COMPUTER' NOT NULL,
	"hostname" varchar(150),
	"ip_address" varchar(45) NOT NULL,
	"mac_address" varchar(100),
	"room_id" uuid NOT NULL,
	"asset_id" uuid,
	"status" varchar(50) DEFAULT 'UNKNOWN' NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_ping_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_status_change_at" timestamp with time zone,
	"offline_started_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "network_devices_device_type_check" CHECK ("network_devices"."device_type" in ('COMPUTER', 'SWITCH')),
	CONSTRAINT "network_devices_status_check" CHECK ("network_devices"."status" in ('ONLINE', 'OFFLINE', 'UNKNOWN')),
	CONSTRAINT "network_devices_consecutive_failures_nonnegative" CHECK ("network_devices"."consecutive_failures" >= 0),
	CONSTRAINT "network_devices_offline_status_consistency" CHECK ((
      ("network_devices"."status" = 'OFFLINE' AND "network_devices"."offline_started_at" IS NOT NULL)
      OR ("network_devices"."status" <> 'OFFLINE' AND "network_devices"."offline_started_at" IS NULL)
    ))
);
--> statement-breakpoint
ALTER TABLE "network_connection_events" ADD CONSTRAINT "network_connection_events_network_device_id_network_devices_id_fk" FOREIGN KEY ("network_device_id") REFERENCES "public"."network_devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_devices" ADD CONSTRAINT "network_devices_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_devices" ADD CONSTRAINT "network_devices_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "network_connection_events_single_active_incident_unique" ON "network_connection_events" USING btree ("network_device_id") WHERE "network_connection_events"."resolved_at" IS NULL;--> statement-breakpoint
CREATE INDEX "network_connection_events_device_started_idx" ON "network_connection_events" USING btree ("network_device_id","started_at");--> statement-breakpoint
CREATE INDEX "network_connection_events_resolved_at_idx" ON "network_connection_events" USING btree ("resolved_at");--> statement-breakpoint
CREATE UNIQUE INDEX "network_devices_active_ip_unique" ON "network_devices" USING btree ("ip_address") WHERE "network_devices"."is_active" = true;--> statement-breakpoint
CREATE INDEX "network_devices_status_idx" ON "network_devices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "network_devices_room_id_idx" ON "network_devices" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "network_devices_asset_id_idx" ON "network_devices" USING btree ("asset_id");