import type { MaintenanceCostFilters } from './report-maintenance-cost.repository';
import * as repo from './report-maintenance-cost.repository';

export function maintenanceCostReport(filters: MaintenanceCostFilters) {
  return repo.maintenanceCostReport(filters);
}
