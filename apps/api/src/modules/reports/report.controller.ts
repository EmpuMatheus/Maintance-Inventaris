import type { Request, Response, NextFunction } from 'express';
import * as svc from './report.service';

function qStr(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function qNum(v: unknown): number | undefined {
  return v !== undefined ? Number(v) : undefined;
}

export async function inventoryController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.inventoryReport({
      page: qNum(req.query.page),
      limit: qNum(req.query.limit),
      keyword: qStr(req.query.keyword),
      categoryId: qStr(req.query.categoryId),
      subcategoryId: qStr(req.query.subcategoryId),
      brandId: qStr(req.query.brandId),
      departmentId: qStr(req.query.departmentId),
      siteId: qStr(req.query.siteId),
      buildingId: qStr(req.query.buildingId),
      floorId: qStr(req.query.floorId),
      roomId: qStr(req.query.roomId),
      condition: qStr(req.query.condition),
      status: qStr(req.query.status),
      assignedTo: qStr(req.query.assignedTo),
      purchaseDateFrom: qStr(req.query.purchaseDateFrom),
      purchaseDateTo: qStr(req.query.purchaseDateTo),
      sortBy: qStr(req.query.sortBy),
      sortOrder: req.query.sortOrder === 'asc' ? 'asc' : 'desc',
    });
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}
