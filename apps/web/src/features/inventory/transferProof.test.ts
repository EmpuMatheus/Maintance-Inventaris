import { describe, expect, it } from 'vitest';
import { buildBeritaAcaraHtml } from './transferProof';

describe('transfer proof number', () => {
  it('prints stored transfer number instead of transfer UUID', () => {
    const html = buildBeritaAcaraHtml(
      { id: 'transfer-uuid', transferNumber: '3/BBP/IT/X/2026' },
      { assetName: 'Laptop' },
    );

    expect(html).toContain('<td>3/BBP/IT/X/2026</td>');
    expect(html).not.toContain('<td>transfer-uuid</td>');
  });

  it('keeps UUID for transfers created before numbered proofs', () => {
    const html = buildBeritaAcaraHtml(
      { id: 'old-transfer-uuid', transferNumber: null },
      { assetName: 'Laptop' },
    );

    expect(html).toContain('<td>old-transfer-uuid</td>');
  });
});
