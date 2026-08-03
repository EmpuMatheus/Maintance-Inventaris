import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import path from 'path';
import { existsSync } from 'fs';
import { env } from '@/config/env';
import { corsOptions } from '@/config/cors';
import { accessLogger } from '@/lib/logger';
import { errorHandler, notFoundHandler } from '@/middleware/error-handler';
import { redirectHttpToHttps } from '@/middleware/redirect-to-https';
import healthRoutes from '@/modules/health/health.routes';
import authRoutes from '@/modules/auth/auth.routes';
import masterDataRoutes from '@/modules/master-data/master-data.routes';
import assetRoutes from '@/modules/assets/asset.routes';
import qrRoutes from '@/modules/qr/qr.routes';
import maintenanceRoutes from '@/modules/maintenance/maintenance.routes';
import scheduleRoutes from '@/modules/maintenance-schedules/schedule.routes';
import reminderRoutes from '@/modules/reminders/reminder.routes';
import dashboardRoutes from '@/modules/dashboard/dashboard.routes';
import ticketRoutes from '@/modules/tickets/ticket.routes';
import notificationRoutes from '@/modules/notifications/notification.routes';
import reportRoutes from '@/modules/reports/report.routes';
import auditRoutes from '@/modules/audit/audit.routes';
import userRoutes from '@/modules/users/user.routes';
import roleRoutes from '@/modules/roles/role.routes';
import backupRoutes from '@/modules/backup/backup.routes';
import analyticsRoutes from '@/modules/analytics/analytics.routes';

const app = express();

// Reverse proxy: honour X-Forwarded-For/Proto/Host when running behind a proxy.
app.set('trust proxy', env.trustProxy);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

if (env.httpsEnabled) {
  app.use(redirectHttpToHttps);
}

app.use(cors(corsOptions));
app.use('/uploads', express.static(path.join(env.storageRoot, 'uploads')));
app.use(express.json({ limit: env.REQUEST_BODY_LIMIT }));
app.use(
  pinoHttp({
    logger: accessLogger,
    autoLogging: {
      ignore: (req) => (req.url ?? '').includes('/health'),
    },
  }),
);

// Health endpoints exposed at the root and under the API prefix.
app.use('/', healthRoutes);
app.use(env.API_PREFIX, healthRoutes);
app.use(env.API_PREFIX, authRoutes);
app.use(`${env.API_PREFIX}/master`, masterDataRoutes);
app.use(`${env.API_PREFIX}/assets`, assetRoutes);
app.use(`${env.API_PREFIX}/qr`, qrRoutes);
app.use(`${env.API_PREFIX}/maintenance`, maintenanceRoutes);
app.use(`${env.API_PREFIX}/tickets`, ticketRoutes);
app.use(`${env.API_PREFIX}/maintenance-schedules`, scheduleRoutes);
app.use(`${env.API_PREFIX}/reminders`, reminderRoutes);
app.use(`${env.API_PREFIX}/dashboard`, dashboardRoutes);
app.use(`${env.API_PREFIX}/notifications`, notificationRoutes);
app.use(`${env.API_PREFIX}/reports`, reportRoutes);
app.use(`${env.API_PREFIX}/audit`, auditRoutes);
app.use(`${env.API_PREFIX}/users`, userRoutes);
app.use(`${env.API_PREFIX}/roles`, roleRoutes);
app.use(env.API_PREFIX, backupRoutes);
app.use(env.API_PREFIX, analyticsRoutes);

// Single-origin SPA serving (desktop launcher / standalone deployments).
// When SERVE_SPA_DIR points at a built React SPA, serve it from the same
// origin as the API so the frontend can use relative /api URLs.
const spaDir = env.SERVE_SPA_DIR;
if (spaDir && existsSync(spaDir)) {
  app.use(express.static(spaDir, { index: 'index.html' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      next();
      return;
    }
    res.sendFile(path.join(spaDir, 'index.html'));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
