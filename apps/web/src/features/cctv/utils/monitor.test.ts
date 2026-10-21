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
  monitorTileState,
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
  it('exposes 4, 9, 16, 25, 32, 36 and 49 tile choices', () => {
    expect(FULLSCREEN_TILE_OPTIONS).toEqual([4, 9, 16, 25, 32, 36, 49]);
  });

  it('uses the correct grid for every tile choice', () => {
    expect(fullscreenGridClass(4)).toContain('grid-cols-2');
    expect(fullscreenGridClass(4)).toContain('grid-rows-2');
    expect(fullscreenGridClass(9)).toContain('grid-cols-3');
    expect(fullscreenGridClass(9)).toContain('grid-rows-3');
    expect(fullscreenGridClass(16)).toContain('grid-cols-4');
    expect(fullscreenGridClass(16)).toContain('grid-rows-4');
    expect(fullscreenGridClass(25)).toContain('grid-cols-5');
    expect(fullscreenGridClass(25)).toContain('grid-rows-5');
    expect(fullscreenGridClass(32)).toContain('grid-cols-8');
    expect(fullscreenGridClass(32)).toContain('grid-rows-4');
    expect(fullscreenGridClass(36)).toContain('grid-cols-6');
    expect(fullscreenGridClass(36)).toContain('grid-rows-6');
    expect(fullscreenGridClass(49)).toContain('grid-cols-7');
    expect(fullscreenGridClass(49)).toContain('grid-rows-7');
  });

  it('always yields the same number of cells as the chosen tile count', () => {
    expect(fullscreenFillerCount(16, 10)).toBe(6);
    expect(fullscreenFillerCount(25, 10)).toBe(15);
    expect(fullscreenFillerCount(4, 10)).toBe(0);
    expect(fullscreenFillerCount(49, 0)).toBe(49);
    expect(fullscreenFillerCount(9, 9)).toBe(0);
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

describe('monitorTileState (grid / multi / single fullscreen)', () => {
  it('grid mode follows Play All and hides nothing', () => {
    const base = { view: 'grid' as const, index: 3, focusedIndex: null, tileCount: 9 as const };
    expect(monitorTileState({ ...base, playingAll: true })).toEqual({ hidden: false, autoStart: true });
    expect(monitorTileState({ ...base, playingAll: false })).toEqual({ hidden: false, autoStart: false });
  });

  it('multi mode fills the chosen tile count and follows Play All', () => {
    const base = { view: 'multi' as const, focusedIndex: null, playingAll: true, tileCount: 9 as const };
    expect(monitorTileState({ ...base, index: 0 })).toEqual({ hidden: false, autoStart: true });
    expect(monitorTileState({ ...base, index: 8 })).toEqual({ hidden: false, autoStart: true });
    expect(monitorTileState({ ...base, index: 9 })).toEqual({ hidden: true, autoStart: false });
    expect(monitorTileState({ ...base, index: 20, playingAll: false })).toEqual({ hidden: true, autoStart: false });
  });

  it('single mode plays only the focused tile and stops the rest', () => {
    const base = { view: 'single' as const, focusedIndex: 2, playingAll: true, tileCount: 9 as const };
    expect(monitorTileState({ ...base, index: 2 })).toEqual({ hidden: false, autoStart: true });
    expect(monitorTileState({ ...base, index: 1 })).toEqual({ hidden: true, autoStart: false });
  });

  it('single mode with no focus hides every tile', () => {
    const base = { view: 'single' as const, focusedIndex: null, playingAll: true, tileCount: 9 as const };
    expect(monitorTileState({ ...base, index: 0 })).toEqual({ hidden: true, autoStart: false });
    expect(monitorTileState({ ...base, index: 5 })).toEqual({ hidden: true, autoStart: false });
  });
});
