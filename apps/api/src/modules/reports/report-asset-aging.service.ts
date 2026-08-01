import type { AgingFilters } from './report-asset-aging.repository';
import * as repo from './report-asset-aging.repository';

export function assetAgingReport(filters: AgingFilters) {
  return repo.assetAgingReport(filters);
}
