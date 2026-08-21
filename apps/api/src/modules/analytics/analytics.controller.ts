import type { Request, Response, NextFunction } from 'express';
import * as analyticsService from './analytics.service';
import { resolveAssetScope } from '@/middleware/scope';

function categoryScope(req: Request): string[] | undefined {
  const scope = resolveAssetScope(req.user);
  return scope.categoryIds?.length ? scope.categoryIds : undefined;
}

export async function dashboardController(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await analyticsService.getDashboard(categoryScope(req)) });
  } catch (error) {
    next(error);
  }
}

export async function healthController(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await analyticsService.getHealthAnalytics(categoryScope(req)) });
  } catch (error) {
    next(error);
  }
}

export async function replacementController(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await analyticsService.getReplacementAnalytics(categoryScope(req)) });
  } catch (error) {
    next(error);
  }
}

export async function failuresController(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await analyticsService.getFailureAnalytics(categoryScope(req)) });
  } catch (error) {
    next(error);
  }
}

export async function trendsController(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await analyticsService.getTrends(categoryScope(req)) });
  } catch (error) {
    next(error);
  }
}
