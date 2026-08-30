/* Zoho Inventory.
 *
 * The first adapter that brings stock rather than vehicles, and the first that
 * a real operation could plausibly be running today — Zoho is cheap, common in
 * the mid-market, and unlike the other four it has a free tier, which means
 * this is the first connector that can actually be tested against a live
 * account rather than written to documentation and hoped over.
 *
 * Two things make it awkward, and both are worth knowing before reading on.
 *
 * OAUTH, NOT A KEY
 *
 * Zoho issues access tokens that expire in an hour. A stored access token
 * would work once and then fail silently forever, so what is stored is a
 * refresh token and the client credentials, and an access token is minted at
 * the start of every sync. That is four values rather than one, and the
 * connections screen asks for all four because Zoho requires all four.
 *
 * REGIONS
 *
 * Zoho runs separate data centres and an account in one is invisible to the
 * others. A token from zoho.eu against zohoapis.com returns an authentication
 * error that reads exactly like a bad token. The base URL is therefore
 * overridable per connection, and the field hint says why.
 *
 * Built to the published API. Never run against a live account — though it is
 * the first one where that could reasonably change.
 */

import type {
  CanonicalItem,
  Connector,
  ConnectorConfig,
  FetchResult,
} from "./types";

export const ZOHO_BASE_URL = "https://www.zohoapis.com";

/** Their documented maximum for list endpoints. */
const PAGE_SIZE = 200;

/** What is stored for a Zoho connection, as JSON. */
interface ZohoCredentials {
  organizationId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  /** Optional, because connections made before the dropdown existed have none. */
  region?: string;
}

interface ZohoItem {
  item_id?: string;
  sku?: string;
  name?: string;
  category_name?: string;
  /** Everything physically there, including what is already committed. */
  stock_on_hand?: number | string;
  /** What is left once committed orders are taken off. */
  available_stock?: number | string;
  actual_available_stock?: number | string;
  reorder_level?: number | string;
  purchase_rate?: number | string;
  rate?: number | string;
  vendor_name?: string;
  status?: string;
  [k: string]: unknown;
}

interface ZohoItemsPage {
  items?: ZohoItem[];
  page_context?: { has_more_page?: boolean; page?: number };
  code?: number;
  message?: string;
}

function readCredentials(cfg: ConnectorConfig): ZohoCredentials {
  try {
    const c = JSON.parse(cfg.token) as Partial<ZohoCredentials>;
    if (!c.organizationId || !c.clientId || !c.clientSecret || !c.refreshToken) {
      throw new Error("missing field");
    }
    return c as ZohoCredentials;
  } catch {
    throw new Error(
      "This Zoho connection is missing one of its four values. Enter them again."
    );
  }
}

/**
 * The accounts host is not the API host, and it is region-specific in the same
 * way. Derived from the API base rather than stored separately, so a connection
 * pointed at Europe mints its token in Europe too — getting that pair out of
 * step produces an "invalid client" that sends you looking at the secret.
 *
 * Canada breaks the pattern. Its API is served from www.zohoapis.ca like every
 * other region, but its sign-in is accounts.zohocloud.ca — accounts.zoho.ca
 * does not resolve at all. Derivation alone therefore sent every Canadian
 * account to a hostname that does not exist, and the failure arrived as
 * "invalid client", which reads as a bad secret. Found the first time this was
 * pointed at a real Canadian account; the exceptions are listed rather than
 * inferred, and each was checked against the live endpoint.
 */
const ACCOUNTS_HOST_EXCEPTIONS: Record<string, string> = {
  ca: "https://accounts.zohocloud.ca",
};

function accountsHostFor(baseUrl: string): string {
  try {
    const host = new URL(baseUrl).host;                 // www.zohoapis.eu
    const suffix = host.replace(/^www\.zohoapis\./, ""); // eu
    if (!suffix || suffix === host) return "https://accounts.zoho.com";
    return ACCOUNTS_HOST_EXCEPTIONS[suffix] ?? `https://accounts.zoho.${suffix}`;
  } catch {
    return "https://accounts.zoho.com";
  }
}

/* The regions, named the way an operator would say them.
 *
 * This exists because the first version had no such list. The region was
 * carried by the "different region or a test server" box, which is collapsed
 * by default, holds a URL, and empties every time the page reloads. A Canadian
 * operator therefore had to know that their country meant typing
 * https://www.zohoapis.ca into a hidden field — and when they typed "canada",
 * which is the sensible answer to the question the field asks, Zoho refused
 * the credentials and the screen blamed the client secret.
 *
 * Watching that happen three times to the same person is what produced this
 * list. The address is ours to know; the country is theirs.
 */
export const ZOHO_REGIONS: { value: string; label: string; api: string }[] = [
  { value: "com", label: "United States / rest of world", api: "https://www.zohoapis.com" },
  { value: "ca", label: "Canada — your Zoho address says zohocloud.ca", api: "https://www.zohoapis.ca" },
  { value: "eu", label: "Europe", api: "https://www.zohoapis.eu" },
  { value: "in", label: "India", api: "https://www.zohoapis.in" },
  { value: "com.au", label: "Australia", api: "https://www.zohoapis.com.au" },
  { value: "jp", label: "Japan", api: "https://www.zohoapis.jp" },
  { value: "com.cn", label: "China", api: "https://www.zohoapis.com.cn" },
  { value: "sa", label: "Saudi Arabia", api: "https://www.zohoapis.sa" },
];

/**
 * Where this connection's requests go.
 *
 * A region chosen on the form wins. Falling back to the base URL keeps any
 * connection made before the dropdown existed working unchanged, and still
 * allows a test server to be pointed at by hand.
 */
function apiBaseFor(cfg: ConnectorConfig, region?: string): string {
  const known = region && ZOHO_REGIONS.find((r) => r.value === region);
  if (known) return known.api;
  return cfg.baseUrl || ZOHO_BASE_URL;
}

/** Exchanges the stored refresh token for an access token good for one hour. */
async function accessToken(cfg: ConnectorConfig): Promise<string> {
  const c = readCredentials(cfg);
  const url = new URL("/oauth/v2/token", accountsHostFor(apiBaseFor(cfg, c.region)));

  const body = new URLSearchParams({
    refresh_token: c.refreshToken,
    client_id: c.clientId,
    client_secret: c.clientSecret,
    grant_type: "refresh_token",
  });

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  let json: { access_token?: string; error?: string };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    throw new Error(`Zoho returned something that was not JSON (${res.status}).`);
  }

  if (!json.access_token) {
    // Their errors are single words — "invalid_code", "invalid_client" — and
    // passing them through would tell an operator nothing they can act on.
    if (json.error === "invalid_client") {
      throw new Error("Zoho did not accept the client ID or secret.");
    }
    if (json.error === "invalid_code" || json.error === "invalid_grant") {
      throw new Error(
        "Zoho rejected the refresh token. It may have been revoked, or it may belong to a different data centre — check the region."
      );
    }
    throw new Error("Zoho would not issue a token.");
  }

  return json.access_token;
}

async function get<T>(
  cfg: ConnectorConfig,
  token: string,
  path: string,
  params: Record<string, string>
): Promise<T> {
  const c = readCredentials(cfg);
  const url = new URL(path, apiBaseFor(cfg, c.region));
  url.searchParams.set("organization_id", c.organizationId);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Zoho-oauthtoken ${token}`, Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error("Zoho rejected the token.");
    if (res.status === 400) {
      throw new Error("Zoho refused the request — usually a wrong organisation ID.");
    }
    throw new Error(`Zoho request failed: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as T;
}

/** Zoho sends numbers as numbers or as strings, depending on the field. */
function num(v: number | string | undefined): number | undefined {
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function toCanonical(i: ZohoItem): CanonicalItem | null {
  if (!i.item_id) return null;

  // An item with no code cannot be matched to anything, and inventing one
  // would create a duplicate on the next sync when Zoho still has none.
  const sku = (i.sku || "").trim();
  if (!sku) return null;

  const onHand = num(i.stock_on_hand) ?? 0;
  // Zoho's "available" is on hand less what is committed. Opservor stores the
  // commitment rather than the difference, so it is derived back out. Clamped
  // at zero because a negative reservation is not a thing.
  const available = num(i.actual_available_stock) ?? num(i.available_stock);
  const reserved = available != null ? Math.max(Math.round(onHand - available), 0) : undefined;

  return {
    externalId: String(i.item_id),
    sku,
    name: (i.name || "").trim() || sku,
    category: (i.category_name || "").trim() || undefined,
    quantityOnHand: Math.round(onHand),
    quantityReserved: reserved,
    reorderLevel: num(i.reorder_level) != null ? Math.round(num(i.reorder_level)!) : undefined,
    unitCost: num(i.purchase_rate),
    unitPrice: num(i.rate),
    supplier: (i.vendor_name || "").trim() || undefined,
    raw: i as Record<string, unknown>,
  };
}

export const zohoConnector: Connector = {
  provider: "zoho",

  async verify(cfg: ConnectorConfig) {
    try {
      const token = await accessToken(cfg);
      await get(cfg, token, "/inventory/v1/items", { per_page: "1", page: "1" });
      return { ok: true, message: "Connected to Zoho Inventory." };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Could not reach Zoho Inventory.",
      };
    }
  },

  /* No fetchVehicles. An inventory system has no fleet, and returning an empty
   * list to satisfy a signature would be a lie told to a type. */

  async fetchItems(cfg, cursor): Promise<FetchResult<CanonicalItem>> {
    const page = Number(cursor || "1");
    const token = await accessToken(cfg);

    const body = await get<ZohoItemsPage>(cfg, token, "/inventory/v1/items", {
      per_page: String(PAGE_SIZE),
      page: String(page),
    });

    const rows = body.items ?? [];
    const items: CanonicalItem[] = [];
    let skippedNoSku = 0;

    for (const i of rows) {
      const mapped = toCanonical(i);
      if (mapped) items.push(mapped);
      else skippedNoSku++;
    }

    const warnings: string[] = [];
    if (skippedNoSku) {
      warnings.push(
        `${skippedNoSku} item(s) had no SKU in Zoho and were skipped — without a code there is nothing to match them to.`
      );
    }

    // Zoho states whether more pages exist rather than making you infer it
    // from a short page, which is the one thing it does better than the others.
    const more = body.page_context?.has_more_page === true;

    return {
      items,
      cursor: more ? String(page + 1) : undefined,
      warnings: warnings.length ? warnings : undefined,
    };
  },
};
