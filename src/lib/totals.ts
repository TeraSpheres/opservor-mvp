/* Typed wrappers for the totals functions added in migration 0011.
 *
 * Every module used to work out its headline figures by fetching rows and
 * adding them up in the browser. That is right while a tenant is small and
 * wrong once it is not — PostgREST returns at most 1000 rows by default, so
 * past that the page adds up a fraction of the data and shows a total that
 * is too low, with no error.
 *
 * These run the sum in the database instead. One round trip, correct at any
 * size, and the list on screen can then be paged without the figures above
 * it moving.
 *
 * Each function filters on auth_company_id() and runs as the caller, so
 * row-level security still applies — no wider reach than a normal read.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  InventoryTotals,
  FleetTotals,
  MaintenanceTotals,
  FinanceTotals,
  HrTotals,
  WarehouseTotals,
  SafetyTotals,
} from "./types";

/**
 * Postgres functions that RETURN TABLE come back as an array of one row.
 * Unwrap it, and return null rather than throwing when the function is
 * missing — a database where 0011 has not been applied is a state the UI
 * should be able to describe, not crash on.
 */
async function callTotals<T>(
  supabase: SupabaseClient,
  fn: string,
  args?: Record<string, unknown>
): Promise<T | null> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as T | null;
}

export const inventoryTotals = (s: SupabaseClient) =>
  callTotals<InventoryTotals>(s, "inventory_totals");

export const fleetTotals = (s: SupabaseClient) =>
  callTotals<FleetTotals>(s, "fleet_totals");

/** Only exists once 0010 has been applied — null means "no maintenance yet". */
export const maintenanceTotals = (s: SupabaseClient) =>
  callTotals<MaintenanceTotals>(s, "maintenance_totals");

export const financeTotals = (s: SupabaseClient, from?: string, to?: string) =>
  callTotals<FinanceTotals>(s, "finance_totals", { p_from: from ?? null, p_to: to ?? null });

export const hrTotals = (s: SupabaseClient, period?: string) =>
  callTotals<HrTotals>(s, "hr_totals", { p_period: period ?? null });

export const warehouseTotals = (s: SupabaseClient, from?: string, to?: string) =>
  callTotals<WarehouseTotals>(s, "warehouse_totals", { p_from: from ?? null, p_to: to ?? null });

export const safetyTotals = (s: SupabaseClient, from?: string, to?: string) =>
  callTotals<SafetyTotals>(s, "safety_totals", { p_from: from ?? null, p_to: to ?? null });

/** Formats a number for display without inventing precision. */
export const fmt = (n: number | null | undefined, dp = 0) =>
  n == null ? "—" : Number(n).toLocaleString(undefined, { maximumFractionDigits: dp });

/* ------------------------------------------------------------------ *
 * Report aggregates over a date range — migration 0012.
 *
 * The Reports screen used to fetch every row in the period and add it up
 * in the browser. Over a real year of trading that meant adding up the
 * first 1000 rows and printing the answer as if it were the whole year.
 * ------------------------------------------------------------------ */

export interface TripTotals {
  trip_count: number;
  total_miles: number;
  total_fuel: number;
}

export interface MovementTotals {
  movement_count: number;
  units_in: number;
  units_out: number;
  net_change: number;
}

export interface AttendanceTotals {
  record_count: number;
  present: number;
  absent: number;
  late: number;
  on_leave: number;
  hours_worked: number;
}

export const tripTotals = (s: SupabaseClient, from?: string, to?: string) =>
  callTotals<TripTotals>(s, "fleet_trip_totals", { p_from: from ?? null, p_to: to ?? null });

export const movementTotals = (s: SupabaseClient, from?: string, to?: string) =>
  callTotals<MovementTotals>(s, "inventory_movement_totals", { p_from: from ?? null, p_to: to ?? null });

export const attendanceTotals = (s: SupabaseClient, from?: string, to?: string) =>
  callTotals<AttendanceTotals>(s, "hr_attendance_totals", { p_from: from ?? null, p_to: to ?? null });
