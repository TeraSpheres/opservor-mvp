/* MyGeotab.
 *
 * The odd one out, and worth understanding before adding a third of its kind.
 *
 * Samsara and Motive hand you a key and you present it on every request.
 * Geotab does not. You send a database name, a username and a password to
 * Authenticate, and it returns a session id used in place of the password
 * afterwards. So this adapter holds three secrets rather than one, which is
 * why the connections screen learned to ask for more than a single field.
 *
 * Two further quirks, both of which produce confusing failures if missed:
 *
 *   - Authenticate replies with a `path`. Anything other than "ThisServer"
 *     means the customer's database lives elsewhere and every later call must
 *     go to that host instead. Ignore it and calls fail with an error that
 *     looks like bad credentials.
 *   - Everything is a POST to /apiv1 in JSON-RPC style, and a failure comes
 *     back as HTTP 200 with an `error` object in the body. Checking res.ok
 *     alone reports success on every failure.
 *
 * Built to the published API and to Geotab's own SDKs. Never run against a
 * live database.
 */

import type {
  CanonicalTrip,
  CanonicalVehicle,
  Connector,
  ConnectorConfig,
  FetchResult,
} from "./types";

export const GEOTAB_BASE_URL = "https://my.geotab.com";

/* Geotab's Get has no cursor. You ask for a number of rows and get them, so
 * "is there more" cannot be known — only suspected, when exactly the limit
 * comes back. Reported as a warning rather than silently truncating a fleet. */
const RESULTS_LIMIT = 5000;

/** What is actually stored for a Geotab connection, as JSON. */
interface GeotabCredentials {
  database: string;
  username: string;
  password: string;
}

interface GeotabDevice {
  id?: string;
  name?: string;
  serialNumber?: string;
  licensePlate?: string;
  vehicleIdentificationNumber?: string;
  deviceType?: string;
  comment?: string;
  activeTo?: string;
  /**
   * Geotab's grouping, and the reason this connector needs a second call.
   * A device carries group references by id — [{ id: "b27A1" }] — with no
   * name attached, so the names have to be fetched separately and matched up.
   */
  groups?: { id?: string }[];
  [k: string]: unknown;
}

interface GeotabGroup {
  id?: string;
  name?: string;
  /** Geotab's built-in groups have these; customer groups do not. */
  reference?: string;
  [k: string]: unknown;
}

/* Geotab ships with a fixed set of system groups that every device belongs to.
 * They describe permissions and hierarchy, never a place, so a device tagged
 * "Company Group" tells us nothing about which yard it parks in. */
const SYSTEM_GROUPS = new Set([
  'GroupCompanyId', 'GroupRootId', 'GroupVehicleId', 'GroupAssetId',
  'GroupDriverId', 'GroupUserId', 'GroupSecurityId', 'GroupEverythingSecurityId',
]);

/** Distance on a Geotab Trip is kilometres; everything downstream is miles. */
const KM_PER_MILE = 1.609344;

interface GeotabTrip {
  device?: { id?: string };
  start?: string;
  stop?: string;
  /** Kilometres. */
  distance?: number;
  drivingDuration?: string;
  [k: string]: unknown;
}

interface RpcReply<T> {
  result?: T;
  error?: { message?: string; name?: string; errors?: { message?: string }[] };
}

function readCredentials(cfg: ConnectorConfig): GeotabCredentials {
  try {
    const c = JSON.parse(cfg.token) as Partial<GeotabCredentials>;
    if (!c.database || !c.username || !c.password) {
      throw new Error("missing field");
    }
    return c as GeotabCredentials;
  } catch {
    throw new Error(
      "This Geotab connection is missing its database, username or password. Enter them again."
    );
  }
}

async function rpc<T>(host: string, method: string, params: unknown): Promise<T> {
  const res = await fetch(new URL("/apiv1", host).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ id: -1, method, params }),
    cache: "no-store",
  });

  // A JSON-RPC failure arrives as 200 with an error in the body, so the status
  // is checked for transport problems only and the body decides the rest.
  if (!res.ok && res.status >= 500) {
    throw new Error(`Geotab request failed: ${res.status} ${res.statusText}`);
  }

  let body: RpcReply<T>;
  try {
    body = (await res.json()) as RpcReply<T>;
  } catch {
    throw new Error(`Geotab returned something that was not JSON (${res.status}).`);
  }

  if (body.error) {
    const detail =
      body.error.errors?.[0]?.message || body.error.message || body.error.name || "unknown error";
    throw new Error(`Geotab refused the request: ${detail}`);
  }
  if (body.result === undefined) {
    throw new Error("Geotab returned no result.");
  }
  return body.result;
}

interface AuthResult {
  credentials?: { userName?: string; sessionId?: string; database?: string };
  path?: string;
}

/**
 * Exchanges the password for a session, and works out which host to use.
 * Returns everything later calls need, so no caller has to remember the
 * redirect rule.
 */
async function authenticate(cfg: ConnectorConfig) {
  const c = readCredentials(cfg);
  const start = cfg.baseUrl || GEOTAB_BASE_URL;

  const auth = await rpc<AuthResult>(start, "Authenticate", {
    database: c.database,
    userName: c.username,
    password: c.password,
  });

  const sessionId = auth.credentials?.sessionId;
  if (!sessionId) throw new Error("Geotab accepted the request but returned no session.");

  // "ThisServer" means stay put. Anything else is a hostname to move to.
  const path = auth.path;
  const host = !path || path === "ThisServer" ? start : `https://${path}`;

  return {
    host,
    credentials: {
      userName: auth.credentials?.userName || c.username,
      sessionId,
      database: auth.credentials?.database || c.database,
    },
  };
}

/**
 * A Geotab Device is the telematics unit, not a vehicle record, so it carries
 * no make, model or fuel type. Those are left empty rather than guessed at —
 * deviceType describes the hardware, not the truck it is bolted to.
 */
function toCanonical(d: GeotabDevice, groupNames?: Map<string, string>): CanonicalVehicle | null {
  if (!d.id) return null;

  // Geotab marks a device retired by setting activeTo to a past date. The
  // never-expires value is a far-future sentinel rather than an empty field.
  let status: CanonicalVehicle["status"] | undefined;
  if (d.activeTo) {
    const until = Date.parse(d.activeTo);
    if (!Number.isNaN(until)) status = until < Date.now() ? "inactive" : "active";
  }

  // The first group with a real name wins. System groups were dropped when the
  // map was built, so anything left is a group somebody at the customer created
  // — which is where yards and branches live.
  let depot: string | undefined;
  if (groupNames) {
    for (const g of d.groups ?? []) {
      const name = g.id ? groupNames.get(g.id) : undefined;
      if (name) { depot = name; break; }
    }
  }

  return {
    externalId: d.id,
    name: (d.name || "").trim() || `Device ${d.id}`,
    type: "Vehicle",
    registration: d.licensePlate || undefined,
    vin: d.vehicleIdentificationNumber || undefined,
    status,
    depot,
    raw: d as Record<string, unknown>,
  };
}

/**
 * Group id to name, with Geotab's built-in groups removed.
 *
 * One extra round trip per sync, which is worth it: without the names a device
 * carries nothing but opaque ids like "b27A1". Failure here is deliberately
 * quiet — an empty map means vehicles arrive without a depot, exactly as they
 * did before, rather than the whole sync failing over a nicety.
 */
async function fetchGroupNames(
  host: string,
  credentials: unknown
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  try {
    const groups = await rpc<GeotabGroup[]>(host, "Get", {
      typeName: "Group",
      credentials,
      resultsLimit: RESULTS_LIMIT,
    });
    for (const g of groups ?? []) {
      if (!g.id || SYSTEM_GROUPS.has(g.id)) continue;
      const name = (g.name || "").trim();
      if (name) names.set(g.id, name);
    }
  } catch {
    /* No groups readable — vehicles simply arrive without a depot. */
  }
  return names;
}

export const geotabConnector: Connector = {
  provider: "geotab",

  async verify(cfg: ConnectorConfig) {
    try {
      const { host, credentials } = await authenticate(cfg);
      // Authenticating proves the credentials; one row proves the session works.
      await rpc<GeotabDevice[]>(host, "Get", {
        typeName: "Device",
        credentials,
        resultsLimit: 1,
      });
      return {
        ok: true,
        message:
          host === (cfg.baseUrl || GEOTAB_BASE_URL)
            ? "Connected to Geotab."
            : `Connected to Geotab on ${new URL(host).host}.`,
      };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Could not reach Geotab.",
      };
    }
  },

  async fetchVehicles(cfg: ConnectorConfig, cursor?: string): Promise<FetchResult<CanonicalVehicle>> {
    // Get returns everything at once, so a second call would repeat the first.
    if (cursor) return { items: [] };

    const { host, credentials } = await authenticate(cfg);
    const [devices, groupNames] = await Promise.all([
      rpc<GeotabDevice[]>(host, "Get", {
        typeName: "Device",
        credentials,
        resultsLimit: RESULTS_LIMIT,
      }),
      fetchGroupNames(host, credentials),
    ]);

    const items: CanonicalVehicle[] = [];
    const warnings: string[] = [];

    for (const d of devices ?? []) {
      const v = toCanonical(d, groupNames);
      if (v) items.push(v);
      else warnings.push("A device arrived without an id and was skipped.");
    }

    if ((devices?.length ?? 0) >= RESULTS_LIMIT) {
      warnings.push(
        `Exactly ${RESULTS_LIMIT} devices came back, which is the limit asked for. ` +
          `There may be more that were not read.`
      );
    }

    return { items, warnings: warnings.length ? warnings : undefined };
  },

  /* Trips.
   *
   * One query covers the whole database, unlike Samsara. Distance arrives in
   * kilometres and is converted, because everything downstream is in miles and
   * a silent unit mismatch is a sixty per cent error that looks plausible.
   *
   * A real limitation, stated rather than hidden: a Geotab Trip records where
   * it stopped and not where it started. Opservor works out which vehicles
   * serve which depot from where journeys began, so Geotab trips give mileage
   * but cannot feed the depot mapping the capacity check is built on. Anyone
   * needing that will have to name the sites another way.
   */
  async fetchTrips(cfg, since, cursor): Promise<FetchResult<CanonicalTrip>> {
    if (cursor) return { items: [] };

    const { host, credentials } = await authenticate(cfg);
    const fromDate = new Date(Date.parse(since) || Date.now() - 90 * 86400000).toISOString();

    const trips = await rpc<GeotabTrip[]>(host, "Get", {
      typeName: "Trip",
      credentials,
      search: { fromDate, toDate: new Date().toISOString() },
      resultsLimit: RESULTS_LIMIT,
    });

    const items: CanonicalTrip[] = [];
    const warnings: string[] = [];

    for (const t of trips ?? []) {
      const deviceId = t.device?.id;
      if (!deviceId || !t.start) {
        warnings.push("A trip arrived without a device or a start time.");
        continue;
      }
      const started = new Date(t.start);
      if (Number.isNaN(started.getTime())) continue;

      items.push({
        // Geotab trips have no id of their own in this shape, so one is made
        // from the device and the start instant — both stable, which is what
        // stops a second sync inserting the same journey again.
        externalId: `${deviceId}:${t.start}`,
        vehicleExternalId: deviceId,
        date: started.toISOString().slice(0, 10),
        distanceMiles:
          t.distance != null ? Math.round((t.distance / KM_PER_MILE) * 10) / 10 : 0,
        // Left empty deliberately. See the note above.
        origin: undefined,
        destination: undefined,
        status: t.stop ? "completed" : "in_progress",
        raw: t as Record<string, unknown>,
      });
    }

    if ((trips?.length ?? 0) >= RESULTS_LIMIT) {
      warnings.push(
        `Exactly ${RESULTS_LIMIT} trips came back, which is the limit asked for. ` +
          `There may be more that were not read.`
      );
    }

    return { items, warnings: warnings.length ? warnings : undefined };
  },
};
