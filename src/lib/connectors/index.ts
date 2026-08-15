import type { Connector } from "./types";
import { samsaraConnector, SAMSARA_BASE_URL } from "./samsara";
import { motiveConnector, MOTIVE_BASE_URL } from "./motive";
import { geotabConnector, GEOTAB_BASE_URL } from "./geotab";

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
    // Vehicles only. The Connector interface allows trips and this adapter
    // does not implement them yet — saying otherwise here would put a claim on
    // the screen the code cannot meet.
    brings: "Vehicles",
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
    brings: "Vehicles",
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
    brings: "Vehicles",
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
