import type { Request, Response, NextFunction } from 'express';
import * as svc from './maintenance.service';
import { auditFromRequest } from '@/modules/audit/audit.service';

export async function listController(req: Request, res: Response, next: NextFunction) {
  try { const r = await svc.list(req.query); res.json({ success: true, ...r }); } catch (e) { next(e); }
}
export async function getByIdController(req: Request, res: Response, next: NextFunction) {
  try { const r = await svc.getById(req.params.id as string); res.json({ success: true, data: r }); } catch (e) { next(e); }
}
export async function getByCodeController(req: Request, res: Response, next: NextFunction) {
  try { const r = await svc.getByCode(req.params.code as string); res.json({ success: true, data: r }); } catch (e) { next(e); }
}
export async function createController(req: Request, res: Response, next: NextFunction) {
  try { const r = await svc.create(req.body, req.user?.id); res.status(201).json({ success: true, data: r }); } catch (e) { next(e); }
}
export async function assignController(req: Request, res: Response, next: NextFunction) {
  try { const r = await svc.assign(req.params.id as string, req.body, req.user?.id); res.json({ success: true, data: r }); } catch (e) { next(e); }
}
export async function startController(req: Request, res: Response, next: NextFunction) {
  try { const r = await svc.start(req.params.id as string); res.json({ success: true, data: r }); } catch (e) { next(e); }
}
export async function waitingPartController(req: Request, res: Response, next: NextFunction) {
  try { const r = await svc.waitingPart(req.params.id as string, req.body); res.json({ success: true, data: r }); } catch (e) { next(e); }
}
export async function testingController(req: Request, res: Response, next: NextFunction) {
  try { const r = await svc.testing(req.params.id as string); res.json({ success: true, data: r }); } catch (e) { next(e); }
}
export async function completeController(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await svc.complete(req.params.id as string, req.body, req.user?.id);
    auditFromRequest(req, {
      module: 'MAINTENANCE',
      action: 'COMPLETE',
      entityType: 'maintenance',
      entityId: req.params.id as string,
      description: `Maintenance ${r.maintenanceCode} completed.`,
      newData: { status: r.status, condition: req.body.condition },
    });
    res.json({ success: true, data: r });
  } catch (e) { next(e); }
}
export async function cancelController(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await svc.cancel(req.params.id as string, req.body);
    auditFromRequest(req, {
      module: 'MAINTENANCE',
      action: 'CANCEL',
      entityType: 'maintenance',
      entityId: req.params.id as string,
      description: `Maintenance ${r.maintenanceCode} cancelled.`,
      newData: { status: r.status },
    });
    res.json({ success: true, data: r });
  } catch (e) { next(e); }
}
export async function addPartController(req: Request, res: Response, next: NextFunction) {
  try { const r = await svc.addPart(req.params.id as string, req.body); res.status(201).json({ success: true, data: r }); } catch (e) { next(e); }
}
export async function deletePartController(req: Request, res: Response, next: NextFunction) {
  try { await svc.deletePart(req.params.id as string, req.params.partId as string); res.json({ success: true, data: null }); } catch (e) { next(e); }
}
export async function getPartsController(req: Request, res: Response, next: NextFunction) {
  try { const r = await svc.repo.getParts(req.params.id as string); res.json({ success: true, data: r }); } catch (e) { next(e); }
}
export async function getDocumentsController(req: Request, res: Response, next: NextFunction) {
  try { const r = await svc.repo.getDocuments(req.params.id as string); res.json({ success: true, data: r }); } catch (e) { next(e); }
}
