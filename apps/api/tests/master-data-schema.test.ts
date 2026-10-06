import { describe, it, expect } from 'vitest';
import {
  createCategorySchema,
  createSubcategorySchema,
  createBuildingSchema,
  createFloorSchema,
  createRoomSchema,
  createMaintenanceTypeSchema,
} from '@/modules/master-data/master-data.schema';

describe('Master Data Schema Validation', () => {
  describe('createCategorySchema', () => {
    it('accepts valid category', () => {
      const result = createCategorySchema.safeParse({ code: 'IT', name: 'IT Equipment' });
      expect(result.success).toBe(true);
    });

    it('rejects missing code', () => {
      const result = createCategorySchema.safeParse({ name: 'IT Equipment' });
      expect(result.success).toBe(false);
    });

    it('rejects empty name', () => {
      const result = createCategorySchema.safeParse({ code: 'IT', name: '' });
      expect(result.success).toBe(false);
    });

    it('trims via service (code too long)', () => {
      const result = createCategorySchema.safeParse({ code: 'A'.repeat(51), name: 'Test' });
      expect(result.success).toBe(false);
    });
  });

  describe('createSubcategorySchema', () => {
    it('requires categoryId', () => {
      const result = createSubcategorySchema.safeParse({ code: 'LAP', name: 'Laptop' });
      expect(result.success).toBe(false);
    });

    it('accepts valid subcategory', () => {
      const result = createSubcategorySchema.safeParse({
        categoryId: '00000000-0000-0000-0000-000000000001',
        code: 'LAP',
        name: 'Laptop',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid categoryId', () => {
      const result = createSubcategorySchema.safeParse({
        categoryId: 'not-a-uuid',
        code: 'LAP',
        name: 'Laptop',
      });
      expect(result.success).toBe(false);
    });

    it('accepts an optional isNetworkDevice boolean', () => {
      const result = createSubcategorySchema.safeParse({
        categoryId: '00000000-0000-0000-0000-000000000001',
        code: 'SW',
        name: 'Switch',
        isNetworkDevice: true,
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.isNetworkDevice).toBe(true);
    });

    it('rejects a non-boolean isNetworkDevice', () => {
      const result = createSubcategorySchema.safeParse({
        categoryId: '00000000-0000-0000-0000-000000000001',
        code: 'SW',
        name: 'Switch',
        isNetworkDevice: 'yes',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Location hierarchy validation', () => {
    it('building requires siteId', () => {
      const result = createBuildingSchema.safeParse({ code: 'MB', name: 'Main Building' });
      expect(result.success).toBe(false);
    });

    it('floor requires buildingId', () => {
      const result = createFloorSchema.safeParse({ code: 'F1', name: 'Floor 1' });
      expect(result.success).toBe(false);
    });

    it('room requires floorId', () => {
      const result = createRoomSchema.safeParse({ code: 'R001', name: 'Room 001' });
      expect(result.success).toBe(false);
    });

    it('accepts valid building', () => {
      const result = createBuildingSchema.safeParse({
        siteId: '00000000-0000-0000-0000-000000000001',
        code: 'MB',
        name: 'Main Building',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('createMaintenanceTypeSchema', () => {
    it('accepts a task list and no description', () => {
      const result = createMaintenanceTypeSchema.safeParse({
        code: 'CLEANING',
        name: 'PC Cleaning',
        maintenanceCategory: 'PREVENTIVE',
        tasks: [{ task: 'Check device' }, { task: 'Clean device', order: 1 }],
      });
      expect(result.success).toBe(true);
    });

    it('accepts a type without tasks', () => {
      const result = createMaintenanceTypeSchema.safeParse({
        code: 'CLEANING',
        name: 'PC Cleaning',
        maintenanceCategory: 'PREVENTIVE',
      });
      expect(result.success).toBe(true);
    });

    it('rejects a task with a non-uuid id', () => {
      const result = createMaintenanceTypeSchema.safeParse({
        code: 'CLEANING',
        name: 'PC Cleaning',
        maintenanceCategory: 'PREVENTIVE',
        tasks: [{ id: 'not-a-uuid', task: 'Check' }],
      });
      expect(result.success).toBe(false);
    });
  });
});
