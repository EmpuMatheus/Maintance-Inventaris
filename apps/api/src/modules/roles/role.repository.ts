import { getDb } from '@/database/client';
import { roles, permissions, rolePermissions, userRoles, users } from '@/database/schema';
import { eq, and, sql, asc, count, inArray } from 'drizzle-orm';

type Row = Record<string, unknown>;

export interface RoleListRow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  permissionCount: number;
  userCount: number;
  createdAt: string;
}

/** Maps a permission code to a UI permission group. */
export function permissionGroup(code: string): string {
  if (code.startsWith('asset.')) return 'Inventory';
  if (code.startsWith('master_data.')) return 'Master Data';
  if (code.startsWith('maintenance.')) return 'Maintenance';
  if (code.startsWith('ticket.')) return 'Ticket';
  if (code.startsWith('report.')) return 'Report';
  if (code.startsWith('audit.')) return 'Audit';
  if (code.startsWith('user.') || code.startsWith('role.')) return 'Administration';
  if (code.startsWith('notification.') || code.startsWith('settings.')) return 'System';
  return 'System';
}

export async function listRoles(): Promise<RoleListRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: roles.id,
      name: roles.name,
      description: roles.description,
      isActive: roles.isActive,
      permissionCount: count(rolePermissions.permissionId),
      createdAt: roles.createdAt,
    })
    .from(roles)
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .groupBy(roles.id)
    .orderBy(asc(roles.name));

  const ids = rows.map((r) => r.id);
  const userCountMap = await userCounts(ids);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.isActive ?? true,
    permissionCount: Number(row.permissionCount ?? 0),
    userCount: userCountMap.get(row.id) ?? 0,
    createdAt: String(row.createdAt),
  }));
}

export async function getRoleById(id: string) {
  const db = getDb();
  const rows = await db.select().from(roles).where(eq(roles.id, sql`${id}::uuid`)).limit(1);
  const row = rows[0] as Row | undefined;
  if (!row) return null;

  const [permissionRows, userRows] = await Promise.all([
    db
      .select({ id: permissions.id, code: permissions.code, name: permissions.name })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, sql`${id}::uuid`))
      .orderBy(asc(permissions.code)),
    db
      .select({ id: users.id, name: users.name, username: users.username })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(and(eq(userRoles.roleId, sql`${id}::uuid`), sql`${users.deletedAt} IS NULL`))
      .orderBy(asc(users.name)),
  ]);

  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | null,
    isActive: row.isActive as boolean,
    permissions: permissionRows.map((p) => ({ id: p.id, code: p.code, name: p.name, group: permissionGroup(p.code) })),
    users: userRows.map((u) => ({ id: u.id, name: u.name, username: u.username })),
    createdAt: row.createdAt,
  };
}

export async function listAllPermissions() {
  const db = getDb();
  const rows = await db.select({ id: permissions.id, code: permissions.code, name: permissions.name }).from(permissions).orderBy(asc(permissions.code));
  return rows.map((r) => ({ id: r.id, code: r.code, name: r.name, group: permissionGroup(r.code) }));
}

export async function findRawRoleById(id: string) {
  const db = getDb();
  const rows = await db.select().from(roles).where(eq(roles.id, sql`${id}::uuid`)).limit(1);
  return (rows as Row[])[0] ?? null;
}

export async function create(data: Record<string, unknown>) {
  const db = getDb();
  const rows = await db.insert(roles).values(data as any).returning();
  return (rows as Row[])[0] ?? null;
}

export async function update(id: string, data: Record<string, unknown>) {
  const db = getDb();
  const rows = await db.update(roles).set({ ...data, updatedAt: sql`now()` } as any).where(eq(roles.id, sql`${id}::uuid`)).returning();
  return (rows as Row[])[0] ?? null;
}

export async function deactivate(id: string) {
  const db = getDb();
  await db.update(roles).set({ isActive: false, updatedAt: sql`now()` }).where(eq(roles.id, sql`${id}::uuid`));
}

export async function replacePermissions(roleId: string, permissionIds: string[]) {
  const db = getDb();
  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, sql`${roleId}::uuid`));
  if (permissionIds.length > 0) {
    await db.insert(rolePermissions).values(permissionIds.map((permissionId) => ({ id: sql`gen_random_uuid()`, roleId: sql`${roleId}::uuid`, permissionId: sql`${permissionId}::uuid` })) as any);
  }
}

export async function replaceUsers(roleId: string, userIds: string[]) {
  const db = getDb();
  await db.delete(userRoles).where(eq(userRoles.roleId, sql`${roleId}::uuid`));
  if (userIds.length > 0) {
    await db.insert(userRoles).values(userIds.map((userId) => ({ id: sql`gen_random_uuid()`, roleId: sql`${roleId}::uuid`, userId: sql`${userId}::uuid` })) as any);
  }
}

export async function validatePermissions(permissionIds: string[]): Promise<boolean> {
  if (permissionIds.length === 0) return true;
  const db = getDb();
  const rows = await db.select({ id: permissions.id }).from(permissions).where(inArray(permissions.id, permissionIds));
  return rows.length === permissionIds.length;
}

export async function validateUsers(userIds: string[]): Promise<boolean> {
  if (userIds.length === 0) return true;
  const db = getDb();
  const rows = await db.select({ id: users.id }).from(users).where(and(inArray(users.id, userIds), sql`${users.deletedAt} IS NULL`));
  return rows.length === userIds.length;
}

async function userCounts(roleIds: string[]): Promise<Map<string, number>> {
  if (roleIds.length === 0) return new Map();
  const db = getDb();
  const rows = await db
    .select({ roleId: userRoles.roleId, value: count() })
    .from(userRoles)
    .where(inArray(userRoles.roleId, roleIds))
    .groupBy(userRoles.roleId);
  return new Map(rows.map((r) => [r.roleId, Number(r.value)]));
}
