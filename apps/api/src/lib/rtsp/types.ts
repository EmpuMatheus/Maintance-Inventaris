/**
 * RTSP integration layer types.
 *
 * This layer performs a transport-only RTSP probe (DESCRIBE) against a device.
 * It knows nothing about the database, brands or business rules; the CCTV
 * service composes it. Only the RTSP path is passed per call, the endpoint and
 * credentials come from the stored device configuration.
 */

export interface RtspCredentials {
  username: string;
  password: string;
}

export interface RtspClientConfig {
  host: string;
  /** RTSP port from the device configuration (never hard-coded). */
  port: number;
  credentials: RtspCredentials;
  /** Per-probe timeout in milliseconds. Defaults to 8000. */
  timeoutMs?: number;
}

/** Successful RTSP probe outcome. */
export interface RtspProbeResult {
  statusCode: number;
  latencyMs: number;
  /** True when a digest challenge was answered successfully. */
  authenticated: boolean;
  /**
   * Number of video frames actually decoded during the probe, when the probe
   * decodes media (FFmpeg-based probe). Undefined for transport-only probes
   * that only perform RTSP DESCRIBE.
   */
  decodedFrames?: number;
  /** How long the probe read media for, in milliseconds (FFmpeg probe only). */
  durationMs?: number;
}
