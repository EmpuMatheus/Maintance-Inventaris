import type { Request, Response, NextFunction } from 'express';
import * as svc from './reminder.service';

export async function listController(req: Request, res: Response, next: NextFunction) {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const limit = req.query.limit !== undefined ? Number(req.query.limit) : undefined;
    const userId = req.query.mine === 'true' ? req.user?.id : undefined;
    const rows = await svc.listReminders({ status, userId, limit });
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
}

export async function markReadController(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await svc.markRead(req.params.id as string);
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
}

export async function generateController(_req: Request, res: Response, next: NextFunction) {
  try {
    const count = await svc.generateReminders();
    res.json({ success: true, data: { generated: count } });
  } catch (e) { next(e); }
}
