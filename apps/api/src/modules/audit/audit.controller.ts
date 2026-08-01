import type { Request, Response, NextFunction } from 'express';
import * as svc from './audit.service';

function qStr(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function qNum(v: unknown): number | undefined {
  return v !== undefined ? Number(v) : undefined;
}

export async function listController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.list({
      page: qNum(req.query.page),
      limit: qNum(req.query.limit),
      search: qStr(req.query.search),
      module: qStr(req.query.module),
      action: qStr(req.query.action),
      entityType: qStr(req.query.entity),
      performedBy: qStr(req.query.performedBy),
      dateFrom: qStr(req.query.dateFrom),
      dateTo: qStr(req.query.dateTo),
      sortBy: qStr(req.query.sortBy),
      sortOrder: req.query.sortOrder === 'asc' ? 'asc' : 'desc',
    });
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

export async function getByIdController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getById(req.params.id as string);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function modulesController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.modules();
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function actionsController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.actions();
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function summaryController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.summary();
    res.json({ success: true, data });
  } catch (e) { next(e); }
}
