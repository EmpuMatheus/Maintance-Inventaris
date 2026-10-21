import { describe, expect, it } from 'vitest';
import { buildMaintenanceReportHtml, buildPartsRequestHtml } from './maintenancePrint';
import type { MaintenanceDetail, MaintenancePart } from '../types';

function detail(overrides: Partial<MaintenanceDetail> = {}): MaintenanceDetail {
  return {
    id: 'm1',
    maintenanceCode: 'MNT-2026-000123',
    maintenanceCategory: 'CORRECTIVE',
    status: 'WAITING_PART',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    asset: { id: 'a1', assetCode: 'AST-001', assetName: 'AC Split' },
    maintenanceType: null,
    technician: { id: 'tech-1', name: 'Budi' },
    vendor: null,
    createdByUser: null,
    ...overrides,
  };
}

function part(overrides: Partial<MaintenancePart>): MaintenancePart {
  return {
    id: 'p1',
    maintenanceId: 'm1',
    partName: 'Capacitor',
    partNumber: 'CAP-25',
    quantity: 2,
    unitPrice: '150000.00',
    totalPrice: '300000.00',
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

const PARTS = [
  part({ id: 'p1', partName: 'Capacitor', partNumber: 'CAP-25', quantity: 2, unitPrice: '150000.00', totalPrice: '300000.00' }),
  part({ id: 'p2', partName: 'Fan Blade', partNumber: 'FAN-9', quantity: 1, unitPrice: '90000.00', totalPrice: '90000.00' }),
];

describe('parts request printout', () => {
  it('prints only the selected parts with their stored quantity and prices', () => {
    const html = buildPartsRequestHtml(detail(), PARTS, ['p2'], '2026-10-21T05:00:00.000Z');

    expect(html).toContain('Fan Blade');
    expect(html).toContain('FAN-9');
    expect(html).toContain('Rp 90.000');
    expect(html).not.toContain('Capacitor');
    expect(html).not.toContain('CAP-25');
  });

  it('includes the maintenance code, asset identity, and technician', () => {
    const html = buildPartsRequestHtml(detail(), PARTS, ['p1', 'p2']);
    expect(html).toContain('MNT-2026-000123');
    expect(html).toContain('AST-001');
    expect(html).toContain('AC Split');
    expect(html).toContain('Budi');
  });

  it('escapes dynamic text to avoid injecting markup', () => {
    const html = buildPartsRequestHtml(
      detail({ asset: { id: 'a1', assetCode: 'AST<1>', assetName: 'AC & "Fan"' } }),
      [part({ id: 'p1', partName: '<script>alert(1)</script>' })],
      ['p1'],
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('AC &amp; &quot;Fan&quot;');
  });
});

describe('completed maintenance report printout', () => {
  const completed = detail({
    status: 'COMPLETED',
    diagnosis: 'Capacitor weak',
    actionTaken: 'Replaced capacitor',
    result: 'Unit cooling again',
    finishDate: '2026-10-20T09:30:00.000Z',
    laborCost: '100000.00',
    partsCost: '300000.00',
    otherCost: '0.00',
    totalCost: '400000.00',
    tasks: [
      { id: 't1', maintenanceId: 'm1', task: 'Check voltage', sortOrder: 0, isCompleted: true, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' },
      { id: 't2', maintenanceId: 'm1', task: 'Clean filter', sortOrder: 1, isCompleted: false, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' },
    ],
  });

  it('prints maintenance data, tasks, parts, and costs', () => {
    const html = buildMaintenanceReportHtml(completed, PARTS);

    expect(html).toContain('MNT-2026-000123');
    expect(html).toContain('AST-001');
    expect(html).toContain('AC Split');
    expect(html).toContain('COMPLETED');
    expect(html).toContain('Capacitor weak');
    expect(html).toContain('Replaced capacitor');
    expect(html).toContain('Unit cooling again');

    expect(html).toContain('Check voltage');
    expect(html).toContain('Clean filter');

    expect(html).toContain('Fan Blade');
    expect(html).toContain('FAN-9');
    expect(html).toContain('Rp 90.000');

    expect(html).toContain('Rp 100.000');
    expect(html).toContain('Rp 300.000');
    expect(html).toContain('Rp 400.000');
  });

  it('escapes dynamic text in the report', () => {
    const html = buildMaintenanceReportHtml(
      detail({ status: 'COMPLETED', diagnosis: '<b>x</b>', result: 'a & b' }),
      [],
    );
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).toContain('a &amp; b');
  });

  it('escapes task text, notes, technician name, and maintenance code', () => {
    const html = buildMaintenanceReportHtml(
      detail({
        status: 'COMPLETED',
        maintenanceCode: 'MNT<1>',
        notes: '<img src=x onerror=alert(1)>',
        technician: { id: 'tech-1', name: 'Budi "X" <b>' },
        tasks: [
          {
            id: 't1',
            maintenanceId: 'm1',
            task: 'Step <script>x</script>',
            sortOrder: 0,
            isCompleted: true,
            createdAt: '2026-10-01T00:00:00.000Z',
            updatedAt: '2026-10-01T00:00:00.000Z',
          },
        ],
      }),
      [],
    );
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).toContain('Budi &quot;X&quot; &lt;b&gt;');
    expect(html).toContain('MNT&lt;1&gt;');
  });
});
