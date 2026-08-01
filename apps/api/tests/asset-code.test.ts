import { describe, it, expect } from 'vitest';
import { createAssetSchema, updateAssetSchema } from '@/modules/assets/asset.schema';

describe('Asset Code Schema Requirements', () => {
  describe('createAssetSchema', () => {
    it('requires categoryId', () => {
      const result = createAssetSchema.safeParse({ assetName: 'Test', subcategoryId: '00000000-0000-0000-0000-000000000001' });
      expect(result.success).toBe(false);
    });

    it('requires subcategoryId', () => {
      const result = createAssetSchema.safeParse({ assetName: 'Test', categoryId: '00000000-0000-0000-0000-000000000001' });
      expect(result.success).toBe(false);
    });

    it('accepts both categoryId and subcategoryId', () => {
      const result = createAssetSchema.safeParse({
        assetName: 'Test',
        categoryId: '00000000-0000-0000-0000-000000000001',
        subcategoryId: '00000000-0000-0000-0000-000000000002',
      });
      expect(result.success).toBe(true);
    });

    it('rejects when missing both category and subcategory', () => {
      const result = createAssetSchema.safeParse({ assetName: 'Test' });
      expect(result.success).toBe(false);
    });
  });

  describe('updateAssetSchema', () => {
    it('does not require categoryId or subcategoryId', () => {
      const result = updateAssetSchema.safeParse({ assetName: 'Updated' });
      expect(result.success).toBe(true);
    });
  });
});
