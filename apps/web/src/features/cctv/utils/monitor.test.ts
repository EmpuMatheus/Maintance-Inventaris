import { describe, it, expect } from 'vitest';
import {
  clampPageSize,
  paginateChannels,
  monitorGridClass,
  flattenMonitorChannels,
  fullscreenGridClass,
  fullscreenFillerCount,
  FULLSCREEN_TILE_OPTIONS,
  MONITOR_GRID_CLASS,
} from './monitor';
import type { CctvChannel } from '../types';

function makeChannels(count: number): CctvChannel[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `ch-${i + 1}`,
    deviceId: 'dev-1',
    channelNumber: i + 1,
    deviceChannelId: `vs-${i + 1}`,
    technicalName: null,
    name: `Kamera ${i + 1}`,
    location: null,
    description: null,
    displayOrder: i,
    cameraIp: null,
    status: 'ONLINE',
    isActive: true,
    lastSyncAt: null,
    createdAt: '',
    updatedAt: '',
    device: null,
    streamProfiles: [],
  }));
}

describe('clampPageSize', () => {
  it('clamps to 1..64 and applies a fallback', () => {
    expect(clampPageSize(undefined, 8)).toBe(8);
    expect(clampPageSize(0, 8)).toBe(1);
    expect(clampPageSize(200, 8)).toBe(64);
    expect(clampPageSize(16, 8)).toBe(16);
  });
});

describe('paginateChannels', () => {
  it('slices by page and reports total pages', () => {
    const channels = makeChannels(12);
    const p1 = paginateChannels(channels, 1, 8);
    expect(p1.pageChannels).toHaveLength(8);
    expect(p1.totalPages).toBe(2);
    const p2 = paginateChannels(channels, 2, 8);
    expect(p2.pageChannels).toHaveLength(4);
    expect(p2.pageChannels[0].channelNumber).toBe(9);
  });

  it('clamps an out-of-range page', () => {
    const channels = makeChannels(4);
    const p = paginateChannels(channels, 99, 8);
    expect(p.page).toBe(1);
    expect(p.pageChannels).toHaveLength(4);
  });

  it('returns one page when there are no channels', () => {
    const p = paginateChannels([], 1, 8);
    expect(p.pageChannels).toHaveLength(0);
    expect(p.totalPages).toBe(1);
  });
});

describe('monitorGridClass (uniform video-wall tiles)', () => {
  it('returns the SAME class for any channel count (no per-device size change)', () => {
    expect(monitorGridClass(1)).toBe(monitorGridClass(4));
    expect(monitorGridClass(8)).toBe(monitorGridClass(32));
    expect(monitorGridClass(1)).toBe(MONITOR_GRID_CLASS);
  });

  it('is responsive to viewport only (1/2/3/4 columns)', () => {
    expect(MONITOR_GRID_CLASS).toContain('grid-cols-1');
    expect(MONITOR_GRID_CLASS).toContain('sm:grid-cols-2');
    expect(MONITOR_GRID_CLASS).toContain('lg:grid-cols-3');
    expect(MONITOR_GRID_CLASS).toContain('xl:grid-cols-4');
  });
});

describe('full screen video wall', () => {
  it('exposes 8, 16 and 32 tile choices', () => {
    expect(FULLSCREEN_TILE_OPTIONS).toEqual([8, 16, 32]);
  });

  it('uses the correct grid for 8, 16 and 32 tiles', () => {
    expect(fullscreenGridClass(8)).toContain('grid-cols-4');
    expect(fullscreenGridClass(8)).toContain('grid-rows-2');
    expect(fullscreenGridClass(16)).toContain('grid-cols-4');
    expect(fullscreenGridClass(16)).toContain('grid-rows-4');
    expect(fullscreenGridClass(32)).toContain('grid-cols-8');
    expect(fullscreenGridClass(32)).toContain('grid-rows-4');
  });

  it('always yields the same number of cells as the chosen tile count', () => {
    expect(fullscreenFillerCount(16, 10)).toBe(6);
    expect(fullscreenFillerCount(8, 10)).toBe(0);
    expect(fullscreenFillerCount(32, 0)).toBe(32);
    expect(fullscreenFillerCount(8, 8)).toBe(0);
  });
});

describe('flattenMonitorChannels (single flat grid, no device grouping)', () => {
  function ch(
    id: string,
    deviceId: string,
    deviceName: string,
    channelNumber: number,
    status = 'ONLINE',
  ) {
    return {
      id,
      deviceId,
      channelNumber,
      status,
      device: { name: deviceName },
    };
  }

  it('merges channels from every device into ONE array', () => {
    const flat = flattenMonitorChannels([
      ch('a', 'dvr', 'Embedded DVR', 1),
      ch('b', 'cam', 'Camera', 1),
      ch('c', 'dvr', 'Embedded DVR', 2),
      ch('d', 'nvr', 'XMEye NVR', 1),
    ]);
    expect(flat).toHaveLength(4);
    expect(flat.map((c) => c.id)).toEqual(['b', 'a', 'c', 'd']); // Camera, DVR CH1, DVR CH2, NVR
    // No grouping structure is produced — just a flat list.
    expect(flat.every((c) => typeof c.id === 'string')).toBe(true);
  });

  it('drops MISSING channels', () => {
    const flat = flattenMonitorChannels([
      ch('a', 'dvr', 'DVR', 1, 'ONLINE'),
      ch('b', 'dvr', 'DVR', 2, 'MISSING'),
    ]);
    expect(flat.map((c) => c.id)).toEqual(['a']);
  });

  it('orders by device name then channel number', () => {
    const flat = flattenMonitorChannels([
      ch('a', 'd', 'B Device', 3),
      ch('b', 'd', 'B Device', 1),
      ch('c', 'd', 'A Device', 2),
    ]);
    expect(flat.map((c) => c.id)).toEqual(['c', 'b', 'a']);
  });
});
