import type { Request, Response, NextFunction } from 'express';
import * as svc from './dashboard.service';
import { resolveAssetScope } from '@/middleware/scope';

function scopeFor(req: Request) {
  return resolveAssetScope(req.user);
}

export async function summaryController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getSummary(req.user?.id, scopeFor(req));
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function mySummaryController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getMySummary(req.user!.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function maintenanceStatsController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getMaintenanceStats(scopeFor(req));
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function upcomingSchedulesController(req: Request, res: Response, next: NextFunction) {
  try {
    const days = req.query.days !== undefined ? Number(req.query.days) : 365;
    const assetId = typeof req.query.assetId === 'string' ? req.query.assetId : undefined;
    const typeId = typeof req.query.typeId === 'string' ? req.query.typeId : undefined;
    const limit = req.query.limit !== undefined ? Number(req.query.limit) : 10;
    const result = await svc.getUpcomingSchedules({ days, assetId, typeId, limit }, scopeFor(req));
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

export async function criticalAssetsController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getCriticalAssets(scopeFor(req));
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function assetStatsController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getAssetStats(scopeFor(req));
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function conditionAnalyticsController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getConditionAnalytics(scopeFor(req));
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function assetAgeController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getAssetAgeAnalytics(scopeFor(req));
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function departmentAnalyticsController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getDepartmentAnalytics(scopeFor(req));
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function vendorAnalyticsController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getVendorAnalytics(scopeFor(req));
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function recentActivityController(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = req.query.limit !== undefined ? Number(req.query.limit) : 3;
    const data = await svc.getRecentActivity(limit, scopeFor(req));
    res.json({ success: true, data });
  } catch (e) { next(e); }
}
