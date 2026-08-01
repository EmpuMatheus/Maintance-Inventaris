import type { WarrantyFilters } from './report-warranty.repository';
import * as repo from './report-warranty.repository';

export function warrantyReport(filters: WarrantyFilters) {
  return repo.warrantyReport(filters);
}
