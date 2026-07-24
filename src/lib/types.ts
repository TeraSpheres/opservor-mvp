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
