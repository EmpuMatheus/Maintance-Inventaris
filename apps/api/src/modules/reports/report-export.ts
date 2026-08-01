import type { Request, Response, NextFunction } from 'express';
import { AppError } from '@/middleware/error-handler';
import { generateExcelBuffer, type ExcelColumn, type ExcelRow, type ExcelSpec, type ExcelSummaryItem } from '@/lib/excel';
import { auditFromRequest } from '@/modules/audit/audit.service';
import * as inventorySvc from './report.service';
import * as maintSvc from './report-maintenance.service';
import * as costSvc from './report-maintenance-cost.service';
import * as condSvc from './report-asset-condition.service';
import * as brokenSvc from './report-broken-asset.service';
import * as movementSvc from './report-movement.service';
import * as warrantySvc from './report-warranty.service';
import * as agingSvc from './report-asset-aging.service';

const FILTER_LABELS: Record<string, string> = {
  keyword: 'Keyword',
  categoryId: 'Category',
  subcategoryId: 'Subcategory',
  brandId: 'Brand',
  departmentId: 'Department',
  siteId: 'Site',
  buildingId: 'Building',
  floorId: 'Floor',
  roomId: 'Room',
  condition: 'Condition',
  status: 'Status',
  assignedTo: 'PIC',
  priority: 'Priority',
  maintenanceTypeId: 'Maintenance Type',
  technicianId: 'Technician',
  vendorId: 'Vendor',
  assetId: 'Asset',
  assetCategoryId: 'Asset Category',
  startDate: 'Start Date',
  endDate: 'End Date',
  dateFrom: 'From',
  dateTo: 'To',
  warrantyStatus: 'Warranty Status',
  daysThreshold: 'Expiring Within (days)',
  ageBucket: 'Age Bucket',
};

const SKIP_KEYS = new Set(['page', 'limit', 'sortBy', 'sortOrder']);

function filterLabels(query: Record<string, unknown>): { label: string; value: string }[] {
  return Object.entries(query)
    .filter(([key, value]) => !SKIP_KEYS.has(key) && value !== undefined && value !== '' && FILTER_LABELS[key])
    .map(([key, value]) => ({ label: FILTER_LABELS[key], value: String(value) }));
}

function summarize(items: [string, number | string][]): ExcelSummaryItem[] {
  return items.map(([label, value]) => ({ label, value }));
}

const fl = (rows: any[]): ExcelRow[] => rows as ExcelRow[];

type ReportHandler = (query: Record<string, unknown>) => Promise<ExcelSpec>;

const handlers: Record<string, ReportHandler> = {
  inventory: async (q) => {
    const d = await inventorySvc.inventoryReport(q as any);
    const columns: ExcelColumn[] = [
      { header: 'Asset Code', key: 'assetCode' },
      { header: 'Asset Name', key: 'assetName' },
      { header: 'Category', key: 'category' },
      { header: 'Brand', key: 'brand' },
      { header: 'Department', key: 'department' },
      { header: 'Site', key: 'site' },
      { header: 'Building', key: 'building' },
      { header: 'Floor', key: 'floor' },
      { header: 'Room', key: 'room' },
      { header: 'PIC', key: 'pic' },
      { header: 'Condition', key: 'condition' },
      { header: 'Status', key: 'status' },
      { header: 'Purchase Date', key: 'purchaseDate' },
    ];
    return {
      title: 'Inventory Report',
      filters: filterLabels(q),
      summary: summarize([
        ['Total Assets', d.summary.totalAssets],
        ['Available', d.summary.available],
        ['Assigned', d.summary.assigned],
        ['Maintenance', d.summary.maintenance],
        ['Retired', d.summary.retired],
        ['Good', d.summary.good],
        ['Fair', d.summary.fair],
        ['Poor', d.summary.poor],
        ['Critical', d.summary.critical],
      ]),
      sheets: [{ name: 'Assets', columns, rows: fl(d.items) }],
    };
  },

  maintenance: async (q) => {
    const d = await maintSvc.maintenanceReport(q as any);
    const columns: ExcelColumn[] = [
      { header: 'Maintenance Code', key: 'maintenanceCode' },
      { header: 'Asset Code', key: 'assetCode' },
      { header: 'Asset Name', key: 'assetName' },
      { header: 'Category', key: 'category' },
      { header: 'Type', key: 'maintenanceType' },
      { header: 'Priority', key: 'priority' },
      { header: 'Status', key: 'status' },
      { header: 'Technician', key: 'technician' },
      { header: 'Vendor', key: 'vendor' },
      { header: 'Department', key: 'department' },
      { header: 'Scheduled', key: 'scheduledDate' },
      { header: 'Completed', key: 'finishDate' },
      { header: 'Duration (h)', key: 'durationHours' },
      { header: 'Overdue', key: 'overdue' },
    ];
    const rows = d.items.map((i) => ({
      maintenanceCode: i.maintenanceCode,
      assetCode: i.asset?.assetCode,
      assetName: i.asset?.assetName,
      category: i.asset?.category,
      maintenanceType: i.maintenanceType,
      priority: i.priority,
      status: i.status,
      technician: i.technician,
      vendor: i.vendor,
      department: i.department,
      scheduledDate: i.scheduledDate,
      finishDate: i.finishDate,
      durationHours: i.durationHours,
      overdue: i.overdue ? 'Yes' : 'No',
    }));
    return {
      title: 'Maintenance Report',
      filters: filterLabels(q),
      summary: summarize([
        ['Total', d.summary.total],
        ['Scheduled', d.summary.scheduled],
        ['In Progress', d.summary.inProgress],
        ['Waiting Part', d.summary.waitingPart],
        ['Testing', d.summary.testing],
        ['Completed', d.summary.completed],
        ['Cancelled', d.summary.cancelled],
        ['Overdue', d.summary.overdue],
        ['Avg Resolution (h)', d.summary.averageResolutionHours],
      ]),
      sheets: [{ name: 'Maintenance', columns, rows }],
    };
  },

  'maintenance-cost': async (q) => {
    const d = await costSvc.maintenanceCostReport(q as any);
    const columns: ExcelColumn[] = [
      { header: 'Maintenance Code', key: 'maintenanceCode' },
      { header: 'Asset', key: 'assetName' },
      { header: 'Vendor', key: 'vendor' },
      { header: 'Category', key: 'category' },
      { header: 'Type', key: 'maintenanceType' },
      { header: 'Priority', key: 'priority' },
      { header: 'Status', key: 'status' },
      { header: 'Labor', key: 'laborCost' },
      { header: 'Parts', key: 'partsCost' },
      { header: 'Other', key: 'otherCost' },
      { header: 'Total', key: 'totalCost' },
      { header: 'Completed', key: 'completedDate' },
    ];
    const rows = d.items.map((i) => ({
      maintenanceCode: i.maintenanceCode,
      assetName: i.asset?.assetName,
      vendor: i.vendor,
      category: i.asset?.category,
      maintenanceType: i.maintenanceType,
      priority: i.priority,
      status: i.status,
      laborCost: i.laborCost,
      partsCost: i.partsCost,
      otherCost: i.otherCost,
      totalCost: i.totalCost,
      completedDate: i.completedDate,
    }));
    return {
      title: 'Maintenance Cost Report',
      filters: filterLabels(q),
      summary: summarize([
        ['Total Maintenance', d.summary.totalMaintenance],
        ['Total Cost', d.summary.totalCost],
        ['Average Cost', d.summary.averageCost],
        ['Highest Cost', d.summary.highestCost],
        ['Labor', d.summary.totalLabor],
        ['Parts', d.summary.totalParts],
        ['Other', d.summary.totalOther],
        ['Preventive', d.summary.preventiveCost],
        ['Corrective', d.summary.correctiveCost],
      ]),
      sheets: [{ name: 'Costs', columns, rows }],
    };
  },

  'asset-condition': async (q) => {
    const d = await condSvc.assetConditionReport(q as any);
    const columns: ExcelColumn[] = [
      { header: 'Asset Code', key: 'assetCode' },
      { header: 'Asset Name', key: 'assetName' },
      { header: 'Category', key: 'category' },
      { header: 'Brand', key: 'brand' },
      { header: 'Department', key: 'department' },
      { header: 'Location', key: 'location' },
      { header: 'PIC', key: 'pic' },
      { header: 'Condition', key: 'condition' },
      { header: 'Status', key: 'status' },
      { header: 'Last Change', key: 'lastConditionChange' },
      { header: 'Changed By', key: 'lastChangedBy' },
    ];
    return {
      title: 'Asset Condition Report',
      filters: filterLabels(q),
      summary: summarize([
        ['Total', d.summary.total],
        ['Good', d.summary.good],
        ['Fair', d.summary.fair],
        ['Need Attention', d.summary.needAttention],
        ['Broken', d.summary.broken],
        ['Critical', d.summary.critical],
        ['Retired', d.summary.retired],
      ]),
      sheets: [{ name: 'Assets', columns, rows: fl(d.items) }],
    };
  },

  'broken-asset': async (q) => {
    const d = await brokenSvc.brokenAssetReport(q as any);
    const columns: ExcelColumn[] = [
      { header: 'Asset Code', key: 'assetCode' },
      { header: 'Asset Name', key: 'assetName' },
      { header: 'Category', key: 'category' },
      { header: 'Brand', key: 'brand' },
      { header: 'Department', key: 'department' },
      { header: 'Location', key: 'location' },
      { header: 'PIC', key: 'pic' },
      { header: 'Condition', key: 'condition' },
      { header: 'Status', key: 'status' },
      { header: 'Maint Count', key: 'maintenanceCount' },
      { header: 'Last Maintenance', key: 'lastMaintenanceDate' },
      { header: 'Repair Cost', key: 'repairCost' },
      { header: 'Downtime (h)', key: 'downtimeHours' },
      { header: 'Recommendation', key: 'recommendation' },
    ];
    return {
      title: 'Broken Asset Report',
      filters: filterLabels(q),
      summary: summarize([
        ['Total', d.summary.total],
        ['Broken', d.summary.broken],
        ['Critical', d.summary.critical],
        ['Need Attention', d.summary.needAttention],
        ['Total Repair Cost', d.summary.totalRepairCost],
        ['Average Repair Cost', d.summary.averageRepairCost],
        ['Total Downtime (h)', d.summary.totalDowntimeHours],
      ]),
      sheets: [{ name: 'Broken Assets', columns, rows: fl(d.items) }],
    };
  },

  movement: async (q) => {
    const d = await movementSvc.movementReport(q as any);
    const columns: ExcelColumn[] = [
      { header: 'Type', key: 'type' },
      { header: 'Asset Code', key: 'assetCode' },
      { header: 'Asset Name', key: 'assetName' },
      { header: 'From', key: 'fromLabel' },
      { header: 'To', key: 'toLabel' },
      { header: 'Date', key: 'eventDate' },
      { header: 'Notes', key: 'notes' },
      { header: 'Performed By', key: 'performedBy' },
    ];
    return {
      title: 'Movement Report',
      filters: filterLabels(q),
      summary: summarize([
        ['Total Events', d.summary.total],
        ['Movements', d.summary.totalMovements],
        ['Assignments', d.summary.totalAssignments],
        ['Returns', d.summary.totalReturns],
        ['Assets Moved', d.summary.assetsMoved],
      ]),
      sheets: [{ name: 'Movements', columns, rows: fl(d.items) }],
    };
  },

  warranty: async (q) => {
    const d = await warrantySvc.warrantyReport(q as any);
    const columns: ExcelColumn[] = [
      { header: 'Asset Code', key: 'assetCode' },
      { header: 'Asset Name', key: 'assetName' },
      { header: 'Category', key: 'category' },
      { header: 'Brand', key: 'brand' },
      { header: 'Vendor', key: 'vendor' },
      { header: 'Department', key: 'department' },
      { header: 'Purchase Date', key: 'purchaseDate' },
      { header: 'Warranty Start', key: 'warrantyStart' },
      { header: 'Warranty End', key: 'warrantyEnd' },
      { header: 'Days Remaining', key: 'daysRemaining' },
      { header: 'Status', key: 'status' },
    ];
    return {
      title: 'Warranty Report',
      filters: filterLabels(q),
      summary: summarize([
        ['Total', d.summary.total],
        ['Active', d.summary.active],
        ['Expiring Soon', d.summary.expiringSoon],
        ['Expired', d.summary.expired],
        ['Avg Days Remaining', d.summary.avgDaysRemaining],
      ]),
      sheets: [{ name: 'Warranty', columns, rows: fl(d.items) }],
    };
  },

  'asset-aging': async (q) => {
    const d = await agingSvc.assetAgingReport(q as any);
    const columns: ExcelColumn[] = [
      { header: 'Asset Code', key: 'assetCode' },
      { header: 'Asset Name', key: 'assetName' },
      { header: 'Category', key: 'category' },
      { header: 'Department', key: 'department' },
      { header: 'Purchase Date', key: 'purchaseDate' },
      { header: 'Age (years)', key: 'ageYears' },
      { header: 'Bucket', key: 'ageBucket' },
      { header: 'Condition', key: 'condition' },
      { header: 'Status', key: 'status' },
      { header: 'Replacement Candidate', key: 'replacementCandidate' },
    ];
    const rows = d.items.map((i) => ({ ...i, replacementCandidate: i.replacementCandidate ? 'Yes' : 'No' }));
    return {
      title: 'Asset Aging Report',
      filters: filterLabels(q),
      summary: summarize([
        ['Total', d.summary.total],
        ['< 1 year', d.summary.lt1],
        ['1-2 years', d.summary.y1_2],
        ['2-3 years', d.summary.y2_3],
        ['3-5 years', d.summary.y3_5],
        ['5-10 years', d.summary.y5_10],
        ['> 10 years', d.summary.gt10],
        ['Unknown', d.summary.unknown],
        ['Replacement Candidates', d.summary.replacementCandidates],
        ['Avg Age (y)', d.summary.avgAgeYears],
        ['Oldest (y)', d.summary.oldestAgeYears],
      ]),
      sheets: [{ name: 'Aging', columns, rows }],
    };
  },
};

export async function exportController(req: Request, res: Response, next: NextFunction) {
  try {
    const handler = handlers[req.params.report as string];
    if (!handler) throw new AppError(404, 'NOT_FOUND', 'Unknown report.');
    const spec = await handler(req.query as Record<string, unknown>);
    const buffer = await generateExcelBuffer(spec);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.report}-report-${date}.xlsx"`);
    auditFromRequest(req, {
      module: 'REPORT',
      action: 'EXPORT',
      entityType: 'report',
      entityId: req.params.report as string,
      description: `Report "${req.params.report}" exported to Excel.`,
    });
    res.send(buffer);
  } catch (e) { next(e); }
}
