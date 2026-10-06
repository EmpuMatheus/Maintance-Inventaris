import { describe, it, expect } from 'vitest';
import { buildCctvDevicePayload, cctvDeviceFormSchema } from './validation';

const ASSET_ID = '11111111-1111-1111-1111-111111111111';

function validValues(overrides: Record<string, unknown> = {}) {
  return {
    assetId: ASSET_ID,
    ipAddress: '192.168.1.10',
    port: 80,
    rtspPort: 554,
    username: 'admin',
    password: '',
    location: 'Ruang Server',
    ...overrides,
  };
}

describe('cctvDeviceFormSchema', () => {
  it('requires an asset and a location', () => {
    expect(cctvDeviceFormSchema.safeParse(validValues()).success).toBe(true);
    expect(cctvDeviceFormSchema.safeParse(validValues({ assetId: '' })).success).toBe(false);
    expect(cctvDeviceFormSchema.safeParse(validValues({ location: '' })).success).toBe(false);
  });

  it('validates the IP address and ports', () => {
    expect(cctvDeviceFormSchema.safeParse(validValues({ ipAddress: '999.1.1.1' })).success).toBe(false);
    expect(cctvDeviceFormSchema.safeParse(validValues({ port: 0 })).success).toBe(false);
  });
});

describe('buildCctvDevicePayload', () => {
  it('sends only asset + network fields (no manual name/brand/model/subcategory)', () => {
    const payload = buildCctvDevicePayload(cctvDeviceFormSchema.parse(validValues()), { isEdit: false });
    expect(payload.assetId).toBe(ASSET_ID);
    expect(payload.ipAddress).toBe('192.168.1.10');
    expect(payload.location).toBe('Ruang Server');
    expect(payload).not.toHaveProperty('name');
    expect(payload).not.toHaveProperty('brand');
    expect(payload).not.toHaveProperty('model');
    expect(payload).not.toHaveProperty('subcategoryId');
    expect(payload).not.toHaveProperty('description');
  });

  it('omits a blank password on edit but clears it on create', () => {
    const values = cctvDeviceFormSchema.parse(validValues());
    expect(buildCctvDevicePayload(values, { isEdit: true })).not.toHaveProperty('password');
    expect(buildCctvDevicePayload(values, { isEdit: false }).password).toBeNull();
  });

  it('includes the password when provided', () => {
    const values = cctvDeviceFormSchema.parse(validValues({ password: 'secret' }));
    expect(buildCctvDevicePayload(values, { isEdit: true }).password).toBe('secret');
  });
});
