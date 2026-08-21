import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { getDb } from '@/database/client';
import { assets, sites, users } from '@/database/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { AppError } from '@/middleware/error-handler';
import { resolveAssetScope } from '@/middleware/scope';

const router = Router();

const read = [authenticate, authorize('asset.read')];

function scopeCategoryIds(user: { categoryIds?: string[]; roles: string[] }): string[] | undefined {
  const scope = resolveAssetScope(user as never);
  return scope.categoryIds?.length ? scope.categoryIds : undefined;
}

router.get('/assets/:id/qr', ...read, async (req, res, next) => {
  try {
    const db = getDb();
    const categoryIds = scopeCategoryIds(req.user as never);
    const rows = await db
      .select({ assetCode: assets.assetCode })
      .from(assets)
      .where(
        and(
          eq(assets.id, sql`${req.params.id as string}::uuid`),
          sql`${assets.deletedAt} IS NULL`,
          categoryIds?.length ? inArray(assets.categoryId, categoryIds) : undefined,
        ),
      )
      .limit(1);
    if (!rows.length) throw new AppError(404, 'NOT_FOUND', 'Asset not found.');
    res.json({ success: true, data: { assetCode: rows[0].assetCode, qrValue: rows[0].assetCode } });
  } catch (error) {
    next(error);
  }
});

router.get('/assets/:assetCode', ...read, async (req, res, next) => {
  try {
    const db = getDb();
    const categoryIds = scopeCategoryIds(req.user as never);
    const rows = await db
      .select({
        id: assets.id,
        assetCode: assets.assetCode,
        assetName: assets.assetName,
        condition: assets.condition,
        status: assets.status,
        siteName: sites.name,
        siteCode: sites.code,
        picName: users.name,
      })
      .from(assets)
      .leftJoin(sites, eq(assets.siteId, sites.id))
      .leftJoin(users, eq(assets.currentPicId, users.id))
      .where(
        and(
          eq(assets.assetCode, req.params.assetCode as string),
          sql`${assets.deletedAt} IS NULL`,
          categoryIds?.length ? inArray(assets.categoryId, categoryIds) : undefined,
        ),
      )
      .limit(1);
    if (!rows.length) throw new AppError(404, 'NOT_FOUND', 'Asset not found.');
    const a = rows[0];
    res.json({
      success: true,
      data: {
        id: a.id,
        assetCode: a.assetCode,
        assetName: a.assetName,
        condition: a.condition,
        status: a.status,
        location: a.siteCode && a.siteName ? `${a.siteCode} - ${a.siteName}` : '-',
        pic: a.picName || '-',
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
