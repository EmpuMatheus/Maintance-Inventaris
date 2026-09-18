import { describe, it, expect } from 'vitest';
import {
  buildNetworkDevicePayload,
  MONITORING_FIELDS,
  networkDeviceFormSchema,
  type NetworkDeviceFormValues,
} from './validation';

const validValues: NetworkDeviceFormValues = {
  name: 'PC Produksi 01',
  deviceType: 'COMPUTER',
  ipAddress: '192.168.1.10',
  hostname: '',
  macAddress: '',
  roomId: '11111111-1111-1111-1111-111111111111',
  assetId: '',
};

describe('networkDeviceFormSchema', () => {
  it('accepts a valid device', () => {
    const result = networkDeviceFormSchema.safeParse(validValues);
    expect(result.success).toBe(true);
  });

  it('requires a name', () => {
    const result = networkDeviceFormSchema.safeParse({ ...validValues, name: '  ' });
    expect(result.success).toBe(false);
  });

  it('requires a device type', () => {
    const result = networkDeviceFormSchema.safeParse({ ...validValues, deviceType: undefined });
    expect(result.success).toBe(false);
  });

  it('requires a room', () => {
    const result = networkDeviceFormSchema.safeParse({ ...validValues, roomId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed IPv4 address', () => {
    const result = networkDeviceFormSchema.safeParse({ ...validValues, ipAddress: '999.1.1.1' });
    expect(result.success).toBe(false);
  });

  it('treats hostname, MAC address and asset as optional', () => {
    const result = networkDeviceFormSchema.safeParse({
      ...validValues,
      hostname: undefined,
      macAddress: undefined,
      assetId: undefined,
    });
    expect(result.success).toBe(true);
  });
});

describe('buildNetworkDevicePayload', () => {
  it('maps only the editable identity/location/asset fields', () => {
    const parsed = networkDeviceFormSchema.parse({
      ...validValues,
      hostname: 'pc-prod-01',
      macAddress: 'AA:BB:CC:DD:EE:FF',
      assetId: '22222222-2222-2222-2222-222222222222',
    });
    const payload = buildNetworkDevicePayload(parsed);
    expect(Object.keys(payload).sort()).toEqual(
      ['assetId', 'deviceType', 'hostname', 'ipAddress', 'macAddress', 'name', 'roomId'].sort(),
    );
  });

  it('never includes backend-owned monitoring fields', () => {
    const payload = buildNetworkDevicePayload(networkDeviceFormSchema.parse(validValues));
    for (const field of MONITORING_FIELDS) {
      expect(payload).not.toHaveProperty(field);
    }
  });

  it('normalises blank optional fields to null so they can be cleared', () => {
    const payload = buildNetworkDevicePayload(networkDeviceFormSchema.parse(validValues));
    expect(payload.hostname).toBeNull();
    expect(payload.macAddress).toBeNull();
    expect(payload.assetId).toBeNull();
  });

  it('trims text fields before submitting', () => {
    const payload = buildNetworkDevicePayload(
      networkDeviceFormSchema.parse({ ...validValues, name: '  PC Produksi 01  ', ipAddress: ' 10.0.0.1 ' }),
    );
    expect(payload.name).toBe('PC Produksi 01');
    expect(payload.ipAddress).toBe('10.0.0.1');
  });
});
