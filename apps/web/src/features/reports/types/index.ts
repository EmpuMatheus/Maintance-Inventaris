export interface InventoryReportItem {
  id: string;
  assetCode: string;
  assetName: string;
  model: string | null;
  serialNumber: string | null;
  manufacturer: string | null;
  condition: string;
  status: string;
  purchaseDate: string | null;
  createdAt: string;
  updatedAt: string;
  category: string | null;
  subcategory: string | null;
  brand: string | null;
  department: string | null;
  site: string | null;
  building: string | null;
  floor: string | null;
  room: string | null;
  pic: string | null;
  vendor: string | null;
}

export interface InventoryReportSummary {
  totalAssets: number;
  available: number;
  assigned: number;
  maintenance: number;
  retired: number;
  good: number;
  fair: number;
  poor: number;
  critical: number;
}

export interface InventoryReportFilters {
  page?: number;
  limit?: number;
  keyword?: string;
  categoryId?: string;
  subcategoryId?: string;
  brandId?: string;
  departmentId?: string;
  siteId?: string;
  buildingId?: string;
  floorId?: string;
  roomId?: string;
  condition?: string;
  status?: string;
  assignedTo?: string;
  purchaseDateFrom?: string;
  purchaseDateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface MaintenanceReportItem {
  id: string;
  maintenanceCode: string;
  maintenanceCategory: string;
  problem: string | null;
  priority: string;
  status: string;
  scheduledDate: string | null;
  startDate: string | null;
  finishDate: string | null;
  createdAt: string;
  updatedAt: string;
  asset: { assetCode: string | null; assetName: string | null; category: string | null };
  maintenanceType: string | null;
  technician: string | null;
  vendor: string | null;
  department: string | null;
  site: string | null;
  building: string | null;
  floor: string | null;
  room: string | null;
  createdBy: string | null;
  durationHours: number | null;
  overdue: boolean;
}

export interface MaintenanceReportSummary {
  total: number;
  scheduled: number;
  inProgress: number;
  waitingPart: number;
  testing: number;
  completed: number;
  cancelled: number;
  overdue: number;
  averageResolutionHours: number;
}

export interface MaintenanceReportFilters {
  page?: number;
  limit?: number;
  keyword?: string;
  maintenanceTypeId?: string;
  assetId?: string;
  assetCategoryId?: string;
  priority?: string;
  status?: string;
  technicianId?: string;
  vendorId?: string;
  departmentId?: string;
  siteId?: string;
  buildingId?: string;
  floorId?: string;
  roomId?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface MaintenanceCostItem {
  id: string;
  maintenanceCode: string;
  asset: { assetCode: string | null; assetName: string | null; category: string | null };
  department: string | null;
  vendor: string | null;
  maintenanceType: string | null;
  technician: string | null;
  priority: string;
  status: string;
  laborCost: number;
  partsCost: number;
  otherCost: number;
  totalCost: number;
  completedDate: string | null;
  durationHours: number | null;
}

export interface MaintenanceCostSummary {
  totalMaintenance: number;
  totalCost: number;
  averageCost: number;
  highestCost: number;
  totalLabor: number;
  totalParts: number;
  totalOther: number;
  preventiveCost: number;
  correctiveCost: number;
}

export interface CostBucket {
  name: string;
  value: number;
  count: number;
}

export interface MaintenanceCostAnalytics {
  topAssets: CostBucket[];
  topCategories: CostBucket[];
  topVendors: CostBucket[];
  topDepartments: CostBucket[];
  monthlyTrend: { month: string; label: string; value: number }[];
}

export interface MaintenanceCostFilters {
  page?: number;
  limit?: number;
  keyword?: string;
  assetId?: string;
  categoryId?: string;
  departmentId?: string;
  vendorId?: string;
  maintenanceTypeId?: string;
  technicianId?: string;
  priority?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  siteId?: string;
  buildingId?: string;
  floorId?: string;
  roomId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AssetConditionItem {
  id: string;
  assetCode: string;
  assetName: string;
  model: string | null;
  serialNumber: string | null;
  condition: string;
  status: string;
  category: string | null;
  brand: string | null;
  department: string | null;
  location: string | null;
  pic: string | null;
  lastConditionChange: string | null;
  previousCondition: string | null;
  lastChangedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetConditionSummary {
  total: number;
  good: number;
  fair: number;
  needAttention: number;
  broken: number;
  critical: number;
  retired: number;
}

export interface ConditionBucket {
  name: string;
  value: number;
}

export interface ConditionChange {
  assetCode: string | null;
  assetName: string | null;
  previousCondition: string | null;
  newCondition: string | null;
  changedBy: string | null;
  createdAt: string;
}

export interface AssetConditionAnalytics {
  byCategory: ConditionBucket[];
  byDepartment: ConditionBucket[];
  recentChanges: ConditionChange[];
}

export interface AssetConditionFilters {
  page?: number;
  limit?: number;
  keyword?: string;
  categoryId?: string;
  departmentId?: string;
  siteId?: string;
  buildingId?: string;
  floorId?: string;
  roomId?: string;
  condition?: string;
  status?: string;
  assignedTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface BrokenAssetItem {
  id: string;
  assetCode: string;
  assetName: string;
  serialNumber: string | null;
  condition: string;
  status: string;
  category: string | null;
  brand: string | null;
  department: string | null;
  location: string | null;
  pic: string | null;
  maintenanceCount: number;
  lastMaintenanceCode: string | null;
  lastMaintenanceDate: string | null;
  repairCost: number;
  downtimeHours: number;
  recommendation: string;
  createdAt: string;
}

export interface BrokenAssetSummary {
  total: number;
  broken: number;
  critical: number;
  needAttention: number;
  totalRepairCost: number;
  averageRepairCost: number;
  totalDowntimeHours: number;
}

export interface BrokenAssetFilters {
  page?: number;
  limit?: number;
  keyword?: string;
  categoryId?: string;
  departmentId?: string;
  siteId?: string;
  buildingId?: string;
  floorId?: string;
  roomId?: string;
  condition?: string;
  status?: string;
  assignedTo?: string;
}

export interface MovementItem {
  id: string;
  assetId: string | null;
  type: string;
  assetCode: string | null;
  assetName: string | null;
  fromLabel: string | null;
  toLabel: string | null;
  eventDate: string | null;
  notes: string | null;
  performedBy: string | null;
  createdAt: string;
}

export interface MovementSummary {
  total: number;
  totalMovements: number;
  totalAssignments: number;
  totalReturns: number;
  assetsMoved: number;
}

export interface MovementFilters {
  page?: number;
  limit?: number;
  keyword?: string;
  assetId?: string;
  departmentId?: string;
  siteId?: string;
  buildingId?: string;
  floorId?: string;
  roomId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface WarrantyItem {
  id: string;
  assetCode: string;
  assetName: string;
  serialNumber: string | null;
  category: string | null;
  brand: string | null;
  department: string | null;
  vendor: string | null;
  location: string | null;
  pic: string | null;
  purchaseDate: string | null;
  warrantyStart: string | null;
  warrantyEnd: string | null;
  daysRemaining: number;
  status: string;
}

export interface WarrantySummary {
  total: number;
  active: number;
  expired: number;
  expiringSoon: number;
  avgDaysRemaining: number;
}

export interface VendorWarranty {
  name: string;
  total: number;
  active: number;
  expired: number;
  expiringSoon: number;
}

export interface WarrantyFilters {
  page?: number;
  limit?: number;
  keyword?: string;
  categoryId?: string;
  departmentId?: string;
  siteId?: string;
  buildingId?: string;
  floorId?: string;
  roomId?: string;
  vendorId?: string;
  warrantyStatus?: string;
  daysThreshold?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AgingItem {
  id: string;
  assetCode: string;
  assetName: string;
  serialNumber: string | null;
  condition: string;
  status: string;
  purchaseDate: string | null;
  ageYears: number | null;
  ageBucket: string;
  category: string | null;
  brand: string | null;
  department: string | null;
  location: string | null;
  pic: string | null;
  replacementCandidate: boolean;
  createdAt: string;
}

export interface AgingSummary {
  total: number;
  lt1: number;
  y1_2: number;
  y2_3: number;
  y3_5: number;
  y5_10: number;
  gt10: number;
  unknown: number;
  replacementCandidates: number;
  avgAgeYears: number;
  oldestAgeYears: number;
}

export interface AgingBucket {
  name: string;
  value: number;
}

export interface CategoryAging {
  name: string;
  count: number;
  avgAgeYears: number;
}

export interface AgingFilters {
  page?: number;
  limit?: number;
  keyword?: string;
  categoryId?: string;
  departmentId?: string;
  siteId?: string;
  buildingId?: string;
  floorId?: string;
  roomId?: string;
  condition?: string;
  status?: string;
  ageBucket?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
