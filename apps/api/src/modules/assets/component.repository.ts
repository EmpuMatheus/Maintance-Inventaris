import { getDb } from '@/database/client';
import { assetComponents, assets } from '@/database/schema';
import { eq, like, and, sql } from 'drizzle-orm';

export async function listAllComponents(params: Record<string, any>) {
  const db = getDb();
  const search = params.search ? `%${params.search}%` : null;

  const conditions = [];
  if (search) {
    conditions.push(
      sql`(${like(assetComponents.componentName, search)} OR ${like(assetComponents.model, search)} OR ${like(assetComponents.serialNumber, search)})`
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: assetComponents.id,
      componentName: assetComponents.componentName,
      model: assetComponents.model,
      serialNumber: assetComponents.serialNumber,
      assetId: assetComponents.assetId,
      assetCode: assets.assetCode,
      assetName: assets.assetName,
      createdAt: assetComponents.createdAt,
    })
    .from(assetComponents)
    .leftJoin(assets, eq(assetComponents.assetId, assets.id))
    .where(where)
    .orderBy(assetComponents.createdAt);

  return rows as any[];
}

export async function createComponent(assetId: string, data: {
  componentName: string;
  model: string;
  serialNumber: string;
}) {
  const db = getDb();
  const rows = await db.insert(assetComponents).values({
    assetId: sql`${assetId}::uuid`,
    componentName: data.componentName,
    model: data.model,
    serialNumber: data.serialNumber,
  }).returning();
  return (rows as any[])[0] ?? null;
}

export async function getComponentsByAssetId(assetId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(assetComponents)
    .where(eq(assetComponents.assetId, sql`${assetId}::uuid`))
    .orderBy(assetComponents.createdAt);
  return rows as any[];
}

export async function getComponentById(id: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(assetComponents)
    .where(eq(assetComponents.id, sql`${id}::uuid`))
    .limit(1);
  return (rows as any[])[0] ?? null;
}

export async function updateComponent(id: string, data: Partial<{
  componentName: string;
  model: string;
  serialNumber: string;
}>) {
  const db = getDb();
  const rows = await db
    .update(assetComponents)
    .set({ ...data, updatedAt: sql`now()` })
    .where(eq(assetComponents.id, sql`${id}::uuid`))
    .returning();
  return (rows as any[])[0] ?? null;
}

export async function deleteComponent(id: string) {
  const db = getDb();
  await db.delete(assetComponents).where(eq(assetComponents.id, sql`${id}::uuid`));
}

export async function deleteComponentsByAssetId(assetId: string) {
  const db = getDb();
  await db.delete(assetComponents).where(eq(assetComponents.assetId, sql`${assetId}::uuid`));
}
