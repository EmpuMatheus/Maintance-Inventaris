import type { Request, Response, NextFunction } from 'express';
import { AppError } from '@/middleware/error-handler';

export function authorize(...requiredPermissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    }

    const hasAll = requiredPermissions.every((perm) =>
      req.user!.permissions.includes(perm),
    );

    if (!hasAll) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action.');
    }

    next();
  };
}

/** Grants access if the user holds ANY of the given permissions. */
export function authorizeAny(...permissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    }

    const hasAny = permissions.some((perm) => req.user!.permissions.includes(perm));

    if (!hasAny) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action.');
    }

    next();
  };
}
