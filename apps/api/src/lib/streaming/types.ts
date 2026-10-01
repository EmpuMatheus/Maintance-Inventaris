/**
 * Streaming gateway abstraction.
 *
 * The gateway is the layer between RTSP devices and the browser. It pulls the
 * RTSP source (handling Digest authentication and transport), then exposes a
 * browser-playable output (WebRTC/WHEP primary, HLS fallback).
 *
 * The concrete implementation (MediaMTX) is hidden behind this interface so a
 * different engine can be swapped in without touching the CCTV domain layer.
 *
 * SECURITY: `GatewayPathConfig.source` contains an RTSP URL with embedded
 * credentials. It is passed only to the internal gateway process and must never
 * be logged, persisted in the database, or returned to a client.
 */

export interface GatewayPathConfig {
  /** Opaque, unique gateway path name (never derived from a credential). */
  name: string;
  /** Credential-bearing RTSP source URL. Internal use only. */
  source: string;
  /** Pull the source only while a reader is connected (default true). */
  sourceOnDemand?: boolean;
  /** RTSP transport used to pull the source. Default `tcp` for stability. */
  rtspTransport?: 'tcp' | 'udp' | 'multicast' | 'automatic';
  /** Seconds a reader waits for the on-demand source before giving up. */
  sourceOnDemandStartTimeoutSeconds?: number;
  /** Seconds the on-demand source stays open after the last reader leaves. */
  sourceOnDemandCloseAfterSeconds?: number;
}

/** Runtime state of a gateway path, as reported by the control API. */
export interface GatewayPathState {
  name: string;
  /** The source is currently connected and producing media. */
  online: boolean;
  /** At least one track is available for readers. */
  ready: boolean;
}

export interface StreamingGateway {
  /** True when the gateway control API answers. */
  isAvailable(): Promise<boolean>;
  /** Creates or replaces a path configuration. */
  addPath(config: GatewayPathConfig): Promise<void>;
  /** Removes a path configuration. Missing paths are ignored. */
  removePath(name: string): Promise<void>;
  /** Reads a path's runtime state, or null when it does not exist. */
  getPath(name: string): Promise<GatewayPathState | null>;
  /** Absolute (internal) WHEP endpoint for a path. */
  webrtcEndpoint(name: string): string;
  /** Absolute (internal) HLS manifest URL for a path. */
  hlsManifestUrl(name: string): string;
  /** Absolute (internal) RTSP URL for a path, used for readiness probes. */
  rtspUrl(name: string): string;
}

export type GatewayPathNameFactory = () => string;
