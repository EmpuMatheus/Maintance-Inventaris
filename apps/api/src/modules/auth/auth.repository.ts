import { getDb } from '@/database/client';
import { users, roles, userRoles, permissions, rolePermissions } from '@/database/schema';
import { eq, sql } from 'drizzle-orm';

export interface UserRow {
  id: string;
  username: string;
  name: string;
  employeeCode: string | null;
  email: string | null;
  passwordHash: string | null;
  isActive: boolean;
}

export async function findUserByUsername(username: string): Promise<UserRow | undefined> {
  const db = getDb();
  const result = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      employeeCode: users.employeeCode,
      email: users.email,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return result[0];
}

export async function findUserById(id: string): Promise<UserRow | undefined> {
  const db = getDb();
  const result = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      employeeCode: users.employeeCode,
      email: users.email,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, sql`${id}::uuid`))
    .limit(1);
  return result[0];
}

export async function getUserRoles(userId: string): Promise<string[]> {
  const db = getDb();
  const result = await db
    .select({ roleName: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, sql`${userId}::uuid`));
  return result.map((r) => r.roleName);
}

export async function getUserPermissions(userId: string): Promise<string[]> {
  const db = getDb();
  const result = await db
    .select({ permissionCode: permissions.code })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(userRoles.userId, sql`${userId}::uuid`));
  const codes = result.map((r) => r.permissionCode);
  return [...new Set(codes)];
}
