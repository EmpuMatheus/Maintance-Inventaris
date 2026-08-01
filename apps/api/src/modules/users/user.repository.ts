import { getDb } from '@/database/client';
import { users, departments, roles, userRoles } from '@/database/schema';
import { eq, and, sql, desc, asc, count, like, inArray } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export interface UserFilters {
  page?: number;
  limit?: number;
  search?: string;
  departmentId?: string;
  role?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

type Row = Record<string, unknown>;

export async function findMany(filters: UserFilters) {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
  const offset = (page - 1) * limit;
  const conditions: SQL[] = [sql`${users.deletedAt} IS NULL`];

  if (filters.search) {
    const p = `%${filters.search}%`;
    conditions.push(sql`(${like(users.username, p)} OR ${like(users.name, p)} OR ${like(users.email, p)} OR ${like(users.employeeCode, p)})`);
  }
  if (filters.departmentId) conditions.push(eq(users.departmentId, sql`${filters.departmentId}::uuid`));
  if (filters.isActive !== undefined) conditions.push(eq(users.isActive, filters.isActive));

  const where = conditions.length ? and(...conditions) : undefined;
  const sortCol = filters.sortBy === 'name' ? users.name : filters.sortBy === 'employeeCode' ? users.employeeCode : users.createdAt;
  const orderFn = filters.sortOrder === 'asc' ? asc : desc;

  const rows = await db
    .select({
      id: users.id,
      employeeCode: users.employeeCode,
      name: users.name,
      email: users.email,
      username: users.username,
      departmentId: users.departmentId,
      departmentName: departments.name,
      phone: users.phone,
      position: users.position,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(where)
    .orderBy(orderFn(sortCol))
    .limit(limit)
    .offset(offset);

  const totalResult = await db.select({ value: count() }).from(users).where(where);
  const total = Number(totalResult[0]?.value ?? 0);

  const roleMap = await rolesForUsers(rows.map((r) => r.id));

  const data = rows.map((row) => ({
    id: row.id,
    employeeCode: row.employeeCode,
    name: row.name,
    email: row.email,
    username: row.username,
    departmentId: row.departmentId,
    department: row.departmentName,
    phone: row.phone,
    position: row.position,
    isActive: row.isActive,
    lastLoginAt: row.lastLoginAt,
    roles: roleMap.get(row.id) ?? [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPreviousPage: page > 1 },
  };
}

export async function findById(id: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      employeeCode: users.employeeCode,
      name: users.name,
      email: users.email,
      username: users.username,
      passwordHash: users.passwordHash,
      departmentId: users.departmentId,
      departmentName: departments.name,
      phone: users.phone,
      position: users.position,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdBy: users.createdBy,
      updatedBy: users.updatedBy,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(and(eq(users.id, sql`${id}::uuid`), sql`${users.deletedAt} IS NULL`))
    .limit(1);

  const row = rows[0] as Row | undefined;
  if (!row) return null;

  const roleMap = await rolesForUsers([row.id as string]);
  return {
    id: row.id as string,
    employeeCode: row.employeeCode as string,
    name: row.name as string,
    email: row.email as string | null,
    username: row.username as string,
    departmentId: row.departmentId as string | null,
    department: row.departmentName as string | null,
    phone: row.phone as string | null,
    position: row.position as string | null,
    isActive: row.isActive as boolean,
    lastLoginAt: row.lastLoginAt as Date | null,
    roles: roleMap.get(row.id as string) ?? [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function findRawById(id: string) {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.id, sql`${id}::uuid`)).limit(1);
  return (rows as Row[])[0] ?? null;
}

export async function create(data: Record<string, unknown>) {
  const db = getDb();
  const rows = await db.insert(users).values(data as any).returning();
  return (rows as Row[])[0] ?? null;
}

export async function update(id: string, data: Record<string, unknown>) {
  const db = getDb();
  const rows = await db.update(users).set({ ...data, updatedAt: sql`now()` } as any).where(eq(users.id, sql`${id}::uuid`)).returning();
  return (rows as Row[])[0] ?? null;
}

export async function softDelete(id: string) {
  const db = getDb();
  await db.update(users).set({ deletedAt: sql`now()`, isActive: false, updatedAt: sql`now()` }).where(eq(users.id, sql`${id}::uuid`));
}

export async function setActive(id: string, isActive: boolean) {
  const db = getDb();
  const rows = await db.update(users).set({ isActive, updatedAt: sql`now()` }).where(eq(users.id, sql`${id}::uuid`)).returning();
  return (rows as Row[])[0] ?? null;
}

export async function setPassword(id: string, passwordHash: string) {
  const db = getDb();
  const rows = await db.update(users).set({ passwordHash, updatedAt: sql`now()` }).where(eq(users.id, sql`${id}::uuid`)).returning();
  return (rows as Row[])[0] ?? null;
}

export async function touchLastLogin(id: string) {
  const db = getDb();
  await db.update(users).set({ lastLoginAt: sql`now()` }).where(eq(users.id, sql`${id}::uuid`));
}

export async function replaceRoles(userId: string, roleIds: string[]) {
  const db = getDb();
  await db.delete(userRoles).where(eq(userRoles.userId, sql`${userId}::uuid`));
  if (roleIds.length > 0) {
    await db.insert(userRoles).values(roleIds.map((roleId) => ({ id: sql`gen_random_uuid()`, userId: sql`${userId}::uuid`, roleId: sql`${roleId}::uuid` })) as any);
  }
}

export async function validateRoles(roleIds: string[]): Promise<boolean> {
  if (roleIds.length === 0) return true;
  const db = getDb();
  const rows = await db.select({ id: roles.id }).from(roles).where(inArray(roles.id, roleIds));
  return rows.length === roleIds.length;
}

async function rolesForUsers(userIds: string[]): Promise<Map<string, string[]>> {
  if (userIds.length === 0) return new Map();
  const db = getDb();
  const rows = await db
    .select({ userId: userRoles.userId, roleName: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(inArray(userRoles.userId, userIds));

  const map = new Map<string, string[]>();
  for (const r of rows) {
    const list = map.get(r.userId) ?? [];
    list.push(r.roleName);
    map.set(r.userId, list);
  }
  return map;
}
