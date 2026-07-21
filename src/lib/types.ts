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
  created_at: string;
}
