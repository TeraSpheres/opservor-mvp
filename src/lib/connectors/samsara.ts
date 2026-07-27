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
  [k: string]: unknown;
}

interface SamsaraPage<T> {
  data?: T[];
  pagination?: { endCursor?: string; hasNextPage?: boolean };
  message?: string;
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
};

/* Trips are deliberately absent for now.
 *
 * Samsara exposes journey data through several endpoints with materially
 * different shapes, and picking the wrong one would mean rewriting the
 * mapping later. Vehicles alone prove the whole path end to end — fetch,
 * translate, match to an existing record, store — which is what this first
 * connector is for. Trips follow once there is a real account to see the
 * actual payloads against.
 */
export type { CanonicalTrip };
