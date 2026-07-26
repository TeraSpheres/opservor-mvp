"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ReportDefinition, ReportRun, ReportModule, ReportPeriod } from "@/lib/types";

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
  const num = (n: number) => n.toLocaleString();

  const between = (q: any, col = "date") => q.gte(col, start).lte(col, end);

  if (module === "warehouse" || module === "cross_module") {
    const { data } = await between(
      supabase.from("warehouse_snapshot").select("*").eq("company_id", companyId),
    );
    const d = data ?? [];
    count += d.length;
    if (module === "warehouse") {
      const orders = d.reduce((s: number, r: any) => s + (r.orders_processed ?? 0), 0);
      const avg = d.length ? d.reduce((s: number, r: any) => s + Number(r.productivity_pct ?? 0), 0) / d.length : 0;
      rows.push({ label: "Shift snapshots", value: num(d.length) });
      rows.push({ label: "Orders processed", value: num(orders) });
      rows.push({ label: "Average productivity", value: `${avg.toFixed(1)}%` });
    } else rows.push({ label: "Warehouse snapshots", value: num(d.length) });
  }

  if (module === "fleet" || module === "cross_module") {
    const { data } = await between(
      supabase.from("fleet_trip").select("*").eq("company_id", companyId),
    );
    const d = data ?? [];
    count += d.length;
    const miles = d.reduce((s: number, r: any) => s + Number(r.miles_driven ?? 0), 0);
    if (module === "fleet") {
      const fuel = d.reduce((s: number, r: any) => s + Number(r.fuel_used ?? 0), 0);
      rows.push({ label: "Trips logged", value: num(d.length) });
      rows.push({ label: "Distance", value: `${miles.toFixed(1)} mi` });
      rows.push({ label: "Fuel used", value: fuel ? `${fuel.toFixed(1)} gal` : "—" });
      rows.push({ label: "Efficiency", value: fuel ? `${(miles / fuel).toFixed(1)} mpg` : "—" });
    } else rows.push({ label: "Fleet trips", value: `${num(d.length)} · ${miles.toFixed(0)} mi` });
  }

  if (module === "inventory" || module === "cross_module") {
    const { data } = await between(
      supabase.from("inventory_movement").select("*").eq("company_id", companyId),
    );
    const d = data ?? [];
    count += d.length;
    if (module === "inventory") {
      const inb = d.filter((r: any) => r.type === "inbound").reduce((s: number, r: any) => s + r.quantity, 0);
      const out = d.filter((r: any) => r.type === "outbound").reduce((s: number, r: any) => s + r.quantity, 0);
      rows.push({ label: "Movements", value: num(d.length) });
      rows.push({ label: "Units received", value: num(inb) });
      rows.push({ label: "Units shipped", value: num(out) });
      rows.push({ label: "Net change", value: num(inb - out) });
    } else rows.push({ label: "Stock movements", value: num(d.length) });
  }

  if (module === "finance" || module === "cross_module") {
    const { data } = await between(
      supabase.from("finance_transaction").select("*").eq("company_id", companyId),
    );
    const d = data ?? [];
    count += d.length;
    const rev = d.filter((r: any) => r.type === "revenue").reduce((s: number, r: any) => s + Number(r.amount), 0);
    const exp = d.filter((r: any) => r.type === "expense").reduce((s: number, r: any) => s + Number(r.amount), 0);
    if (module === "finance") {
      rows.push({ label: "Transactions", value: num(d.length) });
      rows.push({ label: "Revenue", value: `$${rev.toFixed(2)}` });
      rows.push({ label: "Expenses", value: `$${exp.toFixed(2)}` });
      rows.push({ label: "Net", value: `$${(rev - exp).toFixed(2)}` });
    } else rows.push({ label: "Net position", value: `$${(rev - exp).toFixed(2)}` });
  }

  if (module === "hr" || module === "cross_module") {
    const { data } = await between(
      supabase.from("hr_attendance").select("*").eq("company_id", companyId),
    );
    const d = data ?? [];
    count += d.length;
    const present = d.filter((r: any) => r.status === "present" || r.status === "remote").length;
    if (module === "hr") {
      rows.push({ label: "Attendance records", value: num(d.length) });
      rows.push({ label: "Present or remote", value: num(present) });
      rows.push({ label: "Absent", value: num(d.filter((r: any) => r.status === "absent").length) });
      rows.push({
        label: "Attendance rate",
        value: d.length ? `${((present / d.length) * 100).toFixed(1)}%` : "—",
      });
    } else rows.push({ label: "Attendance records", value: num(d.length) });
  }

  if (module === "safety" || module === "cross_module") {
    const { data } = await between(
      supabase.from("safety_incident").select("*").eq("company_id", companyId),
    );
    const d = data ?? [];
    count += d.length;
    if (module === "safety") {
      rows.push({ label: "Incidents", value: num(d.length) });
      rows.push({ label: "Critical", value: num(d.filter((r: any) => r.severity === "critical").length) });
      rows.push({ label: "High", value: num(d.filter((r: any) => r.severity === "high").length) });
      rows.push({
        label: "Still open",
        value: num(d.filter((r: any) => r.status === "open" || r.status === "investigating").length),
      });
    } else rows.push({ label: "Safety incidents", value: num(d.length) });
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
        name="name"
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
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
      />

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
