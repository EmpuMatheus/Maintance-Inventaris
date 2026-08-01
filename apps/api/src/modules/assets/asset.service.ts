import { AppError } from '@/middleware/error-handler';
import * as repo from './asset.repository';
import { getDb } from '@/database/client';
import { assets as assetsTable, assetConditionHistory, assetCategories, assetSubcategories } from '@/database/schema';
import { sql, eq } from 'drizzle-orm';
import { eventBus } from '@/lib/event-bus';

function str(v: unknown): string | null | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

const ALLOWED_CONDITIONS = ['GOOD', 'FAIR', 'NEED_ATTENTION', 'BROKEN', 'CRITICAL', 'RETIRED'] as const;
const ALLOWED_STATUSES = ['AVAILABLE', 'ASSIGNED', 'IN_USE', 'IN_MAINTENANCE', 'BROKEN', 'SPARE', 'LOST', 'RETIRED', 'DISPOSED'] as const;

async function ref(table: string, id: string | null | undefined, label: string): Promise<void> {
  if (!id) return;
  const name = await repo.getReferenceName(table, id);
  if (!name) throw new AppError(400, 'VALIDATION_ERROR', `${label} not found.`);
}

async function validateCategorySubcategory(categoryId: string | null | undefined, subcategoryId: string | null | undefined) {
  if (!categoryId || !subcategoryId) return;
  const db = getDb();
  const { assetSubcategories } = await import('@/database/schema');
  const { eq } = await import('drizzle-orm');
  const rows = await db.select({ catId: assetSubcategories.categoryId }).from(assetSubcategories).where(eq(assetSubcategories.id, sql`${subcategoryId}::uuid`)).limit(1);
  if (rows.length > 0 && rows[0].catId !== categoryId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Subcategory does not belong to the selected category.');
  }
}

async function validateLocation(siteId: unknown, buildingId: unknown, floorId: unknown, roomId: unknown) {
  if (siteId && buildingId) {
    const db = getDb();
    const { buildings: b } = await import('@/database/schema');
    const { eq } = await import('drizzle-orm');
    const rows = await db.select({ siteId: b.siteId }).from(b).where(eq(b.id, sql`${buildingId}::uuid`)).limit(1);
    if (rows.length > 0 && rows[0].siteId !== siteId) throw new AppError(400, 'VALIDATION_ERROR', 'Building does not belong to the selected site.');
  }
  if (buildingId && floorId) {
    const db = getDb();
    const { floors: f } = await import('@/database/schema');
    const { eq } = await import('drizzle-orm');
    const rows = await db.select({ buildingId: f.buildingId }).from(f).where(eq(f.id, sql`${floorId}::uuid`)).limit(1);
    if (rows.length > 0 && rows[0].buildingId !== buildingId) throw new AppError(400, 'VALIDATION_ERROR', 'Floor does not belong to the selected building.');
  }
  if (floorId && roomId) {
    const db = getDb();
    const { rooms: r } = await import('@/database/schema');
    const { eq } = await import('drizzle-orm');
    const rows = await db.select({ floorId: r.floorId }).from(r).where(eq(r.id, sql`${roomId}::uuid`)).limit(1);
    if (rows.length > 0 && rows[0].floorId !== floorId) throw new AppError(400, 'VALIDATION_ERROR', 'Room does not belong to the selected floor.');
  }
}

async function generateAssetCode(categoryId: string, subcategoryId: string): Promise<string> {
  const db = getDb();

  const [cat] = await db.select({ code: assetCategories.code }).from(assetCategories).where(eq(assetCategories.id, sql`${categoryId}::uuid`)).limit(1);
  if (!cat) throw new AppError(400, 'VALIDATION_ERROR', 'Category not found for code generation.');

  const [sub] = await db.select({ code: assetSubcategories.code }).from(assetSubcategories).where(eq(assetSubcategories.id, sql`${subcategoryId}::uuid`)).limit(1);
  if (!sub) throw new AppError(400, 'VALIDATION_ERROR', 'Subcategory not found for code generation.');

  const catCode = cat.code.toUpperCase().trim();
  const subCode = sub.code.toUpperCase().trim();

  const result = await db.transaction(async (tx) => {
    const [row] = await tx.execute(sql`
      INSERT INTO asset_code_counters (id, category_id, subcategory_id, last_sequence)
      VALUES (gen_random_uuid(), ${categoryId}::uuid, ${subcategoryId}::uuid, 1)
      ON CONFLICT (category_id, subcategory_id)
      DO UPDATE SET last_sequence = asset_code_counters.last_sequence + 1
      RETURNING last_sequence
    `);
    const seq = Number((row as any)?.last_sequence ?? 1);
    return seq;
  });

  const padded = String(result).padStart(4, '0');
  return `AST-${catCode}-${subCode}-${padded}`;
}

export async function list(params: Record<string, any>) {
  return repo.findAssets({
    page: params.page ? Number(params.page) : undefined,
    limit: params.limit ? Number(params.limit) : undefined,
    search: str(params.search) ?? undefined,
    sort: str(params.sort) ?? undefined,
    order: params.order === 'asc' || params.order === 'desc' ? params.order : undefined,
    condition: str(params.condition) ?? undefined,
    status: str(params.status) ?? undefined,
    categoryId: str(params.categoryId) ?? undefined,
    subcategoryId: str(params.subcategoryId) ?? undefined,
    brandId: str(params.brandId) ?? undefined,
    departmentId: str(params.departmentId) ?? undefined,
    siteId: str(params.siteId) ?? undefined,
    buildingId: str(params.buildingId) ?? undefined,
    floorId: str(params.floorId) ?? undefined,
    roomId: str(params.roomId) ?? undefined,
    picId: str(params.picId) ?? undefined,
  });
}

export async function getById(id: string) {
  const row = await repo.findAssetById(id);
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Asset not found.');
  return row;
}

export async function getByCode(code: string) {
  const row = await repo.findAssetByCode(code);
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Asset not found.');
  return row;
}

export async function create(body: Record<string, unknown>, userId?: string) {
  const categoryId = str(body.categoryId);
  const subcategoryId = str(body.subcategoryId);
  if (!categoryId) throw new AppError(400, 'VALIDATION_ERROR', 'Category is required.');
  if (!subcategoryId) throw new AppError(400, 'VALIDATION_ERROR', 'Subcategory is required.');
  const brandId = str(body.brandId);
  const vendorId = str(body.vendorId);
  const departmentId = str(body.departmentId);
  const siteId = str(body.siteId);
  const buildingId = str(body.buildingId);
  const floorId = str(body.floorId);
  const roomId = str(body.roomId);
  const picId = str(body.currentPicId) ?? str(body.picId);
  const condition = str(body.condition) ?? 'GOOD';
  const status = str(body.status) ?? 'AVAILABLE';

  if (!ALLOWED_CONDITIONS.includes(condition as any)) throw new AppError(400, 'VALIDATION_ERROR', `Invalid condition: ${condition}`);
  if (!ALLOWED_STATUSES.includes(status as any)) throw new AppError(400, 'VALIDATION_ERROR', `Invalid status: ${status}`);

  const assetName = str(body.assetName);
  if (!assetName) throw new AppError(400, 'VALIDATION_ERROR', 'Asset name is required.');

  await ref('asset_categories', categoryId, 'Category');
  await ref('asset_subcategories', subcategoryId, 'Subcategory');
  await ref('brands', brandId, 'Brand');
  await ref('vendors', vendorId, 'Vendor');
  await ref('departments', departmentId, 'Department');
  await ref('sites', siteId, 'Site');
  await ref('buildings', buildingId, 'Building');
  await ref('floors', floorId, 'Floor');
  await ref('rooms', roomId, 'Room');
  await ref('users', picId, 'PIC');

  await validateCategorySubcategory(categoryId, subcategoryId);
  await validateLocation(siteId, buildingId, floorId, roomId);

  const assetCode = await generateAssetCode(categoryId, subcategoryId);

  const db = getDb();
  try {
    const result = await db.transaction(async (tx) => {
      const vals: Record<string, unknown> = {
        assetCode,
        assetName,
        categoryId: sql`${categoryId}::uuid`,
        subcategoryId: sql`${subcategoryId}::uuid`,
        condition: sql`${condition}::varchar`,
        status: sql`${status}::varchar`,
        createdBy: userId ? sql`${userId}::uuid` : undefined,
        model: str(body.model) ?? undefined,
        serialNumber: str(body.serialNumber) ?? undefined,
        manufacturer: str(body.manufacturer) ?? undefined,
        specification: str(body.specification) ?? undefined,
        invoiceNumber: str(body.invoiceNumber) ?? undefined,
        notes: str(body.notes) ?? undefined,
      };
      if (categoryId) vals.categoryId = sql`${categoryId}::uuid`;
      if (subcategoryId) vals.subcategoryId = sql`${subcategoryId}::uuid`;
      if (brandId) vals.brandId = sql`${brandId}::uuid`;
      if (vendorId) vals.vendorId = sql`${vendorId}::uuid`;
      if (departmentId) vals.departmentId = sql`${departmentId}::uuid`;
      if (siteId) vals.siteId = sql`${siteId}::uuid`;
      if (buildingId) vals.buildingId = sql`${buildingId}::uuid`;
      if (floorId) vals.floorId = sql`${floorId}::uuid`;
      if (roomId) vals.roomId = sql`${roomId}::uuid`;
      if (picId) vals.currentPicId = sql`${picId}::uuid`;
      if (str(body.purchaseDate)) vals.purchaseDate = sql`${str(body.purchaseDate)}::date`;
      if (str(body.warrantyStart)) vals.warrantyStart = sql`${str(body.warrantyStart)}::date`;
      if (str(body.warrantyEnd)) vals.warrantyEnd = sql`${str(body.warrantyEnd)}::date`;
      if (body.purchasePrice != null) vals.purchasePrice = sql`${String(body.purchasePrice)}::numeric`;

      const [asset] = await tx.insert(assetsTable).values(vals as any).returning();

      await tx.insert(assetConditionHistory).values({
        assetId: sql`${asset.id}::uuid`,
        previousCondition: sql`${condition}::varchar`,
        newCondition: sql`${condition}::varchar`,
        changedBy: userId ? sql`${userId}::uuid` : undefined,
      } as any);

      return asset;
    });
    eventBus.publish({
      type: 'ASSET',
      action: 'created',
      targetUserId: picId ?? null,
      entityType: 'asset',
      entityId: result.id as string,
      data: { assetCode: result.assetCode, assetName: result.assetName },
    });
    return result;
  } catch (err: any) {
    if (err?.code === '23505') throw new AppError(409, 'CONFLICT', 'Asset with this code already exists.');
    throw err;
  }
}

export async function update(id: string, body: Record<string, unknown>, _userId?: string) {
  const existing = await repo.findAssetById(id);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Asset not found.');

  const data: Record<string, unknown> = {};
  const textFields = ['assetName', 'model', 'serialNumber', 'manufacturer', 'specification', 'invoiceNumber', 'notes'] as const;
  for (const f of textFields) {
    const v = str(body[f]);
    if (v !== undefined) data[f] = v;
  }
  const dateFields = ['purchaseDate', 'warrantyStart', 'warrantyEnd'] as const;
  for (const f of dateFields) {
    const v = str(body[f]);
    if (v !== undefined) data[f] = sql`${v}::date`;
  }
  if (body.purchasePrice != null) data.purchasePrice = sql`${String(body.purchasePrice)}::numeric`;

  const refFields = ['categoryId', 'subcategoryId', 'brandId', 'vendorId', 'departmentId', 'siteId', 'buildingId', 'floorId', 'roomId'] as const;
  for (const f of refFields) {
    const v = str(body[f]);
    if (v !== undefined) data[f] = sql`${v}::uuid`;
  }
  const picId = str(body.currentPicId) ?? str(body.picId);
  if (picId !== undefined) data.currentPicId = sql`${picId}::uuid`;
  if (str(body.condition)) data.condition = sql`${str(body.condition)}::varchar`;
  if (str(body.status)) data.status = sql`${str(body.status)}::varchar`;

  if (data.categoryId) await ref('asset_categories', str(body.categoryId), 'Category');
  if (data.subcategoryId) {
    await ref('asset_subcategories', str(body.subcategoryId), 'Subcategory');
    await validateCategorySubcategory(str(body.categoryId) ?? existing.categoryId, str(body.subcategoryId));
  }
  if (data.siteId || data.buildingId || data.floorId || data.roomId) {
    await validateLocation(
      data.siteId ? str(body.siteId) : existing.siteId,
      data.buildingId ? str(body.buildingId) : existing.buildingId,
      data.floorId ? str(body.floorId) : existing.floorId,
      data.roomId ? str(body.roomId) : existing.roomId,
    );
  }

  if (Object.keys(data).length === 0) return existing;

  try {
    const updated = await repo.updateAsset(id, data);
    eventBus.publish({
      type: 'ASSET',
      action: 'updated',
      targetUserId: (existing.currentPicId as string) ?? null,
      entityType: 'asset',
      entityId: id,
      data: { assetCode: existing.assetCode, assetName: existing.assetName },
    });
    return updated ?? existing;
  } catch (err: any) {
    if (err?.code === '23505') throw new AppError(409, 'CONFLICT', 'Duplicate value violates unique constraint.');
    throw err;
  }
}

export async function updateCondition(id: string, body: Record<string, unknown>, userId?: string, userName?: string) {
  const existing = await repo.findAssetById(id);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Asset not found.');

  const newCondition = str(body.condition);
  if (!newCondition) throw new AppError(400, 'VALIDATION_ERROR', 'New condition is required.');
  if (!ALLOWED_CONDITIONS.includes(newCondition as any)) {
    throw new AppError(400, 'VALIDATION_ERROR', `Invalid condition: ${newCondition}`);
  }

  const currentCondition = existing.condition as string;
  if (currentCondition === 'RETIRED') throw new AppError(400, 'VALIDATION_ERROR', 'Cannot change condition of a retired asset.');
  if (newCondition === 'RETIRED') throw new AppError(400, 'VALIDATION_ERROR', 'Use the dedicated retirement workflow.');
  if (currentCondition === newCondition) throw new AppError(400, 'VALIDATION_ERROR', 'Asset already has this condition.');

  const db = getDb();
  try {
    const result = await db.transaction(async (tx) => {
      await tx.update(assetsTable)
        .set({ condition: sql`${newCondition}::varchar`, updatedAt: sql`now()` })
        .where(eq(assetsTable.id, sql`${id}::uuid`));

      const [history] = await tx.insert(assetConditionHistory).values({
        assetId: sql`${id}::uuid`,
        previousCondition: sql`${currentCondition}::varchar`,
        newCondition: sql`${newCondition}::varchar`,
        reason: str(body.reason) ?? undefined,
        notes: str(body.notes) ?? undefined,
        changedBy: userId ? sql`${userId}::uuid` : undefined,
      } as any).returning();

      return { ...history, changedByName: userName || null };
    });

    eventBus.publish({
      type: 'ASSET',
      action: 'condition_changed',
      targetUserId: (existing.currentPicId as string) ?? null,
      entityType: 'asset',
      entityId: id,
      data: { assetCode: existing.assetCode, assetName: existing.assetName, newCondition },
    });

    return result;
  } catch (err: any) {
    if (err?.code === '23503') throw new AppError(400, 'VALIDATION_ERROR', 'Referenced record not found.');
    throw err;
  }
}

export async function getConditionHistory(id: string) {
  const existing = await repo.findAssetById(id);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Asset not found.');

  const db = getDb();
  const rows = await db
    .select({
      id: assetConditionHistory.id,
      previousCondition: assetConditionHistory.previousCondition,
      newCondition: assetConditionHistory.newCondition,
      reason: assetConditionHistory.reason,
      notes: assetConditionHistory.notes,
      inspectionScore: assetConditionHistory.inspectionScore,
      createdAt: assetConditionHistory.createdAt,
      changedById: assetConditionHistory.changedBy,
    })
    .from(assetConditionHistory)
    .where(eq(assetConditionHistory.assetId, sql`${id}::uuid`))
    .orderBy(sql`${assetConditionHistory.createdAt} DESC`);

  return rows;
}
