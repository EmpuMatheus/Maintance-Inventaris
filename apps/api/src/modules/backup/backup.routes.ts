import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { AppError } from '@/middleware/error-handler';
import {
  createDatabaseBackup,
  listDatabaseBackups,
  rotateDatabaseBackups,
} from '@/lib/backup/database';
import {
  createUploadBackup,
  listUploadBackups,
  rotateUploadBackups,
} from '@/lib/backup/uploads';

const router = Router();

const manage = [authenticate, authorize('backup.manage')];

function backupError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return new AppError(500, 'BACKUP_FAILED', error instanceof Error ? error.message : 'Backup failed.');
}

router.get('/backups', ...manage, (_req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        database: listDatabaseBackups(),
        uploads: listUploadBackups(),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/backups/database', ...manage, async (_req, res, next) => {
  try {
    const backup = await createDatabaseBackup();
    const removed = rotateDatabaseBackups();
    res.status(201).json({ success: true, data: { backup, removed } });
  } catch (error) {
    next(backupError(error));
  }
});

router.post('/backups/uploads', ...manage, async (_req, res, next) => {
  try {
    const backup = await createUploadBackup();
    const removed = rotateUploadBackups();
    res.status(201).json({ success: true, data: { backup, removed } });
  } catch (error) {
    next(backupError(error));
  }
});

export default router;
