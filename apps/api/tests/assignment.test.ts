import { describe, it, expect } from 'vitest';
import { assignSchema, returnSchema, transferSchema } from '@/modules/assets/assignment.schema';

describe('Assignment Schema', () => {
  describe('assignSchema', () => {
    it('accepts valid assignment', () => {
      const result = assignSchema.safeParse({
        userId: '00000000-0000-0000-0000-000000000001',
        departmentId: '00000000-0000-0000-0000-000000000002',
        assignedDate: '2026-07-30',
        notes: 'Test assignment',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing userId', () => {
      const result = assignSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('rejects invalid userId', () => {
      const result = assignSchema.safeParse({ userId: 'not-uuid' });
      expect(result.success).toBe(false);
    });

    it('accepts minimal assignment with only userId', () => {
      const result = assignSchema.safeParse({ userId: '00000000-0000-0000-0000-000000000001' });
      expect(result.success).toBe(true);
    });
  });

  describe('returnSchema', () => {
    it('accepts valid return', () => {
      const result = returnSchema.safeParse({ returnedDate: '2026-07-31', notes: 'Returned' });
      expect(result.success).toBe(true);
    });

    it('accepts empty return', () => {
      const result = returnSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('transferSchema', () => {
    it('accepts valid transfer', () => {
      const result = transferSchema.safeParse({
        siteId: '00000000-0000-0000-0000-000000000001',
        buildingId: '00000000-0000-0000-0000-000000000002',
        floorId: '00000000-0000-0000-0000-000000000003',
        roomId: '00000000-0000-0000-0000-000000000004',
        reason: 'Office move',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing siteId', () => {
      const result = transferSchema.safeParse({ buildingId: 'uuid', floorId: 'uuid', roomId: 'uuid' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid UUID', () => {
      const result = transferSchema.safeParse({ siteId: 'bad', buildingId: 'uuid', floorId: 'uuid', roomId: 'uuid' });
      expect(result.success).toBe(false);
    });
  });
});
