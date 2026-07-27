/* Proves the Samsara connector end to end against the stand-in.
 *
 * Checks the things that actually break in production:
 *   - a bad token is rejected clearly rather than returning nothing
 *   - paging follows the cursor to the end and stops
 *   - every vehicle arrives exactly once
 *   - a row with no id is skipped AND reported, not silently dropped
 *   - the translation produces the common shape, not Samsara's field names
 *
 * Run the stand-in first:
 *   node supabase/seed/fake-samsara.js
 * Then:
 *   npx tsx supabase/seed/test-samsara-connector.ts
 */

import { samsaraConnector } from "../../src/lib/connectors/samsara";
import type { CanonicalVehicle, ConnectorConfig } from "../../src/lib/connectors/types";

const BASE = process.env.FAKE_SAMSARA_URL || "http://localhost:4599";
const EXPECTED = Number(process.env.FAKE_SAMSARA_VEHICLES || 47);

const good: ConnectorConfig = { baseUrl: BASE, token: "test-token" };
const bad: ConnectorConfig = { baseUrl: BASE, token: "nonsense" };

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "pass" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`);
  if (!ok) failures++;
}

async function main() {
  console.log("Samsara connector\n");

  // --- credentials -------------------------------------------------------
  const badResult = await samsaraConnector.verify(bad);
  check("a wrong token is rejected", !badResult.ok, badResult.message);

  const goodResult = await samsaraConnector.verify(good);
  check("a correct token is accepted", goodResult.ok, goodResult.message);

  // --- paging ------------------------------------------------------------
  const all: CanonicalVehicle[] = [];
  const warnings: string[] = [];
  let cursor: string | undefined;
  let pages = 0;

  do {
    const page = await samsaraConnector.fetchVehicles(good, cursor);
    pages++;
    all.push(...page.items);
    if (page.warnings) warnings.push(...page.warnings);
    cursor = page.cursor;
    if (pages > 50) break; // guard against a cursor that never clears
  } while (cursor);

  check("paging terminates", pages <= 50, `${pages} page(s)`);
  check(
    `all ${EXPECTED} vehicles fetched`,
    all.length === EXPECTED,
    `got ${all.length}`
  );

  const ids = new Set(all.map((v) => v.externalId));
  check("no vehicle arrives twice", ids.size === all.length, `${ids.size} unique of ${all.length}`);

  // --- the malformed row -------------------------------------------------
  check("the row with no id was skipped", !all.some((v) => !v.externalId));
  check("and it was reported, not swallowed", warnings.length > 0, warnings[0] ?? "no warning raised");

  // --- translation -------------------------------------------------------
  const first = all[0];
  check("external id is the provider's own", /^\d+$/.test(first.externalId), first.externalId);
  check("name is populated", Boolean(first.name), first.name);
  check("type is composed from make and model", Boolean(first.type), first.type);
  check("registration mapped from licensePlate", Boolean(first.registration), first.registration);
  check("vin carried through", Boolean(first.vin), first.vin);
  check(
    "status is left unset so a sync cannot overwrite it",
    first.status === undefined
  );
  check("nothing named licensePlate survives translation",
    !Object.keys(first).includes("licensePlate"));

  console.log(`\n  sample: ${JSON.stringify({
    externalId: first.externalId,
    name: first.name,
    type: first.type,
    registration: first.registration,
  })}`);

  console.log(failures === 0 ? "\nall checks passed" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("test threw:", e);
  process.exit(1);
});
