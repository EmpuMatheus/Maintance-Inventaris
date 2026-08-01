import type { MovementFilters } from './report-movement.repository';
import * as repo from './report-movement.repository';

export function movementReport(filters: MovementFilters) {
  return repo.movementReport(filters);
}
