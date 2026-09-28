export const CCTV_PERMISSIONS = {
  deviceRead: 'cctv_device.read',
  deviceManage: 'cctv_device.manage',
  streamRead: 'cctv_stream.read',
  streamManage: 'cctv_stream.manage',
} as const;

type CanFn = (permission: string) => boolean;

/** Reading devices requires read or manage (matches the backend authorizeAny). */
export function canReadCctvDevices(can: CanFn): boolean {
  return can(CCTV_PERMISSIONS.deviceRead) || can(CCTV_PERMISSIONS.deviceManage);
}

/** Create/edit/activate/test/sync require cctv_device.manage. */
export function canManageCctvDevices(can: CanFn): boolean {
  return can(CCTV_PERMISSIONS.deviceManage);
}

/** Viewing streams requires stream.read, stream.manage or device.manage. */
export function canReadCctvStreams(can: CanFn): boolean {
  return (
    can(CCTV_PERMISSIONS.streamRead) ||
    can(CCTV_PERMISSIONS.streamManage) ||
    can(CCTV_PERMISSIONS.deviceManage)
  );
}

/** Editing channel name/location requires cctv_stream.manage. */
export function canManageCctvStreams(can: CanFn): boolean {
  return can(CCTV_PERMISSIONS.streamManage);
}

/** The CCTV menu entry is visible when either page is accessible. */
export function canAccessCctv(can: CanFn): boolean {
  return canReadCctvDevices(can) || canReadCctvStreams(can);
}
