import { AppError } from '@/middleware/error-handler';
import { getDb } from '@/database/client';
import { assets } from '@/database/schema';
import { eq, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { eventBus } from '@/lib/event-bus';
import * as repo from './schedule.repository';
import { calculateNextDueDate, daysBetween, toDateString, todayString } from './schedule.date';
import type { ScheduleFrequency, ScheduleState } from './schedule.types';
import * as maintenanceService from '@/modules/maintenance/maintenance.service';

export interface ScheduleInput {
  assetId: string;
  maintenanceTypeId?: string | null;
  frequencyType: ScheduleFrequency;
  frequencyValue: number;
  startDate?: string | null;
  nextMaintenanceDate?: string | null;
  lastMaintenanceDate?: string | null;
  reminderDays?: number | null;
  notes?: string | null;
}

async function assertAssetExists(assetId: string) {
  const db = getDb();
  const rows = await db
    .select({ id: assets.id, assetCode: assets.assetCode })
    .from(assets)
    .where(eq(assets.id, sql`${assetId}::uuid`))
    .limit(1);
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Asset not found.');
  return rows[0];
}

function resolveNextDueDate(input: ScheduleInput): string {
  if (input.nextMaintenanceDate) return input.nextMaintenanceDate;
  const from = input.startDate || input.lastMaintenanceDate || todayString();
  return calculateNextDueDate(from, input.frequencyType, input.frequencyValue);
}

export async function list(filters: repo.ScheduleFilters) {
  const result = await repo.findMany(filters);
  const today = todayString();
  return {
    data: result.data.map((s) => ({ ...s, ...computeState(s, today) })),
    meta: result.meta,
  };
}

export async function getById(id: string) {
  const schedule = await repo.findById(id);
  if (!schedule) throw new AppError(404, 'NOT_FOUND', 'Maintenance schedule not found.');
  return { ...schedule, ...computeState(schedule, todayString()) };
}

export async function create(body: ScheduleInput, userId?: string) {
  await assertAssetExists(body.assetId);
  const startDate = body.startDate || todayString();
  const nextMaintenanceDate = resolveNextDueDate(body);
  const row = await repo.create({
    assetId: sql`${body.assetId}::uuid`,
    maintenanceTypeId: body.maintenanceTypeId ? sql`${body.maintenanceTypeId}::uuid` : undefined,
    frequencyType: body.frequencyType,
    frequencyValue: body.frequencyValue,
    startDate: sql`${startDate}::date`,
    nextMaintenanceDate: sql`${nextMaintenanceDate}::date`,
    lastMaintenanceDate: body.lastMaintenanceDate ? sql`${body.lastMaintenanceDate}::date` : undefined,
    reminderDays: body.reminderDays ?? 7,
    notes: body.notes || undefined,
    createdBy: userId ? sql`${userId}::uuid` : undefined,
  });
  return row;
}

export async function update(id: string, body: Partial<ScheduleInput>) {
  const existing = await repo.findRawById(id);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Maintenance schedule not found.');

  const data: Record<string, unknown> = {};
  if (body.maintenanceTypeId !== undefined) {
    data.maintenanceTypeId = body.maintenanceTypeId ? sql`${body.maintenanceTypeId}::uuid` : undefined;
  }
  if (body.frequencyType !== undefined) data.frequencyType = body.frequencyType;
  if (body.frequencyValue !== undefined) data.frequencyValue = body.frequencyValue;
  if (body.reminderDays !== undefined) data.reminderDays = body.reminderDays ?? 7;
  if (body.notes !== undefined) data.notes = body.notes || undefined;
  if (body.lastMaintenanceDate !== undefined) {
    data.lastMaintenanceDate = body.lastMaintenanceDate ? sql`${body.lastMaintenanceDate}::date` : undefined;
  }

  const startDate = body.startDate !== undefined ? body.startDate : toDateString(existing.startDate);
  const start = startDate || todayString();
  if (body.startDate !== undefined) data.startDate = sql`${start}::date`;

  const recompute = body.nextMaintenanceDate === undefined && (body.frequencyType !== undefined || body.frequencyValue !== undefined || body.startDate !== undefined);
  const nextMaintenanceDate = body.nextMaintenanceDate || (recompute ? calculateNextDueDate(start, (body.frequencyType ?? existing.frequencyType) as ScheduleFrequency, (body.frequencyValue ?? existing.frequencyValue) as number) : undefined);
  if (nextMaintenanceDate) data.nextMaintenanceDate = sql`${nextMaintenanceDate}::date`;

  return repo.update(id, data);
}

export async function setActive(id: string, isActive: boolean) {
  const existing = await repo.findRawById(id);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Maintenance schedule not found.');
  return repo.setActive(id, isActive);
}

export async function upcoming(params: { days?: number } & repo.DueFilters) {
  const today = todayString();
  const days = Math.min(365, Math.max(0, params.days ?? 30));
  const result = await repo.findUpcoming(today, days, params);
  return {
    data: result.data.map((s) => ({ ...s, ...computeState(s, today) })),
    meta: result.meta,
  };
}

export async function dueToday(params: repo.DueFilters) {
  const today = todayString();
  const result = await repo.findDueToday(today, params);
  return {
    data: result.data.map((s) => ({ ...s, ...computeState(s, today) })),
    meta: result.meta,
  };
}

export async function overdue(params: repo.DueFilters) {
  const today = todayString();
  const result = await repo.findOverdue(today, params);
  return {
    data: result.data.map((s) => ({ ...s, ...computeState(s, today) })),
    meta: result.meta,
  };
}

export async function completed(params: { days?: number } & repo.DueFilters) {
  const days = Math.min(365, Math.max(0, params.days ?? 30));
  return repo.findCompleted(days, params);
}

function computeState(schedule: { nextMaintenanceDate?: string | null }, today: string): {
  state: ScheduleState;
  daysUntil: number;
  daysOverdue: number;
} {
  const next = schedule.nextMaintenanceDate;
  if (!next) return { state: 'UPCOMING', daysUntil: 0, daysOverdue: 0 };
  const diff = daysBetween(today, next);
  if (diff < 0) return { state: 'OVERDUE', daysUntil: diff, daysOverdue: Math.abs(diff) };
  if (diff === 0) return { state: 'DUE_TODAY', daysUntil: 0, daysOverdue: 0 };
  return { state: 'UPCOMING', daysUntil: diff, daysOverdue: 0 };
}

/**
 * Automatically generates a Maintenance record for every active schedule whose
 * due date has passed, then advances the schedule to its next due date.
 * Duplicate generation for the same (schedule, due date) is prevented by a
 * unique constraint combined with an atomic reservation row.
 */
export async function processDueSchedules(): Promise<number> {
  const today = todayString();
  const schedules = await repo.findSchedulesForGeneration(today);
  let processed = 0;

  for (const schedule of schedules) {
    const dueDate = schedule.nextMaintenanceDate;
    if (!dueDate) continue;

    try {
      const reserved = await repo.insertLog({
        scheduleId: sql`${schedule.id}::uuid`,
        dueDate: sql`${dueDate}::date`,
        status: 'GENERATING',
        notes: `Auto generation started for due date ${dueDate}.`,
      });
      if (!reserved) continue;

      const record = await maintenanceService.create(
        {
          assetId: schedule.assetId,
          maintenanceTypeId: schedule.maintenanceTypeId,
          maintenanceCategory: 'PREVENTIVE',
          problem: `Scheduled preventive maintenance due ${dueDate}.`,
          priority: 'MEDIUM',
          scheduledDate: today,
          notes: `Automatically generated from maintenance schedule (${schedule.maintenanceType?.name ?? 'preventive'}).`,
        },
        schedule.createdBy ?? undefined,
      );

      await repo.confirmLog(schedule.id, dueDate, record.id);
      await repo.update(schedule.id, {
        lastMaintenanceDate: sql`${dueDate}::date`,
        nextMaintenanceDate: sql`${calculateNextDueDate(dueDate, schedule.frequencyType as ScheduleFrequency, schedule.frequencyValue)}::date`,
      });
      processed += 1;

      eventBus.publish({
        type: 'SCHEDULE',
        action: 'due',
        targetUserId: schedule.createdBy ?? null,
        entityType: 'maintenance',
        entityId: record.id as string,
        data: {
          assetCode: schedule.asset?.assetCode,
          assetName: schedule.asset?.assetName,
          dueDate,
          maintenanceCode: record.maintenanceCode,
        },
      });
    } catch (error) {
      logger.warn({ error, scheduleId: schedule.id }, 'Failed to process due maintenance schedule');
      await repo.removeGeneratingLog(schedule.id, dueDate);
    }
  }

  return processed;
}

export { repo };
