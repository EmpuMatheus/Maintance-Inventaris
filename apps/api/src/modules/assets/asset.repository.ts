import { getDb } from '@/database/client';
import { assets, assetCategories, assetSubcategories, brands, vendors, sites, buildings, floors, rooms, departments, users } from '@/database/schema';
import { eq, like, and, sql, asc, desc, count } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

const LIST_COLUMNS = {
  id: assets.id,
  assetCode: assets.assetCode,
  assetName: assets.assetName,
  model: assets.model,
  serialNumber: assets.serialNumber,
  condition: assets.condition,
  status: assets.status,
  categoryId: assets.categoryId,
  subcategoryId: assets.subcategoryId,
  brandId: assets.brandId,
  siteId: assets.siteId,
  buildingId: assets.buildingId,
  floorId: assets.floorId,
  roomId: assets.roomId,
  departmentId: assets.departmentId,
  currentPicId: assets.currentPicId,
  createdAt: assets.createdAt,
};

export async function findAssets(params: {
  page?: number; limit?: number; search?: string; sort?: string; order?: string;
  condition?: string; status?: string; categoryId?: string; subcategoryId?: string;
  brandId?: string; departmentId?: string; siteId?: string; buildingId?: string;
  floorId?: string; roomId?: string; picId?: string;
}) {
  const db = getDb();
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 25));
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [sql`${assets.deletedAt} IS NULL`];

  if (params.search) {
    const p = `%${params.search}%`;
    conditions.push(sql`(${like(assets.assetCode, p)} OR ${like(assets.assetName, p)} OR ${like(assets.serialNumber, p)} OR ${like(assets.model, p)})`);
  }
  if (params.condition) conditions.push(eq(assets.condition, sql`${params.condition}::varchar`));
  if (params.status) conditions.push(eq(assets.status, sql`${params.status}::varchar`));
  if (params.categoryId) conditions.push(eq(assets.categoryId, sql`${params.categoryId}::uuid`));
  if (params.subcategoryId) conditions.push(eq(assets.subcategoryId, sql`${params.subcategoryId}::uuid`));
  if (params.brandId) conditions.push(eq(assets.brandId, sql`${params.brandId}::uuid`));
  if (params.departmentId) conditions.push(eq(assets.departmentId, sql`${params.departmentId}::uuid`));
  if (params.siteId) conditions.push(eq(assets.siteId, sql`${params.siteId}::uuid`));
  if (params.buildingId) conditions.push(eq(assets.buildingId, sql`${params.buildingId}::uuid`));
  if (params.floorId) conditions.push(eq(assets.floorId, sql`${params.floorId}::uuid`));
  if (params.roomId) conditions.push(eq(assets.roomId, sql`${params.roomId}::uuid`));
  if (params.picId) conditions.push(eq(assets.currentPicId, sql`${params.picId}::uuid`));

  const where = and(...conditions);
  const allowedSort = ['assetCode', 'assetName', 'condition', 'status', 'createdAt'] as const;
  const sortKey = params.sort && (allowedSort as readonly string[]).includes(params.sort) ? params.sort : 'createdAt';
  const sortCol = LIST_COLUMNS[sortKey as keyof typeof LIST_COLUMNS];
  const orderFn = params.order === 'asc' ? asc : desc;

  const rows = await db.select(LIST_COLUMNS).from(assets).where(where).orderBy(orderFn(sortCol)).limit(limit).offset(offset);
  const totalResult = await db.select({ value: count() }).from(assets).where(where);
  const total = Number(totalResult[0]?.value ?? 0);

  return {
    data: rows as any[],
    meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPreviousPage: page > 1 },
  };
}

export async function findAssetById(id: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: assets.id,
      assetCode: assets.assetCode,
      assetName: assets.assetName,
      categoryId: assets.categoryId,
      subcategoryId: assets.subcategoryId,
      brandId: assets.brandId,
      model: assets.model,
      serialNumber: assets.serialNumber,
      manufacturer: assets.manufacturer,
      specification: assets.specification,
      purchaseDate: assets.purchaseDate,
      purchasePrice: assets.purchasePrice,
      vendorId: assets.vendorId,
      invoiceNumber: assets.invoiceNumber,
      warrantyStart: assets.warrantyStart,
      warrantyEnd: assets.warrantyEnd,
      siteId: assets.siteId,
      buildingId: assets.buildingId,
      floorId: assets.floorId,
      roomId: assets.roomId,
      departmentId: assets.departmentId,
      currentPicId: assets.currentPicId,
      status: assets.status,
      condition: assets.condition,
      healthScore: assets.healthScore,
      qrCode: assets.qrCode,
      photoUrl: assets.photoUrl,
      notes: assets.notes,
      createdBy: assets.createdBy,
      createdAt: assets.createdAt,
      updatedAt: assets.updatedAt,
      deletedAt: assets.deletedAt,
      categoryName: assetCategories.name,
      categoryCode: assetCategories.code,
      subcategoryName: assetSubcategories.name,
      subcategoryCode: assetSubcategories.code,
      brandName: brands.name,
      vendorName: vendors.name,
      siteName: sites.name,
      siteCode: sites.code,
      buildingName: buildings.name,
      buildingCode: buildings.code,
      floorName: floors.name,
      floorCode: floors.code,
      roomName: rooms.name,
      roomCode: rooms.code,
      departmentName: departments.name,
      departmentCode: departments.code,
      picName: users.name,
    })
    .from(assets)
    .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
    .leftJoin(assetSubcategories, eq(assets.subcategoryId, assetSubcategories.id))
    .leftJoin(brands, eq(assets.brandId, brands.id))
    .leftJoin(vendors, eq(assets.vendorId, vendors.id))
    .leftJoin(sites, eq(assets.siteId, sites.id))
    .leftJoin(buildings, eq(assets.buildingId, buildings.id))
    .leftJoin(floors, eq(assets.floorId, floors.id))
    .leftJoin(rooms, eq(assets.roomId, rooms.id))
    .leftJoin(departments, eq(assets.departmentId, departments.id))
    .leftJoin(users, eq(assets.currentPicId, users.id))
    .where(and(eq(assets.id, sql`${id}::uuid`), sql`${assets.deletedAt} IS NULL`))
    .limit(1);
  return (rows as any[])[0] ?? null;
}

export async function findAssetByCode(code: string) {
  const db = getDb();
  const rows = await db.select().from(assets).where(and(eq(assets.assetCode, code), sql`${assets.deletedAt} IS NULL`)).limit(1);
  return (rows as any[])[0] ?? null;
}

export async function updateAsset(id: string, data: Record<string, unknown>) {
  const db = getDb();
  const rows = await db.update(assets).set({ ...data, updatedAt: sql`now()` }).where(eq(assets.id, sql`${id}::uuid`)).returning();
  return (rows as any[])[0] ?? null;
}

export async function getReferenceName(table: string, id: string): Promise<string | null> {
  const db = getDb();
  const tables: Record<string, any> = {
    asset_categories: assetCategories, asset_subcategories: assetSubcategories,
    brands, vendors, sites, buildings, floors, rooms, departments, users,
  };
  const t = tables[table];
  if (!t) return null;
  const rows = await db.select({ name: t.name }).from(t).where(eq(t.id, sql`${id}::uuid`)).limit(1);
  return (rows as any[])[0]?.name ?? null;
}
