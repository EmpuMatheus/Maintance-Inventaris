/**
 * Derives a Network Device `deviceType` from its Asset's subcategory.
 *
 * The Device Type is simply the Subcategory name of the selected Asset (e.g.
 * "Laptop", "Switch", "Access Point"). There is no separate device-type master
 * data: the subcategory is the single source of truth. When a name is missing
 * the asset code is used as a fallback so the column always has a value.
 */
export function deriveDeviceType(
  subcategory?: { code?: unknown; name?: unknown } | null,
): string {
  if (!subcategory) return '';
  const name = typeof subcategory.name === 'string' ? subcategory.name.trim() : '';
  if (name) return name;
  return typeof subcategory.code === 'string' ? subcategory.code.trim() : '';
}
