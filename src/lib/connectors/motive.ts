/* Motive, formerly KeepTruckin.
 *
 * Built to their published API. Never run against a live account, and it says
 * so in the connections screen rather than pretending otherwise.
 *
 *   GET https://api.gomotive.com/v1/vehicles
 *   header  X-API-Key: <key>
 *   paging  per_page (max 100) and page_no, with a total in the response
 *
 * The response nests each vehicle inside a wrapper alongside its availability,
 * so a row is { vehicle: {...}, availability_details: {...} } rather than the
 * vehicle itself. Reading it as a flat list gets nothing and looks like an
 * empty fleet, which is the kind of failure that wastes an afternoon.
 */

import type {
  CanonicalVehicle,
  Connector,
  ConnectorConfig,
  FetchResult,
} from "./types";

export const MOTIVE_BASE_URL = "https://api.gomotive.com";

/** Their documented maximum. Fewer requests, and they permit it. */
const PAGE_SIZE = 100;

interface MotiveVehicle {
  id?: number | string;
  number?: string;
  status?: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: string | number;
  license_plate_number?: string;
  license_plate_state?: string;
  fuel_type?: string;
  notes?: string;
  [k: string]: unknown;
}

interface MotiveRow {
  vehicle?: MotiveVehicle;
  availability_details?: { availability_status?: string; out_of_service_reason?: string };
}

interface MotivePage {
  vehicles?: MotiveRow[];
  pagination?: { per_page?: number; page_no?: number; total?: number };
  error?: string;
  message?: string;
}

async function get(cfg: ConnectorConfig, path: string, params: Record<string, string>) {
  const url = new URL(path, cfg.baseUrl || MOTIVE_BASE_URL);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { "X-API-Key": cfg.token, Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as MotivePage;
      const said = body?.error || body?.message;
      if (said) detail = `${res.status} — ${said}`;
    } catch {
      /* not JSON; the status line is all there is */
    }
    throw new Error(`Motive request failed: ${detail}`);
  }

  return (await res.json()) as MotivePage;
}

/**
 * Motive reports availability separately from whether the record is active, so
 * the two are read in order of consequence: a vehicle out of service matters
 * more to a fleet manager than one merely marked inactive.
 */
function status(row: MotiveRow): CanonicalVehicle["status"] | undefined {
  const avail = (row.availability_details?.availability_status || "").toLowerCase();
  if (avail.includes("out_of_service") || avail.includes("out of service")) return "maintenance";

  const s = (row.vehicle?.status || "").toLowerCase();
  if (s === "active") return "active";
  if (s === "deactivated" || s === "inactive") return "inactive";
  return undefined;
}

/** Their vehicles carry make and model but no single type, as with Samsara. */
function vehicleType(v: MotiveVehicle): string {
  const parts = [v.make, v.model].filter(Boolean);
  return parts.length ? parts.join(" ") : "Vehicle";
}

function toCanonical(row: MotiveRow): CanonicalVehicle | null {
  const v = row.vehicle;
  if (!v || v.id == null) return null;

  return {
    externalId: String(v.id),
    // A fleet calls it by its number, not its database id. Falling back to the
    // id keeps the row usable when a number was never set.
    name: (v.number || "").trim() || `Vehicle ${v.id}`,
    type: vehicleType(v),
    registration: v.license_plate_number || undefined,
    vin: v.vin || undefined,
    make: v.make || undefined,
    model: v.model || undefined,
    year: v.year != null ? String(v.year) : undefined,
    fuelType: v.fuel_type || undefined,
    status: status(row),
    raw: v as Record<string, unknown>,
  };
}

export const motiveConnector: Connector = {
  provider: "motive",

  async verify(cfg: ConnectorConfig) {
    try {
      // One page of one. Cheap, and proves the key rather than the network.
      await get(cfg, "/v1/vehicles", { per_page: "1", page_no: "1" });
      return { ok: true, message: "Connected to Motive." };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Could not reach Motive.",
      };
    }
  },

  async fetchVehicles(cfg: ConnectorConfig, cursor?: string): Promise<FetchResult<CanonicalVehicle>> {
    const page = Number(cursor || "1");
    const body = await get(cfg, "/v1/vehicles", {
      per_page: String(PAGE_SIZE),
      page_no: String(page),
    });

    const rows = body.vehicles ?? [];
    const items: CanonicalVehicle[] = [];
    const warnings: string[] = [];

    for (const row of rows) {
      const v = toCanonical(row);
      if (v) items.push(v);
      else warnings.push("A row arrived without a vehicle id and was skipped.");
    }

    // Motive gives a total rather than a next-page flag, so whether more
    // exists is arithmetic: everything seen so far against everything there is.
    const total = body.pagination?.total ?? rows.length;
    const seen = page * PAGE_SIZE;
    const more = rows.length === PAGE_SIZE && seen < total;

    return {
      items,
      cursor: more ? String(page + 1) : undefined,
      warnings: warnings.length ? warnings : undefined,
    };
  },
};
