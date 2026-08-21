import { getDb } from '@/database/client';
import { assets, assetCategories, brands, departments, vendors, sites, buildings, floors, rooms, users } from '@/database/schema';
import { eq, and, sql, desc, asc, count, inArray } from 'drizzle-orm';
import type { SQL, SQLWrapper } from 'drizzle-orm';

export interface WarrantyFilters {
  page?: number;
  limit?: number;
  keyword?: string;
  categoryId?: string;
  categoryIds?: string[];
  departmentId?: string;
  siteId?: string;
  buildingId?: string;
  floorId?: string;
  roomId?: string;
  vendorId?: string;
  warrantyStatus?: string;
  daysThreshold?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface WarrantySummary {
  total: number;
  active: number;
  expired: number;
  expiringSoon: number;
  avgDaysRemaining: number;
}

export interface VendorWarranty {
  name: string;
  total: number;
  active: number;
  expired: number;
  expiringSoon: number;
}

const SORT_COLUMNS: Record<string, SQLWrapper> = {
  asset_code: assets.assetCode,
  asset_name: assets.assetName,
  warranty_end: assets.warrantyEnd,
  purchase_date: assets.purchaseDate,
  days_remaining: assets.warrantyEnd,
};

function buildWhere(filters: WarrantyFilters): SQL[] {
  const conditions: SQL[] = [sql`${assets.deletedAt} IS NULL`, sql`${assets.warrantyEnd} IS NOT NULL`];
  const threshold = filters.daysThreshold ?? 90;

  if (filters.warrantyStatus === 'EXPIRED') conditions.push(sql`${assets.warrantyEnd} < current_date`);
  else if (filters.warrantyStatus === 'EXPIRING_SOON') {
    conditions.push(sql`${assets.warrantyEnd} >= current_date AND ${assets.warrantyEnd} <= current_date + make_interval(days => ${threshold})`);
  } else if (filters.warrantyStatus === 'ACTIVE') {
    conditions.push(sql`${assets.warrantyEnd} > current_date + make_interval(days => ${threshold})`);
  }

  if (filters.keyword) {
    const p = `%${filters.keyword}%`;
    conditions.push(sql`(${assets.assetCode} ILIKE ${p} OR ${assets.assetName} ILIKE ${p} OR ${assets.serialNumber} ILIKE ${p})`);
  }
  if (filters.categoryId) conditions.push(eq(assets.categoryId, sql`${filters.categoryId}::uuid`));
  if (filters.categoryIds && filters.categoryIds.length > 0) {
    conditions.push(inArray(assets.categoryId, filters.categoryIds));
  }
  if (filters.departmentId) conditions.push(eq(assets.departmentId, sql`${filters.departmentId}::uuid`));
  if (filters.siteId) conditions.push(eq(assets.siteId, sql`${filters.siteId}::uuid`));
  if (filters.buildingId) conditions.push(eq(assets.buildingId, sql`${filters.buildingId}::uuid`));
  if (filters.floorId) conditions.push(eq(assets.floorId, sql`${filters.floorId}::uuid`));
  if (filters.roomId) conditions.push(eq(assets.roomId, sql`${filters.roomId}::uuid`));
  if (filters.vendorId) conditions.push(eq(assets.vendorId, sql`${filters.vendorId}::uuid`));

  return conditions;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function warrantyStatus(daysRemaining: number, threshold: number): string {
  if (daysRemaining < 0) return 'EXPIRED';
  if (daysRemaining <= threshold) return 'EXPIRING_SOON';
  return 'ACTIVE';
}

export async function warrantyReport(filters: WarrantyFilters) {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
  const offset = (page - 1) * limit;
  const threshold = filters.daysThreshold ?? 90;
  const where = and(...buildWhere(filters));

  const sortCol = SORT_COLUMNS[filters.sortBy ?? ''] ?? SORT_COLUMNS.warranty_end;
  const orderFn = filters.sortOrder === 'asc' ? asc : desc;

  const rows = await db
    .select({
      id: assets.id,
      assetCode: assets.assetCode,
      assetName: assets.assetName,
      serialNumber: assets.serialNumber,
      purchaseDate: assets.purchaseDate,
      warrantyStart: assets.warrantyStart,
      warrantyEnd: assets.warrantyEnd,
      category: assetCategories.name,
      brand: brands.name,
      department: departments.name,
      vendor: vendors.name,
      site: sites.name,
      building: buildings.name,
      floor: floors.name,
      room: rooms.name,
      pic: users.name,
    })
    .from(assets)
    .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
    .leftJoin(brands, eq(assets.brandId, brands.id))
    .leftJoin(departments, eq(assets.departmentId, departments.id))
    .leftJoin(vendors, eq(assets.vendorId, vendors.id))
    .leftJoin(sites, eq(assets.siteId, sites.id))
    .leftJoin(buildings, eq(assets.buildingId, buildings.id))
    .leftJoin(floors, eq(assets.floorId, floors.id))
    .leftJoin(rooms, eq(assets.roomId, rooms.id))
    .leftJoin(users, eq(assets.currentPicId, users.id))
    .where(where)
    .orderBy(orderFn(sortCol))
    .limit(limit)
    .offset(offset);

  const totalResult = await db.select({ value: count() }).from(assets).where(where);
  const total = Number(totalResult[0]?.value ?? 0);

  const today = new Date();
  const items = rows.map((row) => {
    const end = row.warrantyEnd as Date | string;
    const endDate = end instanceof Date ? end : new Date(String(end));
    const start = row.warrantyStart as Date | string;
    const daysRemaining = daysBetween(today, endDate);
    return {
      id: row.id,
      assetCode: row.assetCode,
      assetName: row.assetName,
      serialNumber: row.serialNumber,
      category: row.category,
      brand: row.brand,
      department: row.department,
      vendor: row.vendor,
      location: [row.site, row.building, row.floor, row.room].filter(Boolean).join(' / ') || null,
      pic: row.pic,
      purchaseDate: start,
      warrantyStart: row.warrantyStart,
      warrantyEnd: row.warrantyEnd,
      daysRemaining,
      status: warrantyStatus(daysRemaining, threshold),
    } as any;
  });

  const summary = await buildSummary(where, threshold);
  const byVendor = await buildVendorSummary(where, threshold);

  return {
    items,
    summary,
    analytics: { byVendor },
    meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPreviousPage: page > 1 },
  };
}

async function buildSummary(where: SQL | undefined, threshold: number): Promise<WarrantySummary> {
  const db = getDb();
  const rows = await db.execute(sql`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE ${assets.warrantyEnd} < current_date)::int AS expired,
      count(*) FILTER (WHERE ${assets.warrantyEnd} >= current_date AND ${assets.warrantyEnd} <= current_date + make_interval(days => ${threshold}))::int AS expiring_soon,
      count(*) FILTER (WHERE ${assets.warrantyEnd} > current_date + make_interval(days => ${threshold}))::int AS active,
      COALESCE(AVG(CASE WHEN ${assets.warrantyEnd} > current_date THEN ${assets.warrantyEnd} - current_date END), 0)::float AS avg_days
    FROM ${assets}
    WHERE ${where}
  `);
  const row = (rows as unknown as Record<string, unknown>[])[0];
  return {
    total: Number(row?.total ?? 0),
    active: Number(row?.active ?? 0),
    expired: Number(row?.expired ?? 0),
    expiringSoon: Number(row?.expiring_soon ?? 0),
    avgDaysRemaining: Math.round(Number(row?.avg_days ?? 0)),
  };
}

async function buildVendorSummary(where: SQL | undefined, threshold: number): Promise<VendorWarranty[]> {
  const db = getDb();
  const rows = await db.execute(sql`
    SELECT
      ${vendors.name} AS name,
      count(*)::int AS total,
      count(*) FILTER (WHERE ${assets.warrantyEnd} < current_date)::int AS expired,
      count(*) FILTER (WHERE ${assets.warrantyEnd} >= current_date AND ${assets.warrantyEnd} <= current_date + make_interval(days => ${threshold}))::int AS expiring_soon,
      count(*) FILTER (WHERE ${assets.warrantyEnd} > current_date + make_interval(days => ${threshold}))::int AS active
    FROM ${assets}
    LEFT JOIN ${vendors} ON ${vendors.id} = ${assets.vendorId}
    WHERE ${where}
    GROUP BY ${vendors.name}
    ORDER BY total DESC
  `);

  interface VendorRow {
    name: string | null;
    total: number;
    expired: number;
    expiring_soon: number;
    active: number;
  }

  return (rows as unknown as VendorRow[]).map((r) => ({
    name: r.name ?? 'Unassigned',
    total: Number(r.total ?? 0),
    expired: Number(r.expired ?? 0),
    expiringSoon: Number(r.expiring_soon ?? 0),
    active: Number(r.active ?? 0),
  }));
}
