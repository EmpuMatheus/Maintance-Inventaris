import { AppError } from '@/middleware/error-handler';
import * as repo from './maintenance.repository';
import { getDb } from '@/database/client';
import { maintenanceRecords, assets as assetsTable, assetConditionHistory, users } from '@/database/schema';
import { sql, eq } from 'drizzle-orm';
import { eventBus } from '@/lib/event-bus';
import { canAccessAsset, type AssetScope } from '@/middleware/scope';

function str(v: unknown): string | null | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

const TRANSITIONS: Record<string, string[]> = {
  OPEN: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_PART', 'TESTING', 'CANCELLED'],
  WAITING_PART: ['IN_PROGRESS', 'CANCELLED'],
  TESTING: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

function assertTransition(current: string, target: string) {
  const allowed = TRANSITIONS[current];
  if (!allowed) throw new AppError(400, 'INVALID_MAINTENANCE_TRANSITION', `Unknown status: ${current}`);
  if (!allowed.includes(target)) {
    throw new AppError(400, 'INVALID_MAINTENANCE_TRANSITION', `Cannot transition from ${current} to ${target}.`);
  }
}

async function generateCode(): Promise<string> {
  const db = getDb();
  const seq = await db.execute(sql`SELECT nextval('maintenance_code_seq') AS n`);
  const num = Number((seq as any)[0]?.n ?? 1);
  const year = new Date().getFullYear();
  return `MNT-${year}-${String(num).padStart(6, '0')}`;
}

/**
 * Users with own-scoped or category-scoped access may only view maintenance
 * records whose asset is within their scope.
 */
async function assertOwnMaintenance(id: string, scope?: AssetScope) {
  if (!scope?.ownUserId && !scope?.categoryIds) return;
  const db = getDb();
  const rows = await db
    .select({ assetPicId: assetsTable.currentPicId, categoryId: assetsTable.categoryId })
    .from(maintenanceRecords)
    .leftJoin(assetsTable, eq(maintenanceRecords.assetId, assetsTable.id))
    .where(eq(maintenanceRecords.id, sql`${id}::uuid`))
    .limit(1);
  if (!rows.length) throw new AppError(404, 'NOT_FOUND', 'Maintenance record not found.');
  if (!canAccessAsset(scope, { currentPicId: rows[0].assetPicId, categoryId: rows[0].categoryId })) {
    throw new AppError(404, 'NOT_FOUND', 'Maintenance record not found.');
  }
}

export async function list(params: Record<string, any>, scope?: AssetScope) {
  return repo.findMany({
    page: params.page ? Number(params.page) : undefined,
    limit: params.limit ? Number(params.limit) : undefined,
    search: str(params.search) ?? undefined,
    status: str(params.status) ?? undefined,
    priority: str(params.priority) ?? undefined,
    assetId: str(params.assetId) ?? undefined,
    technicianId: str(params.technicianId) ?? undefined,
    typeId: str(params.typeId) ?? undefined,
    ownUserId: scope?.ownUserId,
    categoryIds: scope?.categoryIds,
  });
}

export async function getById(id: string, scope?: AssetScope) {
  const row = await repo.findDetails(id);
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Maintenance record not found.');
  await assertOwnMaintenance(id, scope);
  return row;
}

export async function getByCode(code: string, scope?: AssetScope) {
  const row = await repo.findByCode(code);
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Maintenance record not found.');
  await assertOwnMaintenance(row.id as string, scope);
  return row;
}

export async function getParts(maintenanceId: string, scope?: AssetScope) {
  await assertOwnMaintenance(maintenanceId, scope);
  return repo.getParts(maintenanceId);
}

export async function getDocuments(maintenanceId: string, scope?: AssetScope) {
  await assertOwnMaintenance(maintenanceId, scope);
  return repo.getDocuments(maintenanceId);
}

export async function create(body: Record<string, unknown>, userId?: string, scope?: AssetScope) {
  const db = getDb();
  const [asset] = await db
    .select({ id: assetsTable.id, status: assetsTable.status, categoryId: assetsTable.categoryId, currentPicId: assetsTable.currentPicId })
    .from(assetsTable)
    .where(eq(assetsTable.id, sql`${body.assetId as string}::uuid`))
    .limit(1);
  if (!asset) throw new AppError(404, 'NOT_FOUND', 'Asset not found.');
  if (asset.status === 'RETIRED') {
    throw new AppError(409, 'CONFLICT', 'Cannot create maintenance for a retired asset.');
  }
  if (!canAccessAsset(scope ?? {}, asset as { categoryId?: unknown; currentPicId?: unknown })) {
    throw new AppError(404, 'NOT_FOUND', 'Asset not found.');
  }

  const code = await generateCode();
  const [record] = await db.insert(maintenanceRecords).values({
    maintenanceCode: code,
    assetId: sql`${body.assetId as string}::uuid`,
    maintenanceTypeId: body.maintenanceTypeId ? sql`${body.maintenanceTypeId as string}::uuid` : undefined,
    maintenanceCategory: str(body.maintenanceCategory) || 'CORRECTIVE',
    problem: str(body.problem) || undefined,
    priority: str(body.priority) || 'MEDIUM',
    technicianId: body.technicianId ? sql`${body.technicianId as string}::uuid` : undefined,
    vendorId: body.vendorId ? sql`${body.vendorId as string}::uuid` : undefined,
    scheduledDate: str(body.scheduledDate) ? sql`${str(body.scheduledDate)}::date` : undefined,
    notes: str(body.notes) ?? undefined,
    ticketId: body.ticketId ? sql`${body.ticketId as string}::uuid` : undefined,
    createdBy: userId ? sql`${userId}::uuid` : undefined,
    status: 'OPEN',
  } as any).returning();

  return record;
}

export async function assign(id: string, body: Record<string, unknown>, _userId?: string) {
  const mt = await repo.findById(id);
  if (!mt) throw new AppError(404, 'NOT_FOUND', 'Maintenance record not found.');
  assertTransition(mt.status, 'ASSIGNED');

  const db = getDb();
  const [tech] = await db.select({ id: users.id }).from(users).where(eq(users.id, sql`${body.technicianId as string}::uuid`)).limit(1);
  if (!tech) throw new AppError(400, 'VALIDATION_ERROR', 'Technician not found.');

  return repo.update(id, {
    technicianId: sql`${body.technicianId as string}::uuid`,
    status: 'ASSIGNED',
    notes: str(body.notes) ?? undefined,
  });
}

export async function start(id: string) {
  const mt = await repo.findById(id);
  if (!mt) throw new AppError(404, 'NOT_FOUND', 'Maintenance record not found.');
  assertTransition(mt.status, 'IN_PROGRESS');
  const result = await repo.update(id, { status: 'IN_PROGRESS', startDate: sql`now()` });
  eventBus.publish({
    type: 'MAINTENANCE',
    action: 'started',
    targetUserId: (mt.technicianId as string) ?? (mt.createdBy as string) ?? null,
    entityType: 'maintenance',
    entityId: id,
    data: { maintenanceCode: mt.maintenanceCode },
  });
  return result;
}

export async function waitingPart(id: string, body: Record<string, unknown>) {
  const mt = await repo.findById(id);
  if (!mt) throw new AppError(404, 'NOT_FOUND', 'Maintenance record not found.');
  assertTransition(mt.status, 'WAITING_PART');
  if (!str(body.reason)) throw new AppError(400, 'VALIDATION_ERROR', 'Reason for waiting part is required.');
  return repo.update(id, { status: 'WAITING_PART', notes: str(body.notes) ?? undefined });
}

export async function testing(id: string) {
  const mt = await repo.findById(id);
  if (!mt) throw new AppError(404, 'NOT_FOUND', 'Maintenance record not found.');
  assertTransition(mt.status, 'TESTING');
  return repo.update(id, { status: 'TESTING' });
}

export async function complete(id: string, body: Record<string, unknown>, userId?: string) {
  const mt = await repo.findById(id);
  if (!mt) throw new AppError(404, 'NOT_FOUND', 'Maintenance record not found.');
  assertTransition(mt.status, 'COMPLETED');

  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.update(maintenanceRecords).set({
      status: 'COMPLETED',
      diagnosis: str(body.diagnosis) ?? undefined,
      actionTaken: str(body.actionTaken) ?? undefined,
      result: str(body.result) ?? undefined,
      finishDate: sql`now()`,
      notes: str(body.notes) ?? undefined,
      updatedAt: sql`now()`,
    } as any).where(eq(maintenanceRecords.id, sql`${id}::uuid`));

    const newCondition = str(body.condition);
    if (newCondition) {
      const [asset] = await tx.select({ condition: assetsTable.condition }).from(assetsTable).where(eq(assetsTable.id, sql`${mt.assetId}::uuid`)).limit(1);
      if (asset) {
        await tx.update(assetsTable).set({ condition: sql`${newCondition}::varchar`, updatedAt: sql`now()` }).where(eq(assetsTable.id, sql`${mt.assetId}::uuid`));
        await tx.insert(assetConditionHistory).values({
          assetId: sql`${mt.assetId}::uuid`,
          previousCondition: sql`${asset.condition}::varchar`,
          newCondition: sql`${newCondition}::varchar`,
          reason: `Maintenance ${mt.maintenanceCode} completed.`,
          changedBy: userId ? sql`${userId}::uuid` : undefined,
        } as any);
      }
    }
  });

  eventBus.publish({
    type: 'MAINTENANCE',
    action: 'completed',
    targetUserId: (mt.technicianId as string) ?? (mt.createdBy as string) ?? null,
    entityType: 'maintenance',
    entityId: id,
    data: { maintenanceCode: mt.maintenanceCode },
  });

  return repo.findById(id);
}

export async function cancel(id: string, body: Record<string, unknown>) {
  const mt = await repo.findById(id);
  if (!mt) throw new AppError(404, 'NOT_FOUND', 'Maintenance record not found.');
  assertTransition(mt.status, 'CANCELLED');
  if (!str(body.reason)) throw new AppError(400, 'VALIDATION_ERROR', 'Cancellation reason is required.');
  return repo.update(id, { status: 'CANCELLED', notes: str(body.notes) ?? undefined });
}

export async function addPart(maintenanceId: string, body: Record<string, unknown>) {
  const mt = await repo.findById(maintenanceId);
  if (!mt) throw new AppError(404, 'NOT_FOUND', 'Maintenance record not found.');
  if (mt.status === 'COMPLETED' || mt.status === 'CANCELLED') {
    throw new AppError(400, 'VALIDATION_ERROR', 'Cannot add parts to a completed or cancelled maintenance.');
  }
  const qty = Number(body.quantity) || 1;
  const price = Number(body.unitPrice) || 0;
  return repo.addPart({
    maintenanceId: sql`${maintenanceId}::uuid`,
    partName: str(body.partName),
    partNumber: str(body.partNumber) ?? undefined,
    quantity: qty,
    unitPrice: sql`${String(price)}::numeric`,
    totalPrice: sql`${String(qty * price)}::numeric`,
    vendorId: body.vendorId ? sql`${body.vendorId as string}::uuid` : undefined,
    notes: str(body.notes) ?? undefined,
  });
}

export async function deletePart(maintenanceId: string, partId: string) {
  const mt = await repo.findById(maintenanceId);
  if (!mt) throw new AppError(404, 'NOT_FOUND', 'Maintenance record not found.');
  if (mt.status === 'COMPLETED' || mt.status === 'CANCELLED') {
    throw new AppError(400, 'VALIDATION_ERROR', 'Cannot delete parts from a completed or cancelled maintenance.');
  }
  await repo.deletePart(partId);
}

export { repo };
