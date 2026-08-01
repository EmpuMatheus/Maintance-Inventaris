import type { Request, Response, NextFunction } from 'express';
import * as svc from './role.service';
import { auditFromRequest } from '@/modules/audit/audit.service';

export async function listController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.list();
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function permissionsController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.permissions();
    res.json({ success: true, data });
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
      module: 'ROLE',
      action: 'CREATE',
      entityType: 'role',
      entityId: data.id,
      description: `Role ${data.name} created.`,
      newData: { name: data.name, permissions: data.permissions.map((p) => p.code) },
    });
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
}

export async function updateController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.update(req.params.id as string, req.body);
    auditFromRequest(req, {
      module: 'ROLE',
      action: 'UPDATE',
      entityType: 'role',
      entityId: data.id,
      description: `Role ${data.name} updated.`,
      newData: { name: data.name },
    });
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function deleteController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await svc.remove(id);
    auditFromRequest(req, {
      module: 'ROLE',
      action: 'DELETE',
      entityType: 'role',
      entityId: id,
      description: `Role ${id} deactivated.`,
    });
    res.json({ success: true, data: { success: true } });
  } catch (e) { next(e); }
}

export async function permissionsAssignController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.setPermissions(req.params.id as string, req.body.permissions as string[]);
    auditFromRequest(req, {
      module: 'ROLE',
      action: 'ASSIGN',
      entityType: 'role',
      entityId: data.id,
      description: `Permissions updated for role ${data.name}.`,
      newData: { permissions: data.permissions.map((p) => p.code) },
    });
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function usersAssignController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.setUsers(req.params.id as string, req.body.userIds as string[]);
    auditFromRequest(req, {
      module: 'ROLE',
      action: 'ASSIGN',
      entityType: 'role',
      entityId: data.id,
      description: `Members updated for role ${data.name}.`,
      newData: { users: data.users.map((u) => u.username) },
    });
    res.json({ success: true, data });
  } catch (e) { next(e); }
}
