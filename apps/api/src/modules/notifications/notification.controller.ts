import type { Request, Response, NextFunction } from 'express';
import * as svc from './notification.service';

function qStr(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function qNum(v: unknown): number | undefined {
  return v !== undefined ? Number(v) : undefined;
}

export async function listController(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const result = await svc.list(userId, {
      page: qNum(req.query.page),
      limit: qNum(req.query.limit),
      search: qStr(req.query.search),
      type: qStr(req.query.type),
      priority: qStr(req.query.priority),
      unreadOnly: req.query.unread === 'true',
      archived: req.query.archived === 'true',
    });
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

export async function unreadCountController(req: Request, res: Response, next: NextFunction) {
  try {
    const count = await svc.unreadCount(req.user!.id);
    res.json({ success: true, data: { count } });
  } catch (e) { next(e); }
}

export async function markReadController(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await svc.markRead(req.user!.id, req.params.id as string);
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
}

export async function markAllReadController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.markAllRead(req.user!.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function archiveController(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await svc.archive(req.user!.id, req.params.id as string);
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
}

export async function deleteController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.remove(req.user!.id, req.params.id as string);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function getSettingsController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getSettings(req.user!.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function updateSettingsController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.updateSettings(req.user!.id, req.body);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}
