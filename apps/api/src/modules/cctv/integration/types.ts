import type { RtspStreamKind } from '../cctv.helpers';

/**
 * The protocol used to integrate with a device.
 * - ISAPI: Hikvision DVR/NVR/Recorder (device info, channel discovery/sync).
 * - ONVIF: XMEye NVR and other ONVIF-compliant devices.
 *
 * RTSP remains the streaming layer for both, but is never the integration
 * protocol for device information/discovery.
 */
export type IntegrationProtocol = 'ISAPI' | 'ONVIF';

/** Technical device information, normalised across protocols. */
export interface IntegrationDeviceInformation {
  manufacturer: string | null;
  model: string | null;
  firmwareVersion: string | null;
  serialNumber: string | null;
  hardwareId: string | null;
  deviceName?: string | null;
}

/** A single media profile / stream belonging to a channel. */
export interface IntegrationStreamProfile {
  profileToken: string;
  profileName: string | null;
  streamType: 'MAIN' | 'SUB' | 'OTHER';
  /** Credential-free stream URI when the protocol provides one. */
  streamUri: string | null;
  videoCodec: string | null;
  resolution: string | null;
  fps: number | null;
  isMainStream: boolean;
}

/**
 * A channel as discovered from the device. `externalId` is the stable device
 * identity (Hikvision channel number or ONVIF VideoSource token).
 * `channelNumber` is only set when the device itself defines the numbering
 * (Hikvision); otherwise the service allocates a stable number.
 */
export interface IntegrationChannel {
  externalId: string;
  channelNumber: number | null;
  technicalName: string | null;
  cameraIp: string | null;
  status: 'ONLINE' | 'UNKNOWN';
  profiles: IntegrationStreamProfile[];
}

/** A resolved RTSP target to probe for the Test RTSP Connection feature. */
export interface RtspProbeTarget {
  channel: number;
  stream: RtspStreamKind;
  /** Path-based target (Hikvision). */
  path?: string;
  /** URI-based target (ONVIF StreamUri). */
  uri?: string;
  /** Credential-free label shown to the user. */
  display: string;
}

/**
 * A resolved stream source for Live View. Carries the credential-free target
 * (Hikvision path or ONVIF StreamUri); the live-session service attaches the
 * device credential server-side before handing it to the gateway.
 */
export interface StreamSource {
  channel: number;
  kind: RtspStreamKind;
  /** Path-based source (Hikvision). */
  path?: string;
  /** URI-based source (ONVIF StreamUri), credential-free. */
  uri?: string;
  /** Credential-free label for diagnostics. */
  display: string;
}

/**
 * A device integration provider. Implementations encapsulate the protocol
 * specifics; the CCTV service never branches on vendor.
 */
export interface CctvIntegrationProvider {
  readonly protocol: IntegrationProtocol;
  getDeviceInformation(): Promise<IntegrationDeviceInformation>;
  discoverChannels(): Promise<IntegrationChannel[]>;
  /** ONVIF only: media service endpoints (persisted for diagnostics). */
  getServices?(): Promise<{ namespace: string; xAddr: string }[]>;
  /** ONVIF only: resolve a stream URI for a media profile. */
  getStreamUri?(profileToken: string): Promise<{ uri: string | null }>;
  /**
   * Resolves the RTSP targets to probe. Hikvision uses a path built from the
   * channel number; ONVIF uses the device-provided StreamUri.
   */
  resolveRtspTargets(options: {
    channel: number;
    kinds: RtspStreamKind[];
    storedProfiles: StoredStreamProfile[];
  }): Promise<RtspProbeTarget[]>;

  /**
   * Resolves a single credential-free stream source for Live View. Uses the
   * same vendor rules as `resolveRtspTargets`, but for one channel/kind and
   * returning only the source target (no probe).
   */
  resolveStreamSource(options: {
    channel: number;
    kind: RtspStreamKind;
    storedProfiles: StoredStreamProfile[];
  }): Promise<StreamSource>;
}

/** The stored stream profile subset the provider needs to resolve RTSP. */
export interface StoredStreamProfile {
  profileToken: string;
  streamUri: string | null;
  streamType: string;
  isMainStream: boolean;
}
