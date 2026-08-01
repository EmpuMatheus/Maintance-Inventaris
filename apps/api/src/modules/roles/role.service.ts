import { AppError } from '@/middleware/error-handler';
import * as repo from './role.repository';

export async function list() {
  return repo.listRoles();
}

export async function getById(id: string) {
  const role = await repo.getRoleById(id);
  if (!role) throw new AppError(404, 'NOT_FOUND', 'Role not found.');
  return role;
}

export async function permissions() {
  return repo.listAllPermissions();
}

export async function create(body: Record<string, unknown>) {
  const permissionsList = (body.permissions as string[]) ?? [];
  if (!(await repo.validatePermissions(permissionsList))) {
    throw new AppError(400, 'VALIDATION_ERROR', 'One or more permissions are invalid.');
  }
  try {
    const record = await repo.create({
      name: String(body.name),
      description: body.description ? String(body.description) : undefined,
      isActive: true,
    });
    await repo.replacePermissions(record.id as string, permissionsList);
    return getById(record.id as string);
  } catch (err: any) {
    if (err?.code === '23505') throw new AppError(409, 'CONFLICT', 'Role name already exists.');
    throw err;
  }
}

export async function update(id: string, body: Record<string, unknown>) {
  const existing = await repo.findRawRoleById(id);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Role not found.');
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = String(body.name);
  if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
  if (Object.keys(data).length > 0) {
    try {
      await repo.update(id, data);
    } catch (err: any) {
      if (err?.code === '23505') throw new AppError(409, 'CONFLICT', 'Role name already exists.');
      throw err;
    }
  }
  return getById(id);
}

export async function remove(id: string) {
  const existing = await repo.findRawRoleById(id);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Role not found.');
  await repo.deactivate(id);
  return { success: true };
}

export async function setPermissions(id: string, permissionIds: string[]) {
  const existing = await repo.findRawRoleById(id);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Role not found.');
  if (!(await repo.validatePermissions(permissionIds))) {
    throw new AppError(400, 'VALIDATION_ERROR', 'One or more permissions are invalid.');
  }
  await repo.replacePermissions(id, permissionIds);
  return getById(id);
}

export async function setUsers(id: string, userIds: string[]) {
  const existing = await repo.findRawRoleById(id);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Role not found.');
  if (!(await repo.validateUsers(userIds))) {
    throw new AppError(400, 'VALIDATION_ERROR', 'One or more users are invalid.');
  }
  await repo.replaceUsers(id, userIds);
  return getById(id);
}

export { repo };
