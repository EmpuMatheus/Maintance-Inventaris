import type { Request, Response, NextFunction } from 'express';
import * as svc from './user.service';
import { auditFromRequest } from '@/modules/audit/audit.service';

function qStr(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function qNum(v: unknown): number | undefined {
  return v !== undefined ? Number(v) : undefined;
}

export async function listController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.list({
      page: qNum(req.query.page),
      limit: qNum(req.query.limit),
      search: qStr(req.query.search),
      departmentId: qStr(req.query.departmentId),
      role: qStr(req.query.role),
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
      sortBy: qStr(req.query.sortBy),
      sortOrder: req.query.sortOrder === 'asc' ? 'asc' : 'desc',
    });
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

export async function getByIdController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getById(req.params.id as string);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.create(req.body);
    auditFromRequest(req, {
      module: 'USER',
      action: 'CREATE',
      entityType: 'user',
      entityId: data.id,
      description: `User ${data.username} created.`,
      newData: { username: data.username, name: data.name, roles: data.roles, categoryId: data.categoryIds?.[0] ?? null },
    });
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
}

export async function updateController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.update(req.params.id as string, req.body);
    auditFromRequest(req, {
      module: 'USER',
      action: 'UPDATE',
      entityType: 'user',
      entityId: data.id,
      description: `User ${data.username} updated.`,
      newData: { name: data.name, email: data.email, position: data.position },
    });
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function deleteController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await svc.softDelete(id);
    auditFromRequest(req, {
      module: 'USER',
      action: 'DELETE',
      entityType: 'user',
      entityId: id,
      description: `User ${id} deleted.`,
    });
    res.json({ success: true, data: { success: true } });
  } catch (e) { next(e); }
}

export async function statusController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.setActive(req.params.id as string, req.body.isActive as boolean);
    auditFromRequest(req, {
      module: 'USER',
      action: 'UPDATE',
      entityType: 'user',
      entityId: data.id,
      description: `User ${data.username} ${req.body.isActive ? 'activated' : 'deactivated'}.`,
      newData: { isActive: req.body.isActive },
    });
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function passwordController(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.setPassword(req.params.id as string, req.body.password as string);
    auditFromRequest(req, {
      module: 'USER',
      action: 'UPDATE',
      entityType: 'user',
      entityId: req.params.id as string,
      description: `Password reset for user ${req.params.id}.`,
    });
    res.json({ success: true, data: { success: true } });
  } catch (e) { next(e); }
}

export async function rolesController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.setRole(req.params.id as string, req.body.roleId as string, req.body.categoryId as string | null | undefined);
    auditFromRequest(req, {
      module: 'USER',
      action: 'ASSIGN',
      entityType: 'user',
      entityId: data.id,
      description: `Role updated for user ${data.username}.`,
      newData: { roles: data.roles, categoryId: data.categoryIds?.[0] ?? null },
    });
    res.json({ success: true, data });
  } catch (e) { next(e); }
}
