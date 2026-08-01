import type { Request, Response, NextFunction } from 'express';
import * as service from './asset.service';
import { auditFromRequest } from '@/modules/audit/audit.service';

export async function listController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.list(req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function getByIdController(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await service.getById(req.params.id as string);
    res.json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
}

export async function getByCodeController(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await service.getByCode(req.params.assetCode as string);
    res.json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
}

export async function createController(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await service.create(req.body, req.user?.id);
    auditFromRequest(req, {
      module: 'INVENTORY',
      action: 'CREATE',
      entityType: 'asset',
      entityId: row.id as string,
      description: `Asset ${row.assetCode} created.`,
      newData: { assetCode: row.assetCode, assetName: row.assetName },
    });
    res.status(201).json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
}

export async function updateController(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await service.update(req.params.id as string, req.body, req.user?.id);
    auditFromRequest(req, {
      module: 'INVENTORY',
      action: 'UPDATE',
      entityType: 'asset',
      entityId: req.params.id as string,
      description: `Asset ${row.assetCode} updated.`,
      newData: { assetCode: row.assetCode, assetName: row.assetName },
    });
    res.json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
}

export async function updateConditionController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.updateCondition(req.params.id as string, req.body, req.user?.id, req.user?.name);
    auditFromRequest(req, {
      module: 'INVENTORY',
      action: 'UPDATE',
      entityType: 'asset',
      entityId: req.params.id as string,
      description: `Asset condition changed to ${result.newCondition}.`,
      newData: { newCondition: result.newCondition, reason: req.body.reason },
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getConditionHistoryController(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await service.getConditionHistory(req.params.id as string);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}
