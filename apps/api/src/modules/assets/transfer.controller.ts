import type { Request, Response, NextFunction } from 'express';
import * as svc from './transfer.service';
import { auditFromRequest } from '@/modules/audit/audit.service';
import { resolveAssetScope } from '@/middleware/scope';

export async function activeTransferController(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = resolveAssetScope(req.user);
    const transfer = await svc.getActiveTransfer(req.params.id as string, scope);
    res.json({ success: true, data: transfer });
  } catch (error) { next(error); }
}

export async function latestTransferController(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = resolveAssetScope(req.user);
    const transfer = await svc.getLatestTransfer(req.params.id as string, scope);
    res.json({ success: true, data: transfer });
  } catch (error) { next(error); }
}

export async function receiverContextController(req: Request, res: Response, next: NextFunction) {
  try {
    const context = await svc.getReceiverContext(req.params.userId as string);
    res.json({ success: true, data: context });
  } catch (error) { next(error); }
}

export async function createTransferController(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = resolveAssetScope(req.user);
    const fileUrl = req.file ? `/uploads/documents/${req.file.filename}` : undefined;
    const result = await svc.createTransfer(req.params.id as string, req.body, fileUrl, req.user?.id, scope);
    auditFromRequest(req, {
      module: 'MOVEMENT',
      action: 'CREATE',
      entityType: 'asset_transfer',
      entityId: (result as any).id ?? (req.params.id as string),
      description: 'Transfer created for asset.',
    });
    res.status(201).json({ success: true, data: result });
  } catch (error) { next(error); }
}

export async function confirmTransferController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.confirmTransfer(req.params.transferId as string, req.user?.id);
    auditFromRequest(req, {
      module: 'MOVEMENT',
      action: 'COMPLETE',
      entityType: 'asset_transfer',
      entityId: req.params.transferId as string,
      description: (result as any).completed ? 'Transfer completed.' : 'Transfer confirmation recorded.',
    });
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
}

export async function rejectTransferController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.rejectTransfer(req.params.transferId as string, req.user?.id, req.body?.reason);
    auditFromRequest(req, {
      module: 'MOVEMENT',
      action: 'REJECT',
      entityType: 'asset_transfer',
      entityId: req.params.transferId as string,
      description: `Transfer rejected: ${req.body?.reason ?? ''}`,
    });
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
}

export async function cancelTransferController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.cancelTransfer(req.params.transferId as string, req.user?.id);
    auditFromRequest(req, {
      module: 'MOVEMENT',
      action: 'CANCEL',
      entityType: 'asset_transfer',
      entityId: req.params.transferId as string,
      description: 'Transfer cancelled.',
    });
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
}

export async function transferByIdController(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = resolveAssetScope(req.user);
    const transfer = await svc.getTransferById(req.params.transferId as string, scope);
    res.json({ success: true, data: transfer });
  } catch (error) { next(error); }
}
