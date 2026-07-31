"use client";

/* Guardian.
 *
 * Findings, not alerts. An alert says a threshold was crossed — the stock
 * screen already does that, and it is why 143 units against a reorder level
 * of 60 looks healthy when it is not.
 *
 * Every finding shows its working on the page rather than behind a click. An
 * operations manager will not act on "trust me, Thursday will fall over", and
 * should not. The numbers are the point.
 */

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { GuardianFinding, FindingSeverity } from "@/lib/types";

const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const SEVERITY_STYLE: Record<FindingSeverity, string> = {
  critical: "bg-red-500 text-white",
  high: "bg-amber-500 text-white",
  medium: "bg-brand text-white",
  low: "bg-slate-500 text-white",
};

const SEVERITY_EDGE: Record<FindingSeverity, string> = {
  critical: "border-l-red-500",
  high: "border-l-amber-500",
  medium: "border-l-brand",
  low: "border-l-slate-500",
};

/* Field names as they should read on screen, in the order they should be read.
 *
 * An array rather than an object because jsonb does not preserve key order —
 * Postgres stores keys shortest-first — so listing them here is the only way
 * the numbers appear in the order somebody would work through them. */
const LABELS: [string, string][] = [
  // stockout_risk
  ["units_shipped", "Units shipped"],
  ["days_observed", "Days observed"],
  ["daily_rate", "Leaving per day"],
  ["quantity_on_hand", "On hand"],
  ["quantity_reserved", "Reserved"],
  ["available", "Available"],
  ["reorder_level", "Reorder level"],
  ["days_to_zero", "Days to zero"],
  ["days_to_reorder", "Days to reorder level"],
  ["assumed_lead_days", "Assumed lead time (days)"],
  // capacity_clash
  ["vehicles_serving", "Vehicles serving this site"],
  ["worst_day", "Worst day"],
  ["worst_day_vehicles", "Gone that day"],
  ["share_gone_pct", "Share gone that day (%)"],
  ["days_until", "Days away"],
  ["vehicles_booked_out", "Booked out over the period"],
  ["share_horizon_pct", "Share over the period (%)"],
  ["horizon_days", "Days looked ahead"],
  ["dock_utilization_now", "Dock use, this week (%)"],
  ["dock_utilization_before", "Dock use, before (%)"],
  ["orders_pending_now", "Orders waiting, this week"],
  ["orders_pending_before", "Orders waiting, before"],
  ["orders_per_day", "Orders a day"],
];

/* Anything a check had to assume rather than measure ends in _source, and is
 * spelled out under the numbers. Presenting an assumption as a measurement is
 * the one thing this product exists not to do. */
const NOTE_PREFIX: Record<string, string> = {
  lead_time_source: "Lead time is",
  link_source: "Which vehicles serve this site is",
};

function Evidence({ evidence }: { evidence: GuardianFinding["evidence"] }) {
  const rows = LABELS.filter(([k]) => evidence[k] != null);
  const notes = Object.entries(evidence).filter(([k]) => k.endsWith("_source"));

  return (
    <div className="mt-3 rounded-lg border border-border bg-surface p-3">
      <p className="mb-2 text-[11px] uppercase tracking-wider text-muted">How this was worked out</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 md:grid-cols-4">
        {rows.map(([k, label]) => (
          <div key={k}>
            <p className="text-[11px] text-muted">{label}</p>
            <p className="text-sm text-ink">{String(evidence[k])}</p>
          </div>
        ))}
      </div>
      {notes.map(([k, v]) => (
        <p key={k} className="mt-2 text-[11px] text-amber-400">
          {NOTE_PREFIX[k] ?? "Note:"} {String(v)}.
        </p>
      ))}
    </div>
  );
}

function FindingCard({
  finding,
  onStatus,
}: {
  finding: GuardianFinding;
  onStatus: (id: string, status: "acknowledged" | "resolved") => void;
}) {
  const [open, setOpen] = useState(finding.severity === "critical");

  return (
    <div className={`rounded-xl border border-border border-l-4 bg-panel p-5 ${SEVERITY_EDGE[finding.severity]}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLE[finding.severity]}`}>
              {finding.severity}
            </span>
            {finding.modules.map((m) => (
              <span key={m} className="rounded-md border border-border px-2 py-0.5 text-xs text-muted">
                {m}
              </span>
            ))}
          </div>
          <h3 className="mt-2 text-base font-semibold text-ink">{finding.title}</h3>
          <p className="mt-1 text-sm text-muted">{finding.detail}</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onStatus(finding.id, "acknowledged")}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface"
          >
            Seen
          </button>
          <button
            onClick={() => onStatus(finding.id, "resolved")}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface"
          >
            Done
          </button>
        </div>
      </div>

      {finding.recommendation && (
        <p className="mt-3 rounded-lg bg-brand/10 px-3 py-2 text-sm text-ink">
          <span className="font-medium">Recommended: </span>
          {finding.recommendation}
        </p>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="mt-3 text-xs text-brand-light hover:underline"
      >
        {open ? "Hide the numbers" : "Show the numbers"}
      </button>

      {open && <Evidence evidence={finding.evidence} />}
    </div>
  );
}

export default function GuardianPage() {
  const [findings, setFindings] = useState<GuardianFinding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("guardian_finding")
      .select("*")
      .in("status", ["open", "acknowledged"])
      .order("last_seen_at", { ascending: false });

    if (error) {
      // Migration 0015 not applied. A legitimate state to describe rather
      // than a crash.
      setUnavailable(true);
      setFindings([]);
    } else {
      setUnavailable(false);
      const rows = (data ?? []) as GuardianFinding[];
      // Within a severity, soonest first. Each check names its own countdown —
      // days_to_zero for stock, days_until for a clash — so both are read.
      const soonest = (f: GuardianFinding) =>
        Number(f.evidence.days_to_zero ?? f.evidence.days_until ?? 9999);
      rows.sort(
        (a, b) =>
          SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || soonest(a) - soonest(b)
      );
      setFindings(rows);
      setLastRun(rows[0]?.last_seen_at ?? null);
    }
    setIsLoading(false);
  }

  async function run() {
    setIsRunning(true);
    const { error } = await supabase.rpc("guardian_run_all");
    if (error) setUnavailable(true);
    await load();
    setIsRunning(false);
  }

  async function setStatus(id: string, status: "acknowledged" | "resolved") {
    await supabase.from("guardian_finding").update({ status }).eq("id", id);
    setFindings((f) => (status === "resolved" ? f.filter((x) => x.id !== id) : f));
  }

  const critical = findings.filter((f) => f.severity === "critical").length;
  const high = findings.filter((f) => f.severity === "high").length;

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Guardian</h1>
          <p className="text-sm text-muted">
            What is going to happen, and the numbers behind it
          </p>
        </div>
        <button
          onClick={run}
          disabled={isRunning}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light disabled:opacity-50"
        >
          {isRunning ? "Checking…" : "Run checks"}
        </button>
      </div>

      {unavailable ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm text-amber-300">Guardian is not available on this database.</p>
          <p className="mt-1 text-xs text-muted">
            Migration 0015 creates the findings table and the first check. It has not been
            applied yet.
          </p>
        </div>
      ) : isLoading ? (
        <div className="rounded-xl border border-border bg-panel p-6 text-center text-sm text-muted">
          Loading…
        </div>
      ) : findings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-panel p-8 text-center">
          <p className="text-sm text-ink">Nothing to flag.</p>
          <p className="mt-1 text-xs text-muted">
            Either everything is genuinely fine, or the checks have not been run yet.
            Press <span className="text-ink">Run checks</span> to look now.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-4 text-sm">
            <span className="text-muted">
              <span className="text-ink font-medium">{findings.length}</span> open
            </span>
            {critical > 0 && (
              <span className="text-red-400">{critical} needing action now</span>
            )}
            {high > 0 && <span className="text-amber-400">{high} close behind</span>}
            {lastRun && (
              <span className="ml-auto text-xs text-muted">
                Last checked {new Date(lastRun).toLocaleString()}
              </span>
            )}
          </div>

          <div className="space-y-4">
            {findings.map((f) => (
              <FindingCard key={f.id} finding={f} onStatus={setStatus} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
