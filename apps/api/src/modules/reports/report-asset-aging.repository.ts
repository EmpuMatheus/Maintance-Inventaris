import { getDb } from '@/database/client';
import {
  assets,
  assetCategories,
  brands,
  departments,
  sites,
  buildings,
  floors,
  rooms,
  users,
} from '@/database/schema';
import { eq, and, sql, desc, asc, inArray } from 'drizzle-orm';
import type { SQL, SQLWrapper } from 'drizzle-orm';

export interface AgingFilters {
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
  condition?: string;
  status?: string;
  ageBucket?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AgingSummary {
  total: number;
  lt1: number;
  y1_2: number;
  y2_3: number;
  y3_5: number;
  y5_10: number;
  gt10: number;
  unknown: number;
  replacementCandidates: number;
  avgAgeYears: number;
  oldestAgeYears: number;
}

export interface AgingBucket {
  name: string;
  value: number;
}

export interface CategoryAging {
  name: string;
  count: number;
  avgAgeYears: number;
}

const SORT_COLUMNS: Record<string, SQLWrapper> = {
  asset_code: assets.assetCode,
  asset_name: assets.assetName,
  purchase_date: assets.purchaseDate,
  age_years: assets.purchaseDate,
};

const DAY_MS = 24 * 60 * 60 * 1000;

function ageYears(purchaseDate: unknown, now: Date): number | null {
  if (!purchaseDate) return null;
  const d = purchaseDate instanceof Date ? purchaseDate : new Date(String(purchaseDate));
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / (365.25 * DAY_MS)));
}

function bucketOf(age: number | null): string {
  if (age == null) return 'Unknown';
  if (age < 1) return '< 1 year';
  if (age < 2) return '1-2 years';
  if (age < 3) return '2-3 years';
  if (age < 5) return '3-5 years';
  if (age < 10) return '5-10 years';
  return '> 10 years';
}

const BUCKETS = ['< 1 year', '1-2 years', '2-3 years', '3-5 years', '5-10 years', '> 10 years', 'Unknown'];

function isReplacementCandidate(age: number | null, condition: string): boolean {
  if (age == null) return false;
  if (age >= 8) return true;
  if (age >= 5 && ['BROKEN', 'CRITICAL', 'NEED_ATTENTION'].includes(condition)) return true;
  return false;
}

function buildWhere(filters: AgingFilters): SQL[] {
  const conditions: SQL[] = [sql`${assets.deletedAt} IS NULL`];
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
  if (filters.condition) conditions.push(eq(assets.condition, sql`${filters.condition}::varchar`));
  if (filters.status) conditions.push(eq(assets.status, sql`${filters.status}::varchar`));
  return conditions;
}

export async function assetAgingReport(filters: AgingFilters) {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
  const where = and(...buildWhere(filters));

  const sortCol = SORT_COLUMNS[filters.sortBy ?? ''] ?? SORT_COLUMNS.purchase_date;
  const orderFn = filters.sortOrder === 'asc' ? asc : desc;

  const rows = await db
    .select({
      id: assets.id,
      assetCode: assets.assetCode,
      assetName: assets.assetName,
      serialNumber: assets.serialNumber,
      condition: assets.condition,
      status: assets.status,
      purchaseDate: assets.purchaseDate,
      category: assetCategories.name,
      brand: brands.name,
      department: departments.name,
      site: sites.name,
      building: buildings.name,
      floor: floors.name,
      room: rooms.name,
      pic: users.name,
      createdAt: assets.createdAt,
    })
    .from(assets)
    .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
    .leftJoin(brands, eq(assets.brandId, brands.id))
    .leftJoin(departments, eq(assets.departmentId, departments.id))
    .leftJoin(sites, eq(assets.siteId, sites.id))
    .leftJoin(buildings, eq(assets.buildingId, buildings.id))
    .leftJoin(floors, eq(assets.floorId, floors.id))
    .leftJoin(rooms, eq(assets.roomId, rooms.id))
    .leftJoin(users, eq(assets.currentPicId, users.id))
    .where(where)
    .orderBy(orderFn(sortCol));

  const now = new Date();
  let enriched = rows.map((row) => {
    const age = ageYears(row.purchaseDate, now);
    return {
      id: row.id,
      assetCode: row.assetCode,
      assetName: row.assetName,
      serialNumber: row.serialNumber,
      condition: row.condition,
      status: row.status,
      purchaseDate: row.purchaseDate,
      ageYears: age,
      ageBucket: bucketOf(age),
      category: row.category,
      brand: row.brand,
      department: row.department,
      location: [row.site, row.building, row.floor, row.room].filter(Boolean).join(' / ') || null,
      pic: row.pic,
      replacementCandidate: isReplacementCandidate(age, row.condition),
      createdAt: row.createdAt,
    } as any;
  });

  if (filters.ageBucket) enriched = enriched.filter((item) => item.ageBucket === filters.ageBucket);

  const total = enriched.length;
  const offset = (page - 1) * limit;
  const items = enriched.slice(offset, offset + limit);

  const summary = buildSummary(enriched);
  const byCategory = buildCategoryAnalytics(enriched);

  return {
    items,
    summary,
    analytics: { byCategory, ...buildBuckets(enriched) },
    meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPreviousPage: page > 1 },
  };
}

function buildBuckets(enriched: any[]): { byAge: AgingBucket[] } {
  const map = new Map<string, number>(BUCKETS.map((b) => [b, 0]));
  for (const item of enriched) {
    map.set(item.ageBucket, (map.get(item.ageBucket) ?? 0) + 1);
  }
  return { byAge: BUCKETS.map((b) => ({ name: b, value: map.get(b) ?? 0 })) };
}

function buildSummary(enriched: any[]): AgingSummary {
  const counts = new Map<string, number>();
  let replacementCandidates = 0;
  let ageSum = 0;
  let ageCount = 0;
  let oldest = 0;

  for (const item of enriched) {
    counts.set(item.ageBucket, (counts.get(item.ageBucket) ?? 0) + 1);
    if (item.replacementCandidate) replacementCandidates += 1;
    if (item.ageYears != null) {
      ageSum += item.ageYears;
      ageCount += 1;
      if (item.ageYears > oldest) oldest = item.ageYears;
    }
  }

  return {
    total: enriched.length,
    lt1: counts.get('< 1 year') ?? 0,
    y1_2: counts.get('1-2 years') ?? 0,
    y2_3: counts.get('2-3 years') ?? 0,
    y3_5: counts.get('3-5 years') ?? 0,
    y5_10: counts.get('5-10 years') ?? 0,
    gt10: counts.get('> 10 years') ?? 0,
    unknown: counts.get('Unknown') ?? 0,
    replacementCandidates,
    avgAgeYears: ageCount > 0 ? Math.round((ageSum / ageCount) * 10) / 10 : 0,
    oldestAgeYears: oldest,
  };
}

function buildCategoryAnalytics(enriched: any[]): CategoryAging[] {
  const map = new Map<string, { count: number; ageSum: number; ageCount: number }>();
  for (const item of enriched) {
    const key = item.category ?? 'Unassigned';
    const entry = map.get(key) ?? { count: 0, ageSum: 0, ageCount: 0 };
    entry.count += 1;
    if (item.ageYears != null) {
      entry.ageSum += item.ageYears;
      entry.ageCount += 1;
    }
    map.set(key, entry);
  }
  return Array.from(map.entries())
    .map(([name, e]) => ({ name, count: e.count, avgAgeYears: e.ageCount > 0 ? Math.round((e.ageSum / e.ageCount) * 10) / 10 : 0 }))
    .sort((a, b) => b.count - a.count);
}
