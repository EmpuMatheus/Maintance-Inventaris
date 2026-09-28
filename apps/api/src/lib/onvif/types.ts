/** ONVIF credentials used for WS-Security UsernameToken digest authentication. */
export interface OnvifCredentials {
  username: string;
  password: string;
}

export interface OnvifDeviceInformation {
  manufacturer: string | null;
  model: string | null;
  firmwareVersion: string | null;
  serialNumber: string | null;
  hardwareId: string | null;
}

export interface OnvifServiceInfo {
  namespace: string;
  xAddr: string;
}

export interface OnvifVideoSource {
  token: string;
  sourceToken: string | null;
  name: string | null;
  resolution: string | null;
}

/** A single ONVIF media profile. Multiple profiles may share a video source. */
export interface OnvifMediaProfile {
  token: string;
  name: string | null;
  videoSourceToken: string | null;
  videoSourceName: string | null;
  encoderToken: string | null;
  encoding: string | null;
  resolution: string | null;
  fps: number | null;
}

/** Result of `getStreamUri` for one profile. */
export interface OnvifStreamUri {
  uri: string | null;
}

export interface OnvifClientConfig {
  host: string;
  port: number;
  credentials: OnvifCredentials;
  /** Per-request timeout in milliseconds. Defaults to 8000. */
  timeoutMs?: number;
  /** Allow plain HTTP (ONVIF default). HTTPS can be forced for hardened setups. */
  https?: boolean;
  /** Injectable fetch implementation (tests). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

/** The optional technical fields a device may or may not support. */
export const ONVIF_NAMESPACES = {
  device: 'http://www.onvif.org/ver10/device/wsdl',
  media: 'http://www.onvif.org/ver10/media/wsdl',
  media2: 'http://www.onvif.org/ver20/media/wsdl',
  tds: 'http://www.onvif.org/ver10/device/wsdl',
} as const;
