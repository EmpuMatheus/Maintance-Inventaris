import type { Request, Response, NextFunction } from 'express';
import * as svc from './assignment.service';
import { auditFromRequest } from '@/modules/audit/audit.service';
import { resolveAssetScope } from '@/middleware/scope';

export async function assignController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.assign(req.params.id as string, req.body, req.user?.id, req.user?.name);
    auditFromRequest(req, {
      module: 'ASSIGNMENT',
      action: 'ASSIGN',
      entityType: 'asset',
      entityId: req.params.id as string,
      description: `Asset assigned to ${req.body.userId ?? 'user'}.`,
    });
    res.status(201).json({ success: true, data: result });
  } catch (error) { next(error); }
}

export async function returnController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.returnAsset(req.params.id as string, req.body, req.user?.id, req.user?.name);
    auditFromRequest(req, {
      module: 'ASSIGNMENT',
      action: 'UPDATE',
      entityType: 'asset',
      entityId: req.params.id as string,
      description: 'Asset returned.',
    });
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
}

export async function assignmentHistoryController(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = resolveAssetScope(req.user);
    const rows = await svc.getAssignmentHistory(req.params.id as string, scope);
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
}

export async function transferController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.transfer(req.params.id as string, req.body, req.user?.id, req.user?.name);
    auditFromRequest(req, {
      module: 'MOVEMENT',
      action: 'TRANSFER',
      entityType: 'asset',
      entityId: req.params.id as string,
      description: `Asset transferred to ${req.body.roomId ?? 'new location'}.`,
    });
    res.status(201).json({ success: true, data: result });
  } catch (error) { next(error); }
}

export async function movementHistoryController(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = resolveAssetScope(req.user);
    const rows = await svc.getMovementHistory(req.params.id as string, scope);
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
}
