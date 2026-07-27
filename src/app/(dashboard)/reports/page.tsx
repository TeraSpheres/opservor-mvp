"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ReportDefinition, ReportRun, ReportModule, ReportPeriod } from "@/lib/types";
import {
  warehouseTotals,
  financeTotals,
  safetyTotals,
  tripTotals,
  movementTotals,
  attendanceTotals,
} from "@/lib/totals";

const MODULE_LABEL: Record<ReportModule, string> = {
  warehouse: "Warehouse",
  fleet: "Fleet",
  inventory: "Inventory",
  finance: "Finance",
  hr: "Human Resources",
  safety: "Safety",
  cross_module: "All modules",
};

type Row = { label: string; value: string };

function periodRange(period: ReportPeriod): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  if (period === "week") start.setDate(end.getDate() - 7);
  else if (period === "month") start.setMonth(end.getMonth() - 1);
  else if (period === "quarter") start.setMonth(end.getMonth() - 3);
  else start.setFullYear(end.getFullYear() - 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

/**
 * Reports holds no operational data of its own. It reads what the other
 * modules already hold, scoped to a period. Every query is company-scoped
 * by RLS, so this cannot reach across tenants even if the filter were wrong.
 */
async function runReport(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  module: ReportModule,
  start: string,
  end: string,
): Promise<{ rows: Row[]; count: number }> {
  const rows: Row[] = [];
  let count = 0;
  const num = (n: number) => Number(n).toLocaleString();
  const dp = (n: number, d = 1) => Number(n).toFixed(d);
  const money = (n: number) =>
    `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Every figure below is summed by the database over the full period.
  // Nothing is derived from a fetched page, so the totals do not change
  // with how many rows happen to come back.
  const wants = (m: ReportModule) => module === m || module === "cross_module";

  if (wants("warehouse")) {
    const t = await warehouseTotals(supabase, start, end);
    const shifts = t?.shifts_recorded ?? 0;
    count += shifts;
    if (module === "warehouse") {
      rows.push({ label: "Shift snapshots", value: num(shifts) });
      rows.push({ label: "Orders processed", value: num(t?.orders_processed ?? 0) });
      rows.push({ label: "Orders pending", value: num(t?.orders_pending ?? 0) });
      rows.push({
        label: "Average productivity",
        value: t?.avg_productivity != null ? `${dp(t.avg_productivity)}%` : "—",
      });
      rows.push({
        label: "Average dock utilisation",
        value: t?.avg_dock_util != null ? `${dp(t.avg_dock_util)}%` : "—",
      });
    } else {
      rows.push({ label: "Warehouse snapshots", value: num(shifts) });
    }
  }

  if (wants("fleet")) {
    const t = await tripTotals(supabase, start, end);
    const trips = t?.trip_count ?? 0;
    const miles = t?.total_miles ?? 0;
    const fuel = t?.total_fuel ?? 0;
    count += trips;
    if (module === "fleet") {
      rows.push({ label: "Trips logged", value: num(trips) });
      rows.push({ label: "Distance", value: `${dp(miles)} mi` });
      rows.push({ label: "Fuel used", value: fuel ? `${dp(fuel)} gal` : "—" });
      rows.push({ label: "Efficiency", value: fuel ? `${dp(miles / fuel)} mpg` : "—" });
    } else {
      rows.push({ label: "Fleet trips", value: `${num(trips)} · ${dp(miles, 0)} mi` });
    }
  }

  if (wants("inventory")) {
    const t = await movementTotals(supabase, start, end);
    const moves = t?.movement_count ?? 0;
    count += moves;
    if (module === "inventory") {
      rows.push({ label: "Movements", value: num(moves) });
      rows.push({ label: "Units received", value: num(t?.units_in ?? 0) });
      rows.push({ label: "Units shipped", value: num(t?.units_out ?? 0) });
      rows.push({ label: "Net change", value: num(t?.net_change ?? 0) });
    } else {
      rows.push({ label: "Stock movements", value: num(moves) });
    }
  }

  if (wants("finance")) {
    const t = await financeTotals(supabase, start, end);
    count += t?.transaction_count ?? 0;
    if (module === "finance") {
      rows.push({ label: "Transactions", value: num(t?.transaction_count ?? 0) });
      rows.push({ label: "Revenue", value: money(t?.revenue ?? 0) });
      rows.push({ label: "Expenses", value: money(t?.expense ?? 0) });
      rows.push({ label: "Net", value: money(t?.net ?? 0) });
    } else {
      rows.push({ label: "Net position", value: money(t?.net ?? 0) });
    }
  }

  if (wants("hr")) {
    const t = await attendanceTotals(supabase, start, end);
    const records = t?.record_count ?? 0;
    count += records;
    if (module === "hr") {
      rows.push({ label: "Attendance records", value: num(records) });
      rows.push({ label: "Present or remote", value: num(t?.present ?? 0) });
      rows.push({ label: "Absent", value: num(t?.absent ?? 0) });
      rows.push({ label: "Late", value: num(t?.late ?? 0) });
      rows.push({
        label: "Attendance rate",
        value: records ? `${dp(((t?.present ?? 0) / records) * 100)}%` : "—",
      });
      rows.push({ label: "Hours worked", value: t?.hours_worked ? dp(t.hours_worked) : "—" });
    } else {
      rows.push({ label: "Attendance records", value: num(records) });
    }
  }

  if (wants("safety")) {
    const t = await safetyTotals(supabase, start, end);
    const incidents = t?.incident_count ?? 0;
    count += incidents;
    if (module === "safety") {
      rows.push({ label: "Incidents", value: num(incidents) });
      rows.push({ label: "Critical", value: num(t?.critical_count ?? 0) });
      rows.push({ label: "High", value: num(t?.high_count ?? 0) });
      rows.push({ label: "Still open", value: num(t?.open_incidents ?? 0) });
    } else {
      rows.push({ label: "Safety incidents", value: num(incidents) });
    }
  }

  return { rows, count };
}

function NewReportForm({ onCreated }: { onCreated: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    const form = e.currentTarget;
    const data = new FormData(form);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setIsLoading(false);
      return;
    }

    const { data: appUser } = await supabase
      .from("app_user")
      .select("company_id")
      .eq("auth_id", user.id)
      .single();

    if (!appUser) {
      setIsLoading(false);
      return;
    }

    const { error } = await supabase.from("report_definition").insert({
      company_id: appUser.company_id,
      name: String(data.get("name")),
      module: String(data.get("module")),
      period: String(data.get("period")),
      description: String(data.get("description") || "") || null,
    });

    if (!error) {
      setIsOpen(false);
      form.reset();
      onCreated();
    }
    setIsLoading(false);
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light"
      >
        New report
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-panel p-5 space-y-4">
      <h3 className="text-sm font-semibold text-ink">Define a report</h3>

      <input
        name="report_name" autoComplete="off"
        type="text"
        placeholder="Report name, e.g. Monthly fleet summary"
        required
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
      />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Module</label>
          <select
            name="module"
            required
            defaultValue="cross_module"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          >
            {(Object.keys(MODULE_LABEL) as ReportModule[]).map((m) => (
              <option key={m} value={m}>
                {MODULE_LABEL[m]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Period</label>
          <select
            name="period"
            required
            defaultValue="month"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="week">Last 7 days</option>
            <option value="month">Last month</option>
            <option value="quarter">Last quarter</option>
            <option value="year">Last year</option>
          </select>
        </div>
      </div>

      <input
        name="description"
        type="text"
        placeholder="Description (optional)"
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand" autoComplete="off" />

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-light disabled:opacity-50"
        >
          {isLoading ? "Saving..." : "Create report"}
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="flex-1 rounded-md border border-border px-3 py-2 text-sm font-medium text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function ReportsPage() {
  const [definitions, setDefinitions] = useState<ReportDefinition[]>([]);
  const [runs, setRuns] = useState<ReportRun[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [active, setActive] = useState<ReportDefinition | null>(null);
  const [result, setResult] = useState<{ rows: Row[]; start: string; end: string } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: appUser } = await supabase
      .from("app_user")
      .select("company_id")
      .eq("auth_id", user.id)
      .single();

    if (!appUser) return;
    setCompanyId(appUser.company_id);

    const [defs, hist] = await Promise.all([
      supabase
        .from("report_definition")
        .select("*")
        .eq("company_id", appUser.company_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("report_run")
        .select("*")
        .eq("company_id", appUser.company_id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    setDefinitions((defs.data ?? []) as ReportDefinition[]);
    setRuns((hist.data ?? []) as ReportRun[]);
  }

  async function handleRun(def: ReportDefinition) {
    if (!companyId) return;
    setIsRunning(true);
    setActive(def);
    setResult(null);

    const { start, end } = periodRange(def.period);
    const { rows, count } = await runReport(supabase, companyId, def.module, start, end);

    await supabase.from("report_run").insert({
      company_id: companyId,
      definition_id: def.id,
      period_start: start,
      period_end: end,
      row_count: count,
      status: count > 0 ? "success" : "empty",
    });

    setResult({ rows, start, end });
    setIsRunning(false);
    fetchAll();
  }

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Reports</h1>
        <p className="text-sm text-muted">Cross-module reporting over any period</p>
      </div>

      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="text-sm text-muted">
          {definitions.length} saved {definitions.length === 1 ? "report" : "reports"}
        </p>
        <NewReportForm onCreated={fetchAll} />
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="mb-4 text-sm font-semibold text-ink">Saved reports</h2>
          {definitions.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {definitions.map((def) => (
                <div
                  key={def.id}
                  className={`rounded-xl border bg-panel p-4 ${
                    active?.id === def.id ? "border-brand" : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{def.name}</p>
                      <p className="mt-1 text-xs text-muted">
                        {MODULE_LABEL[def.module]} · {def.period}
                      </p>
                      {def.description && (
                        <p className="mt-1 text-xs text-muted">{def.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRun(def)}
                      disabled={isRunning}
                      className="shrink-0 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-light disabled:opacity-50"
                    >
                      {isRunning && active?.id === def.id ? "Running..." : "Run"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-panel p-6 text-center text-sm text-muted">
              No reports defined yet. Create one to pull figures across modules.
            </div>
          )}
        </div>

        {active && result && (
          <div>
            <h2 className="mb-4 text-sm font-semibold text-ink">
              {active.name}
              <span className="ml-2 font-normal text-muted">
                {result.start} to {result.end}
              </span>
            </h2>
            {result.rows.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {result.rows.map((row) => (
                  <div key={row.label} className="rounded-xl border border-border bg-panel p-5">
                    <p className="text-xs text-muted">{row.label}</p>
                    <p className="mt-2 text-2xl font-semibold text-ink">{row.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-panel p-6 text-center text-sm text-muted">
                No data in this period.
              </div>
            )}
          </div>
        )}

        <div>
          <h2 className="mb-4 text-sm font-semibold text-ink">Run history</h2>
          {runs.length > 0 ? (
            <div className="space-y-2">
              {runs.map((run) => {
                const def = definitions.find((d) => d.id === run.definition_id);
                return (
                  <div key={run.id} className="rounded-xl border border-border bg-panel p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-ink">{def?.name ?? "Deleted report"}</p>
                        <p className="mt-1 text-xs text-muted">
                          {run.period_start} to {run.period_end} · {run.row_count ?? 0} records
                        </p>
                      </div>
                      <span
                        className={`rounded px-2 py-1 text-xs font-medium uppercase ${
                          run.status === "success"
                            ? "bg-green-500 text-white"
                            : run.status === "empty"
                            ? "bg-slate-500 text-white"
                            : "bg-red-500 text-white"
                        }`}
                      >
                        {run.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-panel p-6 text-center text-sm text-muted">
              No reports run yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
