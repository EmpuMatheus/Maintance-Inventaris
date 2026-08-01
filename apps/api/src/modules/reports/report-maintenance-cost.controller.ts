import type { Request, Response, NextFunction } from 'express';
import * as svc from './report-maintenance-cost.service';

function qStr(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function qNum(v: unknown): number | undefined {
  return v !== undefined ? Number(v) : undefined;
}

export async function maintenanceCostController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.maintenanceCostReport({
      page: qNum(req.query.page),
      limit: qNum(req.query.limit),
      keyword: qStr(req.query.keyword),
      assetId: qStr(req.query.assetId),
      categoryId: qStr(req.query.categoryId),
      departmentId: qStr(req.query.departmentId),
      vendorId: qStr(req.query.vendorId),
      maintenanceTypeId: qStr(req.query.maintenanceTypeId),
      technicianId: qStr(req.query.technicianId),
      priority: qStr(req.query.priority),
      status: qStr(req.query.status),
      startDate: qStr(req.query.startDate),
      endDate: qStr(req.query.endDate),
      siteId: qStr(req.query.siteId),
      buildingId: qStr(req.query.buildingId),
      floorId: qStr(req.query.floorId),
      roomId: qStr(req.query.roomId),
      sortBy: qStr(req.query.sortBy),
      sortOrder: req.query.sortOrder === 'asc' ? 'asc' : 'desc',
    });
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}
