// Mirrors Section 5 (Data model) of Opservor-MVP-Spec-v1.3 exactly.
// Keep in sync with supabase/migrations/0001_init.sql.

export type Category =
  | "finance"
  | "operations"
  | "customer"
  | "hr"
  | "fleet_assets"
  | "safety_compliance"
  | "inventory_procurement";

export type AlertSeverity = "critical" | "high" | "medium";
export type AlertStatus = "open" | "resolved";

export interface Company {
  id: string;
  name: string;
  timezone: string;
}

export interface AppUser {
  id: string;
  company_id: string;
  name: string;
  email: string;
  role: "founder";
}

export interface KpiSnapshot {
  id: string;
  company_id: string;
  date: string; // YYYY-MM-DD
  revenue: number;
  profit: number;
  total_loads: number;
  fleet_utilization_pct: number;
  on_time_delivery_pct: number;
}

export interface CategoryScore {
  id: string;
  company_id: string;
  date: string;
  category: Category;
  score: number; // 0-100
}

export interface Alert {
  id: string;
  company_id: string;
  title: string;
  detail: string | null;
  severity: AlertSeverity;
  owner: string | null;
  due_date: string | null;
  status: AlertStatus;
  site_id: string | null; // warehouse_site foreign key (v1.1)
  created_at: string;
}

// =====================================================================
// Warehouse Module (v1.1)
// =====================================================================

export interface WarehouseSite {
  id: string;
  company_id: string;
  name: string;
  location: string | null;
  created_at: string;
  updated_at: string;
}

export type ShiftType = "A" | "B" | "C" | "all";

export interface WarehouseSnapshot {
  id: string;
  company_id: string;
  site_id: string;
  date: string; // YYYY-MM-DD
  shift: ShiftType;
  productivity_pct: number; // 0-100
  orders_processed: number;
  orders_pending: number;
  dock_utilization_pct: number; // 0-100
  created_at: string;
  updated_at: string;
}

// =====================================================================
// Fleet Module (v1.0)
// =====================================================================

export type VehicleStatus = "active" | "maintenance" | "retired" | "inactive";

export interface FleetVehicle {
  id: string;
  company_id: string;
  name: string;
  type: string;
  status: VehicleStatus;
  license_plate: string | null;
  fuel_type: string | null;
  purchase_date: string | null;
  mileage: number;
  created_at: string;
  updated_at: string;
}

export type TripStatus = "completed" | "in_progress" | "cancelled";

export interface FleetTrip {
  id: string;
  company_id: string;
  vehicle_id: string;
  date: string; // YYYY-MM-DD
  miles_driven: number;
  fuel_used: number | null;
  origin: string | null;
  destination: string | null;
  status: TripStatus;
  created_at: string;
  updated_at: string;
}

export type MaintenanceStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type MaintenancePriority = "routine" | "high" | "critical";

export interface FleetMaintenance {
  id: string;
  company_id: string;
  vehicle_id: string;
  /** Free text, chosen from MAINTENANCE_TYPE_GROUPS in lib/fleet-options. */
  type: string;
  status: MaintenanceStatus;
  priority: MaintenancePriority;
  scheduled_date: string | null; // YYYY-MM-DD
  completed_date: string | null; // YYYY-MM-DD
  /** Reading taken at service — distinct from the trip-derived vehicle mileage. */
  odometer: number | null;
  cost: number | null;
  vendor: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FleetMetrics {
  id: string;
  company_id: string;
  vehicle_id: string;
  date: string; // YYYY-MM-DD
  trips_completed: number;
  miles_driven: number;
  fuel_efficiency: number | null;
  utilization_hours: number | null;
  on_time_pct: number | null;
  created_at: string;
  updated_at: string;
}

// =====================================================================
// Inventory Module (v1.0)
// =====================================================================

export interface InventorySku {
  id: string;
  company_id: string;
  sku: string;
  name: string;
  category: string | null;
  quantity_on_hand: number;
  quantity_reserved: number;
  reorder_level: number;
  reorder_quantity: number;
  unit_cost: number | null;
  unit_price: number | null;
  warehouse_location: string | null;
  supplier: string | null;
  created_at: string;
  updated_at: string;
}

export type MovementType = "inbound" | "outbound" | "adjustment" | "reorder";

export interface InventoryMovement {
  id: string;
  company_id: string;
  sku_id: string;
  type: MovementType;
  quantity: number;
  reference: string | null;
  notes: string | null;
  date: string; // YYYY-MM-DD
  created_at: string;
}

export type ReorderStatus = "ok" | "low" | "critical" | "overstocked";

export interface InventorySnapshot {
  id: string;
  company_id: string;
  sku_id: string;
  date: string; // YYYY-MM-DD
  quantity_on_hand: number;
  quantity_reserved: number;
  days_on_hand: number | null;
  reorder_status: ReorderStatus | null;
  created_at: string;
  updated_at: string;
}

// =====================================================================
// Finance Module (v1.0)
// =====================================================================

export interface FinanceCostCenter {
  id: string;
  company_id: string;
  name: string;
  code: string;
  manager: string | null;
  budget_ytd: number;
  created_at: string;
  updated_at: string;
}

export interface FinanceTransaction {
  id: string;
  company_id: string;
  cost_center_id: string;
  type: "revenue" | "expense" | "adjustment";
  category: string;
  amount: number;
  description: string | null;
  date: string; // YYYY-MM-DD
  reference: string | null;
  created_at: string;
}

export interface FinanceSnapshot {
  id: string;
  company_id: string;
  cost_center_id: string;
  month: string; // YYYY-MM
  budget_allocated: number;
  revenue_actual: number;
  expense_actual: number;
  variance_pct: number | null;
  burn_rate_pct: number | null;
  created_at: string;
  updated_at: string;
}

// =====================================================================
// HR Module (v1.0)
// =====================================================================

export interface HrDepartment {
  id: string;
  company_id: string;
  name: string;
  code: string;
  head: string | null;
  created_at: string;
  updated_at: string;
}

export type EmployeeStatus = "active" | "onboarding" | "on_leave" | "departed" | "inactive";

export interface HrEmployee {
  id: string;
  company_id: string;
  department_id: string;
  name: string;
  email: string;
  role: string;
  status: EmployeeStatus;
  hire_date: string; // YYYY-MM-DD
  manager_id: string | null;
  salary: number | null;
  work_location: string | null;
  created_at: string;
  updated_at: string;
}

export type AttendanceStatus = "present" | "absent" | "late" | "leave" | "remote";

export interface HrAttendance {
  id: string;
  company_id: string;
  employee_id: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  hours_worked: number | null;
  notes: string | null;
  created_at: string;
}

export interface HrPerformance {
  id: string;
  company_id: string;
  employee_id: string;
  period: string; // YYYY-Q1 format
  rating: number; // 1-5
  category: string | null;
  feedback: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HrSnapshot {
  id: string;
  company_id: string;
  month: string; // YYYY-MM
  total_headcount: number;
  active_count: number;
  new_hires: number;
  departures: number;
  avg_attendance_pct: number | null;
  avg_performance: number | null;
  created_at: string;
  updated_at: string;
}

// =====================================================================
// Safety Module (v1.0)
// =====================================================================

export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "investigating" | "resolved" | "closed";

export interface SafetyIncident {
  id: string;
  company_id: string;
  date: string; // YYYY-MM-DD
  severity: IncidentSeverity;
  category: string;
  location: string | null;
  description: string;
  corrective_action: string | null;
  status: IncidentStatus;
  reported_by: string | null;
  resolved_date: string | null;
  created_at: string;
  updated_at: string;
}

export type InspectionResult = "pass" | "conditional" | "fail";

export interface SafetyInspection {
  id: string;
  company_id: string;
  date: string; // YYYY-MM-DD
  area: string;
  inspector: string | null;
  result: InspectionResult;
  findings: string | null;
  next_due: string | null;
  created_at: string;
  updated_at: string;
}

export interface SafetySnapshot {
  id: string;
  company_id: string;
  month: string; // YYYY-MM
  incidents_total: number;
  incidents_critical: number;
  incidents_high: number;
  inspections_completed: number;
  inspections_failed: number;
  days_since_last_incident: number | null;
  created_at: string;
  updated_at: string;
}

// =====================================================================
// Reports Module (v1.0)
// =====================================================================

export type ReportModule =
  | "warehouse" | "fleet" | "inventory"
  | "finance" | "hr" | "safety" | "cross_module";

export type ReportPeriod = "week" | "month" | "quarter" | "year" | "custom";

export interface ReportDefinition {
  id: string;
  company_id: string;
  name: string;
  module: ReportModule;
  period: ReportPeriod;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export type ReportRunStatus = "success" | "empty" | "failed";

export interface ReportRun {
  id: string;
  company_id: string;
  definition_id: string;
  period_start: string; // YYYY-MM-DD
  period_end: string;   // YYYY-MM-DD
  row_count: number | null;
  status: ReportRunStatus;
  notes: string | null;
  created_at: string;
}

// =====================================================================
// Operational tables (v1.4+)
// =====================================================================

export type AssetType = "vehicle" | "equipment" | "facility" | "technology" | "other";
export type AssetStatus = "active" | "inactive" | "maintenance" | "retired";

export interface Asset {
  id: string;
  company_id: string;
  asset_type: AssetType;
  name: string;
  description: string | null;
  status: AssetStatus;
  purchase_date: string | null; // YYYY-MM-DD
  acquisition_cost: number | null;
  current_value: number | null;
  location: string | null;
  serial_number: string | null;
  depreciation_rate: number | null; // 0-100
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

export type ShipmentStatus = "pending" | "in_transit" | "delivered" | "cancelled" | "returned";

export interface Shipment {
  id: string;
  company_id: string;
  shipment_number: string;
  origin: string;
  destination: string;
  status: ShipmentStatus;
  scheduled_delivery: string | null; // YYYY-MM-DD
  actual_delivery: string | null; // YYYY-MM-DD
  weight_kg: number | null;
  dimensions_cm: string | null;
  value: number | null;
  carrier: string | null;
  tracking_number: string | null;
  reference_number: string | null;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

export interface InventoryItem {
  id: string;
  company_id: string;
  sku: string;
  name: string;
  description: string | null;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number; // Generated column
  unit_cost: number | null;
  unit_price: number | null;
  location: string | null;
  warehouse_bin: string | null;
  reorder_level: number | null;
  reorder_quantity: number | null;
  lead_time_days: number | null;
  category: string | null;
  supplier: string | null;
  last_restocked_at: string | null; // ISO 8601
  last_counted_at: string | null; // ISO 8601
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

export type ErpAction = "sync" | "import" | "export" | "update" | "validation";
export type ErpStatus = "success" | "failure" | "pending" | "retrying";

export interface ErpLog {
  id: string;
  company_id: string;
  action: ErpAction;
  entity_type: string;
  entity_id: string | null;
  record_count: number | null;
  status: ErpStatus;
  message: string | null;
  error_details: Record<string, unknown> | null; // JSONB
  sync_timestamp: string | null; // ISO 8601
  duration_seconds: number | null;
  created_at: string; // ISO 8601
}

/* ------------------------------------------------------------------ *
 * Module totals — returned by the RPCs in migration 0011.
 *
 * These are computed in the database, not by summing a fetched page.
 * Above 1000 rows PostgREST returns a truncated set by default, so a
 * client-side sum silently understates. Aggregates live server-side and
 * lists paginate independently.
 * ------------------------------------------------------------------ */

export interface InventoryTotals {
  sku_count: number;
  units_on_hand: number;
  units_reserved: number;
  stock_value: number;
  low_stock_count: number;
  out_of_stock: number;
}

export interface FleetTotals {
  vehicle_count: number;
  active_count: number;
  in_maintenance: number;
  total_mileage: number;
  completed_trips: number;
  total_miles: number;
  total_fuel: number;
}

export interface MaintenanceTotals {
  total_jobs: number;
  open_jobs: number;
  overdue_jobs: number;
  completed_jobs: number;
  total_spend: number;
}

export interface FinanceTotals {
  cost_center_count: number;
  revenue: number;
  expense: number;
  net: number;
  transaction_count: number;
}

export interface HrTotals {
  department_count: number;
  headcount: number;
  active_count: number;
  review_count: number;
  avg_rating: number | null;
  unreviewed: number;
}

export interface WarehouseTotals {
  site_count: number;
  shifts_recorded: number;
  orders_processed: number;
  orders_pending: number;
  avg_productivity: number | null;
  avg_dock_util: number | null;
}

export interface SafetyTotals {
  incident_count: number;
  open_incidents: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
}
