import type { Request, Response, NextFunction } from 'express';
import * as svc from './schedule.service';
import { auditFromRequest } from '@/modules/audit/audit.service';

function qStr(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function qNum(v: unknown): number | undefined {
  return v !== undefined ? Number(v) : undefined;
}

function dueParams(req: Request) {
  return {
    days: qNum(req.query.days),
    page: qNum(req.query.page),
    limit: qNum(req.query.limit),
    assetId: qStr(req.query.assetId),
    typeId: qStr(req.query.typeId),
  };
}

export async function listController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.list({
      page: qNum(req.query.page),
      limit: qNum(req.query.limit),
      search: qStr(req.query.search),
      assetId: qStr(req.query.assetId),
      typeId: qStr(req.query.typeId),
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
    });
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

export async function getByIdController(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await svc.getById(req.params.id as string);
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
}

export async function createController(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await svc.create(req.body, req.user?.id);
    auditFromRequest(req, {
      module: 'SCHEDULE',
      action: 'CREATE',
      entityType: 'schedule',
      entityId: row.id as string,
      description: `Maintenance schedule created for asset ${req.body.assetId ?? ''}.`,
      newData: { frequencyType: req.body.frequencyType, frequencyValue: req.body.frequencyValue },
    });
    res.status(201).json({ success: true, data: row });
  } catch (e) { next(e); }
}

export async function updateController(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await svc.update(req.params.id as string, req.body);
    auditFromRequest(req, {
      module: 'SCHEDULE',
      action: 'UPDATE',
      entityType: 'schedule',
      entityId: req.params.id as string,
      description: 'Maintenance schedule updated.',
      newData: { frequencyType: req.body.frequencyType, frequencyValue: req.body.frequencyValue },
    });
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
}

export async function setStatusController(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await svc.setActive(req.params.id as string, req.body.isActive as boolean);
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
}

export async function upcomingController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.upcoming(dueParams(req));
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

export async function dueTodayController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.dueToday(dueParams(req));
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

export async function overdueController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.overdue(dueParams(req));
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

export async function completedController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.completed(dueParams(req));
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

export async function processDueController(_req: Request, res: Response, next: NextFunction) {
  try {
    const count = await svc.processDueSchedules();
    res.json({ success: true, data: { processed: count } });
  } catch (e) { next(e); }
}
