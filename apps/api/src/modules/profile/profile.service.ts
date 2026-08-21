import { AppError } from '@/middleware/error-handler';
import { hashPassword, verifyPassword } from '@/lib/password';
import * as userRepo from '@/modules/users/user.repository';
import * as authRepo from '@/modules/auth/auth.repository';

export async function getProfile(userId: string) {
  const user = await userRepo.findById(userId);
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
  const permissions = await authRepo.getUserPermissions(userId);
  return { ...user, permissions };
}

export async function updateProfile(userId: string, body: Record<string, unknown>) {
  const existing = await userRepo.findRawById(userId);
  if (!existing) throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = String(body.name);
  if (body.email !== undefined) data.email = body.email ? String(body.email) : null;
  if (body.phone !== undefined) data.phone = body.phone ? String(body.phone) : null;
  if (body.position !== undefined) data.position = body.position ? String(body.position) : null;
  if (Object.keys(data).length === 0) return getProfile(userId);

  try {
    await userRepo.update(userId, data);
    return getProfile(userId);
  } catch (err: any) {
    if (err?.code === '23505') throw new AppError(409, 'CONFLICT', 'Email already exists.');
    throw err;
  }
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await authRepo.findUserById(userId);
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
  if (!user.passwordHash) throw new AppError(400, 'VALIDATION_ERROR', 'Password cannot be changed.');

  const valid = await verifyPassword(user.passwordHash, currentPassword);
  if (!valid) throw new AppError(400, 'VALIDATION_ERROR', 'Current password is incorrect.');

  const passwordHash = await hashPassword(newPassword);
  await userRepo.setPassword(userId, passwordHash);
  return { success: true };
}
