import type { Request, Response, NextFunction } from 'express';
import * as analyticsService from './analytics.service';

export async function dashboardController(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await analyticsService.getDashboard() });
  } catch (error) {
    next(error);
  }
}

export async function healthController(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await analyticsService.getHealthAnalytics() });
  } catch (error) {
    next(error);
  }
}

export async function replacementController(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await analyticsService.getReplacementAnalytics() });
  } catch (error) {
    next(error);
  }
}

export async function failuresController(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await analyticsService.getFailureAnalytics() });
  } catch (error) {
    next(error);
  }
}

export async function trendsController(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await analyticsService.getTrends() });
  } catch (error) {
    next(error);
  }
}
