import type { Request, Response, NextFunction } from 'express';
import * as svc from './ticket.service';
import type { TicketScope } from './ticket.repository';
import { auditFromRequest } from '@/modules/audit/audit.service';

function scopeFor(user?: Request['user']): TicketScope | undefined {
  if (!user) return undefined;
  if (user.roles.includes('SUPER_ADMIN')) return undefined;
  if (user.roles.includes('ADMIN') || user.roles.includes('TECHNICIAN')) {
    return { categoryIds: user.categoryIds ?? [] };
  }
  return { userId: user.id };
}

function qStr(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function qNum(v: unknown): number | undefined {
  return v !== undefined ? Number(v) : undefined;
}

function listParams(req: Request) {
  return {
    page: qNum(req.query.page),
    limit: qNum(req.query.limit),
    search: qStr(req.query.search),
    status: qStr(req.query.status),
    priority: qStr(req.query.priority),
    category: qStr(req.query.category),
    assetId: qStr(req.query.assetId),
    reporterId: qStr(req.query.reporterId),
    assignedTo: qStr(req.query.assignedTo),
    departmentId: qStr(req.query.departmentId),
    dateFrom: qStr(req.query.dateFrom),
    dateTo: qStr(req.query.dateTo),
  };
}

export async function listController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.list(listParams(req), scopeFor(req.user));
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

export async function getByIdController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getById(req.params.id as string, req.user);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function getByCodeController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getByCode(req.params.code as string, req.user);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.create(req.body, req.user);
    auditFromRequest(req, {
      module: 'TICKET',
      action: 'CREATE',
      entityType: 'ticket',
      entityId: data.id as string,
      description: `Ticket ${data.ticketCode} created.`,
      newData: { ticketCode: data.ticketCode, title: data.title },
    });
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
}

export async function updateController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.update(req.params.id as string, req.body, req.user?.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function assignController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.assign(req.params.id as string, req.body.technicianId as string, req.body.notes, req.user?.id);
    auditFromRequest(req, {
      module: 'TICKET',
      action: 'ASSIGN',
      entityType: 'ticket',
      entityId: req.params.id as string,
      description: `Ticket ${data?.ticketCode ?? ''} assigned to technician.`,
    });
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function startController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.start(req.params.id as string, req.user?.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function holdController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.hold(req.params.id as string, req.user?.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function resumeController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.resume(req.params.id as string, req.user?.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function resolveController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.resolve(req.params.id as string, req.body.resolution as string, req.user?.id);
    auditFromRequest(req, {
      module: 'TICKET',
      action: 'UPDATE',
      entityType: 'ticket',
      entityId: req.params.id as string,
      description: `Ticket ${data?.ticketCode ?? ''} resolved.`,
    });
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function closeController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.close(req.params.id as string, req.user?.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function cancelController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.cancel(req.params.id as string, req.body.reason as string, req.user?.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function getCommentsController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getComments(req.params.id as string, req.user);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function addCommentController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.addComment(req.params.id as string, req.body.comment as string, req.body.isInternal === true, req.user);
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
}

export async function getAssignmentsController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getAssignments(req.params.id as string, req.user);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createMaintenanceController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.createMaintenanceFromTicket(req.params.id as string, req.body, req.user);
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
}
