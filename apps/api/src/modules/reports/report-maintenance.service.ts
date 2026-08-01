import type { MaintenanceReportFilters } from './report-maintenance.repository';
import * as repo from './report-maintenance.repository';

export function maintenanceReport(filters: MaintenanceReportFilters) {
  return repo.maintenanceReport(filters);
}
