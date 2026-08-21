import type { Request, Response, NextFunction } from 'express';
import * as svc from './report-asset-condition.service';
import { scopeCategoryIds } from './report-scope';

function qStr(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function qNum(v: unknown): number | undefined {
  return v !== undefined ? Number(v) : undefined;
}

export async function assetConditionController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.assetConditionReport({
      page: qNum(req.query.page),
      limit: qNum(req.query.limit),
      keyword: qStr(req.query.keyword),
      categoryId: qStr(req.query.categoryId),
      categoryIds: scopeCategoryIds(req),
      departmentId: qStr(req.query.departmentId),
      siteId: qStr(req.query.siteId),
      buildingId: qStr(req.query.buildingId),
      floorId: qStr(req.query.floorId),
      roomId: qStr(req.query.roomId),
      condition: qStr(req.query.condition),
      status: qStr(req.query.status),
      assignedTo: qStr(req.query.assignedTo),
      sortBy: qStr(req.query.sortBy),
      sortOrder: req.query.sortOrder === 'asc' ? 'asc' : 'desc',
    });
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}
