import type { Request, Response, NextFunction } from 'express';
import * as brokenSvc from './report-broken-asset.service';
import * as movementSvc from './report-movement.service';
import * as warrantySvc from './report-warranty.service';
import * as agingSvc from './report-asset-aging.service';

function qStr(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function qNum(v: unknown): number | undefined {
  return v !== undefined ? Number(v) : undefined;
}

export async function brokenAssetController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await brokenSvc.brokenAssetReport({
      page: qNum(req.query.page),
      limit: qNum(req.query.limit),
      keyword: qStr(req.query.keyword),
      categoryId: qStr(req.query.categoryId),
      departmentId: qStr(req.query.departmentId),
      siteId: qStr(req.query.siteId),
      buildingId: qStr(req.query.buildingId),
      floorId: qStr(req.query.floorId),
      roomId: qStr(req.query.roomId),
      condition: qStr(req.query.condition),
      status: qStr(req.query.status),
      assignedTo: qStr(req.query.assignedTo),
    });
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

export async function movementController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await movementSvc.movementReport({
      page: qNum(req.query.page),
      limit: qNum(req.query.limit),
      keyword: qStr(req.query.keyword),
      assetId: qStr(req.query.assetId),
      departmentId: qStr(req.query.departmentId),
      siteId: qStr(req.query.siteId),
      buildingId: qStr(req.query.buildingId),
      floorId: qStr(req.query.floorId),
      roomId: qStr(req.query.roomId),
      dateFrom: qStr(req.query.dateFrom),
      dateTo: qStr(req.query.dateTo),
      sortBy: qStr(req.query.sortBy),
      sortOrder: req.query.sortOrder === 'asc' ? 'asc' : 'desc',
    });
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

export async function warrantyController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await warrantySvc.warrantyReport({
      page: qNum(req.query.page),
      limit: qNum(req.query.limit),
      keyword: qStr(req.query.keyword),
      categoryId: qStr(req.query.categoryId),
      departmentId: qStr(req.query.departmentId),
      siteId: qStr(req.query.siteId),
      buildingId: qStr(req.query.buildingId),
      floorId: qStr(req.query.floorId),
      roomId: qStr(req.query.roomId),
      vendorId: qStr(req.query.vendorId),
      warrantyStatus: qStr(req.query.warrantyStatus),
      daysThreshold: qNum(req.query.daysThreshold),
      sortBy: qStr(req.query.sortBy),
      sortOrder: req.query.sortOrder === 'asc' ? 'asc' : 'desc',
    });
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

export async function assetAgingController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await agingSvc.assetAgingReport({
      page: qNum(req.query.page),
      limit: qNum(req.query.limit),
      keyword: qStr(req.query.keyword),
      categoryId: qStr(req.query.categoryId),
      departmentId: qStr(req.query.departmentId),
      siteId: qStr(req.query.siteId),
      buildingId: qStr(req.query.buildingId),
      floorId: qStr(req.query.floorId),
      roomId: qStr(req.query.roomId),
      condition: qStr(req.query.condition),
      status: qStr(req.query.status),
      ageBucket: qStr(req.query.ageBucket),
      sortBy: qStr(req.query.sortBy),
      sortOrder: req.query.sortOrder === 'asc' ? 'asc' : 'desc',
    });
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}
