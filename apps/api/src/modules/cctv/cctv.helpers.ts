/**
 * Removes embedded credentials from an RTSP/HTTP URI before it is persisted or
 * returned to the frontend. Devices frequently return
 * `rtsp://admin:password@host:554/...`; storing or sending that would expose
 * the device credential.
 *
 * `rtsp://admin:pass@10.0.0.5:554/Streaming/Channels/101`
 *   -> `rtsp://10.0.0.5:554/Streaming/Channels/101`
 */
export function stripUriCredentials(uri: string | null | undefined): string | null {
  if (!uri) return null;
  try {
    const url = new URL(uri);
    url.username = '';
    url.password = '';
    return url.toString();
  } catch {
    // Not a parseable URL; defensively strip a `user:pass@` prefix.
    return uri.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/@]*@/i, '$1');
  }
}

/**
 * Classifies an ONVIF profile as MAIN/SUB/OTHER without assuming a fixed
 * numbering scheme. A device may name profiles "MainStream"/"SubStream" or
 * expose resolution hints; when nothing matches we fall back to OTHER rather
 * than guessing.
 */
export function classifyStreamType(
  profileName: string | null,
  encoding: string | null,
  resolution: string | null,
  index: number,
): 'MAIN' | 'SUB' | 'OTHER' {
  const name = (profileName ?? '').toLowerCase();
  if (/(^|[^a-z])(sub|minor|secondary|low)/.test(name)) return 'SUB';
  if (/(^|[^a-z])(main|major|primary|high)/.test(name)) return 'MAIN';
  // Without a name hint, the first profile of a source is treated as main.
  if (index === 0) return 'MAIN';
  void encoding;
  void resolution;
  return 'OTHER';
}

/** Safely parses a numeric FPS value from ONVIF, returning null when invalid. */
export function parseFps(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

/** The two test stream variants used by the RTSP connection test. */
export const RTSP_STREAM_KINDS = ['main', 'sub'] as const;
export type RtspStreamKind = (typeof RTSP_STREAM_KINDS)[number];

/**
 * Builds a Hikvision-style RTSP path:
 *   /Streaming/channels/{channel}{stream}
 *
 * The stream digit is `01` for the main stream and `02` for the sub stream, so
 * channel 1 main `101`, channel 1 sub `102`, channel 2 main `201`, etc.
 *
 * Hikvision is the only path scheme currently implemented. A device exposing a
 * different scheme would need an explicit mapping (not fabricated here).
 */
export function buildHikvisionRtspPath(channel: number, kind: RtspStreamKind = 'sub'): string {
  const streamDigit = kind === 'main' ? '01' : '02';
  return `/Streaming/channels/${channel}${streamDigit}`;
}
