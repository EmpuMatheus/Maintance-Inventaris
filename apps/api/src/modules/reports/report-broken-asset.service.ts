import type { BrokenAssetFilters } from './report-broken-asset.repository';
import * as repo from './report-broken-asset.repository';

export function brokenAssetReport(filters: BrokenAssetFilters) {
  return repo.brokenAssetReport(filters);
}
