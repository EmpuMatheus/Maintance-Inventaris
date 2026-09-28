export type NetworkDeviceType = string;
export type NetworkStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

export interface NetworkDeviceRoom {
  id: string;
  code: string;
  name: string;
  location: string | null;
  floorId: string | null;
  floorName: string | null;
  buildingId: string | null;
  buildingName: string | null;
  siteId: string | null;
  siteName: string | null;
}

export interface NetworkDeviceAsset {
  id: string;
  assetCode: string;
  assetName: string;
  status: string;
  condition: string;
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
  picName: string | null;
  departmentId: string | null;
  departmentName: string | null;
}

/** Derived, read-only values returned by the asset eligibility preview. */
export interface NetworkDeviceAssetPreview {
  assetId: string;
  assetCode: string;
  assetName: string;
  subcategoryId: string | null;
  subcategoryName: string | null;
  picName: string | null;
  roomId: string | null;
  roomName: string | null;
  deviceType: NetworkDeviceType;
  hostname: string | null;
}

export interface NetworkDevice {
  id: string;
  name: string;
  deviceType: NetworkDeviceType;
  hostname: string | null;
  ipAddress: string;
  macAddress: string | null;
  roomId: string;
  assetId: string | null;
  status: NetworkStatus;
  consecutiveFailures: number;
  lastPingAt: string | null;
  lastSuccessAt: string | null;
  lastStatusChangeAt: string | null;
  offlineStartedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  room: NetworkDeviceRoom | null;
  asset: NetworkDeviceAsset | null;
}

export interface NetworkDeviceFilters {
  page?: number;
  limit?: number;
  search?: string;
  deviceType?: string;
  status?: string;
  roomId?: string;
  isActive?: boolean;
}

/**
 * Only asset + network fields are submitted. `deviceType`, `hostname` and
 * `roomId` are derived from the selected asset by the backend (source of truth).
 * Monitoring state is backend-owned.
 */
export interface NetworkDeviceInput {
  name?: string;
  ipAddress: string;
  macAddress?: string | null;
  assetId: string | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
