import type { Request, Response, NextFunction } from 'express';
import { AppError } from '@/middleware/error-handler';
import { verifyToken } from '@/lib/jwt';
import * as repo from '@/modules/auth/auth.repository';

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    }

    const token = authHeader.slice(7);

    let payload: { sub: string };
    try {
      payload = verifyToken(token);
    } catch {
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token.');
    }

    const user = await repo.findUserById(payload.sub);
    if (!user || !user.isActive) {
      throw new AppError(401, 'UNAUTHORIZED', 'User not found or inactive.');
    }

    const roles = await repo.getUserRoles(user.id);
    const permissions = await repo.getUserPermissions(user.id);
    const categoryIds = await repo.getUserCategories(user.id);

    req.user = {
      id: user.id,
      username: user.username,
      name: user.name,
      roles,
      permissions,
      categoryIds,
    };

    next();
  } catch (error) {
    next(error);
  }
}
