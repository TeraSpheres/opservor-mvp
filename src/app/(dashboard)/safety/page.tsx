"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SafetyIncident, SafetyInspection, IncidentSeverity } from "@/lib/types";

const SEVERITY_STYLE: Record<IncidentSeverity, string> = {
  critical: "bg-red-500 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-amber-500 text-white",
  low: "bg-slate-500 text-white",
};

const STATUS_STYLE: Record<string, string> = {
  open: "text-red-400",
  investigating: "text-amber-400",
  resolved: "text-green-400",
  closed: "text-muted",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function LogIncidentForm({ onLogged }: { onLogged: () => void }) {
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

    const { error } = await supabase.from("safety_incident").insert({
      company_id: appUser.company_id,
      date: String(data.get("date")),
      severity: String(data.get("severity")),
      category: String(data.get("category")),
      location: String(data.get("location") || "") || null,
      description: String(data.get("description")),
      corrective_action: String(data.get("corrective_action") || "") || null,
      reported_by: String(data.get("reported_by") || "") || null,
      status: "open",
    });

    if (!error) {
      setIsOpen(false);
      form.reset();
      onLogged();
    }
    setIsLoading(false);
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light"
      >
        Log incident
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-panel p-5 space-y-4">
      <h3 className="text-sm font-semibold text-ink">Log an incident</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Date</label>
          <input
            name="date"
            type="date"
            defaultValue={todayISO()}
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Severity</label>
          <select
            name="severity"
            required
            defaultValue="medium"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Category</label>
          <input
            name="category"
            type="text"
            placeholder="e.g. Slip, Equipment, Vehicle"
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Location</label>
          <input
            name="location"
            type="text"
            placeholder="Site or area"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted mb-1">What happened</label>
        <textarea
          name="description"
          required
          rows={2}
          placeholder="Describe the incident"
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted mb-1">Corrective action</label>
        <textarea
          name="corrective_action"
          rows={2}
          placeholder="What was done, or is planned"
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

      <input
        name="reported_by"
        type="text"
        placeholder="Reported by (optional)"
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
      />

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-light disabled:opacity-50"
        >
          {isLoading ? "Saving..." : "Log incident"}
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

function LogInspectionForm({ onLogged }: { onLogged: () => void }) {
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

    const { error } = await supabase.from("safety_inspection").insert({
      company_id: appUser.company_id,
      date: String(data.get("date")),
      area: String(data.get("area")),
      inspector: String(data.get("inspector") || "") || null,
      result: String(data.get("result")),
      findings: String(data.get("findings") || "") || null,
    });

    if (!error) {
      form.reset();
      onLogged();
    }
    setIsLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-panel p-5 space-y-4">
      <h3 className="text-sm font-semibold text-ink">Record an inspection</h3>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Date</label>
          <input
            name="date"
            type="date"
            defaultValue={todayISO()}
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Area</label>
          <input
            name="area"
            type="text"
            placeholder="e.g. Loading dock"
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Result</label>
          <select
            name="result"
            required
            defaultValue="pass"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="pass">Pass</option>
            <option value="conditional">Conditional</option>
            <option value="fail">Fail</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <input
          name="inspector"
          type="text"
          placeholder="Inspector (optional)"
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <input
          name="findings"
          type="text"
          placeholder="Findings (optional)"
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light disabled:opacity-50"
      >
        {isLoading ? "Saving..." : "Record inspection"}
      </button>
    </form>
  );
}

function MetricCard({
  label,
  value,
  note,
  tone = "text-ink",
}: {
  label: string;
  value: string | number;
  note?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-panel p-5">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  );
}

export default function SafetyPage() {
  const [incidents, setIncidents] = useState<SafetyIncident[]>([]);
  const [inspections, setInspections] = useState<SafetyInspection[]>([]);
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

    const [inc, insp] = await Promise.all([
      supabase
        .from("safety_incident")
        .select("*")
        .eq("company_id", appUser.company_id)
        .order("date", { ascending: false })
        .limit(50),
      supabase
        .from("safety_inspection")
        .select("*")
        .eq("company_id", appUser.company_id)
        .order("date", { ascending: false })
        .limit(20),
    ]);

    setIncidents((inc.data ?? []) as SafetyIncident[]);
    setInspections((insp.data ?? []) as SafetyInspection[]);
  }

  // Derived on read. Once safety_snapshot is populated these come from there.
  const openCount = incidents.filter((i) => i.status === "open" || i.status === "investigating").length;
  const criticalCount = incidents.filter((i) => i.severity === "critical").length;
  const failedInspections = inspections.filter((i) => i.result === "fail").length;

  const daysSinceLast = incidents.length
    ? Math.floor((Date.now() - new Date(incidents[0].date).getTime()) / 86_400_000)
    : null;

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Safety &amp; Compliance</h1>
        <p className="text-sm text-muted">Incident capture, inspections and corrective action</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard
          label="Days since last incident"
          value={daysSinceLast === null ? "—" : daysSinceLast}
          note={daysSinceLast === null ? "No incidents recorded" : "Since most recent report"}
          tone={daysSinceLast !== null && daysSinceLast < 7 ? "text-amber-400" : "text-green-400"}
        />
        <MetricCard
          label="Open incidents"
          value={openCount}
          note="Open or investigating"
          tone={openCount > 0 ? "text-red-400" : "text-green-400"}
        />
        <MetricCard
          label="Critical (all time)"
          value={criticalCount}
          tone={criticalCount > 0 ? "text-red-400" : "text-ink"}
        />
        <MetricCard
          label="Failed inspections"
          value={failedInspections}
          note={`${inspections.length} recorded`}
          tone={failedInspections > 0 ? "text-amber-400" : "text-green-400"}
        />
      </div>

      <div className="mb-6 flex justify-end">
        <LogIncidentForm onLogged={fetchAll} />
      </div>

      <div className="space-y-6">
        <LogInspectionForm onLogged={fetchAll} />

        <div>
          <h2 className="mb-4 text-sm font-semibold text-ink">Incidents ({incidents.length})</h2>
          {incidents.length > 0 ? (
            <div className="space-y-2">
              {incidents.map((incident) => (
                <div key={incident.id} className="rounded-xl border border-border bg-panel p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium uppercase ${SEVERITY_STYLE[incident.severity]}`}
                        >
                          {incident.severity}
                        </span>
                        <p className="font-medium text-ink">{incident.category}</p>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {incident.date}
                        {incident.location ? ` · ${incident.location}` : ""}
                      </p>
                      <p className="mt-2 text-sm text-ink">{incident.description}</p>
                      {incident.corrective_action && (
                        <p className="mt-1 text-xs text-muted">
                          Action: {incident.corrective_action}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs font-medium capitalize ${STATUS_STYLE[incident.status]}`}>
                      {incident.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-panel p-6 text-center text-sm text-muted">
              No incidents recorded. That is the goal.
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-4 text-sm font-semibold text-ink">Recent inspections</h2>
          {inspections.length > 0 ? (
            <div className="space-y-2">
              {inspections.map((inspection) => (
                <div key={inspection.id} className="rounded-xl border border-border bg-panel p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-ink">{inspection.area}</p>
                      <p className="mt-1 text-xs text-muted">
                        {inspection.date}
                        {inspection.inspector ? ` · ${inspection.inspector}` : ""}
                      </p>
                      {inspection.findings && (
                        <p className="mt-1 text-xs text-muted">{inspection.findings}</p>
                      )}
                    </div>
                    <span
                      className={`rounded px-2 py-1 text-xs font-medium uppercase ${
                        inspection.result === "pass"
                          ? "bg-green-500 text-white"
                          : inspection.result === "conditional"
                          ? "bg-amber-500 text-white"
                          : "bg-red-500 text-white"
                      }`}
                    >
                      {inspection.result}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-panel p-6 text-center text-sm text-muted">
              No inspections recorded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
