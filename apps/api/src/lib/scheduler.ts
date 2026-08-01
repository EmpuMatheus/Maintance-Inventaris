import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import * as scheduleService from '@/modules/maintenance-schedules/schedule.service';
import * as reminderService from '@/modules/reminders/reminder.service';

let timer: NodeJS.Timeout | null = null;

async function run() {
  try {
    const generated = await scheduleService.processDueSchedules();
    if (generated > 0) logger.info({ generated }, 'Automatic maintenance generation completed');
  } catch (error) {
    logger.error({ error }, 'Automatic maintenance generation failed');
  }

  try {
    const created = await reminderService.generateReminders();
    if (created > 0) logger.info({ created }, 'Maintenance reminders generated');
  } catch (error) {
    logger.error({ error }, 'Maintenance reminder generation failed');
  }
}

/**
 * Starts the preventive-maintenance background processor. It runs once at
 * startup and then every `SCHEDULE_PROCESS_INTERVAL_MINUTES` minutes.
 */
export function startMaintenanceScheduler(): void {
  stopMaintenanceScheduler();
  const intervalMinutes = Math.max(1, env.SCHEDULE_PROCESS_INTERVAL_MINUTES);
  void run();
  timer = setInterval(() => void run(), intervalMinutes * 60 * 1000);
  logger.info({ intervalMinutes }, 'Maintenance scheduler started');
}

export function stopMaintenanceScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
