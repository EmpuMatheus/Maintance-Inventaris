import type { Request, Response, NextFunction } from 'express';
import * as svc from './network-device.service';
import { auditFromRequest } from '@/modules/audit/audit.service';

function qStr(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function qNum(v: unknown): number | undefined {
  return v !== undefined && v !== '' ? Number(v) : undefined;
}

function qBool(v: unknown): boolean | undefined {
  if (v === undefined || v === '') return undefined;
  return v === 'true';
}

export async function listController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.list({
      page: qNum(req.query.page),
      limit: qNum(req.query.limit),
      search: qStr(req.query.search),
      deviceType: qStr(req.query.deviceType),
      status: qStr(req.query.status),
      roomId: qStr(req.query.roomId),
      isActive: qBool(req.query.isActive),
    });
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

export async function getByIdController(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await svc.getById(req.params.id as string);
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
}

export async function createController(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await svc.create(req.body);
    auditFromRequest(req, {
      module: 'INVENTORY',
      action: 'CREATE',
      entityType: 'network_device',
      entityId: row.id as string,
      description: `Network device ${row.name} created.`,
      newData: { name: row.name, deviceType: row.deviceType, ipAddress: row.ipAddress, roomId: row.roomId, isActive: row.isActive },
    });
    res.status(201).json({ success: true, data: row });
  } catch (e) { next(e); }
}

export async function updateController(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await svc.update(req.params.id as string, req.body);
    auditFromRequest(req, {
      module: 'INVENTORY',
      action: 'UPDATE',
      entityType: 'network_device',
      entityId: req.params.id as string,
      description: `Network device ${row.name} updated.`,
      newData: { name: row.name, deviceType: row.deviceType, ipAddress: row.ipAddress, roomId: row.roomId },
    });
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
}

export async function setStatusController(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await svc.setActive(req.params.id as string, req.body.isActive as boolean);
    auditFromRequest(req, {
      module: 'INVENTORY',
      action: 'UPDATE',
      entityType: 'network_device',
      entityId: req.params.id as string,
      description: `Network device ${row.name} ${row.isActive ? 'activated' : 'deactivated'}.`,
      newData: { isActive: row.isActive },
    });
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
}