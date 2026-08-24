/* Samsara connector.
 *
 * Built against Samsara's published API reference. The request and response
 * shapes below are taken from their documentation, not guessed:
 *
 *   GET https://api.samsara.com/fleet/vehicles
 *   Authorization: Bearer <token>
 *
 *   { "data": [ { "id": "212014918732717", "name": "Little Red",
 *                 "vin": "...", "licensePlate": "6KDB798", "make": "Toyota",
 *                 "model": "Rav4", "year": "2008", ... } ],
 *     "pagination": { "endCursor": "", "hasNextPage": false } }
 *
 * Paging is cursor-based: pass the previous endCursor as `after`.
 * Their documented rate limit is 25 requests a second.
 *
 * This has not been run against Samsara itself — an account requires their
 * partner programme. It is tested against a stand-in that replies in exactly
 * the shape above. When real credentials arrive, only the token changes.
 */

import type {
  Connector,
  ConnectorConfig,
  CanonicalVehicle,
  CanonicalTrip,
  FetchResult,
} from "./types";

export const SAMSARA_BASE_URL = "https://api.samsara.com";

/** Their documented ceiling is 512. 200 keeps responses small and polite. */
const PAGE_SIZE = 200;

interface SamsaraVehicle {
  id: string;
  name?: string;
  vin?: string;
  licensePlate?: string;
  make?: string;
  model?: string;
  year?: string;
  notes?: string;
  serial?: string;
  externalIds?: Record<string, string>;
  /** How Samsara groups vehicles. A fleet uses these for yards, regions, crews. */
  tags?: { id?: string; name?: string }[];
  [k: string]: unknown;
}

/**
 * Picks the tag most likely to be a depot.
 *
 * A vehicle usually carries several tags — "Reefer", "Night shift", "Calgary
 * Yard" — and only one of them is a place. Rather than guess cleverly, prefer a
 * tag whose name reads like a location, and otherwise take the first. Getting
 * this wrong is cheap: the site match downstream simply fails and the vehicle
 * falls back to having no depot, which is where it was before.
 */
function depotFromTags(tags?: { name?: string }[]): string | undefined {
  const names = (tags ?? []).map((t) => (t.name || "").trim()).filter(Boolean);
  if (!names.length) return undefined;

  const placeLike = /\b(yard|depot|branch|terminal|site|hub|warehouse|garage|plant|dc)\b/i;
  return names.find((n) => placeLike.test(n)) ?? names[0];
}

interface SamsaraPage<T> {
  data?: T[];
  pagination?: { endCursor?: string; hasNextPage?: boolean };
  message?: string;
}

interface SamsaraAddress {
  address?: string;
  name?: string;
  id?: number;
}

interface SamsaraTrip {
  startMs?: number;
  endMs?: number;
  startLocation?: string;
  endLocation?: string;
  startAddress?: SamsaraAddress;
  endAddress?: SamsaraAddress;
  distanceMeters?: number;
  fuelConsumedMl?: number;
  startOdometer?: number;
  endOdometer?: number;
  [k: string]: unknown;
}

/** The trips endpoint returns a bare object, not the usual data/pagination envelope. */
interface SamsaraTripPage {
  trips?: SamsaraTrip[];
}

const METRES_PER_MILE = 1609.344;
const ML_PER_LITRE = 1000;

/* An ongoing trip is returned with the largest possible 64-bit integer as its
 * end. Treating that as a real timestamp would produce a journey ending in the
 * year 292 million, so it is read as "still running" instead. */
const STILL_RUNNING = 9223372036854775807;

/**
 * Samsara names a place two ways: a saved address if the point falls inside
 * one the customer has drawn, and a plain string otherwise. The saved name is
 * preferred because it is what the customer calls the site — and matching a
 * depot by name is what lets Opservor work out which vehicles serve where.
 */
function place(addr?: SamsaraAddress, fallback?: string): string | undefined {
  const named = (addr?.name || "").trim();
  if (named) return named;
  const line = (addr?.address || "").trim();
  if (line) return line;
  const plain = (fallback || "").trim();
  return plain || undefined;
}

function toCanonicalTrip(vehicleExternalId: string, t: SamsaraTrip): CanonicalTrip | null {
  if (t.startMs == null) return null;

  const running = t.endMs == null || t.endMs >= STILL_RUNNING;
  const started = new Date(t.startMs);
  if (Number.isNaN(started.getTime())) return null;

  return {
    // Samsara gives trips no id of their own, so one is composed from the
    // vehicle and the start instant. Both are stable, which is what stops a
    // second sync inserting the same journey again.
    externalId: `${vehicleExternalId}:${t.startMs}`,
    vehicleExternalId,
    date: started.toISOString().slice(0, 10),
    distanceMiles:
      t.distanceMeters != null
        ? Math.round((t.distanceMeters / METRES_PER_MILE) * 10) / 10
        : 0,
    fuelUsed:
      t.fuelConsumedMl != null
        ? Math.round((t.fuelConsumedMl / ML_PER_LITRE) * 10) / 10
        : undefined,
    origin: place(t.startAddress, t.startLocation),
    destination: place(t.endAddress, t.endLocation),
    status: running ? "in_progress" : "completed",
    raw: t as Record<string, unknown>,
  };
}

async function get<T>(
  cfg: ConnectorConfig,
  path: string,
  params: Record<string, string | undefined>
): Promise<SamsaraPage<T>> {
  const url = new URL(path, cfg.baseUrl || SAMSARA_BASE_URL);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    // Their errors carry a message; fall back to the status when they do not.
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) detail = `${res.status} — ${body.message}`;
    } catch {
      /* body was not JSON; the status line is all we have */
    }
    throw new Error(`Samsara request failed: ${detail}`);
  }

  return (await res.json()) as SamsaraPage<T>;
}

/**
 * Samsara reports make, model and year but has no single "type" field, so
 * type is composed from what they do send. Falling back to the plain word
 * keeps the column populated rather than leaving it empty.
 */
function vehicleType(v: SamsaraVehicle): string {
  const parts = [v.make, v.model].filter(Boolean);
  return parts.length ? parts.join(" ") : "Vehicle";
}

function toCanonical(v: SamsaraVehicle): CanonicalVehicle {
  return {
    externalId: String(v.id),
    name: v.name?.trim() || `Vehicle ${v.id}`,
    type: vehicleType(v),
    registration: v.licensePlate || undefined,
    vin: v.vin || undefined,
    make: v.make || undefined,
    model: v.model || undefined,
    year: v.year || undefined,
    depot: depotFromTags(v.tags),
    // Samsara does not return a lifecycle status on this endpoint. Left unset
    // rather than assumed — the sync will not overwrite a status someone has
    // deliberately changed in Opservor.
    status: undefined,
    raw: v as Record<string, unknown>,
  };
}

export const samsaraConnector: Connector = {
  provider: "samsara",

  async verify(cfg) {
    try {
      // One vehicle is enough to prove the token and the permission scope.
      await get<SamsaraVehicle>(cfg, "/fleet/vehicles", { limit: "1" });
      return { ok: true, message: "Connected. Token accepted and vehicles readable." };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // 401 is the common one and deserves a plain explanation.
      if (msg.includes("401")) {
        return { ok: false, message: "Token rejected. Check it is correct and has the Read Vehicles scope." };
      }
      return { ok: false, message: msg };
    }
  },

  async fetchVehicles(cfg, cursor): Promise<FetchResult<CanonicalVehicle>> {
    const page = await get<SamsaraVehicle>(cfg, "/fleet/vehicles", {
      limit: String(PAGE_SIZE),
      after: cursor,
    });

    const warnings: string[] = [];
    const items: CanonicalVehicle[] = [];

    for (const v of page.data ?? []) {
      if (!v?.id) {
        // Without their id we cannot map it, and a vehicle we cannot map
        // would be recreated on every sync. Skipped and reported.
        warnings.push("Skipped a vehicle with no id.");
        continue;
      }
      items.push(toCanonical(v));
    }

    const more = page.pagination?.hasNextPage && page.pagination?.endCursor;

    return {
      items,
      cursor: more ? page.pagination!.endCursor : undefined,
      warnings: warnings.length ? warnings : undefined,
    };
  },

  /* Trips.
   *
   * Samsara gives trips for one vehicle at a time — vehicleId is required —
   * so this walks the fleet rather than asking for all of it. The cursor
   * carries both the list of vehicles and how far through it we are, so the
   * fleet is fetched once per sync rather than once per batch, and a single
   * request handles a bounded number of vehicles so it cannot run past the
   * route's time limit on a large fleet.
   */
  async fetchTrips(cfg, since, cursor): Promise<FetchResult<CanonicalTrip>> {
    // Their window is capped at 90 days. A longer request is clamped rather
    // than left to fail or, worse, silently return nothing.
    const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
    const earliest = Date.now() - NINETY_DAYS;
    const asked = Date.parse(since);
    const startMs = Math.max(Number.isNaN(asked) ? earliest : asked, earliest);
    const endMs = Date.now();

    let ids: string[];
    let at: number;

    if (cursor) {
      const state = JSON.parse(cursor) as { ids: string[]; at: number };
      ids = state.ids;
      at = state.at;
    } else {
      ids = [];
      let after: string | undefined;
      do {
        const page = await get<SamsaraVehicle>(cfg, "/fleet/vehicles", {
          limit: String(PAGE_SIZE),
          after,
        });
        for (const v of page.data ?? []) if (v?.id) ids.push(String(v.id));
        after = page.pagination?.hasNextPage ? page.pagination?.endCursor : undefined;
      } while (after);
      at = 0;
    }

    const BATCH = 10;
    const slice = ids.slice(at, at + BATCH);
    const items: CanonicalTrip[] = [];
    const warnings: string[] = [];

    for (const vehicleId of slice) {
      let body: SamsaraTripPage;
      try {
        body = (await get<never>(cfg, "/v1/fleet/trips", {
          vehicleId,
          startMs: String(startMs),
          endMs: String(endMs),
        })) as unknown as SamsaraTripPage;
      } catch (e) {
        // One vehicle refusing must not cost the rest of the fleet.
        warnings.push(
          `Could not read trips for vehicle ${vehicleId}: ${
            e instanceof Error ? e.message : "unknown error"
          }`
        );
        continue;
      }

      for (const t of body.trips ?? []) {
        const trip = toCanonicalTrip(vehicleId, t);
        if (trip) items.push(trip);
      }
    }

    const next = at + BATCH;
    return {
      items,
      cursor: next < ids.length ? JSON.stringify({ ids, at: next }) : undefined,
      warnings: warnings.length ? warnings : undefined,
    };
  },
};

export type { CanonicalTrip };
