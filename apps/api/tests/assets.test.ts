import { describe, it, expect } from 'vitest';
import { createAssetSchema, updateAssetSchema, listAssetsQuery } from '@/modules/assets/asset.schema';

describe('Asset Schema Validation', () => {
  describe('createAssetSchema', () => {
    it('accepts minimal valid asset with category and subcategory', () => {
      const result = createAssetSchema.safeParse({
        assetName: 'Test Asset',
        categoryId: '00000000-0000-0000-0000-000000000001',
        subcategoryId: '00000000-0000-0000-0000-000000000002',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing assetName', () => {
      const result = createAssetSchema.safeParse({
        categoryId: '00000000-0000-0000-0000-000000000001',
        subcategoryId: '00000000-0000-0000-0000-000000000002',
      });
      expect(result.success).toBe(false);
    });

    it('accepts full asset with all fields', () => {
      const result = createAssetSchema.safeParse({
        assetName: 'Lenovo ThinkPad',
        categoryId: '00000000-0000-0000-0000-000000000001',
        subcategoryId: '00000000-0000-0000-0000-000000000002',
        brandId: '00000000-0000-0000-0000-000000000003',
        model: 'ThinkPad E14',
        serialNumber: 'ABC123',
        manufacturer: 'Lenovo',
        specification: 'Intel i5, 16GB',
        purchaseDate: '2026-01-15',
        purchasePrice: 1200,
        vendorId: '00000000-0000-0000-0000-000000000004',
        invoiceNumber: 'INV-001',
        warrantyStart: '2026-01-15',
        warrantyEnd: '2029-01-15',
        siteId: '00000000-0000-0000-0000-000000000005',
        buildingId: '00000000-0000-0000-0000-000000000006',
        floorId: '00000000-0000-0000-0000-000000000007',
        roomId: '00000000-0000-0000-0000-000000000008',
        departmentId: '00000000-0000-0000-0000-000000000009',
        currentPicId: '00000000-0000-0000-0000-000000000010',
        condition: 'GOOD',
        status: 'IN_USE',
        notes: 'Test notes',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid UUID for categoryId', () => {
      const result = createAssetSchema.safeParse({ assetName: 'Test', categoryId: 'not-uuid' });
      expect(result.success).toBe(false);
    });
  });

  describe('updateAssetSchema', () => {
    it('accepts partial update', () => {
      const result = updateAssetSchema.safeParse({ assetName: 'Updated Name' });
      expect(result.success).toBe(true);
    });

    it('accepts empty update', () => {
      const result = updateAssetSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('listAssetsQuery', () => {
    it('accepts valid list query', () => {
      const result = listAssetsQuery.safeParse({ page: 1, limit: 25, condition: 'GOOD', sort: 'assetName', order: 'asc' });
      expect(result.success).toBe(true);
    });

    it('rejects invalid sort order', () => {
      const result = listAssetsQuery.safeParse({ order: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('rejects limit over 100', () => {
      const result = listAssetsQuery.safeParse({ limit: 200 });
      expect(result.success).toBe(false);
    });
  });
});
