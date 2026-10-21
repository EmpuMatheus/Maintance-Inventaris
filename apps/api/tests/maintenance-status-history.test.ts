import { describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';

const sql = postgres(env.DATABASE_URL, { max: 1 });

/** Requires migration 0035_maintenance_status_history. */
describe('maintenance status history schema', () => {
  it('stores nullable creation metadata and cascades with its maintenance record', async () => {
    const [record] = await sql`
      INSERT INTO maintenance_records (maintenance_code, asset_id, maintenance_category, priority, status)
      SELECT 'QA-HISTORY-' || replace(gen_random_uuid()::text, '-', ''), id, 'CORRECTIVE', 'MEDIUM', 'OPEN'
      FROM assets
      WHERE status <> 'RETIRED'
      LIMIT 1
      RETURNING id
    `;

    expect(record).toBeTruthy();
    const maintenanceId = record.id as string;

    try {
      const [history] = await sql`
        INSERT INTO maintenance_status_history (maintenance_id, from_status, to_status, changed_by)
        VALUES (${maintenanceId}, NULL, 'OPEN', NULL)
        RETURNING id, from_status, to_status, changed_by
      `;
      expect(history.from_status).toBeNull();
      expect(history.to_status).toBe('OPEN');
      expect(history.changed_by).toBeNull();

      await sql`DELETE FROM maintenance_records WHERE id = ${maintenanceId}`;
      const rows = await sql`SELECT id FROM maintenance_status_history WHERE id = ${history.id}`;
      expect(rows).toHaveLength(0);
    } finally {
      await sql`DELETE FROM maintenance_records WHERE id = ${maintenanceId}`;
    }
  });
});

process.on('exit', () => { void sql.end(); });
