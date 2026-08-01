import app from './app';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { startMaintenanceScheduler } from '@/lib/scheduler';
import { setupNotificationConsumer } from '@/modules/notifications/notification.service';

setupNotificationConsumer();

app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, prefix: env.API_PREFIX, corsOrigin: env.CORS_ORIGIN },
    `Server started`,
  );
  startMaintenanceScheduler();
});
