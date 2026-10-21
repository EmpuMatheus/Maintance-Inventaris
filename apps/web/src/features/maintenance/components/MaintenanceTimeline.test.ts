import { describe, expect, it } from 'vitest';
import { buildTimeline, buildTimelineFromHistory } from './MaintenanceTimeline';
import type { MaintenanceDetail } from '../types';

function detail(overrides: Partial<MaintenanceDetail>): MaintenanceDetail {
  return {
    id: 'm1',
    maintenanceCode: 'MNT-2026-000001',
    maintenanceCategory: 'CORRECTIVE',
    status: 'IN_PROGRESS',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    asset: null,
    maintenanceType: null,
    technician: { id: 'tech-1', name: 'Budi' },
    vendor: null,
    createdByUser: null,
    ...overrides,
  };
}

describe('maintenance timeline history', () => {
  it('keeps the Waiting Part entry after the maintenance resumes', () => {
    const events = buildTimelineFromHistory(
      detail({
        statusHistory: [
          { id: 'h1', fromStatus: null, toStatus: 'OPEN', createdAt: '2026-10-01T00:00:00.000Z' },
          { id: 'h2', fromStatus: 'OPEN', toStatus: 'ASSIGNED', createdAt: '2026-10-01T01:00:00.000Z' },
          { id: 'h3', fromStatus: 'ASSIGNED', toStatus: 'IN_PROGRESS', createdAt: '2026-10-01T02:00:00.000Z' },
          { id: 'h4', fromStatus: 'IN_PROGRESS', toStatus: 'WAITING_PART', reason: 'No stock', createdAt: '2026-10-01T03:00:00.000Z' },
          { id: 'h5', fromStatus: 'WAITING_PART', toStatus: 'IN_PROGRESS', createdAt: '2026-10-01T04:00:00.000Z' },
        ],
      }),
    );

    expect(events).not.toBeNull();
    expect(events!.map((e) => e.label)).toEqual([
      'Created',
      'Assigned',
      'In Progress',
      'Waiting Part',
      'Resumed',
    ]);
    const waiting = events!.find((e) => e.label === 'Waiting Part');
    expect(waiting?.description).toBe('No stock');
  });

  it('falls back to the inferred timeline when a record has no history', () => {
    const record = detail({ status: 'COMPLETED', result: 'Fixed', statusHistory: [] });
    expect(buildTimelineFromHistory(record)).toBeNull();
    expect(buildTimeline(record).map((e) => e.label)).toContain('Completed');
  });
});
