import { describe, it, expect } from 'vitest';
import { deriveDeviceType } from './device-type';

describe('deriveDeviceType', () => {
  it('uses the subcategory name as the device type', () => {
    expect(deriveDeviceType({ code: 'SW', name: 'Switch' })).toBe('Switch');
    expect(deriveDeviceType({ code: 'AP', name: 'Access Point' })).toBe('Access Point');
    expect(deriveDeviceType({ code: 'KOM', name: 'Komputer' })).toBe('Komputer');
  });

  it('trims the subcategory name', () => {
    expect(deriveDeviceType({ code: 'SW', name: '  Switch  ' })).toBe('Switch');
  });

  it('falls back to the subcategory code when the name is missing', () => {
    expect(deriveDeviceType({ code: 'SW', name: '' })).toBe('SW');
    expect(deriveDeviceType({ code: 'SW' })).toBe('SW');
  });

  it('returns an empty string for a missing subcategory', () => {
    expect(deriveDeviceType(null)).toBe('');
    expect(deriveDeviceType(undefined)).toBe('');
  });
});
