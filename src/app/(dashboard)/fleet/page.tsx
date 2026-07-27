"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FleetVehicle, FleetTrip, VehicleStatus } from "@/lib/types";

const STATUS_STYLES: Record<VehicleStatus, string> = {
  active: "bg-green-500 text-white",
  maintenance: "bg-amber-500 text-white",
  inactive: "bg-slate-500 text-white",
  retired: "bg-red-500 text-white",
};

function StatusBadge({ status }: { status: VehicleStatus }) {
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

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
          <input name="vehicle_type" autoComplete="off" type="text" placeholder="Cargo Van" required className={field} />
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
          <input name="fuel_type" type="text" placeholder="Diesel, Petrol, Electric" className={field} autoComplete="off" />
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

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Fleet Operations</h1>
        <p className="text-sm text-muted">Vehicle registry, trip log and utilisation</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Vehicles" value={vehicles.length} />
        <MetricCard label="Active" value={activeCount} note={inMaintenance ? `${inMaintenance} in maintenance` : undefined} />
        <MetricCard label="Fleet mileage" value={num(fleetMileage)} unit="mi" note="From completed trips" />
        <MetricCard label="Trips logged" value={num(Object.values(tripCounts).reduce((s, c) => s + c, 0))} />
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
