"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FleetVehicle, FleetTrip, FleetMetrics } from "@/lib/types";

function AddVehicleForm({ onVehicleAdded }: { onVehicleAdded: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  async function handleAddVehicle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("name"));
    const type = String(formData.get("type"));
    const license_plate = String(formData.get("license_plate") || "");

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

    const { error } = await supabase.from("fleet_vehicle").insert({
      company_id: appUser.company_id,
      name,
      type,
      license_plate: license_plate || null,
      status: "active",
    });

    if (!error) {
      setIsOpen(false);
      (e.target as HTMLFormElement).reset();
      onVehicleAdded();
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
          Add vehicle
        </button>
      ) : (
        <form onSubmit={handleAddVehicle} className="rounded-xl border border-border bg-panel p-4 space-y-3">
          <input
            name="name"
            type="text"
            placeholder="Vehicle name (e.g., Truck #1)"
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <input
            name="type"
            type="text"
            placeholder="Vehicle type (e.g., Cargo Van)"
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <input
            name="license_plate"
            type="text"
            placeholder="License plate (optional)"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-light disabled:opacity-50"
            >
              {isLoading ? "Adding..." : "Add vehicle"}
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

function LogTripForm({
  vehicle,
  onTripLogged,
}: {
  vehicle: FleetVehicle;
  onTripLogged: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  async function handleLogTrip(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("fleet_trip").insert({
      company_id: vehicle.company_id,
      vehicle_id: vehicle.id,
      date: String(formData.get("date")),
      miles_driven: Number(formData.get("miles_driven") || 0),
      fuel_used: Number(formData.get("fuel_used") || null),
      origin: String(formData.get("origin") || ""),
      destination: String(formData.get("destination") || ""),
      status: "completed",
    });

    if (!error) {
      (e.target as HTMLFormElement).reset();
      onTripLogged();
    }
    setIsLoading(false);
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  return (
    <form onSubmit={handleLogTrip} className="rounded-xl border border-border bg-panel p-5 space-y-4">
      <h3 className="text-sm font-semibold text-ink">{vehicle.name} — Log Trip</h3>

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
          <label className="block text-xs font-medium text-muted mb-1">Miles Driven</label>
          <input
            name="miles_driven"
            type="number"
            step="0.1"
            min="0"
            defaultValue={0}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Fuel Used (gal)</label>
          <input
            name="fuel_used"
            type="number"
            step="0.1"
            min="0"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div></div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Origin</label>
          <input
            name="origin"
            type="text"
            placeholder="e.g., Warehouse A"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Destination</label>
          <input
            name="destination"
            type="text"
            placeholder="e.g., Customer Site"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light disabled:opacity-50"
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
}: {
  label: string;
  value: string | number;
  unit?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-panel p-5">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">
        {value}
        {unit && <span className="ml-1 text-sm font-normal">{unit}</span>}
      </p>
    </div>
  );
}

export default function FleetPage() {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<FleetVehicle | null>(null);
  const [trips, setTrips] = useState<FleetTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchVehicles();
  }, []);

  async function fetchVehicles() {
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
      .from("fleet_vehicle")
      .select("*")
      .eq("company_id", appUser.company_id)
      .order("created_at", { ascending: false });

    const vehicleList = (data ?? []) as FleetVehicle[];
    setVehicles(vehicleList);
    if (vehicleList.length > 0 && !selectedVehicle) {
      setSelectedVehicle(vehicleList[0]);
      fetchTrips(vehicleList[0].id, appUser.company_id);
    }
    setIsLoading(false);
  }

  async function fetchTrips(vehicleId: string, companyId: string) {
    const { data } = await supabase
      .from("fleet_trip")
      .select("*")
      .eq("company_id", companyId)
      .eq("vehicle_id", vehicleId)
      .order("date", { ascending: false })
      .limit(7);

    setTrips((data ?? []) as FleetTrip[]);
  }

  function handleVehicleSelect(vehicle: FleetVehicle) {
    setSelectedVehicle(vehicle);
    fetchTrips(vehicle.id, vehicle.company_id);
  }

  function handleTripLogged() {
    if (selectedVehicle) {
      fetchTrips(selectedVehicle.id, selectedVehicle.company_id);
    }
  }

  const latestTrip = trips[0] ?? null;
  const totalMiles = trips.reduce((sum, trip) => sum + trip.miles_driven, 0);
  const totalTrips = trips.length;

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Fleet Operations</h1>
        <p className="text-sm text-muted">Track vehicle utilization and trip metrics</p>
      </div>

      <div className="mb-6 flex gap-4 items-center justify-between">
        <div className="flex gap-2">
          {vehicles.map((vehicle) => (
            <button
              key={vehicle.id}
              onClick={() => handleVehicleSelect(vehicle)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                selectedVehicle?.id === vehicle.id
                  ? "bg-brand text-white"
                  : "border border-border text-ink hover:bg-panel"
              }`}
            >
              {vehicle.name}
            </button>
          ))}
        </div>
        <AddVehicleForm onVehicleAdded={fetchVehicles} />
      </div>

      {selectedVehicle ? (
        <div className="space-y-6">
          <LogTripForm vehicle={selectedVehicle} onTripLogged={handleTripLogged} />

          {latestTrip && (
            <div>
              <h2 className="mb-4 text-sm font-semibold text-ink">Trip Summary ({latestTrip.date})</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <MetricCard label="Total Trips (7d)" value={totalTrips} />
                <MetricCard label="Total Miles (7d)" value={totalMiles.toFixed(1)} unit="mi" />
                <MetricCard label="Latest Distance" value={latestTrip.miles_driven.toFixed(1)} unit="mi" />
                <MetricCard label="Fuel Used" value={latestTrip.fuel_used?.toFixed(1) ?? "—"} unit={latestTrip.fuel_used ? "gal" : ""} />
              </div>
            </div>
          )}

          <div>
            <h2 className="mb-4 text-sm font-semibold text-ink">Recent Trips</h2>
            <div className="space-y-2">
              {trips.length > 0 ? (
                trips.map((trip) => (
                  <div key={trip.id} className="rounded-xl border border-border bg-panel p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-ink">{trip.date}</p>
                        <p className="mt-1 text-xs text-muted">{trip.origin} → {trip.destination}</p>
                        <p className="mt-2 text-xs text-muted">{trip.miles_driven} miles</p>
                      </div>
                      <span className="rounded-md bg-brand px-3 py-1 text-xs font-medium text-white">
                        {trip.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-panel p-6 text-center text-sm text-muted">
                  No trips logged yet.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-panel p-6 text-center text-sm text-muted">
          No vehicles yet. Add one to get started.
        </div>
      )}
    </div>
  );
}
