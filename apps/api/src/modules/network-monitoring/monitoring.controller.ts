import type { Request, Response, NextFunction } from 'express';
import * as svc from './monitoring.service';

function qStr(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}
function qNum(v: unknown): number | undefined {
  return v !== undefined && v !== '' ? Number(v) : undefined;
}

/**
 * Recovery endpoint. The frontend calls this on initial load and after every
 * Socket.IO (re)connect so it can rebuild current monitoring state from the
 * backend source of truth.
 */
export async function getStatusController(_req: Request, res: Response, next: NextFunction) {
  try {
    const devices = await svc.getStatus();
    res.json({ success: true, data: { devices } });
  } catch (e) { next(e); }
}

export async function getSummaryController(_req: Request, res: Response, next: NextFunction) {
  try {
    const summary = await svc.getSummary();
    res.json({ success: true, data: summary });
  } catch (e) { next(e); }
}

/** Connection history / timeline (paginated, with filters). */
export async function getEventsController(req: Request, res: Response, next: NextFunction) {
  try {
    const from = qStr(req.query.from);
    const to = qStr(req.query.to);
    const result = await svc.getEvents({
      page: qNum(req.query.page),
      limit: qNum(req.query.limit),
      deviceId: qStr(req.query.deviceId),
      roomId: qStr(req.query.roomId),
      deviceType: qStr(req.query.deviceType),
      status: qStr(req.query.status),
      search: qStr(req.query.search),
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

/** Active (unresolved) incidents. */
export async function getActiveIncidentsController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getActiveIncidents();
    res.json({ success: true, data });
  } catch (e) { next(e); }
}