import { AppError } from '@/middleware/error-handler';
import { encryptSecret, decryptSecret } from '@/lib/crypto/secret-box';
import { RtspProbeClient, RtspError } from '@/lib/rtsp';
import type { RtspCredentials, RtspProbeResult } from '@/lib/rtsp';
import { toIntegrationError } from '@/lib/integration/errors';
import { env } from '@/config/env';
import * as repo from './cctv.repository';
import { stripUriCredentials } from './cctv.helpers';
import type { RtspStreamKind } from './cctv.helpers';
import {
  buildIntegrationProvider,
  resolveIntegrationProtocol,
  resolveDeviceProtocol,
  setCctvClientFactory,
  resetCctvClientFactory,
  setCctvIsapiClientFactory,
  resetCctvIsapiClientFactory,
} from './integration';
import type {
  CctvOnvifClient,
  IntegrationProtocol,
  StoredStreamProfile,
} from './integration';

// Backwards-compatible re-exports (Phase 1 tests/consumers import these from
// the service). The implementation lives in ./integration.
export {
  setCctvClientFactory,
  resetCctvClientFactory,
  setCctvIsapiClientFactory,
  resetCctvIsapiClientFactory,
  resolveIntegrationProtocol,
};
export type { CctvOnvifClient };

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  deviceType?: string;
  status?: string;
  isActive?: boolean;
}

export interface CreateInput {
  name: string;
  deviceType?: string;
  brand?: string | null;
  model?: string | null;
  ipAddress: string;
  port?: number;
  rtspPort?: number;
  username?: string | null;
  password?: string | null;
  location?: string | null;
  description?: string | null;
  isActive?: boolean;
}

export interface UpdateInput {
  name?: string;
  deviceType?: string;
  brand?: string | null;
  model?: string | null;
  ipAddress?: string;
  port?: number;
  rtspPort?: number;
  username?: string | null;
  password?: string | null;
  location?: string | null;
  description?: string | null;
}

export interface TestConnectionStep {
  key: string;
  label: string;
  ok: boolean;
  detail?: string | null;
}

export interface TestConnectionResult {
  /** Derived integration protocol used for this test (ISAPI | ONVIF). */
  protocol: IntegrationProtocol;
  reachable: boolean;
  /**
   * True when the protocol service (ISAPI or ONVIF) was reachable.
   * Kept under the historical name for API compatibility.
   */
  onvifAvailable: boolean;
  /** Same value as `onvifAvailable`, exposed under a protocol-neutral name. */
  protocolAvailable: boolean;
  authenticated: boolean;
  infoRetrieved: boolean;
  success: boolean;
  status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
  errorCode: string | null;
  errorMessage: string | null;
  deviceInformation: {
    manufacturer: string | null;
    model: string | null;
    firmwareVersion: string | null;
    serialNumber: string | null;
    hardwareId: string | null;
  } | null;
  steps: TestConnectionStep[];
  checkedAt: string;
}

interface SyncChannelOutcome {
  created: number;
  updated: number;
  missing: number;
  total: number;
}

export interface SyncResult {
  deviceId: string;
  syncedAt: string;
  channels: SyncChannelOutcome;
  profiles: number;
  deviceInformation: TestConnectionResult['deviceInformation'];
}

function getPostgresErrorCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const e = err as { code?: unknown; cause?: unknown };
  if (typeof e.code === 'string') return e.code;
  if (e.cause && typeof e.cause === 'object') {
    const c = e.cause as { code?: unknown };
    if (typeof c.code === 'string') return c.code;
  }
  return undefined;
}

function isUniqueViolation(err: unknown): boolean {
  return getPostgresErrorCode(err) === '23505';
}

/**
 * The RTSP operations the CCTV service depends on. Kept as an interface so a
 * fake can be injected in tests without opening a real socket.
 *
 * - `describe(path)` probes a Hikvision path on the configured RTSP endpoint.
 * - `describeUri(uri)` probes a device-provided (ONVIF) URI; optional so simple
 *   fakes remain valid.
 */
export interface CctvRtspClient {
  describe(path: string): Promise<RtspProbeResult>;
  describeUri?(uri: string): Promise<RtspProbeResult>;
}

export type CctvRtspClientFactory = (device: Record<string, unknown>) => CctvRtspClient;

/**
 * Builds an RTSP probe client from a raw device row. The decrypted password is
 * used only for the in-memory digest handshake and never leaves this function.
 */
function defaultBuildRtspClient(device: Record<string, unknown>): CctvRtspClient {
  const password = decryptSecret(device.passwordEncrypted as string | null) ?? '';
  const credentials: RtspCredentials = {
    username: (device.username as string | null) ?? '',
    password,
  };
  return new RtspProbeClient({
    host: device.ipAddress as string,
    port: (device.rtspPort as number | null) ?? 554,
    credentials,
    timeoutMs: env.CCTV_RTSP_TIMEOUT_MS,
  });
}

let rtspClientFactory: CctvRtspClientFactory = defaultBuildRtspClient;

/** Overrides the RTSP client factory. Intended for dependency injection/tests. */
export function setCctvRtspClientFactory(factory: CctvRtspClientFactory): void {
  rtspClientFactory = factory;
}

/** Restores the default RTSP client factory. */
export function resetCctvRtspClientFactory(): void {
  rtspClientFactory = defaultBuildRtspClient;
}

function buildRtspClient(device: Record<string, unknown>): CctvRtspClient {
  return rtspClientFactory(device);
}

/* ------------------------- RTSP connection test ------------------------- */

export interface RtspStreamTestResult {
  channel: number;
  stream: RtspStreamKind;
  /**
   * Credential-free target descriptor: a Hikvision path
   * (`/Streaming/channels/102`) or an ONVIF-derived stream URI. Never contains
   * a password.
   */
  path: string;
  success: boolean;
  latencyMs: number | null;
  authenticated: boolean;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface RtspTestStep {
  key: string;
  label: string;
  ok: boolean;
  detail?: string | null;
}

/** Internal shape for a target-resolution failure. */
interface RtspTestStreamFailure {
  errorCode: string;
  errorMessage: string;
}

export interface TestRtspResult {
  /** Derived integration protocol that determined how the stream was resolved. */
  protocol: IntegrationProtocol;
  success: boolean;
  message: string;
  device: {
    id: string;
    name: string;
    ipAddress: string;
    rtspPort: number;
  };
  /** The channel/stream actually probed (defaults to channel 1 sub stream). */
  channel: number;
  stream: RtspStreamKind;
  path: string;
  latencyMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  streams: RtspStreamTestResult[];
  steps: RtspTestStep[];
  checkedAt: string;
}



/** Builds the ordered Test Connection checklist from a failure point onwards. */
function buildSteps(
  result: {
    reachable: boolean;
    onvifAvailable: boolean;
    authenticated: boolean;
    infoRetrieved: boolean;
    errorMessage?: string | null;
  },
  protocol: IntegrationProtocol,
): TestConnectionStep[] {
  const steps: TestConnectionStep[] = [
    { key: 'reachable', label: 'Device reachable', ok: result.reachable },
    {
      key: 'protocol',
      label: `${protocol} available`,
      ok: result.onvifAvailable,
    },
    { key: 'auth', label: 'Authentication successful', ok: result.authenticated },
    { key: 'info', label: 'Device information retrieved', ok: result.infoRetrieved },
  ];
  return steps;
}

export async function list(params: ListParams) {
  return repo.findMany(params);
}

export async function getById(id: string) {
  const row = await repo.findById(id);
  if (!row) throw new AppError(404, 'NOT_FOUND', 'CCTV device not found.');
  return row;
}

export async function create(body: CreateInput) {
  const isActive = body.isActive ?? true;
  if (isActive) {
    const existing = await repo.findActiveByEndpoint(body.ipAddress, body.port ?? 80);
    if (existing) {
      throw new AppError(409, 'CONFLICT', 'An active CCTV device already uses this IP and port.');
    }
  }

  const brand = body.brand?.trim() || null;
  const model = body.model?.trim() || null;
  const deviceType = body.deviceType ?? 'DVR';

  try {
    const row = await repo.create({
      name: body.name.trim(),
      deviceType,
      brand,
      model,
      integrationProtocol: resolveIntegrationProtocol({ brand, model, deviceType }),
      ipAddress: body.ipAddress,
      port: body.port ?? 80,
      rtspPort: body.rtspPort ?? 554,
      username: body.username?.trim() || null,
      passwordEncrypted: encryptSecret(body.password),
      location: body.location?.trim() || null,
      description: body.description?.trim() || null,
      isActive,
      status: 'UNKNOWN',
    });
    return repo.findById(row.id as string);
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      throw new AppError(409, 'CONFLICT', 'An active CCTV device already uses this IP and port.');
    }
    throw err;
  }
}

export async function update(id: string, body: UpdateInput) {
  const existing = await repo.findRawById(id);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'CCTV device not found.');

  const data: Record<string, unknown> = {};

  if (body.name !== undefined) data.name = body.name.trim();
  if (body.deviceType !== undefined) data.deviceType = body.deviceType;
  if (body.brand !== undefined) data.brand = body.brand?.trim() || null;
  if (body.model !== undefined) data.model = body.model?.trim() || null;
  if (body.username !== undefined) data.username = body.username?.trim() || null;
  if (body.location !== undefined) data.location = body.location?.trim() || null;
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  // Password: only re-encrypt when a value is provided. An empty string is
  // treated as "clear password"; undefined leaves it unchanged.
  if (body.password !== undefined) data.passwordEncrypted = encryptSecret(body.password);

  const endpointChanged =
    body.ipAddress !== undefined && body.ipAddress !== (existing.ipAddress as string);
  const portChanged = body.port !== undefined && body.port !== (existing.port as number);

  if (body.ipAddress !== undefined) data.ipAddress = body.ipAddress;
  if (body.port !== undefined) data.port = body.port;
  if (body.rtspPort !== undefined) data.rtspPort = body.rtspPort;

  if ((endpointChanged || portChanged) && existing.isActive) {
    const dup = await repo.findActiveByEndpoint(
      (body.ipAddress ?? existing.ipAddress) as string,
      (body.port ?? existing.port) as number,
      id,
    );
    if (dup) throw new AppError(409, 'CONFLICT', 'An active CCTV device already uses this IP and port.');
  }

  // Connection state is backend-owned; never accept it via update.
  delete data.status;
  delete data.lastError;
  delete data.isActive;
  delete data.lastCheckedAt;

  // Re-derive the integration protocol whenever the vendor/type inputs change.
  if (
    body.brand !== undefined ||
    body.model !== undefined ||
    body.deviceType !== undefined
  ) {
    data.integrationProtocol = resolveIntegrationProtocol({
      brand: body.brand !== undefined ? data.brand : existing.brand,
      model: body.model !== undefined ? data.model : existing.model,
      deviceType: body.deviceType !== undefined ? data.deviceType : existing.deviceType,
    });
  }

  if (Object.keys(data).length === 0) {
    return repo.findById(id);
  }

  try {
    await repo.update(id, data);
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      throw new AppError(409, 'CONFLICT', 'An active CCTV device already uses this IP and port.');
    }
    throw err;
  }

  return repo.findById(id);
}

export async function setActive(id: string, isActive: boolean) {
  const existing = await repo.findRawById(id);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'CCTV device not found.');

  if (isActive) {
    const dup = await repo.findActiveByEndpoint(
      existing.ipAddress as string,
      existing.port as number,
      id,
    );
    if (dup) {
      throw new AppError(409, 'CONFLICT', 'Another active CCTV device already uses this IP and port.');
    }
  }

  await repo.setActive(id, isActive);
  return repo.findById(id);
}

/**
 * Runs the Test Connection flow using the device's derived integration
 * protocol:
 *
 *   Hikvision -> ISAPI  (connectivity -> auth -> device information)
 *   XMEye     -> ONVIF  (connectivity -> auth -> device information)
 *
 * Every failure is classified (see IntegrationError) and persisted as the
 * device status + a sanitized last error. The plaintext credential is never
 * logged.
 */
export async function testConnection(id: string): Promise<TestConnectionResult> {
  const device = await repo.findRawById(id);
  if (!device) throw new AppError(404, 'NOT_FOUND', 'CCTV device not found.');

  const protocol = resolveDeviceProtocol(device);
  const checkedAt = new Date();
  const result: TestConnectionResult = {
    protocol,
    reachable: false,
    onvifAvailable: false,
    protocolAvailable: false,
    authenticated: false,
    infoRetrieved: false,
    success: false,
    status: 'UNKNOWN',
    errorCode: null,
    errorMessage: null,
    deviceInformation: null,
    steps: [],
    checkedAt: checkedAt.toISOString(),
  };

  try {
    const provider = buildIntegrationProvider(device);
    // getDeviceInformation exercises connectivity, the protocol service and
    // authentication in a single round trip, then yields the technical info.
    const info = await provider.getDeviceInformation();

    result.reachable = true;
    result.onvifAvailable = true;
    result.protocolAvailable = true;
    result.authenticated = true;
    result.infoRetrieved = true;
    result.success = true;
    result.status = 'ONLINE';
    result.deviceInformation = {
      manufacturer: info.manufacturer,
      model: info.model,
      firmwareVersion: info.firmwareVersion,
      serialNumber: info.serialNumber,
      hardwareId: info.hardwareId,
    };

    // ONVIF exposes service endpoints; ISAPI has no equivalent. Persist them
    // only when the provider offers them.
    let services: unknown;
    if (provider.getServices) {
      try {
        services = await provider.getServices();
      } catch {
        services = undefined;
      }
    }

    await repo.recordConnectionResult(id, {
      status: 'ONLINE',
      lastCheckedAt: checkedAt,
      lastSuccessAt: checkedAt,
      lastError: null,
      info: {
        manufacturer: info.manufacturer,
        model: info.model,
        firmwareVersion: info.firmwareVersion,
        serialNumber: info.serialNumber,
        hardwareId: info.hardwareId,
        onvifServices: services,
        integrationProtocol: protocol,
      },
    });

    // Fill brand/model from the device only when the user has not set them.
    if ((!device.brand || !device.model) && (info.manufacturer || info.model)) {
      const patch: Record<string, unknown> = {};
      if (!device.brand && info.manufacturer) patch.brand = info.manufacturer;
      if (!device.model && info.model) patch.model = info.model;
      if (Object.keys(patch).length > 0) await repo.update(id, patch);
    }
  } catch (error) {
    const integrationError = toIntegrationError(error);
    result.errorCode = integrationError.code;
    result.errorMessage = integrationError.label;

    // Map how far the flow got, based on the failure code.
    switch (integrationError.code) {
      case 'AUTHENTICATION_FAILED':
        result.reachable = true;
        result.onvifAvailable = true;
        result.protocolAvailable = true;
        result.authenticated = false;
        break;
      case 'ISAPI_UNAVAILABLE':
      case 'ONVIF_UNAVAILABLE':
      case 'PROTOCOL_SERVICE_ERROR':
      case 'INVALID_RESPONSE':
        result.reachable = true;
        result.onvifAvailable = false;
        result.protocolAvailable = false;
        break;
      case 'DEVICE_UNREACHABLE':
      case 'CONNECTION_TIMEOUT':
      default:
        result.reachable = false;
        break;
    }

    // Any failure means the device is not usable right now.
    result.status = 'OFFLINE';
    await repo.recordConnectionResult(id, {
      status: 'OFFLINE',
      lastCheckedAt: checkedAt,
      lastError: integrationError.label,
      info: { integrationProtocol: protocol },
    });
  }

  result.steps = buildSteps(result, protocol);
  return result;
}

/**
 * Tests RTSP connectivity for a device.
 *
 * The integration provider decides HOW the stream target is determined:
 *   Hikvision -> ISAPI channel data -> Hikvision RTSP path
 *   XMEye     -> ONVIF media profile -> device-provided StreamUri
 *
 * The default probe is channel 1 sub stream. Credentials are used only in
 * memory for the RTSP Digest handshake; the response contains a credential-free
 * path/URI and never a password.
 */
export async function testRtspConnection(
  id: string,
  options: { channel?: number; includeMain?: boolean } = {},
): Promise<TestRtspResult> {
  const device = await repo.findRawById(id);
  if (!device) throw new AppError(404, 'NOT_FOUND', 'CCTV device not found.');

  const protocol = resolveDeviceProtocol(device);
  const channel = options.channel && options.channel > 0 ? options.channel : 1;
  const includeMain = options.includeMain ?? false;
  const kinds: RtspStreamKind[] = includeMain ? ['main', 'sub'] : ['sub'];

  const rtspPort = (device.rtspPort as number | null) ?? 554;
  const checkedAt = new Date();
  const client = buildRtspClient(device);
  const provider = buildIntegrationProvider(device);

  // Stored profiles let the ONVIF provider reuse an already-resolved StreamUri.
  const storedProfiles = await loadStoredProfiles(device);

  let targets: Awaited<ReturnType<typeof provider.resolveRtspTargets>> = [];
  let resolutionError: RtspTestStreamFailure | null = null;
  try {
    targets = await provider.resolveRtspTargets({ channel, kinds, storedProfiles });
  } catch (error) {
    // Resolving the target failed (e.g. ONVIF auth/discovery). Report this
    // instead of probing a fabricated path.
    const integrationError = toIntegrationError(error);
    resolutionError = {
      errorCode: integrationError.code,
      errorMessage: integrationError.label,
    };
    // No target was resolved; still surface one failure per requested stream so
    // the error is not silently swallowed.
    targets = kinds.map((kind) => ({ channel, stream: kind, display: `${kind} stream` }));
  }

  const streams: RtspStreamTestResult[] = [];
  for (const target of targets) {
    const label = target.display;
    // A target without a path or URI means the device could not provide one.
    if (!target.uri && !target.path) {
      streams.push({
        channel: target.channel,
        stream: target.stream,
        path: label,
        success: false,
        latencyMs: null,
        authenticated: false,
        errorCode: resolutionError?.errorCode ?? 'STREAM_UNAVAILABLE',
        errorMessage: resolutionError?.errorMessage ?? 'Stream unavailable',
      });
      continue;
    }
    try {
      const probe = target.uri
        ? client.describeUri
          ? await client.describeUri(target.uri)
          : await client.describe(target.uri)
        : await client.describe(target.path!);
      streams.push({
        channel: target.channel,
        stream: target.stream,
        path: label,
        success: true,
        latencyMs: probe.latencyMs,
        authenticated: probe.authenticated,
        errorCode: null,
        errorMessage: null,
      });
    } catch (error) {
      const rtspError = error instanceof RtspError ? error : new RtspError('UNKNOWN_ERROR');
      streams.push({
        channel: target.channel,
        stream: target.stream,
        path: label,
        success: false,
        latencyMs: null,
        authenticated: false,
        errorCode: rtspError.code,
        errorMessage: rtspError.label,
      });
    }
  }

  // The tested stream is the one the caller asked for (default: channel sub).
  const primary = streams[streams.length - 1] ?? {
    channel,
    stream: 'sub' as RtspStreamKind,
    path: '-',
    success: false,
    latencyMs: null,
    authenticated: false,
    errorCode: 'STREAM_UNAVAILABLE',
    errorMessage: 'Stream unavailable',
  };
  const success = streams.length > 0 && streams.every((s) => s.success);

  const steps: RtspTestStep[] = [
    { key: 'reachable', label: 'Device reachable', ok: streams.some((s) => s.success) },
    ...streams.map((s) => ({
      key: `${s.stream}-stream`,
      label: `${s.stream === 'main' ? 'Main' : 'Sub'} stream (${s.path})`,
      ok: s.success,
      detail: s.success ? null : s.errorMessage,
    })),
  ];

  let message: string;
  if (success) {
    message = `RTSP ${primary.stream} stream channel ${primary.channel} is accessible.`;
  } else if (primary.errorCode === 'DEVICE_UNREACHABLE') {
    message = 'RTSP test failed: device unreachable.';
  } else {
    message = `RTSP test failed: ${primary.errorMessage}.`;
  }

  return {
    protocol,
    success,
    message,
    device: {
      id: device.id as string,
      name: device.name as string,
      ipAddress: device.ipAddress as string,
      rtspPort,
    },
    channel: primary.channel,
    stream: primary.stream,
    path: primary.path,
    latencyMs: primary.latencyMs,
    errorCode: primary.errorCode,
    errorMessage: primary.errorMessage,
    streams,
    steps,
    checkedAt: checkedAt.toISOString(),
  };
}

/** Loads the device's stored stream profiles as provider input. */
async function loadStoredProfiles(
  device: Record<string, unknown>,
): Promise<StoredStreamProfile[]> {
  try {
    const channels = await repo.findChannelsByDevice(device.id as string);
    const channelIds = channels.map((c) => c.id as string);
    const profiles = await repo.findStreamProfilesByChannelIds(channelIds);
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
 * Synchronises channels and stream profiles from the device, using the
 * derived integration protocol:
 *   Hikvision -> ISAPI channel discovery
 *   XMEye     -> ONVIF video source/profile discovery
 *
 * Identity rules:
 * - Channels are matched on their stable device identity (`device_channel_id`).
 *   Hikvision provides the channel number; ONVIF provides a VideoSource token.
 * - Operational fields (name/location/description/order/isActive) are never
 *   written by sync.
 * - Channels that disappear are marked MISSING, never deleted.
 */
export async function syncChannels(id: string): Promise<SyncResult> {
  const device = await repo.findRawById(id);
  if (!device) throw new AppError(404, 'NOT_FOUND', 'CCTV device not found.');

  const protocol = resolveDeviceProtocol(device);
  const provider = buildIntegrationProvider(device);
  const syncedAt = new Date();

  // 1) Connectivity + authentication + device information (required).
  let info;
  try {
    info = await provider.getDeviceInformation();
  } catch (error) {
    const integrationError = toIntegrationError(error);
    await repo.recordConnectionResult(id, {
      status: 'OFFLINE',
      lastCheckedAt: syncedAt,
      lastError: integrationError.label,
      info: { integrationProtocol: protocol },
    });
    throw new AppError(502, integrationError.code, `Sync failed: ${integrationError.label}.`);
  }

  // 2) The provider returns exactly the channels the device reports.
  let discovered;
  try {
    discovered = await provider.discoverChannels();
  } catch (error) {
    const integrationError = toIntegrationError(error);
    await repo.recordConnectionResult(id, {
      status: 'OFFLINE',
      lastCheckedAt: syncedAt,
      lastError: integrationError.label,
      info: { integrationProtocol: protocol },
    });
    throw new AppError(502, integrationError.code, `Sync failed: ${integrationError.label}.`);
  }

  // Existing channels keyed by their stable device identity. This keeps a
  // channel's number/user data stable across syncs, even when channels are
  // added or removed.
  const existingChannels = (await repo.findChannelsByDevice(id)) as Record<string, unknown>[];
  const byExternalId = new Map<string, Record<string, unknown>>();
  const usedNumbers = new Set<number>();
  for (const c of existingChannels) {
    usedNumbers.add(c.channelNumber as number);
    if (typeof c.deviceChannelId === 'string' && c.deviceChannelId) {
      byExternalId.set(c.deviceChannelId, c);
    }
  }
  let nextNumber = usedNumbers.size > 0 ? Math.max(...usedNumbers) + 1 : 1;

  let created = 0;
  let updated = 0;
  let profileCount = 0;
  const keptChannelIds: string[] = [];

  for (const channel of discovered) {
    const existing = byExternalId.get(channel.externalId) ?? null;

    // Prefer the device-defined number (Hikvision); otherwise reuse the stored
    // number, or allocate a new stable one (ONVIF).
    let channelNumber: number;
    if (existing) {
      channelNumber = existing.channelNumber as number;
    } else if (channel.channelNumber && !usedNumbers.has(channel.channelNumber)) {
      channelNumber = channel.channelNumber;
      usedNumbers.add(channelNumber);
      if (channelNumber >= nextNumber) nextNumber = channelNumber + 1;
    } else {
      while (usedNumbers.has(nextNumber)) nextNumber += 1;
      channelNumber = nextNumber;
      usedNumbers.add(channelNumber);
      nextNumber += 1;
    }

    const upserted = await repo.upsertChannelTechnical(id, channelNumber, {
      deviceChannelId: channel.externalId,
      technicalName: channel.technicalName,
      cameraIp: channel.cameraIp,
      status: channel.status,
      lastSyncAt: syncedAt,
    });

    if (existing) updated += 1;
    else created += 1;

    if (upserted?.id) keptChannelIds.push(upserted.id as string);

    const channelId = upserted?.id as string | undefined;
    if (!channelId) continue;

    const profileInputs = [];
    for (const p of channel.profiles) {
      let streamUri = p.streamUri ? stripUriCredentials(p.streamUri) : null;
      // ONVIF exposes stream URIs via GetStreamUri; resolve them if not already
      // present. Hikvision profiles are path-based and have no stored URI.
      if (!streamUri && provider.getStreamUri && p.profileToken) {
        try {
          const stream = await provider.getStreamUri(p.profileToken);
          streamUri = stripUriCredentials(stream.uri);
        } catch {
          streamUri = null;
        }
      }
      profileInputs.push({
        profileToken: p.profileToken,
        profileName: p.profileName,
        streamType: p.streamType,
        streamUri,
        videoCodec: p.videoCodec,
        resolution: p.resolution,
        fps: p.fps,
        isMainStream: p.isMainStream,
      });
    }

    if (profileInputs.length > 0) {
      await repo.upsertStreamProfiles(channelId, profileInputs);
      await repo.deleteStreamProfilesNotIn(
        channelId,
        profileInputs.map((p) => p.profileToken),
      );
      profileCount += profileInputs.length;
    }
  }

  const missingCount = await markMissing(id, keptChannelIds, syncedAt);

  await repo.recordConnectionResult(id, {
    status: 'ONLINE',
    lastCheckedAt: syncedAt,
    lastSuccessAt: syncedAt,
    lastError: null,
    info: {
      manufacturer: info.manufacturer,
      model: info.model,
      firmwareVersion: info.firmwareVersion,
      serialNumber: info.serialNumber,
      hardwareId: info.hardwareId,
      integrationProtocol: protocol,
    },
  });
  await repo.markSynced(id, syncedAt);

  return {
    deviceId: id,
    syncedAt: syncedAt.toISOString(),
    channels: { created, updated, missing: missingCount, total: discovered.length },
    profiles: profileCount,
    deviceInformation: {
      manufacturer: info.manufacturer,
      model: info.model,
      firmwareVersion: info.firmwareVersion,
      serialNumber: info.serialNumber,
      hardwareId: info.hardwareId,
    },
  };
}

/** Returns how many channels were newly marked MISSING by this sync. */
async function markMissing(deviceId: string, keepChannelIds: string[], at: Date): Promise<number> {
  const before = await repo.findChannelsByDevice(deviceId);
  const beforeMissing = before.filter((c) => c.status === 'MISSING').length;
  await repo.markChannelsMissing(deviceId, keepChannelIds, at);
  const after = await repo.findChannelsByDevice(deviceId);
  const afterMissing = after.filter((c) => c.status === 'MISSING').length;
  return Math.max(0, afterMissing - beforeMissing);
}

/* ------------------------------ Channels ------------------------------ */

export interface ChannelListParams {
  page?: number;
  limit?: number;
  deviceId?: string;
  status?: string;
  search?: string;
  isActive?: boolean;
}

export async function listChannels(params: ChannelListParams) {
  const result = await repo.findManyChannels(params);
  const deviceIds = Array.from(new Set(result.data.map((c) => c.deviceId)));
  const devices = await repo.findDeviceSummaries(deviceIds);
  const deviceMap = new Map(devices.map((d) => [d.id as string, d]));

  const channelIds = result.data.map((c) => c.id);
  const profiles = await repo.findStreamProfilesByChannelIds(channelIds);
  const profilesByChannel = new Map<string, Record<string, unknown>[]>();
  for (const p of profiles) {
    const key = p.channelId as string;
    if (!profilesByChannel.has(key)) profilesByChannel.set(key, []);
    profilesByChannel.get(key)!.push({
      id: p.id,
      profileToken: p.profileToken,
      profileName: p.profileName,
      streamType: p.streamType,
      streamUri: p.streamUri,
      videoCodec: p.videoCodec,
      resolution: p.resolution,
      fps: p.fps,
      isMainStream: p.isMainStream,
    });
  }

  return {
    data: result.data.map((c) => ({
      ...c,
      device: deviceMap.has(c.deviceId)
        ? {
            id: deviceMap.get(c.deviceId)!.id,
            name: deviceMap.get(c.deviceId)!.name,
            deviceType: deviceMap.get(c.deviceId)!.deviceType,
            brand: deviceMap.get(c.deviceId)!.brand,
            model: deviceMap.get(c.deviceId)!.model,
            status: deviceMap.get(c.deviceId)!.status,
            isActive: deviceMap.get(c.deviceId)!.isActive,
          }
        : null,
      streamProfiles: profilesByChannel.get(c.id) ?? [],
    })),
    meta: result.meta,
  };
}

export async function getChannelById(id: string) {
  const channel = await repo.findChannelById(id);
  if (!channel) throw new AppError(404, 'NOT_FOUND', 'CCTV channel not found.');
  const [device] = await repo.findDeviceSummaries([channel.deviceId]);
  const profiles = await repo.findStreamProfilesByChannelIds([channel.id]);
  return {
    ...channel,
    device: device ?? null,
    streamProfiles: profiles.map((p) => ({
      id: p.id,
      profileToken: p.profileToken,
      profileName: p.profileName,
      streamType: p.streamType,
      streamUri: p.streamUri,
      videoCodec: p.videoCodec,
      resolution: p.resolution,
      fps: p.fps,
      isMainStream: p.isMainStream,
    })),
  };
}

export async function updateChannel(
  id: string,
  data: {
    name?: string;
    location?: string | null;
    description?: string | null;
    displayOrder?: number;
    isActive?: boolean;
  },
) {
  const channel = await repo.findChannelById(id);
  if (!channel) throw new AppError(404, 'NOT_FOUND', 'CCTV channel not found.');
  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name.trim() || 'Belum diatur';
  if (data.location !== undefined) patch.location = data.location?.trim() || null;
  if (data.description !== undefined) patch.description = data.description?.trim() || null;
  if (data.displayOrder !== undefined) patch.displayOrder = data.displayOrder;
  if (data.isActive !== undefined) patch.isActive = data.isActive;
  if (Object.keys(patch).length === 0) return getChannelById(id);
  await repo.updateChannelOperational(id, patch as any);
  return getChannelById(id);
}
