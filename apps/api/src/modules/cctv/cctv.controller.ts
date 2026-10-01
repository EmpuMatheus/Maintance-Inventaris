import type { Request, Response, NextFunction } from 'express';
import * as svc from './cctv.service';
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

/* ------------------------------- Devices ------------------------------- */

export async function listController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.list({
      page: qNum(req.query.page),
      limit: qNum(req.query.limit),
      search: qStr(req.query.search),
      deviceType: qStr(req.query.deviceType),
      status: qStr(req.query.status),
      isActive: qBool(req.query.isActive),
    });
    res.json({ success: true, ...result });
  } catch (e) {
    next(e);
  }
}

export async function getByIdController(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await svc.getById(req.params.id as string);
    res.json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
}

export async function createController(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await svc.create(req.body);
    // Password is intentionally excluded from the audit payload.
    auditFromRequest(req, {
      module: 'CCTV',
      action: 'CREATE',
      entityType: 'cctv_device',
      entityId: row.id as string,
      description: `CCTV device ${row.name} created.`,
      newData: {
        name: row.name,
        deviceType: row.deviceType,
        ipAddress: row.ipAddress,
        port: row.port,
        isActive: row.isActive,
      },
    });
    res.status(201).json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
}

export async function updateController(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await svc.update(req.params.id as string, req.body);
    auditFromRequest(req, {
      module: 'CCTV',
      action: 'UPDATE',
      entityType: 'cctv_device',
      entityId: req.params.id as string,
      description: `CCTV device ${row.name} updated.`,
      newData: {
        name: row.name,
        deviceType: row.deviceType,
        ipAddress: row.ipAddress,
        port: row.port,
      },
    });
    res.json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
}

export async function setStatusController(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await svc.setActive(req.params.id as string, req.body.isActive as boolean);
    auditFromRequest(req, {
      module: 'CCTV',
      action: 'UPDATE',
      entityType: 'cctv_device',
      entityId: req.params.id as string,
      description: `CCTV device ${row.name} ${row.isActive ? 'activated' : 'deactivated'}.`,
      newData: { isActive: row.isActive },
    });
    res.json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
}

export async function testConnectionController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.testConnection(req.params.id as string);
    auditFromRequest(req, {
      module: 'CCTV',
      action: 'UPDATE',
      entityType: 'cctv_device',
      entityId: req.params.id as string,
      description: `Test connection for CCTV device: ${result.success ? 'success' : result.errorMessage}.`,
      newData: { success: result.success, errorCode: result.errorCode },
    });
    res.json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
}

export async function testRtspController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.testRtspConnection(req.params.id as string, {
      channel: req.body?.channel,
      includeMain: req.body?.includeMain,
    });
    auditFromRequest(req, {
      module: 'CCTV',
      action: 'UPDATE',
      entityType: 'cctv_device',
      entityId: req.params.id as string,
      description: `Test RTSP connection for CCTV device: ${result.success ? 'success' : result.errorMessage}.`,
      newData: {
        success: result.success,
        channel: result.channel,
        stream: result.stream,
        errorCode: result.errorCode,
      },
    });
    res.json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
}

export async function syncController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.syncChannels(req.params.id as string);
    auditFromRequest(req, {
      module: 'CCTV',
      action: 'UPDATE',
      entityType: 'cctv_device',
      entityId: req.params.id as string,
      description: `Synced channels for CCTV device (${result.channels.total} channels, ${result.profiles} profiles).`,
      newData: { channels: result.channels, profiles: result.profiles },
    });
    res.json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
}

/* ------------------------------- Channels ------------------------------ */

export async function listChannelsController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.listChannels({
      page: qNum(req.query.page),
      limit: qNum(req.query.limit),
      deviceId: qStr(req.query.deviceId),
      status: qStr(req.query.status),
      search: qStr(req.query.search),
      isActive: qBool(req.query.isActive),
    });
    res.json({ success: true, ...result });
  } catch (e) {
    next(e);
  }
}

export async function getChannelController(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await svc.getChannelById(req.params.id as string);
    res.json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
}

/**
 * All active channels across every device, flattened for the Monitor grid.
 * Lives under `/devices/monitor/channels` so it does not collide with
 * `/devices/:id` (Express matches in registration order; the specific route is
 * registered first).
 */
export async function listMonitorChannelsController(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.listMonitorChannels();
    res.json({ success: true, ...result });
  } catch (e) {
    next(e);
  }
}

export async function updateChannelController(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await svc.updateChannel(req.params.id as string, req.body);
    auditFromRequest(req, {
      module: 'CCTV',
      action: 'UPDATE',
      entityType: 'cctv_channel',
      entityId: req.params.id as string,
      description: `CCTV channel ${row.name} updated.`,
      newData: {
        name: row.name,
        location: row.location,
        isActive: row.isActive,
      },
    });
    res.json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
}
