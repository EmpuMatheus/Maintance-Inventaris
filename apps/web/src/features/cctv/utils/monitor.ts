/**
 * Clamps a page size to a safe range. Retained for the pagination helper below
 * (no longer used by the Monitor grid, which now shows every channel at once).
 */
export function clampPageSize(value: number | undefined, fallback = 8): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(64, Math.max(1, Math.floor(value)));
}

export interface PaginatedChannels<T> {
  pageChannels: T[];
  totalPages: number;
  page: number;
}

/** Slices channels for the given 1-based page. Out-of-range pages clamp. */
export function paginateChannels<T>(
  channels: T[],
  page: number,
  pageSize: number,
): PaginatedChannels<T> {
  const size = clampPageSize(pageSize);
  const totalPages = Math.max(1, Math.ceil(channels.length / size));
  const clampedPage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const start = (clampedPage - 1) * size;
  return {
    pageChannels: channels.slice(start, start + size),
    totalPages,
    page: clampedPage,
  };
}

/**
 * Uniform, responsive CCTV video-wall grid.
 *
 * Every tile uses the SAME class regardless of device type or channel count, so
 * all tiles are identical in size. The column count adapts only to the
 * viewport width (1 / 2 / 3 / 4 columns), never to the data.
 */
export const MONITOR_GRID_CLASS =
  'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

export function monitorGridClass(_tileCount?: number): string {
  return MONITOR_GRID_CLASS;
}

/* ---------------------------- Full Screen wall ---------------------------- */

/** The tile counts a user may pick for the Full Screen video wall. */
export type FullScreenTileCount = 1 | 4 | 9 | 16;

export const FULLSCREEN_TILE_OPTIONS: FullScreenTileCount[] = [1, 4, 9, 16];

/**
 * Uniform video-wall grid for Full Screen. Every tile is the same size and the
 * grid fills the available viewport height (the caller supplies `flex-1
 * min-h-0`). Layouts:
 *   1  -> 1 column x 1 row
 *   4  -> 2 columns x 2 rows
 *   9  -> 3 columns x 3 rows
 *   16 -> 4 columns x 4 rows
 */
const FULLSCREEN_GRID_CLASS: Record<FullScreenTileCount, string> = {
  1: 'grid-cols-1 grid-rows-1',
  4: 'grid-cols-2 grid-rows-2',
  9: 'grid-cols-3 grid-rows-3',
  16: 'grid-cols-4 grid-rows-4',
};

export function fullscreenGridClass(count: FullScreenTileCount): string {
  return `grid ${FULLSCREEN_GRID_CLASS[count]}`;
}

/**
 * Number of empty slots to append so the wall always has exactly `count` cells
 * (e.g. 10 channels in a 16-tile wall -> 6 empty slots). Never negative.
 */
export function fullscreenFillerCount(count: FullScreenTileCount, channelCount: number): number {
  return Math.max(0, count - channelCount);
}

/* ---------------------- Flat channel collection ---------------------- */

/** Minimal shape needed to build the flat monitor wall. */
export interface MonitorLikeChannel {
  status: string;
  deviceId: string;
  channelNumber: number;
  device?: { name?: string | null } | null;
}

/**
 * Builds the SINGLE flat channel collection for the Monitor wall.
 *
 * Channels from all devices are returned in one array (never grouped), ordered
 * by device name then channel number, with MISSING channels removed.
 */
export function flattenMonitorChannels<T extends MonitorLikeChannel>(channels: T[]): T[] {
  return channels
    .filter((c) => c.status !== 'MISSING')
    .slice()
    .sort(
      (a, b) =>
        (a.device?.name ?? '').localeCompare(b.device?.name ?? '') ||
        a.channelNumber - b.channelNumber,
    );
}
