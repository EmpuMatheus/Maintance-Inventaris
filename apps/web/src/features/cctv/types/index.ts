export type CctvDeviceType = 'DVR' | 'NVR' | 'RECORDER';
export type CctvDeviceStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
export type CctvChannelStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN' | 'MISSING';
export type CctvStreamType = 'MAIN' | 'SUB' | 'OTHER';

/**
 * Device integration protocol. Derived by the backend from the vendor/type;
 * not user-selectable.
 *   Hikvision DVR/NVR/Recorder -> ISAPI
 *   XMEye NVR / other ONVIF    -> ONVIF
 */
export type CctvIntegrationProtocol = 'ISAPI' | 'ONVIF';

export interface CctvOnvifService {
  namespace: string;
  xAddr: string;
}

/**
 * CCTV device. The backend never returns the stored password; `username` is
 * shown read-only and `password` is only ever sent on create/update.
 */
export interface CctvDevice {
  id: string;
  name: string;
  deviceType: CctvDeviceType;
  brand: string | null;
  model: string | null;
  integrationProtocol: CctvIntegrationProtocol;
  ipAddress: string;
  port: number;
  rtspPort: number;
  username: string | null;
  location: string | null;
  description: string | null;
  status: CctvDeviceStatus;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  manufacturer: string | null;
  firmwareVersion: string | null;
  serialNumber: string | null;
  hardwareId: string | null;
  onvifServices: CctvOnvifService[] | null;
  lastSyncedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CctvDeviceFilters {
  page?: number;
  limit?: number;
  search?: string;
  deviceType?: string;
  status?: string;
  isActive?: boolean;
}

/** Create/update payload. `password` is optional (unchanged when omitted). */
export interface CctvDeviceInput {
  name: string;
  deviceType: CctvDeviceType;
  brand?: string | null;
  model?: string | null;
  ipAddress: string;
  port: number;
  rtspPort?: number;
  username?: string | null;
  password?: string | null;
  location?: string | null;
  description?: string | null;
  isActive?: boolean;
}

export interface CctvDeviceSummary {
  id: string;
  name: string;
  deviceType: CctvDeviceType;
  brand: string | null;
  model: string | null;
  integrationProtocol?: CctvIntegrationProtocol;
  status: CctvDeviceStatus;
  isActive: boolean;
}

export interface CctvStreamProfile {
  id: string;
  profileToken: string;
  profileName: string | null;
  streamType: CctvStreamType;
  streamUri: string | null;
  videoCodec: string | null;
  resolution: string | null;
  fps: number | null;
  isMainStream: boolean;
}

export interface CctvChannel {
  id: string;
  deviceId: string;
  channelNumber: number;
  deviceChannelId: string | null;
  technicalName: string | null;
  name: string;
  location: string | null;
  description: string | null;
  displayOrder: number;
  cameraIp: string | null;
  status: CctvChannelStatus;
  isActive: boolean;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
  device: CctvDeviceSummary | null;
  streamProfiles: CctvStreamProfile[];
}

export interface CctvChannelFilters {
  page?: number;
  limit?: number;
  deviceId?: string;
  status?: string;
  search?: string;
  isActive?: boolean;
}

export interface CctvChannelInput {
  name?: string;
  location?: string | null;
  description?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}

export interface TestConnectionStep {
  key: string;
  label: string;
  ok: boolean;
  detail?: string | null;
}

export interface TestConnectionResult {
  protocol: CctvIntegrationProtocol;
  reachable: boolean;
  /** Historical name: true when the protocol service (ISAPI/ONVIF) is available. */
  onvifAvailable: boolean;
  protocolAvailable: boolean;
  authenticated: boolean;
  infoRetrieved: boolean;
  success: boolean;
  status: CctvDeviceStatus;
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

export interface SyncResult {
  deviceId: string;
  syncedAt: string;
  channels: { created: number; updated: number; missing: number; total: number };
  profiles: number;
  deviceInformation: TestConnectionResult['deviceInformation'];
}

export type RtspStreamKind = 'main' | 'sub';

export interface RtspTestStep {
  key: string;
  label: string;
  ok: boolean;
  detail?: string | null;
}

export interface RtspStreamTestResult {
  channel: number;
  stream: RtspStreamKind;
  path: string;
  success: boolean;
  latencyMs: number | null;
  authenticated: boolean;
  errorCode: string | null;
  errorMessage: string | null;
}

/** Result of POST /cctv/devices/:id/test-rtsp. Never contains credentials. */
export interface TestRtspResult {
  protocol: CctvIntegrationProtocol;
  success: boolean;
  message: string;
  device: {
    id: string;
    name: string;
    ipAddress: string;
    rtspPort: number;
  };
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

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
