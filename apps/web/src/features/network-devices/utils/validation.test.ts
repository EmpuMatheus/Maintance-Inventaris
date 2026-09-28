import { describe, it, expect } from 'vitest';
import {
  buildNetworkDevicePayload,
  DERIVED_FIELDS,
  MONITORING_FIELDS,
  networkDeviceFormSchema,
  type NetworkDeviceFormValues,
} from './validation';

const validValues: NetworkDeviceFormValues = {
  name: 'PC Produksi 01',
  ipAddress: '192.168.1.10',
  macAddress: '',
  assetId: '22222222-2222-2222-2222-222222222222',
};

describe('networkDeviceFormSchema', () => {
  it('accepts a valid device', () => {
    const result = networkDeviceFormSchema.safeParse(validValues);
    expect(result.success).toBe(true);
  });

  it('requires an asset', () => {
    const result = networkDeviceFormSchema.safeParse({ ...validValues, assetId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed asset id', () => {
    const result = networkDeviceFormSchema.safeParse({ ...validValues, assetId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('does not accept a manually supplied device type', () => {
    const result = networkDeviceFormSchema.safeParse({ ...validValues, deviceType: 'SWITCH' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('deviceType');
    }
  });

  it('requires an IP address', () => {
    const result = networkDeviceFormSchema.safeParse({ ...validValues, ipAddress: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed IPv4 address', () => {
    const result = networkDeviceFormSchema.safeParse({ ...validValues, ipAddress: '999.1.1.1' });
    expect(result.success).toBe(false);
  });

  it('treats name and MAC address as optional', () => {
    const result = networkDeviceFormSchema.safeParse({
      ...validValues,
      name: undefined,
      macAddress: undefined,
    });
    expect(result.success).toBe(true);
  });
});

describe('buildNetworkDevicePayload', () => {
  it('maps only asset + network fields', () => {
    const parsed = networkDeviceFormSchema.parse({
      ...validValues,
      macAddress: 'AA:BB:CC:DD:EE:FF',
    });
    const payload = buildNetworkDevicePayload(parsed);
    expect(Object.keys(payload).sort()).toEqual(
      ['assetId', 'ipAddress', 'macAddress', 'name'].sort(),
    );
  });

  it('never includes backend-derived fields (deviceType/hostname/roomId)', () => {
    const payload = buildNetworkDevicePayload(networkDeviceFormSchema.parse(validValues));
    for (const field of DERIVED_FIELDS) {
      expect(payload).not.toHaveProperty(field);
    }
  });

  it('never includes backend-owned monitoring fields', () => {
    const payload = buildNetworkDevicePayload(networkDeviceFormSchema.parse(validValues));
    for (const field of MONITORING_FIELDS) {
      expect(payload).not.toHaveProperty(field);
    }
  });

  it('normalises a blank MAC address to null so it can be cleared', () => {
    const payload = buildNetworkDevicePayload(networkDeviceFormSchema.parse(validValues));
    expect(payload.macAddress).toBeNull();
  });

  it('trims text fields before submitting', () => {
    const payload = buildNetworkDevicePayload(
      networkDeviceFormSchema.parse({ ...validValues, name: '  PC Produksi 01  ', ipAddress: ' 10.0.0.1 ' }),
    );
    expect(payload.name).toBe('PC Produksi 01');
    expect(payload.ipAddress).toBe('10.0.0.1');
  });
});
