import { IsapiError } from '@/lib/isapi/errors';
import { fromIsapiError, IntegrationError } from '@/lib/integration/errors';
import type { IsapiClient, IsapiStreamingChannel } from '@/lib/isapi';
import { buildHikvisionRtspPath } from '../cctv.helpers';
import type { RtspStreamKind } from '../cctv.helpers';
import type {
  CctvIntegrationProvider,
  IntegrationChannel,
  IntegrationDeviceInformation,
  IntegrationStreamProfile,
  RtspProbeTarget,
  StoredStreamProfile,
  StreamSource,
} from './types';

/**
 * Hikvision ISAPI integration provider.
 *
 * Uses ISAPI (not ONVIF) for device information and channel discovery. The
 * device reports streaming channel ids such as `101` (channel 1 main) and
 * `102` (channel 1 sub); the channel number is derived from that id, so the
 * provider never hard-codes 1..16/1..32.
 *
 * RTSP targets use the Hikvision path scheme
 * `/Streaming/channels/{channel}{stream}` — only valid for Hikvision.
 */
export class HikvisionIsapiProvider implements CctvIntegrationProvider {
  readonly protocol = 'ISAPI' as const;

  constructor(private readonly client: IsapiClient) {}

  async getDeviceInformation(): Promise<IntegrationDeviceInformation> {
    try {
      const info = await this.client.getDeviceInformation();
      return {
        manufacturer: info.manufacturer,
        model: info.model,
        firmwareVersion: info.firmwareVersion,
        serialNumber: info.serialNumber,
        hardwareId: info.hardwareId,
        deviceName: info.deviceName,
      };
    } catch (error) {
      throw normalize(error);
    }
  }

  async discoverChannels(): Promise<IntegrationChannel[]> {
    let channels: IsapiStreamingChannel[];
    try {
      channels = await this.client.getStreamingChannels();
    } catch (error) {
      throw normalize(error);
    }

    // Group the per-stream ids (`101`, `102`, ...) by physical channel (`1`).
    // The main stream is the `*01` id; sub streams are `*02`, `*03`, ...
    const byChannel = new Map<number, IntegrationChannel>();
    for (const channel of channels) {
      const parsed = parseHikvisionStreamId(channel.id);
      if (!parsed) continue;

      const existing = byChannel.get(parsed.channel);
      const profile = toStreamProfile(channel, parsed.streamDigit);
      const channelRecord: IntegrationChannel = existing ?? {
        externalId: String(parsed.channel),
        channelNumber: parsed.channel,
        technicalName: channel.channelName ?? null,
        cameraIp: null,
        status: channel.enabled === false ? 'UNKNOWN' : 'ONLINE',
        profiles: [],
      };
      channelRecord.profiles.push(profile);
      if (!channelRecord.technicalName && channel.channelName) {
        channelRecord.technicalName = channel.channelName;
      }
      byChannel.set(parsed.channel, channelRecord);
    }

    return Array.from(byChannel.values())
      .sort((a, b) => (a.channelNumber ?? 0) - (b.channelNumber ?? 0))
      .map((c) => ({
        ...c,
        profiles: c.profiles.sort((a, b) => streamRank(a) - streamRank(b)),
      }));
  }

  async resolveRtspTargets(options: {
    channel: number;
    kinds: RtspStreamKind[];
    storedProfiles: StoredStreamProfile[];
  }): Promise<RtspProbeTarget[]> {
    void options.storedProfiles;
    return options.kinds.map((kind) => ({
      channel: options.channel,
      stream: kind,
      path: buildHikvisionRtspPath(options.channel, kind),
      display: buildHikvisionRtspPath(options.channel, kind),
    }));
  }

  async resolveStreamSource(options: {
    channel: number;
    kind: RtspStreamKind;
    storedProfiles: StoredStreamProfile[];
  }): Promise<StreamSource> {
    void options.storedProfiles;
    const rtspPath = buildHikvisionRtspPath(options.channel, options.kind);
    return {
      channel: options.channel,
      kind: options.kind,
      path: rtspPath,
      display: rtspPath,
    };
  }
}

/**
 * Parses a Hikvision streaming id into its channel and stream parts.
 * `101` -> channel 1, stream digit `01` (main); `102` -> channel 1, `02` (sub).
 * The stream digit is always the last two characters.
 */
export function parseHikvisionStreamId(id: string): { channel: number; streamDigit: string } | null {
  const match = /^(\d+)(\d{2})$/.exec(id.trim());
  if (!match) return null;
  const channel = Number(match[1]);
  if (!Number.isFinite(channel) || channel <= 0) return null;
  return { channel, streamDigit: match[2] };
}

function toStreamProfile(channel: IsapiStreamingChannel, streamDigit: string): IntegrationStreamProfile {
  const isMain = streamDigit === '01';
  const streamType: IntegrationStreamProfile['streamType'] = isMain
    ? 'MAIN'
    : streamDigit === '02'
      ? 'SUB'
      : 'OTHER';
  return {
    profileToken: channel.id,
    profileName: channel.channelName,
    streamType,
    streamUri: null, // Hikvision RTSP is path-based, built at probe time
    videoCodec: null,
    resolution: null,
    fps: null,
    isMainStream: isMain,
  };
}

function streamRank(profile: IntegrationStreamProfile): number {
  if (profile.streamType === 'MAIN') return 0;
  if (profile.streamType === 'SUB') return 1;
  return 2;
}

function normalize(error: unknown): IntegrationError {
  if (error instanceof IsapiError) return fromIsapiError(error);
  if (error instanceof IntegrationError) return error;
  return new IntegrationError('UNKNOWN_ERROR');
}
