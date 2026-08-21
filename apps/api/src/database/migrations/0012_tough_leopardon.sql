-- ============================================================================
-- DEVELOPMENT ONLY
-- ============================================================================
-- All foreign keys referencing `assets`, `maintenance_records`,
-- `maintenance_schedules` and `tickets` now use ON DELETE CASCADE so that a
-- single DELETE on an asset (or category) lets PostgreSQL remove the entire
-- subtree automatically during development:
--
--   Category -> Subcategories -> Assets -> Condition History / Assignments /
--   Documents / Movements / Maintenance (Parts, Documents, Schedule Logs,
--   Reminders) / Tickets (Comments, Documents, Assignments) / Analytics Events
--
-- This removes the need for any manual child-table deletion in the backend.
--
-- BEFORE PRODUCTION:
--   - assets.category_id -> asset_categories.id MUST be changed back to
--     ON DELETE RESTRICT (delete of a category with assets must be blocked).
--   - Asset child tables (history, documents, assignments, movements,
--     maintenance, tickets, ...) MAY stay ON DELETE CASCADE.
-- ============================================================================
ALTER TABLE "asset_assignments" DROP CONSTRAINT "asset_assignments_asset_id_assets_id_fk";
--> statement-breakpoint
ALTER TABLE "asset_condition_history" DROP CONSTRAINT "asset_condition_history_asset_id_assets_id_fk";
--> statement-breakpoint
ALTER TABLE "asset_documents" DROP CONSTRAINT "asset_documents_asset_id_assets_id_fk";
--> statement-breakpoint
ALTER TABLE "asset_movements" DROP CONSTRAINT "asset_movements_asset_id_assets_id_fk";
--> statement-breakpoint
ALTER TABLE "maintenance_documents" DROP CONSTRAINT "maintenance_documents_maintenance_id_maintenance_records_id_fk";
--> statement-breakpoint
ALTER TABLE "maintenance_parts" DROP CONSTRAINT "maintenance_parts_maintenance_id_maintenance_records_id_fk";
--> statement-breakpoint
ALTER TABLE "maintenance_records" DROP CONSTRAINT "maintenance_records_asset_id_assets_id_fk";
--> statement-breakpoint
ALTER TABLE "maintenance_records" DROP CONSTRAINT "maintenance_records_ticket_id_tickets_id_fk";
--> statement-breakpoint
ALTER TABLE "maintenance_reminders" DROP CONSTRAINT "maintenance_reminders_schedule_id_maintenance_schedules_id_fk";
--> statement-breakpoint
ALTER TABLE "maintenance_reminders" DROP CONSTRAINT "maintenance_reminders_maintenance_id_maintenance_records_id_fk";
--> statement-breakpoint
ALTER TABLE "maintenance_schedule_logs" DROP CONSTRAINT "maintenance_schedule_logs_schedule_id_maintenance_schedules_id_fk";
--> statement-breakpoint
ALTER TABLE "maintenance_schedule_logs" DROP CONSTRAINT "maintenance_schedule_logs_maintenance_id_maintenance_records_id_fk";
--> statement-breakpoint
ALTER TABLE "maintenance_schedules" DROP CONSTRAINT "maintenance_schedules_asset_id_assets_id_fk";
--> statement-breakpoint
ALTER TABLE "ticket_assignments" DROP CONSTRAINT "ticket_assignments_ticket_id_tickets_id_fk";
--> statement-breakpoint
ALTER TABLE "ticket_comments" DROP CONSTRAINT "ticket_comments_ticket_id_tickets_id_fk";
--> statement-breakpoint
ALTER TABLE "ticket_documents" DROP CONSTRAINT "ticket_documents_ticket_id_tickets_id_fk";
--> statement-breakpoint
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_asset_id_assets_id_fk";
--> statement-breakpoint
ALTER TABLE "analytics_events" DROP CONSTRAINT "analytics_events_asset_id_assets_id_fk";
--> statement-breakpoint
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_condition_history" ADD CONSTRAINT "asset_condition_history_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_documents" ADD CONSTRAINT "asset_documents_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_movements" ADD CONSTRAINT "asset_movements_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_documents" ADD CONSTRAINT "maintenance_documents_maintenance_id_maintenance_records_id_fk" FOREIGN KEY ("maintenance_id") REFERENCES "public"."maintenance_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_parts" ADD CONSTRAINT "maintenance_parts_maintenance_id_maintenance_records_id_fk" FOREIGN KEY ("maintenance_id") REFERENCES "public"."maintenance_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_reminders" ADD CONSTRAINT "maintenance_reminders_schedule_id_maintenance_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."maintenance_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_reminders" ADD CONSTRAINT "maintenance_reminders_maintenance_id_maintenance_records_id_fk" FOREIGN KEY ("maintenance_id") REFERENCES "public"."maintenance_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_schedule_logs" ADD CONSTRAINT "maintenance_schedule_logs_schedule_id_maintenance_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."maintenance_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_schedule_logs" ADD CONSTRAINT "maintenance_schedule_logs_maintenance_id_maintenance_records_id_fk" FOREIGN KEY ("maintenance_id") REFERENCES "public"."maintenance_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_documents" ADD CONSTRAINT "ticket_documents_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;