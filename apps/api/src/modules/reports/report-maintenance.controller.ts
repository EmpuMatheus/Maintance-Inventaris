import type { Request, Response, NextFunction } from 'express';
import * as svc from './report-maintenance.service';
import { scopeCategoryIds } from './report-scope';

function qStr(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function qNum(v: unknown): number | undefined {
  return v !== undefined ? Number(v) : undefined;
}

export async function maintenanceController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.maintenanceReport({
      page: qNum(req.query.page),
      limit: qNum(req.query.limit),
      keyword: qStr(req.query.keyword),
      maintenanceTypeId: qStr(req.query.maintenanceTypeId),
      assetId: qStr(req.query.assetId),
      assetCategoryId: qStr(req.query.assetCategoryId),
      categoryIds: scopeCategoryIds(req),
      priority: qStr(req.query.priority),
      status: qStr(req.query.status),
      technicianId: qStr(req.query.technicianId),
      vendorId: qStr(req.query.vendorId),
      departmentId: qStr(req.query.departmentId),
      siteId: qStr(req.query.siteId),
      buildingId: qStr(req.query.buildingId),
      floorId: qStr(req.query.floorId),
      roomId: qStr(req.query.roomId),
      startDate: qStr(req.query.startDate),
      endDate: qStr(req.query.endDate),
      sortBy: qStr(req.query.sortBy),
      sortOrder: req.query.sortOrder === 'asc' ? 'asc' : 'desc',
    });
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}
