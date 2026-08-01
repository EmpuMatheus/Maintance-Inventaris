import type { Request, Response, NextFunction } from 'express';
import * as svc from './dashboard.service';

export async function summaryController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getSummary(req.user?.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function maintenanceStatsController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getMaintenanceStats();
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function upcomingSchedulesController(req: Request, res: Response, next: NextFunction) {
  try {
    const days = req.query.days !== undefined ? Number(req.query.days) : 365;
    const assetId = typeof req.query.assetId === 'string' ? req.query.assetId : undefined;
    const typeId = typeof req.query.typeId === 'string' ? req.query.typeId : undefined;
    const limit = req.query.limit !== undefined ? Number(req.query.limit) : 10;
    const result = await svc.getUpcomingSchedules({ days, assetId, typeId, limit });
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

export async function criticalAssetsController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getCriticalAssets();
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function assetStatsController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getAssetStats();
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function conditionAnalyticsController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getConditionAnalytics();
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function assetAgeController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getAssetAgeAnalytics();
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function departmentAnalyticsController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getDepartmentAnalytics();
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function vendorAnalyticsController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getVendorAnalytics();
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function recentActivityController(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = req.query.limit !== undefined ? Number(req.query.limit) : 20;
    const data = await svc.getRecentActivity(limit);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}
