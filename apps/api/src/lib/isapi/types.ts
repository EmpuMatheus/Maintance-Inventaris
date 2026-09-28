/**
 * Hikvision ISAPI integration layer types.
 *
 * This is a transport-only layer: it speaks ISAPI over HTTP(S) and returns
 * plain domain objects. It knows nothing about the database or business rules;
 * the CCTV integration provider composes it.
 */

export interface IsapiCredentials {
  username: string;
  password: string;
}

export interface IsapiClientConfig {
  host: string;
  /** ISAPI/HTTP management port from the device configuration. */
  port: number;
  credentials: IsapiCredentials;
  /** Per-request timeout in milliseconds. Defaults to 8000. */
  timeoutMs?: number;
  /** Force HTTPS. Defaults to true when the port is 443. */
  https?: boolean;
  /** Injectable fetch implementation (tests). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export interface IsapiDeviceInformation {
  manufacturer: string | null;
  model: string | null;
  firmwareVersion: string | null;
  serialNumber: string | null;
  hardwareId: string | null;
  deviceName: string | null;
}

/**
 * A streaming channel as reported by ISAPI. `id` is the Hikvision stream id
 * (e.g. `101` = channel 1 main, `102` = channel 1 sub).
 */
export interface IsapiStreamingChannel {
  id: string;
  channelName: string | null;
  rtspPort: number | null;
  enabled: boolean | null;
}
