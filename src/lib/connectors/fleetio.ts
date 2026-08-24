/* Fleetio.
 *
 * The first connector here that is not a telematics box. Samsara, Geotab and
 * Motive tell you where a vehicle is and how it is behaving. Fleetio is where
 * somebody wrote down that it is booked in for brakes on Thursday.
 *
 * That distinction matters more than it sounds. The capacity check needs to
 * know what is *going* to be off the road, and telematics cannot tell it —
 * their maintenance APIs report driver inspections and fault codes, which is
 * the vehicle being broken now. A defect and a booking are different facts and
 * only one of them can be seen coming.
 *
 * Two credentials, like Geotab:
 *
 *   Authorization: Token <api token>
 *   Account-Token: <account token>
 *
 * Both are shown in Fleetio under Account Settings. Sending only the first
 * returns 401 with a message about the account, which reads like a bad token
 * and is not.
 *
 * Built to the published API. Never run against a live account, and the
 * connections screen says so rather than pretending otherwise.
 */

import type {
  CanonicalMaintenance,
  CanonicalVehicle,
  Connector,
  ConnectorConfig,
  FetchResult,
} from "./types";

export const FLEETIO_BASE_URL = "https://secure.fleetio.com";

/** Their documented maximum for v1 list endpoints. */
const PAGE_SIZE = 100;

/** What is stored for a Fleetio connection, as JSON. */
interface FleetioCredentials {
  apiToken: string;
  accountToken: string;
}

interface FleetioVehicle {
  id?: number | string;
  name?: string;
  vin?: string;
  license_plate?: string;
  make?: string;
  model?: string;
  year?: number | string;
  fuel_type_name?: string;
  current_meter_value?: number | string;
  vehicle_status_name?: string;
  /** Fleetio's own grouping. Customers use it for yards and regions. */
  group_name?: string;
  [k: string]: unknown;
}

/**
 * A service reminder is Fleetio's scheduled work: a task, a vehicle, and when
 * it next falls due. This is the shape the capacity check has been missing.
 */
interface FleetioServiceReminder {
  id?: number | string;
  vehicle_id?: number | string;
  service_task_name?: string;
  next_due_date?: string;
  due_soon?: boolean;
  overdue?: boolean;
  comments?: string;
  [k: string]: unknown;
}

/** Work that has actually been carried out. */
interface FleetioServiceEntry {
  id?: number | string;
  vehicle_id?: number | string;
  started_at?: string;
  completed_at?: string;
  total_amount_cents?: number;
  vendor_name?: string;
  reference?: string;
  comments?: string;
  meter_value?: number | string;
  service_task_names?: string[];
  [k: string]: unknown;
}

function readCredentials(cfg: ConnectorConfig): FleetioCredentials {
  try {
    const c = JSON.parse(cfg.token) as Partial<FleetioCredentials>;
    if (!c.apiToken || !c.accountToken) throw new Error("missing field");
    return c as FleetioCredentials;
  } catch {
    throw new Error(
      "This Fleetio connection is missing its API token or account token. Enter them again."
    );
  }
}

async function get<T>(
  cfg: ConnectorConfig,
  path: string,
  params: Record<string, string>
): Promise<T> {
  const c = readCredentials(cfg);
  const url = new URL(path, cfg.baseUrl || FLEETIO_BASE_URL);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Token ${c.apiToken}`,
      "Account-Token": c.accountToken,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    // Deliberately not passing their body through. A Fleetio 401 names the
    // account token in its message, and that is a credential.
    if (res.status === 401 || res.status === 403) {
      throw new Error("Fleetio rejected the credentials — check both tokens.");
    }
    throw new Error(`Fleetio request failed: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as T;
}

/** Fleetio meters are whole miles or kilometres by account setting; taken as-is. */
function meter(v: number | string | undefined): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n) : undefined;
}

/** YYYY-MM-DD, or nothing. Never a guessed date. */
function day(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString().slice(0, 10);
}

function toCanonicalVehicle(v: FleetioVehicle): CanonicalVehicle | null {
  if (v.id == null) return null;

  const s = (v.vehicle_status_name || "").toLowerCase();
  let status: CanonicalVehicle["status"] | undefined;
  if (s.includes("active")) status = "active";
  else if (s.includes("service") || s.includes("shop")) status = "maintenance";
  else if (s.includes("sold") || s.includes("dispos")) status = "retired";
  else if (s.includes("inactive")) status = "inactive";

  const parts = [v.make, v.model].filter(Boolean);

  return {
    externalId: String(v.id),
    name: (v.name || "").trim() || `Vehicle ${v.id}`,
    type: parts.length ? parts.join(" ") : "Vehicle",
    registration: v.license_plate || undefined,
    vin: v.vin || undefined,
    make: v.make || undefined,
    model: v.model || undefined,
    year: v.year != null ? String(v.year) : undefined,
    fuelType: v.fuel_type_name || undefined,
    odometerMiles: meter(v.current_meter_value),
    depot: (v.group_name || "").trim() || undefined,
    status,
    raw: v as Record<string, unknown>,
  };
}

export const fleetioConnector: Connector = {
  provider: "fleetio",

  async verify(cfg: ConnectorConfig) {
    try {
      await get(cfg, "/api/v1/vehicles", { per_page: "1", page: "1" });
      return { ok: true, message: "Connected to Fleetio." };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Could not reach Fleetio.",
      };
    }
  },

  async fetchVehicles(cfg, cursor): Promise<FetchResult<CanonicalVehicle>> {
    const page = Number(cursor || "1");
    const rows = await get<FleetioVehicle[]>(cfg, "/api/v1/vehicles", {
      per_page: String(PAGE_SIZE),
      page: String(page),
    });

    const items: CanonicalVehicle[] = [];
    const warnings: string[] = [];

    for (const v of rows ?? []) {
      const mapped = toCanonicalVehicle(v);
      if (mapped) items.push(mapped);
      else warnings.push("A vehicle arrived without an id and was skipped.");
    }

    // Fleetio v1 returns a bare array and signals more pages by filling one.
    // A short page means the end; there is no total to check against.
    const more = (rows?.length ?? 0) === PAGE_SIZE;

    return { items, cursor: more ? String(page + 1) : undefined, warnings: warnings.length ? warnings : undefined };
  },

  /* Maintenance, from two places at once.
   *
   * Service reminders are what is coming — a task and the date it falls due.
   * Service entries are what has been done. The capacity check only cares
   * about the first, but importing both means the fleet screen shows a real
   * history rather than a list of future obligations with no past.
   *
   * Reminders are paged; entries are fetched once alongside the first page,
   * because a second pass over completed work adds cost for no benefit to the
   * check that needed this.
   */
  async fetchMaintenance(cfg, cursor): Promise<FetchResult<CanonicalMaintenance>> {
    const page = Number(cursor || "1");
    const items: CanonicalMaintenance[] = [];
    const warnings: string[] = [];

    const reminders = await get<FleetioServiceReminder[]>(
      cfg,
      "/api/v1/service_reminders",
      { per_page: String(PAGE_SIZE), page: String(page) }
    );

    for (const r of reminders ?? []) {
      if (r.id == null || r.vehicle_id == null) {
        warnings.push("A service reminder arrived without a vehicle and was skipped.");
        continue;
      }
      const due = day(r.next_due_date);
      if (!due) continue; // A reminder with no due date is not a booking.

      items.push({
        externalId: `reminder:${r.id}`,
        vehicleExternalId: String(r.vehicle_id),
        type: (r.service_task_name || "").trim() || "Scheduled service",
        // Overdue work is treated as still scheduled rather than as completed.
        // It has not happened; that is the entire point of it being overdue.
        status: "scheduled",
        scheduledDate: due,
        notes: (r.comments || "").trim() || undefined,
        raw: r as Record<string, unknown>,
      });
    }

    if (page === 1) {
      try {
        const entries = await get<FleetioServiceEntry[]>(
          cfg,
          "/api/v1/service_entries",
          { per_page: String(PAGE_SIZE), page: "1" }
        );

        for (const e of entries ?? []) {
          if (e.id == null || e.vehicle_id == null) continue;
          const done = day(e.completed_at);

          items.push({
            externalId: `entry:${e.id}`,
            vehicleExternalId: String(e.vehicle_id),
            type: (e.service_task_names ?? []).join(", ") || "Service",
            // The database requires a completed job to carry a date and a
            // non-completed one to carry none. Anything without a completion
            // date is therefore still in progress, not completed-but-undated.
            status: done ? "completed" : "in_progress",
            scheduledDate: day(e.started_at),
            completedDate: done,
            odometerMiles: meter(e.meter_value),
            cost:
              e.total_amount_cents != null
                ? Math.round(e.total_amount_cents) / 100
                : undefined,
            vendor: (e.vendor_name || "").trim() || undefined,
            reference: (e.reference || "").trim() || undefined,
            notes: (e.comments || "").trim() || undefined,
            raw: e as Record<string, unknown>,
          });
        }
      } catch (err) {
        // History is a nicety. Losing it must not cost us the reminders,
        // which are the reason this connector exists.
        warnings.push(
          `Past service history could not be read: ${
            err instanceof Error ? err.message : "unknown error"
          }`
        );
      }
    }

    const more = (reminders?.length ?? 0) === PAGE_SIZE;

    return { items, cursor: more ? String(page + 1) : undefined, warnings: warnings.length ? warnings : undefined };
  },
};
