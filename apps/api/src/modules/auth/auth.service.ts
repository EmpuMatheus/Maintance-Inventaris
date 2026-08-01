import { AppError } from '@/middleware/error-handler';
import { hashPassword, verifyPassword } from '@/lib/password';
import { signToken } from '@/lib/jwt';
import * as repo from './auth.repository';

export interface LoginResult {
  accessToken: string;
  user: {
    id: string;
    username: string;
    name: string;
    roles: string[];
    permissions: string[];
  };
}

export interface CurrentUserResult {
  id: string;
  username: string;
  name: string;
  employeeCode: string | null;
  email: string | null;
  roles: string[];
  permissions: string[];
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const user = await repo.findUserByUsername(username);

  if (!user || !user.passwordHash) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid username or password.');
  }

  if (!user.isActive) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid username or password.');
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid username or password.');
  }

  const roles = await repo.getUserRoles(user.id);
  const permissions = await repo.getUserPermissions(user.id);

  const accessToken = signToken({ sub: user.id });

  return {
    accessToken,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      roles,
      permissions,
    },
  };
}

export async function getCurrentUser(userId: string): Promise<CurrentUserResult> {
  const user = await repo.findUserById(userId);

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  const roles = await repo.getUserRoles(user.id);
  const permissions = await repo.getUserPermissions(user.id);

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    employeeCode: user.employeeCode,
    email: user.email,
    roles,
    permissions,
  };
}

export async function createDevAdminUser(
  username: string,
  password: string,
  name: string,
): Promise<void> {
  const db = (await import('@/database/client')).getDb();
  const { users: usersTable, userRoles: userRolesTable, roles: rolesTable } = await import('@/database/schema');
  const { eq } = await import('drizzle-orm');

  const existing = await repo.findUserByUsername(username);
  if (existing) {
    return;
  }

  const hashed = await hashPassword(password);
  const { sql } = await import('drizzle-orm');

  await db.insert(usersTable).values({
    id: sql`gen_random_uuid()`,
    employeeCode: username,
    name,
    username,
    passwordHash: hashed,
    isActive: true,
  });

  const created = await repo.findUserByUsername(username);
  if (!created) return;

  const roleRows = await db
    .select({ id: rolesTable.id })
    .from(rolesTable)
    .where(eq(rolesTable.name, 'SUPER_ADMIN'))
    .limit(1);

  if (roleRows[0]) {
    await db.insert(userRolesTable).values({
      id: sql`gen_random_uuid()`,
      userId: sql`${created.id}::uuid`,
      roleId: sql`${roleRows[0].id}::uuid`,
    });
  }
}
