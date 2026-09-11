export type NetworkDeviceType = 'COMPUTER' | 'SWITCH';
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
  departmentId: string | null;
  departmentName: string | null;
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

/** Only identity/location/asset fields are editable; monitoring state is backend-owned. */
export interface NetworkDeviceInput {
  name: string;
  deviceType: NetworkDeviceType;
  ipAddress: string;
  hostname?: string | null;
  macAddress?: string | null;
  roomId: string;
  assetId?: string | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
