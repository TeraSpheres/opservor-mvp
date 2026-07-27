"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  FleetVehicle,
  FleetTrip,
  FleetMaintenance,
  VehicleStatus,
  MaintenanceStatus,
} from "@/lib/types";
import {
  VEHICLE_TYPE_GROUPS,
  FUEL_TYPE_GROUPS,
  MAINTENANCE_TYPE_GROUPS,
  optionCount,
  type OptionGroup,
} from "@/lib/fleet-options";

const STATUS_STYLES: Record<VehicleStatus, string> = {
  active: "bg-green-500 text-white",
  maintenance: "bg-amber-500 text-white",
  inactive: "bg-slate-500 text-white",
  retired: "bg-red-500 text-white",
};

const MAINT_STATUS_STYLES: Record<MaintenanceStatus, string> = {
  scheduled: "bg-brand text-white",
  in_progress: "bg-amber-500 text-white",
  completed: "bg-green-500 text-white",
  cancelled: "bg-slate-500 text-white",
};

function StatusBadge({ status }: { status: VehicleStatus }) {
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

function MaintBadge({ status }: { status: MaintenanceStatus }) {
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${MAINT_STATUS_STYLES[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}

/** A select backed by grouped reference data — see lib/fleet-options. */
function GroupedSelect({
  name,
  groups,
  className,
  required,
  placeholder = "Select…",
  defaultValue = "",
}: {
  name: string;
  groups: OptionGroup[];
  className?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <select name={name} required={required} defaultValue={defaultValue} className={className}>
      <option value="" disabled>
        {placeholder}
      </option>
      {groups.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

const todayISO = () => new Date().toISOString().slice(0, 10);

function AddVehicleForm({ onVehicleAdded }: { onVehicleAdded: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function handleAddVehicle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Not signed in.");
      setIsLoading(false);
      return;
    }

    const { data: appUser } = await supabase
      .from("app_user")
      .select("company_id")
      .eq("auth_id", user.id)
      .single();

    if (!appUser) {
      setError("No company found for this account.");
      setIsLoading(false);
      return;
    }

    const str = (k: string) => {
      const v = String(formData.get(k) ?? "").trim();
      return v === "" ? null : v;
    };

    // mileage is deliberately absent. Migration 0009 derives it from completed
    // trips, so anything typed here would be overwritten on the next trip.
    const { error: insertError } = await supabase.from("fleet_vehicle").insert({
      company_id: appUser.company_id,
      name: String(formData.get("vehicle_name")),
      type: String(formData.get("vehicle_type")),
      status: String(formData.get("status") || "active"),
      license_plate: str("license_plate"),
      fuel_type: str("fuel_type"),
      purchase_date: str("purchase_date"),
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setIsOpen(false);
      form.reset();
      onVehicleAdded();
    }
    setIsLoading(false);
  }

  const field =
    "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand";
  const label = "block text-xs font-medium text-muted mb-1";

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light"
      >
        Add vehicle
      </button>
    );
  }

  return (
    <form
      onSubmit={handleAddVehicle}
      className="w-full rounded-xl border border-border bg-panel p-5 space-y-4"
    >
      <h3 className="text-sm font-semibold text-ink">Add vehicle</h3>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className={label}>Name</label>
          <input name="vehicle_name" autoComplete="off" type="text" placeholder="Truck #1" required className={field} />
        </div>
        <div>
          <label className={label}>Type</label>
          <GroupedSelect
            name="vehicle_type"
            groups={VEHICLE_TYPE_GROUPS}
            required
            placeholder="Select vehicle type…"
            className={field}
          />
        </div>
        <div>
          <label className={label}>Status</label>
          <select name="status" defaultValue="active" className={field}>
            <option value="active">active</option>
            <option value="maintenance">maintenance</option>
            <option value="inactive">inactive</option>
            <option value="retired">retired</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className={label}>Licence plate</label>
          <input name="license_plate" type="text" placeholder="Optional" className={field} autoComplete="off" />
        </div>
        <div>
          <label className={label}>Fuel type</label>
          <GroupedSelect
            name="fuel_type"
            groups={FUEL_TYPE_GROUPS}
            placeholder="Select fuel type…"
            className={field}
          />
        </div>
        <div>
          <label className={label}>Purchase date</label>
          <input name="purchase_date" type="date" className={field} />
        </div>
      </div>

      <p className="text-xs text-muted">
        Mileage is not entered here — it is calculated from completed trips.
      </p>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light disabled:opacity-50"
        >
          {isLoading ? "Adding..." : "Add vehicle"}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setError(null);
          }}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function LogTripForm({
  vehicle,
  onTripLogged,
}: {
  vehicle: FleetVehicle;
  onTripLogged: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function handleLogTrip(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const fuelRaw = String(formData.get("fuel_used") ?? "").trim();

    const { error: insertError } = await supabase.from("fleet_trip").insert({
      company_id: vehicle.company_id,
      vehicle_id: vehicle.id,
      date: String(formData.get("date")),
      miles_driven: Number(formData.get("miles_driven") || 0),
      // "" coerces to 0, which is a real reading rather than "not recorded"
      fuel_used: fuelRaw === "" ? null : Number(fuelRaw),
      origin: String(formData.get("origin") || "") || null,
      destination: String(formData.get("destination") || "") || null,
      status: String(formData.get("status") || "completed"),
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      form.reset();
      onTripLogged();
    }
    setIsLoading(false);
  }

  const field =
    "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand";
  const label = "block text-xs font-medium text-muted mb-1";

  return (
    <form onSubmit={handleLogTrip} className="rounded-xl border border-border bg-panel p-5 space-y-4">
      <h3 className="text-sm font-semibold text-ink">Log a trip — {vehicle.name}</h3>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div>
          <label className={label}>Date</label>
          <input
            name="date"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
            className={field}
          />
        </div>
        <div>
          <label className={label}>Miles driven</label>
          <input name="miles_driven" type="number" step="0.1" min="0" defaultValue={0} className={field} />
        </div>
        <div>
          <label className={label}>Fuel used (gal)</label>
          <input name="fuel_used" type="number" step="0.1" min="0" placeholder="Optional" className={field} />
        </div>
        <div>
          <label className={label}>Status</label>
          <select name="status" defaultValue="completed" className={field}>
            <option value="completed">completed</option>
            <option value="in_progress">in_progress</option>
            <option value="cancelled">cancelled</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className={label}>Origin</label>
          <input name="origin" type="text" placeholder="Warehouse A" className={field} autoComplete="off" />
        </div>
        <div>
          <label className={label}>Destination</label>
          <input name="destination" type="text" placeholder="Customer site" className={field} autoComplete="off" />
        </div>
      </div>

      <p className="text-xs text-muted">
        Only completed trips count toward vehicle mileage.
      </p>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={isLoading}
        className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light disabled:opacity-50"
      >
        {isLoading ? "Logging..." : "Log trip"}
      </button>
    </form>
  );
}

function ScheduleMaintenanceForm({
  vehicle,
  onScheduled,
}: {
  vehicle: FleetVehicle;
  onScheduled: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<MaintenanceStatus>("scheduled");
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const form = e.currentTarget;
    const fd = new FormData(form);

    const str = (k: string) => {
      const v = String(fd.get(k) ?? "").trim();
      return v === "" ? null : v;
    };
    const numOrNull = (k: string) => {
      const v = String(fd.get(k) ?? "").trim();
      return v === "" ? null : Number(v);
    };

    const nextStatus = String(fd.get("maint_status") || "scheduled") as MaintenanceStatus;

    // The table enforces this pairing; catching it here gives a readable
    // message instead of a constraint violation.
    const completed = str("completed_date");
    if (nextStatus === "completed" && !completed) {
      setError("A completed job needs a completion date.");
      setIsLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("fleet_maintenance").insert({
      company_id: vehicle.company_id,
      vehicle_id: vehicle.id,
      type: String(fd.get("maint_type")),
      status: nextStatus,
      priority: String(fd.get("priority") || "routine"),
      scheduled_date: str("scheduled_date"),
      completed_date: nextStatus === "completed" ? completed : null,
      odometer: numOrNull("odometer"),
      cost: numOrNull("cost"),
      vendor: str("vendor"),
      reference: str("reference"),
      notes: str("notes"),
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      form.reset();
      setStatus("scheduled");
      setIsOpen(false);
      onScheduled();
    }
    setIsLoading(false);
  }

  const field =
    "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand";
  const label = "block text-xs font-medium text-muted mb-1";

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-md border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-panel"
      >
        Book maintenance
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-panel p-5 space-y-4">
      <h3 className="text-sm font-semibold text-ink">Book maintenance — {vehicle.name}</h3>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className={label}>Work required</label>
          <GroupedSelect
            name="maint_type"
            groups={MAINTENANCE_TYPE_GROUPS}
            required
            placeholder="Select work…"
            className={field}
          />
        </div>
        <div>
          <label className={label}>Status</label>
          <select
            name="maint_status"
            value={status}
            onChange={(e) => setStatus(e.target.value as MaintenanceStatus)}
            className={field}
          >
            <option value="scheduled">scheduled</option>
            <option value="in_progress">in progress</option>
            <option value="completed">completed</option>
            <option value="cancelled">cancelled</option>
          </select>
        </div>
        <div>
          <label className={label}>Priority</label>
          <select name="priority" defaultValue="routine" className={field}>
            <option value="routine">routine</option>
            <option value="high">high</option>
            <option value="critical">critical</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className={label}>Due date</label>
          <input name="scheduled_date" type="date" defaultValue={todayISO()} className={field} />
        </div>
        <div>
          <label className={label}>Completed on</label>
          <input
            name="completed_date"
            type="date"
            disabled={status !== "completed"}
            className={`${field} disabled:opacity-40`}
          />
        </div>
        <div>
          <label className={label}>Odometer</label>
          <input name="odometer" type="number" min="0" placeholder="Reading at service" className={field} autoComplete="off" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className={label}>Cost</label>
          <input name="cost" type="number" step="0.01" min="0" placeholder="0.00" className={field} autoComplete="off" />
        </div>
        <div>
          <label className={label}>Vendor</label>
          <input name="vendor" type="text" placeholder="Garage or workshop" className={field} autoComplete="off" />
        </div>
        <div>
          <label className={label}>Work order</label>
          <input name="reference" type="text" placeholder="Reference number" className={field} autoComplete="off" />
        </div>
      </div>

      <div>
        <label className={label}>Notes</label>
        <input name="notes" type="text" placeholder="Optional" className={field} autoComplete="off" />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light disabled:opacity-50"
        >
          {isLoading ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setError(null);
          }}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function MetricCard({
  label,
  value,
  unit = "",
  note,
}: {
  label: string;
  value: string | number;
  unit?: string;
  note?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-panel p-5">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">
        {value}
        {unit && <span className="ml-1 text-sm font-normal">{unit}</span>}
      </p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  );
}

const num = (n: number) => n.toLocaleString();

export default function FleetPage() {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<FleetVehicle | null>(null);
  const [trips, setTrips] = useState<FleetTrip[]>([]);
  const [tripCounts, setTripCounts] = useState<Record<string, number>>({});
  const [maintenance, setMaintenance] = useState<FleetMaintenance[]>([]);
  const [maintUnavailable, setMaintUnavailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchVehicles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchVehicles() {
    setIsLoading(true);
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

    const { data } = await supabase
      .from("fleet_vehicle")
      .select("*")
      .eq("company_id", appUser.company_id)
      .order("created_at", { ascending: false });

    const list = (data ?? []) as FleetVehicle[];
    setVehicles(list);

    // Completed-trip count per vehicle — used to tell "no trips yet" apart from
    // "trips exist but mileage is still zero", which means 0009 has not run.
    const { data: tripRows } = await supabase
      .from("fleet_trip")
      .select("vehicle_id")
      .eq("company_id", appUser.company_id)
      .eq("status", "completed");

    const counts: Record<string, number> = {};
    for (const row of (tripRows ?? []) as { vehicle_id: string }[]) {
      counts[row.vehicle_id] = (counts[row.vehicle_id] ?? 0) + 1;
    }
    setTripCounts(counts);

    // Maintenance arrives in 0010. If that has not been applied the table is
    // absent, which is a legitimate state rather than an error — the section
    // says so instead of the page failing.
    const { data: maintRows, error: maintError } = await supabase
      .from("fleet_maintenance")
      .select("*")
      .eq("company_id", appUser.company_id)
      .order("scheduled_date", { ascending: true, nullsFirst: false });

    if (maintError) {
      setMaintUnavailable(true);
      setMaintenance([]);
    } else {
      setMaintUnavailable(false);
      setMaintenance((maintRows ?? []) as FleetMaintenance[]);
    }

    setSelectedVehicle((current) => {
      if (current) {
        const refreshed = list.find((v) => v.id === current.id);
        if (refreshed) {
          fetchTrips(refreshed.id, appUser.company_id);
          return refreshed;
        }
      }
      if (list.length > 0) {
        fetchTrips(list[0].id, appUser.company_id);
        return list[0];
      }
      return null;
    });

    setIsLoading(false);
  }

  async function fetchTrips(vehicleId: string, companyId: string) {
    const { data } = await supabase
      .from("fleet_trip")
      .select("*")
      .eq("company_id", companyId)
      .eq("vehicle_id", vehicleId)
      .order("date", { ascending: false })
      .limit(10);

    setTrips((data ?? []) as FleetTrip[]);
  }

  function handleVehicleSelect(vehicle: FleetVehicle) {
    setSelectedVehicle(vehicle);
    fetchTrips(vehicle.id, vehicle.company_id);
  }

  // A trip changes vehicle mileage via trigger, so the registry is refetched
  // rather than the trip list alone.
  function handleTripLogged() {
    fetchVehicles();
  }

  const fleetMileage = vehicles.reduce((s, v) => s + (v.mileage ?? 0), 0);
  const activeCount = vehicles.filter((v) => v.status === "active").length;
  const inMaintenance = vehicles.filter((v) => v.status === "maintenance").length;

  // Trips recorded but every vehicle still on zero: the mileage trigger from
  // 0009 is not in place yet.
  const anyCompletedTrips = Object.values(tripCounts).some((c) => c > 0);
  const mileageLooksUnsynced = anyCompletedTrips && fleetMileage === 0;

  const totalMiles = trips
    .filter((t) => t.status === "completed")
    .reduce((s, t) => s + t.miles_driven, 0);

  const openMaint = maintenance.filter(
    (m) => m.status === "scheduled" || m.status === "in_progress"
  );
  const overdueMaint = openMaint.filter(
    (m) => m.scheduled_date != null && m.scheduled_date < todayISO()
  );
  const maintSpend = maintenance
    .filter((m) => m.status === "completed")
    .reduce((s, m) => s + (m.cost ?? 0), 0);
  const vehicleMaint = selectedVehicle
    ? maintenance.filter((m) => m.vehicle_id === selectedVehicle.id)
    : [];

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Fleet Operations</h1>
        <p className="text-sm text-muted">
          Vehicle registry, trip log, maintenance and utilisation
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Vehicles" value={vehicles.length} />
        <MetricCard label="Active" value={activeCount} note={inMaintenance ? `${inMaintenance} in maintenance` : undefined} />
        <MetricCard label="Fleet mileage" value={num(fleetMileage)} unit="mi" note="From completed trips" />
        <MetricCard
          label="Maintenance open"
          value={openMaint.length}
          note={overdueMaint.length ? `${overdueMaint.length} overdue` : "None overdue"}
        />
      </div>

      {mileageLooksUnsynced && (
        <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm text-amber-300">
            Trips are recorded but every vehicle still reads zero mileage.
          </p>
          <p className="mt-1 text-xs text-muted">
            Migration 0009 adds the trigger that keeps mileage in step with completed trips.
            It has not been applied to this database yet.
          </p>
        </div>
      )}

      <div className="mb-6 flex items-start justify-end">
        <AddVehicleForm onVehicleAdded={fetchVehicles} />
      </div>

      <div className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-ink">Vehicle registry</h2>
        {isLoading ? (
          <div className="rounded-xl border border-border bg-panel p-6 text-center text-sm text-muted">
            Loading…
          </div>
        ) : vehicles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-panel p-6 text-center text-sm text-muted">
            No vehicles yet. Add one to get started.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-panel">
                <tr className="text-left text-xs text-muted">
                  <th className="px-4 py-3 font-medium">Vehicle</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Plate</th>
                  <th className="px-4 py-3 font-medium">Fuel</th>
                  <th className="px-4 py-3 font-medium">In service</th>
                  <th className="px-4 py-3 text-right font-medium">Trips</th>
                  <th className="px-4 py-3 text-right font-medium">Mileage</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => {
                  const selected = selectedVehicle?.id === v.id;
                  return (
                    <tr
                      key={v.id}
                      onClick={() => handleVehicleSelect(v)}
                      className={`cursor-pointer border-t border-border transition-colors ${
                        selected ? "bg-brand/10" : "hover:bg-panel"
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-ink">{v.name}</td>
                      <td className="px-4 py-3 text-muted">{v.type}</td>
                      <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                      <td className="px-4 py-3 text-muted">{v.license_plate ?? "—"}</td>
                      <td className="px-4 py-3 text-muted">{v.fuel_type ?? "—"}</td>
                      <td className="px-4 py-3 text-muted">{v.purchase_date ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-muted">{tripCounts[v.id] ?? 0}</td>
                      <td className="px-4 py-3 text-right font-medium text-ink">
                        {num(v.mileage ?? 0)} <span className="text-xs font-normal text-muted">mi</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedVehicle && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-ink">{selectedVehicle.name}</h2>
            <StatusBadge status={selectedVehicle.status} />
            <span className="text-xs text-muted">
              {num(selectedVehicle.mileage ?? 0)} mi lifetime
            </span>
          </div>

          <LogTripForm vehicle={selectedVehicle} onTripLogged={handleTripLogged} />

          {maintUnavailable ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-300">Maintenance is not available on this database.</p>
              <p className="mt-1 text-xs text-muted">
                Migration 0010 creates the fleet_maintenance table. It has not been applied yet.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-sm font-semibold text-ink">
                  Maintenance
                  <span className="ml-2 text-xs font-normal text-muted">
                    {vehicleMaint.length} record{vehicleMaint.length === 1 ? "" : "s"}
                    {maintSpend > 0 && ` · ${num(Math.round(maintSpend))} spent fleet-wide`}
                  </span>
                </h2>
                <ScheduleMaintenanceForm vehicle={selectedVehicle} onScheduled={fetchVehicles} />
              </div>

              {vehicleMaint.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-panel">
                      <tr className="text-left text-xs text-muted">
                        <th className="px-4 py-3 font-medium">Work</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Priority</th>
                        <th className="px-4 py-3 font-medium">Due</th>
                        <th className="px-4 py-3 font-medium">Completed</th>
                        <th className="px-4 py-3 font-medium">Vendor</th>
                        <th className="px-4 py-3 text-right font-medium">Odometer</th>
                        <th className="px-4 py-3 text-right font-medium">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vehicleMaint.map((m) => {
                        const overdue =
                          (m.status === "scheduled" || m.status === "in_progress") &&
                          m.scheduled_date != null &&
                          m.scheduled_date < todayISO();
                        return (
                          <tr key={m.id} className="border-t border-border">
                            <td className="px-4 py-3 font-medium text-ink">{m.type}</td>
                            <td className="px-4 py-3"><MaintBadge status={m.status} /></td>
                            <td className="px-4 py-3 text-muted">{m.priority}</td>
                            <td className={`px-4 py-3 ${overdue ? "font-medium text-red-400" : "text-muted"}`}>
                              {m.scheduled_date ?? "—"}
                              {overdue && " · overdue"}
                            </td>
                            <td className="px-4 py-3 text-muted">{m.completed_date ?? "—"}</td>
                            <td className="px-4 py-3 text-muted">{m.vendor ?? "—"}</td>
                            <td className="px-4 py-3 text-right text-muted">
                              {m.odometer != null ? num(m.odometer) : "—"}
                            </td>
                            <td className="px-4 py-3 text-right text-ink">
                              {m.cost != null ? m.cost.toFixed(2) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-panel p-6 text-center text-sm text-muted">
                  No maintenance recorded for this vehicle.
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <MetricCard label="Trips shown" value={trips.length} note="Most recent 10" />
            <MetricCard label="Miles in view" value={totalMiles.toFixed(1)} unit="mi" />
            <MetricCard
              label="Lifetime mileage"
              value={num(selectedVehicle.mileage ?? 0)}
              unit="mi"
            />
            <MetricCard
              label="Completed trips"
              value={tripCounts[selectedVehicle.id] ?? 0}
              note="All time"
            />
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-ink">Recent trips</h2>
            <div className="space-y-2">
              {trips.length > 0 ? (
                trips.map((trip) => (
                  <div key={trip.id} className="rounded-xl border border-border bg-panel p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-ink">{trip.date}</p>
                        <p className="mt-1 text-xs text-muted">
                          {trip.origin ?? "—"} → {trip.destination ?? "—"}
                        </p>
                        <p className="mt-2 text-xs text-muted">
                          {trip.miles_driven} miles
                          {trip.fuel_used != null && ` · ${trip.fuel_used} gal`}
                        </p>
                      </div>
                      <span
                        className={`rounded-md px-3 py-1 text-xs font-medium ${
                          trip.status === "completed"
                            ? "bg-green-500 text-white"
                            : trip.status === "in_progress"
                            ? "bg-amber-500 text-white"
                            : "bg-slate-500 text-white"
                        }`}
                      >
                        {trip.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-panel p-6 text-center text-sm text-muted">
                  No trips logged for this vehicle yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
