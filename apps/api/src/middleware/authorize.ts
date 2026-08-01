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
