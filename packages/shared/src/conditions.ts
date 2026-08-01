export const ASSET_CONDITIONS = [
  'GOOD',
  'FAIR',
  'NEED_ATTENTION',
  'BROKEN',
  'CRITICAL',
  'RETIRED',
] as const;

export type AssetCondition = (typeof ASSET_CONDITIONS)[number];

export const ASSET_STATUSES = [
  'AVAILABLE',
  'ASSIGNED',
  'IN_USE',
  'IN_MAINTENANCE',
  'BROKEN',
  'SPARE',
  'LOST',
  'RETIRED',
  'DISPOSED',
] as const;

export type AssetStatus = (typeof ASSET_STATUSES)[number];
