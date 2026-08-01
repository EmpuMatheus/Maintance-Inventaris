import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { AppError } from '@/middleware/error-handler';

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new AppError(422, 'VALIDATION_ERROR', 'Invalid request data.'));
      return;
    }
    req.body = result.data;
    next();
  };
}
