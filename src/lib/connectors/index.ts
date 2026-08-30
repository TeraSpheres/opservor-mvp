import type { Connector } from "./types";
import { samsaraConnector, SAMSARA_BASE_URL } from "./samsara";
import { motiveConnector, MOTIVE_BASE_URL } from "./motive";
import { geotabConnector, GEOTAB_BASE_URL } from "./geotab";
import { fleetioConnector, FLEETIO_BASE_URL } from "./fleetio";
import { zohoConnector, ZOHO_BASE_URL, ZOHO_REGIONS } from "./zoho";

/* The register of systems Opservor can talk to.
 *
 * Adding one means writing an adapter and adding an entry here. Nothing else
 * changes — not the connections screen, not the route, not the sync, not
 * Guardian. The screen renders whatever fields an entry declares, so a
 * provider that wants three secrets instead of one needs no new code.
 *
 * Everything an operator reads is written for someone who runs a depot rather
 * than someone who reads API documentation.
 */

/** One thing an operator has to paste in to make a connection work. */
export interface CredentialField {
  key: string;
  label: string;
  /** Rendered as a password field and never echoed back. */
  secret?: boolean;
  placeholder?: string;
  hint?: string;
  /**
   * Turns the field into a dropdown. For anything the product already knows
   * the answers to — a region is a fixed list, and asking someone to type a
   * value from a list they cannot see is how they end up typing the name of
   * their country into a field that wanted a URL.
   */
  options?: { value: string; label: string }[];
  /** Pre-selected, so a dropdown is never submitted empty by accident. */
  defaultValue?: string;
}

export interface RegisteredConnector {
  connector: Connector;
  label: string;
  defaultBaseUrl: string;
  /** Where in that system the operator finds what they need. */
  hint: string;
  brings: string;
  fields: CredentialField[];
  /** Stated on screen. None of these has been run against a live account. */
  untested?: boolean;
}

const REGISTRY: Record<string, RegisteredConnector> = {
  samsara: {
    connector: samsaraConnector,
    label: "Samsara",
    defaultBaseUrl: SAMSARA_BASE_URL,
    hint: "In Samsara: Settings → API Tokens. Read-only is enough.",
    brings: "Vehicles and trips, with the sites they ran from",
    untested: true,
    fields: [
      { key: "token", label: "API token", secret: true, placeholder: "Paste the token" },
    ],
  },

  motive: {
    connector: motiveConnector,
    label: "Motive",
    defaultBaseUrl: MOTIVE_BASE_URL,
    hint: "In Motive: the admin menu at the bottom → Developers → Request API Key.",
    brings: "Vehicles and trips, with start and end addresses",
    untested: true,
    fields: [
      { key: "token", label: "API key", secret: true, placeholder: "Paste the key" },
    ],
  },

  geotab: {
    connector: geotabConnector,
    label: "Geotab",
    defaultBaseUrl: GEOTAB_BASE_URL,
    hint:
      "Geotab signs in rather than using a key, so it needs the three things you " +
      "use to log in yourself. Best practice is a service account with read-only " +
      "access rather than your own login.",
    // Geotab records where a trip stopped and not where it started, so its
    // trips give mileage but cannot feed the depot mapping. Said here rather
    // than discovered later by someone wondering why a check stayed silent.
    brings: "Vehicles and trips, but no start locations",
    untested: true,
    fields: [
      {
        key: "database",
        label: "Database name",
        placeholder: "e.g. yourcompany",
        hint: "The database shown on the MyGeotab sign-in page.",
      },
      { key: "username", label: "Username", placeholder: "name@company.com" },
      { key: "password", label: "Password", secret: true },
    ],
  },

  /* The odd one out, and deliberately so.
   *
   * The other three are telematics: they report where a vehicle is and how it
   * is behaving. Fleetio is where somebody records that it is booked in for
   * brakes on Thursday — and a booking is the only thing that lets the
   * capacity check see a clash before it happens. Telematics can only report a
   * defect, which is the vehicle already broken. */
  fleetio: {
    connector: fleetioConnector,
    label: "Fleetio",
    defaultBaseUrl: FLEETIO_BASE_URL,
    hint:
      "In Fleetio: Account Settings → API Keys. It needs two values, not one — " +
      "the API token and the account token, both shown on that page.",
    brings: "Vehicles, and the service work booked against them",
    untested: true,
    fields: [
      { key: "apiToken", label: "API token", secret: true, placeholder: "Paste the API token" },
      {
        key: "accountToken",
        label: "Account token",
        secret: true,
        placeholder: "Paste the account token",
        hint: "Sent alongside the API token. Without it Fleetio returns an error that looks like a bad key.",
      },
    ],
  },
  /* The first that brings stock rather than vehicles, and the first a real
   * operation might already be running — Zoho is cheap and common in the
   * mid-market. Also the first that could actually be tested against a live
   * account, because unlike the other four it has a free tier. */
  zoho: {
    connector: zohoConnector,
    label: "Zoho Inventory",
    defaultBaseUrl: ZOHO_BASE_URL,
    hint:
      "Zoho uses a sign-in rather than a key, so it needs four values. Create a " +
      "Self Client in the Zoho API Console for the first three; the organisation " +
      "ID is in Zoho Inventory under Settings.",
    brings: "Stock items and levels, for the shortage checks",
    untested: true,
    fields: [
      /* First, because it decides which country's Zoho every other value on
       * this form is checked against. It used to be a URL in a collapsed box
       * further down, which meant the one field that had to be right was the
       * one nobody could see. */
      {
        key: "region",
        label: "Where is your Zoho account?",
        defaultValue: "com",
        options: ZOHO_REGIONS.map(({ value, label }) => ({ value, label })),
        hint: "Look at the address bar in Zoho Inventory — the part after 'zoho' is your region.",
      },
      { key: "organizationId", label: "Organisation ID", placeholder: "e.g. 10234695",
        hint: "Zoho Inventory: Settings, then Organisation Profile." },
      { key: "clientId", label: "Client ID", secret: true },
      { key: "clientSecret", label: "Client secret", secret: true },
      { key: "refreshToken", label: "Refresh token", secret: true,
        hint: "Not the access token — those expire after an hour and the sync would stop working the same day." },
    ],
  },
};

export function getConnector(provider: string):
  (Connector & { defaultBaseUrl: string }) | null {
  const entry = REGISTRY[provider.toLowerCase()];
  if (!entry) return null;
  // The caller asks the connector for its own default rather than keeping a
  // table of URLs, so a provider that moves its API changes in one file.
  return { ...entry.connector, defaultBaseUrl: entry.defaultBaseUrl };
}

/**
 * Packs what the operator typed into the single string that gets encrypted.
 *
 * A provider needing one secret stores it as-is, which keeps every connection
 * made before this existed working unchanged. A provider needing several
 * stores them as JSON, and its adapter unpacks them. The storage never has to
 * know how many secrets a system has.
 */
export function packCredentials(provider: string, values: Record<string, string>): string {
  const entry = REGISTRY[provider.toLowerCase()];
  if (!entry) throw new Error(`No adapter for ${provider}.`);

  const missing = entry.fields.filter((f) => !(values[f.key] || "").trim());
  if (missing.length) {
    throw new Error(`Still need: ${missing.map((f) => f.label.toLowerCase()).join(", ")}.`);
  }

  if (entry.fields.length === 1) return values[entry.fields[0].key].trim();

  const packed: Record<string, string> = {};
  for (const f of entry.fields) packed[f.key] = values[f.key].trim();
  return JSON.stringify(packed);
}

/** Everything the connections screen needs to offer a choice and a form. */
export function listProviders() {
  return Object.entries(REGISTRY).map(([id, e]) => ({
    id,
    label: e.label,
    hint: e.hint,
    brings: e.brings,
    fields: e.fields,
    untested: !!e.untested,
  }));
}

export { REGISTRY };
