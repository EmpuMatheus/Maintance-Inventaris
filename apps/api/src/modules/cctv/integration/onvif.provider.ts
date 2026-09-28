import { fromOnvifError, IntegrationError } from '@/lib/integration/errors';
import { OnvifError } from '@/lib/onvif/errors';
import { stripUriCredentials, classifyStreamType, parseFps } from '../cctv.helpers';
import type {
  CctvIntegrationProvider,
  IntegrationChannel,
  IntegrationDeviceInformation,
  IntegrationStreamProfile,
  RtspProbeTarget,
  StoredStreamProfile,
} from './types';
import type { CctvOnvifClient } from './onvif-client';
import type { RtspStreamKind } from '../cctv.helpers';

/**
 * XMEye / ONVIF integration provider.
 *
 * Uses the existing ONVIF client for device information and media/profile
 * discovery. Channels are grouped by ONVIF VideoSource token (never by profile
 * count), and RTSP targets come from the device-reported StreamUri.
 *
 * The provider never assumes a fixed channel layout: it returns exactly what
 * the device reports.
 */
export class XmeyeOnvifProvider implements CctvIntegrationProvider {
  readonly protocol = 'ONVIF' as const;

  constructor(private readonly client: CctvOnvifClient) {}

  async getDeviceInformation(): Promise<IntegrationDeviceInformation> {
    try {
      return await this.client.getDeviceInformation();
    } catch (error) {
      throw normalize(error);
    }
  }

  async getServices(): Promise<{ namespace: string; xAddr: string }[]> {
    try {
      return await this.client.getServices();
    } catch (error) {
      throw normalize(error);
    }
  }

  async getStreamUri(profileToken: string): Promise<{ uri: string | null }> {
    try {
      return await this.client.getStreamUri(profileToken);
    } catch (error) {
      throw normalize(error);
    }
  }

  async discoverChannels(): Promise<IntegrationChannel[]> {
    let videoSources: Awaited<ReturnType<CctvOnvifClient['getVideoSources']>>;
    let profiles: Awaited<ReturnType<CctvOnvifClient['getProfiles']>>;
    try {
      [videoSources, profiles] = await Promise.all([
        this.client.getVideoSources().catch(() => []),
        this.client.getProfiles(),
      ]);
    } catch (error) {
      throw normalize(error);
    }

    // Ordered, de-duplicated source keys: video sources first (device order),
    // then any profile-only sources. This mirrors Phase 1 behaviour so channel
    // identity and numbering stay stable.
    const orderedSources: string[] = [];
    videoSources.forEach((s, i) => {
      const key = s.token || `source-${i}`;
      if (!orderedSources.includes(key)) orderedSources.push(key);
    });
    profiles.forEach((p, i) => {
      const key = p.videoSourceToken || p.videoSourceName || `profile-${i}`;
      if (!orderedSources.includes(key)) orderedSources.push(key);
    });

    return orderedSources.map((sourceKey) => {
      const sourceProfiles = profiles
        .map((p, idx) => ({ p, idx }))
        .filter(({ p, idx }) => (p.videoSourceToken || p.videoSourceName || `profile-${idx}`) === sourceKey)
        .map(({ p }, j) => toStreamProfile(p, j));
      const videoSource = videoSources.find((s, idx) => (s.token || `source-${idx}`) === sourceKey) ?? null;
      const profileHint = profiles.find((p) => p.videoSourceToken === sourceKey);

      return {
        externalId: sourceKey,
        channelNumber: null,
        technicalName: videoSource?.name ?? profileHint?.videoSourceName ?? profileHint?.name ?? null,
        cameraIp: null,
        status: sourceProfiles.length > 0 ? ('ONLINE' as const) : ('UNKNOWN' as const),
        profiles: sourceProfiles,
      };
    });
  }

  async resolveRtspTargets(options: {
    channel: number;
    kinds: RtspStreamKind[];
    storedProfiles: StoredStreamProfile[];
  }): Promise<RtspProbeTarget[]> {
    // Prefer stored profiles (already-resolved URIs). When none have been
    // synced yet, discover them live from the device so Test RTSP works before
    // the first sync.
    let profiles = options.storedProfiles;
    if (profiles.length === 0) {
      const channels = await this.discoverChannels();
      const channel =
        channels.find((c) => c.channelNumber === options.channel) ??
        channels[options.channel - 1] ??
        channels[0];
      profiles =
        channel?.profiles.map((p) => ({
          profileToken: p.profileToken,
          streamUri: p.streamUri,
          streamType: p.streamType,
          isMainStream: p.isMainStream,
        })) ?? [];
    }

    const targets: RtspProbeTarget[] = [];
    for (const kind of options.kinds) {
      const profile = pickProfileForKind(profiles, kind);
      if (!profile) continue;
      let uri = profile.streamUri ? stripUriCredentials(profile.streamUri) : null;
      if (!uri) {
        try {
          const resolved = await this.client.getStreamUri(profile.profileToken);
          uri = stripUriCredentials(resolved.uri);
        } catch {
          uri = null;
        }
      }
      if (!uri) {
        targets.push({
          channel: options.channel,
          stream: kind,
          display: `${kind === 'main' ? 'main' : 'sub'} stream`,
        });
        continue;
      }
      targets.push({
        channel: options.channel,
        stream: kind,
        uri,
        display: uri,
      });
    }
    return targets;
  }
}

function toStreamProfile(
  p: Awaited<ReturnType<CctvOnvifClient['getProfiles']>>[number],
  index: number,
): IntegrationStreamProfile {
  const streamType = classifyStreamType(p.name, p.encoding, p.resolution, index);
  return {
    profileToken: p.token,
    profileName: p.name,
    streamType,
    streamUri: null, // resolved on sync via getStreamUri
    videoCodec: p.encoding,
    resolution: p.resolution,
    fps: parseFps(p.fps),
    isMainStream: streamType === 'MAIN',
  };
}

/** Chooses the stored profile matching a main/sub stream kind. */
function pickProfileForKind(
  profiles: StoredStreamProfile[],
  kind: RtspStreamKind,
): StoredStreamProfile | null {
  if (profiles.length === 0) return null;
  const wantMain = kind === 'main';
  const exact = profiles.find((p) => (wantMain ? p.streamType === 'MAIN' : p.streamType === 'SUB'));
  if (exact) return exact;
  const byFlag = profiles.find((p) => p.isMainStream === wantMain);
  if (byFlag) return byFlag;
  // Fall back to the first profile for main; for sub, fall back to any
  // non-main profile, then the first.
  if (wantMain) return profiles[0];
  return profiles.find((p) => !p.isMainStream) ?? profiles[0];
}

function normalize(error: unknown): IntegrationError {
  if (error instanceof OnvifError) return fromOnvifError(error);
  if (error instanceof IntegrationError) return error;
  return new IntegrationError('UNKNOWN_ERROR');
}
