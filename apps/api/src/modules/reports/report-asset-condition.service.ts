import type { AssetConditionFilters } from './report-asset-condition.repository';
import * as repo from './report-asset-condition.repository';

export function assetConditionReport(filters: AssetConditionFilters) {
  return repo.assetConditionReport(filters);
}
