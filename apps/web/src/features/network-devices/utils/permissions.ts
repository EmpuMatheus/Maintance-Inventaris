export const NETWORK_DEVICE_PERMISSIONS = {
  read: 'network_device.read',
  manage: 'network_device.manage',
} as const;

type CanFn = (permission: string) => boolean;

/**
 * Reading the list/detail requires `network_device.read`. A user with only
 * `network_device.manage` can also read (matches the backend `authorizeAny`).
 */
export function canReadNetworkDevices(can: CanFn): boolean {
  return can(NETWORK_DEVICE_PERMISSIONS.read) || can(NETWORK_DEVICE_PERMISSIONS.manage);
}

/** Create/edit/activate/deactivate require `network_device.manage`. */
export function canManageNetworkDevices(can: CanFn): boolean {
  return can(NETWORK_DEVICE_PERMISSIONS.manage);
}
