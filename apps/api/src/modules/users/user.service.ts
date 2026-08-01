import { AppError } from '@/middleware/error-handler';
import { hashPassword } from '@/lib/password';
import { sql } from 'drizzle-orm';
import * as repo from './user.repository';

export async function list(filters: repo.UserFilters) {
  return repo.findMany(filters);
}

export async function getById(id: string) {
  const user = await repo.findById(id);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');
  return user;
}

export async function create(body: Record<string, unknown>) {
  if (!(await repo.validateRoles((body.roles as string[]) ?? []))) {
    throw new AppError(400, 'VALIDATION_ERROR', 'One or more roles are invalid.');
  }
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
    await repo.replaceRoles(record.id as string, (body.roles as string[]) ?? []);
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

export async function setRoles(id: string, roleIds: string[]) {
  const existing = await repo.findRawById(id);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'User not found.');
  if (!(await repo.validateRoles(roleIds))) {
    throw new AppError(400, 'VALIDATION_ERROR', 'One or more roles are invalid.');
  }
  await repo.replaceRoles(id, roleIds);
  return getById(id);
}

export async function recordLogin(id: string) {
  await repo.touchLastLogin(id);
}

export { repo };
