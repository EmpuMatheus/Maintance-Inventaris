import { describe, it, expect } from 'vitest';
import { createSchema, assignSchema, waitingPartSchema, completeSchema, cancelSchema, addPartSchema } from '@/modules/maintenance/maintenance.schema';

describe('Maintenance Schema Validation', () => {
  describe('createSchema', () => {
    it('accepts valid create', () => {
      const r = createSchema.safeParse({ assetId: '00000000-0000-0000-0000-000000000001', maintenanceCategory: 'CORRECTIVE', problem: 'Test issue', priority: 'HIGH' });
      expect(r.success).toBe(true);
    });
    it('rejects missing assetId', () => { expect(createSchema.safeParse({ maintenanceCategory: 'C', problem: 'p' }).success).toBe(false); });
    it('rejects missing problem', () => { expect(createSchema.safeParse({ assetId: '00000000-0000-0000-0000-000000000001', maintenanceCategory: 'C' }).success).toBe(false); });
    it('accepts minimal create', () => {
      const r = createSchema.safeParse({ assetId: '00000000-0000-0000-0000-000000000001', maintenanceCategory: 'CORRECTIVE', problem: 'x' });
      expect(r.success).toBe(true);
    });
  });
  describe('assignSchema', () => {
    it('accepts valid assign', () => { expect(assignSchema.safeParse({ technicianId: '00000000-0000-0000-0000-000000000001' }).success).toBe(true); });
    it('rejects missing technicianId', () => { expect(assignSchema.safeParse({}).success).toBe(false); });
  });
  describe('waitingPartSchema', () => {
    it('accepts valid waiting-part', () => { expect(waitingPartSchema.safeParse({ reason: 'No stock' }).success).toBe(true); });
    it('rejects missing reason', () => { expect(waitingPartSchema.safeParse({}).success).toBe(false); });
  });
  describe('completeSchema', () => {
    it('accepts minimal complete', () => { expect(completeSchema.safeParse({}).success).toBe(true); });
    it('accepts full complete', () => { expect(completeSchema.safeParse({ diagnosis: 'x', actionTaken: 'y', result: 'z', condition: 'GOOD' }).success).toBe(true); });
  });
  describe('cancelSchema', () => {
    it('accepts valid cancel', () => { expect(cancelSchema.safeParse({ reason: 'Duplicate' }).success).toBe(true); });
    it('rejects missing reason', () => { expect(cancelSchema.safeParse({}).success).toBe(false); });
  });
  describe('addPartSchema', () => {
    it('accepts valid part', () => { expect(addPartSchema.safeParse({ partName: 'CPU Fan', quantity: 1 }).success).toBe(true); });
    it('rejects missing partName', () => { expect(addPartSchema.safeParse({}).success).toBe(false); });
  });
});
