import { Router } from 'express';
import { getDb } from '@/database/client';
import { sql } from 'drizzle-orm';
import { buildRuntimeMetrics } from './metrics';

const router = Router();

/** Basic liveness/health summary. */
router.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

/** Liveness: the process is up and serving requests. */
router.get('/health/live', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
});

/** Readiness: the process can serve traffic (database reachable). */
router.get('/health/ready', async (_req, res) => {
  try {
    await getDb().execute(sql`SELECT 1`);
    res.json({
      success: true,
      data: { status: 'ready', database: 'connected' },
    });
  } catch {
    res.status(503).json({
      success: false,
      error: { code: 'NOT_READY', message: 'Service is not ready: database unavailable.' },
    });
  }
});

/** Runtime metrics for monitoring dashboards. */
router.get('/metrics', (_req, res) => {
  res.json({ success: true, data: buildRuntimeMetrics() });
});

export default router;
