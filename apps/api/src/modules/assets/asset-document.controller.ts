import type { Request, Response, NextFunction } from 'express';
import { getDb } from '@/database/client';
import { assets, assetDocuments } from '@/database/schema';
import { eq, sql } from 'drizzle-orm';
import { AppError } from '@/middleware/error-handler';

export async function uploadPhoto(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const db = getDb();
    const existing = await db.select({ id: assets.id }).from(assets).where(eq(assets.id, sql`${id}::uuid`)).limit(1);
    if (!existing.length) throw new AppError(404, 'NOT_FOUND', 'Asset not found.');

    if (!req.file) throw new AppError(400, 'VALIDATION_ERROR', 'Photo file is required.');

    const photoUrl = `/uploads/photos/${req.file.filename}`;

    await db.update(assets).set({ photoUrl, updatedAt: sql`now()` }).where(eq(assets.id, sql`${id}::uuid`));

    res.json({ success: true, data: { photoUrl } });
  } catch (error) {
    next(error);
  }
}

export async function listDocuments(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const db = getDb();
    const rows = await db.select().from(assetDocuments).where(eq(assetDocuments.assetId, sql`${id}::uuid`)).orderBy(assetDocuments.createdAt);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

export async function uploadDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const db = getDb();
    const existing = await db.select({ id: assets.id }).from(assets).where(eq(assets.id, sql`${id}::uuid`)).limit(1);
    if (!existing.length) throw new AppError(404, 'NOT_FOUND', 'Asset not found.');

    if (!req.file) throw new AppError(400, 'VALIDATION_ERROR', 'Document file is required.');

    const documentType = (req.body.documentType as string) || 'OTHER';
    const description = (req.body.description as string) || null;
    const fileUrl = `/uploads/documents/${req.file.filename}`;

    const [doc] = await db.insert(assetDocuments).values({
      assetId: sql`${id}::uuid`,
      documentType,
      fileName: req.file.originalname,
      fileUrl,
      description,
    } as any).returning();

    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    next(error);
  }
}

export async function deleteDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const assetId = req.params.id as string;
    const documentId = req.params.documentId as string;
    const db = getDb();

    const existing = await db.select().from(assetDocuments)
      .where(sql`${assetDocuments.assetId} = ${assetId}::uuid AND ${assetDocuments.id} = ${documentId}::uuid`)
      .limit(1);

    if (!existing.length) throw new AppError(404, 'NOT_FOUND', 'Document not found.');

    await db.delete(assetDocuments).where(eq(assetDocuments.id, sql`${documentId}::uuid`));

    res.json({ success: true, data: null });
  } catch (error) {
    next(error);
  }
}
