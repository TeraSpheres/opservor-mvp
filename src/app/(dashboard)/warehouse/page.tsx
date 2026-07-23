"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { WarehouseSite, WarehouseSnapshot, Alert } from "@/lib/types";

function WarehouseSiteForm({ onSiteAdded }: { onSiteAdded: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  async function handleAddSite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("name"));
    const location = String(formData.get("location") || "");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: appUser } = await supabase
      .from("app_user")
      .select("company_id")
      .eq("auth_id", user.id)
      .single();

    if (!appUser) {
      setIsLoading(false);
      return;
    }

    const { error } = await supabase.from("warehouse_site").insert({
      company_id: appUser.company_id,
      name,
      location: location || null,
    });

    if (!error) {
      setIsOpen(false);
      (e.target as HTMLFormElement).reset();
      onSiteAdded();
    }
    setIsLoading(false);
  }

  return (
    <>
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light"
        >
          Add warehouse site
        </button>
      ) : (
        <form onSubmit={handleAddSite} className="rounded-xl border border-border bg-panel p-4 space-y-3">
          <input
            name="name"
            type="text"
            placeholder="Site name"
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <input
            name="location"
            type="text"
            placeholder="Location (optional)"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-light disabled:opacity-50"
            >
              {isLoading ? "Adding..." : "Add site"}
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
      )}
    </>
  );
}

function WarehouseSnapshotForm({
  site,
  onSnapshotSaved,
}: {
  site: WarehouseSite;
  onSnapshotSaved: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  async function handleSaveSnapshot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("warehouse_snapshot").upsert({
      company_id: site.company_id,
      site_id: site.id,
      date: String(formData.get("date")),
      shift: String(formData.get("shift") || "all"),
      productivity_pct: Number(formData.get("productivity_pct") || 0),
      orders_processed: Number(formData.get("orders_processed") || 0),
      orders_pending: Number(formData.get("orders_pending") || 0),
      dock_utilization_pct: Number(formData.get("dock_utilization_pct") || 0),
    }, { onConflict: "company_id,site_id,date,shift" });

    if (!error) {
      (e.target as HTMLFormElement).reset();
      onSnapshotSaved();
    }
    setIsLoading(false);
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  return (
    <form onSubmit={handleSaveSnapshot} className="rounded-xl border border-border bg-panel p-5 space-y-4">
      <h3 className="text-sm font-semibold text-ink">{site.name} — Daily Snapshot</h3>

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
          <label className="block text-xs font-medium text-muted mb-1">Shift</label>
          <select
            name="shift"
            defaultValue="all"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="all">All day</option>
            <option value="A">Shift A</option>
            <option value="B">Shift B</option>
            <option value="C">Shift C</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Productivity (%)</label>
          <input
            name="productivity_pct"
            type="number"
            step="0.1"
            min="0"
            max="100"
            defaultValue={0}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Dock Utilization (%)</label>
          <input
            name="dock_utilization_pct"
            type="number"
            step="0.1"
            min="0"
            max="100"
            defaultValue={0}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Orders Processed</label>
          <input
            name="orders_processed"
            type="number"
            min="0"
            defaultValue={0}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Orders Pending</label>
          <input
            name="orders_pending"
            type="number"
            min="0"
            defaultValue={0}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light disabled:opacity-50"
      >
        {isLoading ? "Saving..." : "Save snapshot"}
      </button>
    </form>
  );
}

function WarehouseKpiCard({
  label,
  value,
  unit = "",
  icon,
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-panel p-5">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">
        {value}
        {unit && <span className="ml-1 text-sm font-normal">{unit}</span>}
      </p>
      {icon && <p className="mt-2 text-xl">{icon}</p>}
    </div>
  );
}

function WarehouseAlertsPanel({ siteId }: { siteId: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchAlerts();
  }, [siteId]);

  async function fetchAlerts() {
    setIsLoading(true);
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

    const { data } = await supabase
      .from("alert")
      .select("*")
      .eq("company_id", appUser.company_id)
      .or(`site_id.eq.${siteId},site_id.is.null`)
      .eq("status", "open")
      .order("created_at", { ascending: false });

    setAlerts((data ?? []) as Alert[]);
    setIsLoading(false);
  }

  async function handleResolveAlert(alertId: string) {
    const { error } = await supabase
      .from("alert")
      .update({ status: "resolved" })
      .eq("id", alertId);

    if (!error) {
      fetchAlerts();
    }
  }

  if (isLoading) return <div className="text-sm text-muted">Loading alerts...</div>;
  if (alerts.length === 0) return <div className="text-sm text-muted">No open alerts for this site.</div>;

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div key={alert.id} className="rounded-xl border border-border bg-panel p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium text-ink">{alert.title}</p>
              {alert.detail && <p className="mt-1 text-xs text-muted">{alert.detail}</p>}
              <p className="mt-2 text-xs text-muted">Severity: {alert.severity}</p>
            </div>
            <button
              onClick={() => handleResolveAlert(alert.id)}
              className="rounded-md bg-brand px-3 py-1 text-xs font-medium text-white hover:bg-brand-light"
            >
              Resolve
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function WarehousePage() {
  const [sites, setSites] = useState<WarehouseSite[]>([]);
  const [selectedSite, setSelectedSite] = useState<WarehouseSite | null>(null);
  const [snapshots, setSnapshots] = useState<WarehouseSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchSites();
  }, []);

  async function fetchSites() {
    setIsLoading(true);
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

    const { data } = await supabase
      .from("warehouse_site")
      .select("*")
      .eq("company_id", appUser.company_id)
      .order("created_at", { ascending: false });

    const siteList = (data ?? []) as WarehouseSite[];
    setSites(siteList);
    if (siteList.length > 0 && !selectedSite) {
      setSelectedSite(siteList[0]);
      fetchSnapshots(siteList[0].id, appUser.company_id);
    }
    setIsLoading(false);
  }

  async function fetchSnapshots(siteId: string, companyId: string) {
    const { data } = await supabase
      .from("warehouse_snapshot")
      .select("*")
      .eq("company_id", companyId)
      .eq("site_id", siteId)
      .order("date", { ascending: false })
      .limit(7);

    setSnapshots((data ?? []) as WarehouseSnapshot[]);
  }

  function handleSiteSelect(site: WarehouseSite) {
    setSelectedSite(site);
    fetchSnapshots(site.id, site.company_id);
  }

  function handleSnapshotSaved() {
    if (selectedSite) {
      fetchSnapshots(selectedSite.id, selectedSite.company_id);
    }
  }

  const latestSnapshot = snapshots[0] ?? null;

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Warehouse Operations</h1>
        <p className="text-sm text-muted">Track warehouse performance and site metrics</p>
      </div>

      <div className="mb-6 flex gap-4 items-center justify-between">
        <div className="flex gap-2">
          {sites.map((site) => (
            <button
              key={site.id}
              onClick={() => handleSiteSelect(site)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                selectedSite?.id === site.id
                  ? "bg-brand text-white"
                  : "border border-border text-ink hover:bg-panel"
              }`}
            >
              {site.name}
            </button>
          ))}
        </div>
        <WarehouseSiteForm onSiteAdded={fetchSites} />
      </div>

      {selectedSite ? (
        <div className="space-y-6">
          <WarehouseSnapshotForm site={selectedSite} onSnapshotSaved={handleSnapshotSaved} />

          {latestSnapshot && (
            <div>
              <h2 className="mb-4 text-sm font-semibold text-ink">Performance ({latestSnapshot.date})</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <WarehouseKpiCard label="Productivity" value={latestSnapshot.productivity_pct} unit="%" />
                <WarehouseKpiCard label="Dock Utilization" value={latestSnapshot.dock_utilization_pct} unit="%" />
                <WarehouseKpiCard label="Orders Processed" value={latestSnapshot.orders_processed} />
                <WarehouseKpiCard label="Orders Pending" value={latestSnapshot.orders_pending} />
              </div>
            </div>
          )}

          <div>
            <h2 className="mb-4 text-sm font-semibold text-ink">Open Alerts</h2>
            <WarehouseAlertsPanel siteId={selectedSite.id} />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-panel p-6 text-center text-sm text-muted">
          No warehouse sites yet. Add one to get started.
        </div>
      )}
    </div>
  );
}
