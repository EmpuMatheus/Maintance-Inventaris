import { AppError } from '@/middleware/error-handler';
import { decryptSecret } from '@/lib/crypto/secret-box';
import { logger } from '@/lib/logger';
import { streamingGatewayConfig } from '@/config/env';
import { toIntegrationError } from '@/lib/integration/errors';import { getStreamingGateway, isStreamingEnabled } from '@/lib/streaming';
import { generateGatewayPathName } from '@/lib/streaming/mediamtx.gateway';
import { startIngest, stopIngest, isFfmpegAvailable } from '@/lib/streaming/ingest';
import * as repo from './cctv.repository';
import { buildIntegrationProvider, resolveDeviceProtocol } from './integration';
import { buildHikvisionRtspPath, stripUriCredentials } from './cctv.helpers';
import type { RtspStreamKind } from './cctv.helpers';
import type { IntegrationProtocol, StoredStreamProfile, StreamSource } from './integration';

/** Live stream kind, mapped to the integration provider's main/sub vocabulary. */
export type LiveStreamKind = 'MAIN' | 'SUB';

export interface LiveSessionView {
  id: string;
  deviceId: string;
  channelId: string;
  channelNumber: number;
  streamKind: LiveStreamKind;
  protocol: IntegrationProtocol;
  /** Credential-free description of the resolved source (for diagnostics). */
  sourceLabel: string;
  /** Playback endpoints relative to the API prefix. Never contain a credential. */
  webrtc: { endpoint: string } | null;
  hls: { manifestUrl: string };
  createdAt: string;
  expiresAt: string;
}

const KIND_TO_RTSP: Record<LiveStreamKind, RtspStreamKind> = { MAIN: 'main', SUB: 'sub' };

function apiRelativeBase(id: string): string {
  return `/cctv/live-sessions/${id}`;
}

function toView(
  row: Record<string, unknown>,
  channelNumber: number,
  protocol: IntegrationProtocol,
  sourceLabel: string,
): LiveSessionView {
  const id = row.id as string;
  const base = apiRelativeBase(id);
  return {
    id,
    deviceId: row.deviceId as string,
    channelId: row.channelId as string,
    channelNumber,
    streamKind: row.streamKind as LiveStreamKind,
    protocol,
    sourceLabel,
    webrtc: { endpoint: `${base}/whep` },
    hls: { manifestUrl: `${base}/hls/index.m3u8` },
    createdAt: (row.createdAt as Date).toISOString(),
    expiresAt: (row.expiresAt as Date).toISOString(),
  };
}

/**
 * Builds a credential-bearing RTSP URL from a credential-free source.
 *
 * The result embeds the device username/password and is used ONLY to configure
 * the internal gateway. It is never logged, persisted, or returned.
 */
export function buildAuthorizedRtspSource(
  source: StreamSource,
  device: { ipAddress: string; rtspPort: number; username: string | null; passwordEncrypted: string | null },
): string {
  const username = device.username ?? '';
  const password = decryptSecret(device.passwordEncrypted) ?? '';

  if (source.uri) {
    // ONVIF StreamUri: re-attach the stored credential, ignoring any credential
    // the device may have embedded in the URI.
    const url = new URL(source.uri);
    url.username = username ? encodeURIComponent(username) : '';
    url.password = password ? encodeURIComponent(password) : '';
    return url.toString();
  }

  const rtspPath = source.path ?? buildHikvisionRtspPath(source.channel, source.kind);
  const auth = username ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@` : '';
  return `rtsp://${auth}${device.ipAddress}:${device.rtspPort}${rtspPath}`;
}

/**
 * Loads the stored stream profiles for ONE channel. Scoping to the channel is
 * required for multi-channel ONVIF devices: passing every profile on the device
 * would let CH02 resolve to CH01's StreamUri.
 */
async function loadStoredProfiles(channelId: string): Promise<StoredStreamProfile[]> {
  try {
    const profiles = await repo.findStreamProfilesByChannelIds([channelId]);
    return profiles.map((p) => ({
      profileToken: p.profileToken as string,
      streamUri: (p.streamUri as string | null) ?? null,
      streamType: p.streamType as string,
      isMainStream: Boolean(p.isMainStream),
    }));
  } catch {
    return [];
  }
}

/**
 * Builds a credential-free, scheme-free source label (e.g. `host:554/live/0/MAIN`).
 * The API never returns a full RTSP URL (even credential-free) to the browser.
 */
function compactSourceLabel(uri: string | null | undefined): string {
  const clean = stripUriCredentials(uri);
  if (!clean) return 'stream';
  return clean.replace(/^rtsps?:\/\//i, '');
}

function assertStreamingEnabled(): void {
  if (!isStreamingEnabled()) {
    throw new AppError(503, 'STREAMING_DISABLED', 'Live View streaming is disabled.');
  }
}

let readyTimeoutMsOverride: number | null = null;

/** Overrides the readiness timeout (ms). Intended for tests. */
export function setLiveReadyTimeoutMs(ms: number | null): void {
  readyTimeoutMsOverride = ms;
}

/** Waits until the gateway reports the path ready, or times out. */
async function waitUntilReady(pathName: string, timeoutMs: number): Promise<boolean> {
  const gateway = getStreamingGateway();
  const effective = readyTimeoutMsOverride ?? timeoutMs;
  const deadline = Date.now() + effective;
  // Small initial delay lets the gateway start pulling the source.
  while (Date.now() < deadline) {
    const state = await gateway.getPath(pathName);
    if (state?.ready) return true;
    await new Promise((resolve) => setTimeout(resolve, Math.min(500, Math.max(50, effective / 10))));
  }
  return false;
}

export interface CreateLiveSessionInput {
  deviceId: string;
  channelId: string;
  streamKind: LiveStreamKind;
  userId: string | null;
}

/**
 * Opens a Live View session.
 *
 * Flow: validate device + channel -> resolve provider source -> build the
 * credential-bearing RTSP source (server-side) -> configure the gateway path ->
 * wait for the stream to be ready -> persist a session row -> return a safe view.
 *
 * The response never contains the RTSP URL or any credential.
 */
export async function createLiveSession(input: CreateLiveSessionInput): Promise<LiveSessionView> {
  assertStreamingEnabled();

  const device = await repo.findRawById(input.deviceId);
  if (!device) throw new AppError(404, 'NOT_FOUND', 'CCTV device not found.');
  if (!device.isActive) throw new AppError(409, 'DEVICE_INACTIVE', 'CCTV device is not active.');

  const channel = await repo.findChannelById(input.channelId);
  if (!channel || channel.deviceId !== input.deviceId) {
    throw new AppError(404, 'NOT_FOUND', 'CCTV channel not found for this device.');
  }
  if (!channel.isActive) throw new AppError(409, 'CHANNEL_INACTIVE', 'CCTV channel is not active.');

  // Reuse an existing active session for the same channel/kind instead of
  // opening a second gateway path on every refresh.
  const existing = await repo.findActiveLiveSession(input.deviceId, input.channelId, input.streamKind);
  if (existing && (existing.expiresAt as Date).getTime() > Date.now()) {
    await repo.touchLiveSession(
      existing.id as string,
      new Date(Date.now() + streamingGatewayConfig.sessionTtlSeconds * 1000),
    );
    return toView(
      { ...existing, expiresAt: new Date(Date.now() + streamingGatewayConfig.sessionTtlSeconds * 1000) },
      channel.channelNumber as number,
      resolveDeviceProtocol(device),
      (channel.technicalName as string | null) ?? `${input.streamKind} stream`,
    );
  }

  const activeCount = await repo.countActiveLiveSessions();
  if (activeCount >= streamingGatewayConfig.maxSessions) {
    throw new AppError(429, 'TOO_MANY_SESSIONS', 'The maximum number of live sessions is already in use.');
  }

  const protocol = resolveDeviceProtocol(device);
  const provider = buildIntegrationProvider(device);
  // Only this channel's stored profiles: Live View must keep working from the
  // last successful sync even when the management protocol (e.g. ONVIF) is down.
  const storedProfiles = await loadStoredProfiles(input.channelId);

  let source: StreamSource;
  try {
    source = await provider.resolveStreamSource({
      channel: channel.channelNumber as number,
      kind: KIND_TO_RTSP[input.streamKind],
      storedProfiles,
    });
  } catch (error) {
    const integrationError = toIntegrationError(error);
    // For ONVIF devices, make it explicit that the management protocol failed
    // but a previously-synced RTSP source may still be usable.
    const hint =
      protocol === 'ONVIF'
        ? ' ONVIF discovery failed; a previously synced RTSP stream is required for this channel.'
        : '';
    throw new AppError(502, integrationError.code, `Stream source unavailable: ${integrationError.label}.${hint}`);
  }

  if (!source.uri && !source.path) {
    const hint =
      protocol === 'ONVIF'
        ? ' No stored ONVIF StreamUri is available for this channel; run Sync while ONVIF is reachable.'
        : '';
    throw new AppError(502, 'STREAM_UNAVAILABLE', `The device did not provide a stream for this channel.${hint}`);
  }

  const gatewayPath = generateGatewayPathName();
  const gateway = getStreamingGateway();
  // A credential-free, scheme-free descriptor (never a full RTSP URL) is shown
  // to the operator purely for diagnostics.
  const sourceLabel = source.path ?? compactSourceLabel(source.uri);
  const authorizedSource = buildAuthorizedRtspSource(source, {
    ipAddress: device.ipAddress as string,
    rtspPort: (device.rtspPort as number | null) ?? 554,
    username: (device.username as string | null) ?? null,
    passwordEncrypted: (device.passwordEncrypted as string | null) ?? null,
  });

  // Ingest mode:
  //  - normalize:   a managed FFmpeg pulls the device and republishes a
  //                 browser-safe H.264 to the gateway. Required for Hikvision
  //                 streams MediaMTX corrupts on ingest (H.264 High w/ B-frames,
  //                 H.265 main streams).
  //  - passthrough: MediaMTX pulls RTSP directly (its built-in client).
  const useNormalizer =
    streamingGatewayConfig.ingestMode === 'normalize' && isFfmpegAvailable();

  try {
    if (useNormalizer) {
      // The path is a publisher; FFmpeg publishes the normalized stream into it.
      await gateway.addPath({
        name: gatewayPath,
        source: 'publisher',
        sourceOnDemand: false,
      });
      startIngest(gatewayPath, authorizedSource);
    } else {
      await gateway.addPath({
        name: gatewayPath,
        source: authorizedSource,
        sourceOnDemand: false,
        rtspTransport: 'tcp',
      });
    }
  } catch (error) {
    if (useNormalizer) stopIngest(gatewayPath);
    logger.warn({ deviceId: input.deviceId, error: (error as Error)?.message }, 'Live session gateway setup failed');
    await gateway.removePath(gatewayPath);
    throw new AppError(502, 'GATEWAY_UNAVAILABLE', 'Streaming gateway is unavailable.');
  }

  const readyTimeout = useNormalizer
    ? Math.max(streamingGatewayConfig.readyTimeoutMs, 20000)
    : streamingGatewayConfig.readyTimeoutMs;
  const ready = await waitUntilReady(gatewayPath, readyTimeout);
  if (!ready) {
    if (useNormalizer) stopIngest(gatewayPath);
    await gateway.removePath(gatewayPath);
    throw new AppError(
      502,
      'STREAM_UNAVAILABLE',
      'The stream could not be opened. Check the device credentials and channel.',
    );
  }

  const expiresAt = new Date(Date.now() + streamingGatewayConfig.sessionTtlSeconds * 1000);
  const row = await repo.createLiveSession({
    deviceId: input.deviceId,
    channelId: input.channelId,
    gatewayPath,
    streamKind: input.streamKind,
    createdBy: input.userId,
    expiresAt,
  });
  if (!row) throw new AppError(500, 'INTERNAL_SERVER_ERROR', 'Failed to create the live session.');

  return toView(row, channel.channelNumber as number, protocol, sourceLabel);
}

/** Returns a session view, refreshing its TTL. 404s when stopped/expired. */
export async function getLiveSession(id: string): Promise<LiveSessionView> {
  const row = await repo.findLiveSessionById(id);
  if (!row || row.status !== 'ACTIVE') {
    throw new AppError(404, 'NOT_FOUND', 'Live session not found.');
  }
  if ((row.expiresAt as Date).getTime() <= Date.now()) {
    throw new AppError(410, 'SESSION_EXPIRED', 'Live session has expired.');
  }
  await repo.touchLiveSession(
    id,
    new Date(Date.now() + streamingGatewayConfig.sessionTtlSeconds * 1000),
  );
  const channel = await repo.findChannelById(row.channelId as string);
  const device = await repo.findRawById(row.deviceId as string);
  return toView(
    { ...row, expiresAt: new Date(Date.now() + streamingGatewayConfig.sessionTtlSeconds * 1000) },
    (channel?.channelNumber as number) ?? 0,
    device ? resolveDeviceProtocol(device) : 'ONVIF',
    (channel?.technicalName as string | null) ?? `${row.streamKind} stream`,
  );
}

/**
 * Renews an active session's TTL (viewer heartbeat). The TTL is a safety net:
 * as long as a viewer keeps sending heartbeats the reaper will not close the
 * session, so a stream can run for hours. Only when heartbeats stop (viewer
 * left/closed) does the session expire and get cleaned up.
 */
export async function heartbeatLiveSession(
  id: string,
): Promise<{ id: string; expiresAt: string }> {
  const row = await repo.findLiveSessionById(id);
  if (!row || row.status !== 'ACTIVE') {
    throw new AppError(404, 'NOT_FOUND', 'Live session not found.');
  }
  if ((row.expiresAt as Date).getTime() <= Date.now()) {
    throw new AppError(410, 'SESSION_EXPIRED', 'Live session has expired.');
  }
  const expiresAt = new Date(Date.now() + streamingGatewayConfig.sessionTtlSeconds * 1000);
  await repo.touchLiveSession(id, expiresAt);
  return { id, expiresAt: expiresAt.toISOString() };
}

/** Stops a session and removes its gateway path. Idempotent. */
export async function stopLiveSession(id: string): Promise<{ stopped: boolean }> {
  const row = await repo.findLiveSessionById(id);
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Live session not found.');
  if (row.status === 'ACTIVE') {
    stopIngest(row.gatewayPath as string);
    await getStreamingGateway().removePath(row.gatewayPath as string);
    await repo.stopLiveSession(id);
  }
  return { stopped: true };
}

/**
 * Resolves the internal gateway path for a session, validating it is active and
 * not expired. Used by the WHEP/HLS proxy routes.
 */
export async function resolveSessionGatewayPath(id: string): Promise<string> {
  const row = await repo.findLiveSessionById(id);
  if (!row || row.status !== 'ACTIVE') {
    throw new AppError(404, 'NOT_FOUND', 'Live session not found.');
  }
  if ((row.expiresAt as Date).getTime() <= Date.now()) {
    throw new AppError(410, 'SESSION_EXPIRED', 'Live session has expired.');
  }
  return row.gatewayPath as string;
}

/**
 * Closes gateway paths for sessions whose TTL has elapsed and marks them
 * STOPPED. Returns the number reaped. Never throws.
 */
export async function reapExpiredLiveSessions(): Promise<number> {
  try {
    const expired = await repo.findExpiredLiveSessions(new Date());
    if (expired.length === 0) return 0;
    const gateway = getStreamingGateway();
    for (const row of expired) {
      stopIngest(row.gatewayPath as string);
      await gateway.removePath(row.gatewayPath as string);
      await repo.stopLiveSession(row.id as string);
    }
    logger.info({ count: expired.length }, 'Reaped expired CCTV live sessions');
    return expired.length;
  } catch (error) {
    logger.warn({ error }, 'Failed to reap expired CCTV live sessions');
    return 0;
  }
}
