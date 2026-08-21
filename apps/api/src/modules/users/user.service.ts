import { AppError } from '@/middleware/error-handler';
import { hashPassword } from '@/lib/password';
import { sql } from 'drizzle-orm';
import * as repo from './user.repository';

const CATEGORY_REQUIRED_ROLES = ['ADMIN', 'TECHNICIAN'];
const CATEGORY_FORBIDDEN_ROLES = ['SUPER_ADMIN', 'USER'];

async function resolveRole(roleId?: string) {
  if (!roleId) throw new AppError(400, 'VALIDATION_ERROR', 'Role is required.');
  const role = await repo.findRoleById(roleId);
  if (!role) throw new AppError(400, 'VALIDATION_ERROR', 'Role is invalid.');
  return { id: role.id as string, name: role.name as string };
}

function validateCategoryForRole(roleName: string, categoryId: string | null | undefined) {
  if (CATEGORY_REQUIRED_ROLES.includes(roleName) && !categoryId) {
    throw new AppError(400, 'VALIDATION_ERROR', `${roleName} role requires an asset category.`);
  }
  if (CATEGORY_FORBIDDEN_ROLES.includes(roleName) && categoryId) {
    throw new AppError(400, 'VALIDATION_ERROR', `${roleName} role cannot have an asset category.`);
  }
}

export async function list(filters: repo.UserFilters) {
  return repo.findMany(filters);
}

export async function getById(id: string) {
  const user = await repo.findById(id);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');
  return user;
}

export async function create(body: Record<string, unknown>) {
  const role = await resolveRole(body.roleId as string);
  const categoryId = body.categoryId ? String(body.categoryId) : null;
  validateCategoryForRole(role.name, categoryId);

  const passwordHash = await hashPassword(String(body.password));
  try {
    const record = await repo.create({
      employeeCode: String(body.employeeCode),
      name: String(body.name),
      email: body.email ? String(body.email) : undefined,
      username: String(body.username),
      passwordHash,
      departmentId: body.departmentId ? sql`${body.departmentId as string}::uuid` : undefined,
      phone: body.phone ? String(body.phone) : undefined,
      position: body.position ? String(body.position) : undefined,
      isActive: true,
    });
    await repo.replaceRoles(record.id as string, [role.id]);
    await repo.replaceCategories(record.id as string, categoryId ? [categoryId] : []);
    return getById(record.id as string);
  } catch (err: any) {
    if (err?.code === '23505') throw new AppError(409, 'CONFLICT', 'Username, email, or employee code already exists.');
    throw err;
  }
}

export async function update(id: string, body: Record<string, unknown>) {
  const existing = await repo.findRawById(id);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'User not found.');
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = String(body.name);
  if (body.email !== undefined) data.email = body.email ? String(body.email) : null;
  if (body.phone !== undefined) data.phone = body.phone ? String(body.phone) : null;
  if (body.position !== undefined) data.position = body.position ? String(body.position) : null;
  if (body.departmentId !== undefined) {
    data.departmentId = body.departmentId ? sql`${body.departmentId as string}::uuid` : null;
  }

  if (body.roleId !== undefined) {
    const role = await resolveRole(body.roleId as string);
    const categoryId = body.categoryId ? String(body.categoryId) : null;
    validateCategoryForRole(role.name, categoryId);
    await repo.replaceRoles(id, [role.id]);
    await repo.replaceCategories(id, categoryId ? [categoryId] : []);
  }

  if (Object.keys(data).length === 0) return getById(id);
  try {
    await repo.update(id, data);
    return getById(id);
  } catch (err: any) {
    if (err?.code === '23505') throw new AppError(409, 'CONFLICT', 'Email already exists.');
    throw err;
  }
}

export async function softDelete(id: string) {
  const existing = await repo.findRawById(id);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'User not found.');
  await repo.softDelete(id);
  return { success: true };
}

export async function setActive(id: string, isActive: boolean) {
  const existing = await repo.findRawById(id);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'User not found.');
  await repo.setActive(id, isActive);
  return getById(id);
}

export async function setPassword(id: string, password: string) {
  const existing = await repo.findRawById(id);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'User not found.');
  const passwordHash = await hashPassword(password);
  await repo.setPassword(id, passwordHash);
  return { success: true };
}

export async function setRole(id: string, roleId: string, categoryId?: string | null) {
  const existing = await repo.findRawById(id);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'User not found.');
  const role = await resolveRole(roleId);
  const cat = categoryId || null;
  validateCategoryForRole(role.name, cat);
  await repo.replaceRoles(id, [role.id]);
  await repo.replaceCategories(id, cat ? [cat] : []);
  return getById(id);
}

export async function recordLogin(id: string) {
  await repo.touchLastLogin(id);
}

export { repo };
