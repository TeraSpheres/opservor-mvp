import type { Connector } from "./types";
import { samsaraConnector, SAMSARA_BASE_URL } from "./samsara";

/* The register of systems Opservor can talk to.
 *
 * Adding one means writing an adapter that implements Connector and adding a
 * line here. Nothing else in the product changes — not the connections screen,
 * not the sync, not Guardian. That is the point of the canonical shapes in
 * types.ts, and the test of whether they were drawn correctly is that this
 * file stays boring as the list grows.
 *
 * `label` and `hint` are what the operator reads on screen, so they are
 * written for somebody who runs a depot rather than somebody who reads API
 * documentation.
 */

export interface RegisteredConnector {
  connector: Connector;
  /** What the system is called, as its own customers call it. */
  label: string;
  /** Where the adapter points unless a connection overrides it. */
  defaultBaseUrl: string;
  /** Where in that system the operator finds the key. */
  hint: string;
  /** What Opservor will read once it is connected. */
  brings: string;
}

const REGISTRY: Record<string, RegisteredConnector> = {
  samsara: {
    connector: samsaraConnector,
    label: "Samsara",
    defaultBaseUrl: SAMSARA_BASE_URL,
    hint: "Samsara dashboard → Settings → API Tokens. Read-only is enough.",
    brings: "Vehicles and trips",
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

/** Everything the connections screen needs to offer a choice. */
export function listProviders() {
  return Object.entries(REGISTRY).map(([id, e]) => ({
    id,
    label: e.label,
    hint: e.hint,
    brings: e.brings,
  }));
}

export { REGISTRY };
