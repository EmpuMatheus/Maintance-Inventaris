import type { Request, Response, NextFunction } from 'express';
import * as svc from './profile.service';

export async function getProfileController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getProfile(req.user!.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function updateProfileController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.updateProfile(req.user!.id, req.body);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function changePasswordController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.changePassword(req.user!.id, req.body.currentPassword as string, req.body.newPassword as string);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}
