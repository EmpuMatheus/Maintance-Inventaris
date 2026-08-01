import type { InventoryReportFilters } from './report.repository';
import * as repo from './report.repository';

export function inventoryReport(filters: InventoryReportFilters) {
  return repo.inventoryReport(filters);
}
