CREATE TABLE "cctv_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"channel_number" integer NOT NULL,
	"device_channel_id" varchar(255),
	"technical_name" varchar(255),
	"name" varchar(150) DEFAULT 'Belum diatur' NOT NULL,
	"location" varchar(255),
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"camera_ip" varchar(45),
	"status" varchar(50) DEFAULT 'UNKNOWN' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cctv_channels_status_check" CHECK ("cctv_channels"."status" in ('ONLINE', 'OFFLINE', 'UNKNOWN', 'MISSING')),
	CONSTRAINT "cctv_channels_channel_number_positive" CHECK ("cctv_channels"."channel_number" > 0),
	CONSTRAINT "cctv_channels_display_order_nonnegative" CHECK ("cctv_channels"."display_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "cctv_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"device_type" varchar(50) DEFAULT 'DVR' NOT NULL,
	"brand" varchar(150),
	"model" varchar(150),
	"ip_address" varchar(45) NOT NULL,
	"port" integer DEFAULT 80 NOT NULL,
	"username" varchar(150),
	"password_encrypted" text,
	"location" varchar(255),
	"description" text,
	"status" varchar(50) DEFAULT 'UNKNOWN' NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_error" varchar(500),
	"manufacturer" varchar(150),
	"firmware_version" varchar(150),
	"serial_number" varchar(150),
	"hardware_id" varchar(150),
	"onvif_services" jsonb,
	"last_synced_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cctv_devices_device_type_check" CHECK ("cctv_devices"."device_type" in ('DVR', 'NVR', 'RECORDER')),
	CONSTRAINT "cctv_devices_status_check" CHECK ("cctv_devices"."status" in ('ONLINE', 'OFFLINE', 'UNKNOWN')),
	CONSTRAINT "cctv_devices_port_range_check" CHECK ("cctv_devices"."port" > 0 AND "cctv_devices"."port" <= 65535)
);
--> statement-breakpoint
CREATE TABLE "cctv_stream_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"profile_token" varchar(255) NOT NULL,
	"profile_name" varchar(255),
	"stream_type" varchar(50) DEFAULT 'MAIN' NOT NULL,
	"stream_uri" text,
	"video_codec" varchar(50),
	"resolution" varchar(50),
	"fps" integer,
	"is_main_stream" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cctv_stream_profiles_stream_type_check" CHECK ("cctv_stream_profiles"."stream_type" in ('MAIN', 'SUB', 'OTHER')),
	CONSTRAINT "cctv_stream_profiles_fps_nonnegative" CHECK ("cctv_stream_profiles"."fps" IS NULL OR "cctv_stream_profiles"."fps" >= 0)
);
--> statement-breakpoint
ALTER TABLE "cctv_channels" ADD CONSTRAINT "cctv_channels_device_id_cctv_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."cctv_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cctv_stream_profiles" ADD CONSTRAINT "cctv_stream_profiles_channel_id_cctv_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."cctv_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cctv_channels_device_channel_unique" ON "cctv_channels" USING btree ("device_id","channel_number");--> statement-breakpoint
CREATE INDEX "cctv_channels_device_id_idx" ON "cctv_channels" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "cctv_channels_status_idx" ON "cctv_channels" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "cctv_devices_active_endpoint_unique" ON "cctv_devices" USING btree ("ip_address","port") WHERE "cctv_devices"."is_active" = true;--> statement-breakpoint
CREATE INDEX "cctv_devices_status_idx" ON "cctv_devices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cctv_devices_is_active_idx" ON "cctv_devices" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "cctv_stream_profiles_channel_profile_unique" ON "cctv_stream_profiles" USING btree ("channel_id","profile_token");--> statement-breakpoint
CREATE INDEX "cctv_stream_profiles_channel_id_idx" ON "cctv_stream_profiles" USING btree ("channel_id");