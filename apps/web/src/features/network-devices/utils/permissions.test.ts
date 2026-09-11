import { describe, it, expect } from 'vitest';
import { canManageNetworkDevices, canReadNetworkDevices } from './permissions';

const fromPermissions = (permissions: string[]) => (permission: string) => permissions.includes(permission);

describe('network device permissions', () => {
  it('allows read with network_device.read', () => {
    expect(canReadNetworkDevices(fromPermissions(['network_device.read']))).toBe(true);
  });

  it('allows read with only network_device.manage (matches backend authorizeAny)', () => {
    expect(canReadNetworkDevices(fromPermissions(['network_device.manage']))).toBe(true);
  });

  it('denies read without a network device permission', () => {
    expect(canReadNetworkDevices(fromPermissions(['asset.read']))).toBe(false);
    expect(canReadNetworkDevices(fromPermissions([]))).toBe(false);
  });

  it('requires network_device.manage for create/edit/status management', () => {
    expect(canManageNetworkDevices(fromPermissions(['network_device.manage']))).toBe(true);
    expect(canManageNetworkDevices(fromPermissions(['network_device.read']))).toBe(false);
    expect(canManageNetworkDevices(fromPermissions([]))).toBe(false);
  });
});
