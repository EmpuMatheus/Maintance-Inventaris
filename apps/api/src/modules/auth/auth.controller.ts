import type { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { recordAudit } from '@/modules/audit/audit.service';
import { touchLastLogin } from '@/modules/users/user.repository';

export async function loginController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { username, password } = req.body;
    const result = await authService.login(username, password);

    void touchLastLogin(result.user.id);
    recordAudit({
      module: 'AUTH',
      action: 'LOGIN',
      entityType: 'user',
      entityId: result.user.id,
      description: `User ${username} logged in.`,
      performedBy: result.user.id,
      performedByName: result.user.name,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      requestId: (req as { id?: string }).id ?? (req.headers['x-request-id'] as string | undefined),
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function meController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await authService.getCurrentUser(req.user!.id);
    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
}
