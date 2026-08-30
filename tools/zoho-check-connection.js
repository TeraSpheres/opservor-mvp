#!/usr/bin/env node
/* Does this Zoho connection actually work?
 *
 * The Connections screen says "Zoho did not accept the client ID or secret"
 * and that one sentence covers several quite different faults: a wrong secret,
 * a refresh token minted against a secret that has since been rotated, the
 * wrong data centre, or the deployed app being an older build than the fix.
 * From a red box on a web page there is no way to tell which.
 *
 * So this does exactly what the app does, on this machine, one step at a time,
 * and says which step failed. Nothing is sent anywhere except Zoho, and the
 * values never leave the file they are read from.
 *
 *   node tools/zoho-check-connection.js
 */

const readline = require("readline");
const fs = require("fs");
const path = require("path");

const { REGIONS } = require("./zoho-refresh-token.js");

const VALUES_FILE = process.argv[2] || path.join(__dirname, "zoho-values.txt");

function readValuesFile(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return {};
  }
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const s = line.split("#")[0].trim();
    if (!s) continue;
    const eq = s.indexOf("=");
    if (eq === -1) continue;
    const key = s.slice(0, eq).trim().toLowerCase().replace(/[\s-]+/g, "_");
    const value = s.slice(eq + 1).trim();
    if (value) out[key] = value;
  }
  return out;
}

let rl = null;
function ask(q) {
  return new Promise((r) => rl.question(q, (a) => r(a.trim())));
}

function step(n, text) {
  console.log(`\n  ${n}. ${text}`);
}

function ok(text) {
  console.log(`     PASS  ${text}`);
}

function bad(text) {
  console.log(`     FAIL  ${text}`);
}

async function main() {
  rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log("\n  Zoho connection check\n  " + "-".repeat(58));

  const v = readValuesFile(VALUES_FILE);
  const region = v.region || "com";
  const chosen = REGIONS[region];

  if (!chosen) {
    console.log(`\n  "${region}" in ${path.basename(VALUES_FILE)} is not a region I know.\n`);
    rl.close();
    process.exitCode = 1;
    return;
  }

  const clientId = v.client_id || (await ask("  Client ID: "));
  const clientSecret = v.client_secret || (await ask("  Client secret: "));
  const orgId = v.organization_id || (await ask("  Organisation ID: "));
  const refreshToken = v.refresh_token || (await ask("  Refresh token: "));
  rl.close();

  if (!clientId || !clientSecret || !orgId || !refreshToken) {
    console.log("\n  Need all four. Fill them into zoho-values.txt and run again.\n");
    process.exitCode = 1;
    return;
  }

  console.log(`\n  Region ${region} — signing in at ${chosen.accounts}`);
  console.log(`  Reading stock from ${chosen.api}`);

  /* Step one: the same refresh the app does at the start of every sync. This
   * is where a rotated secret shows up, and where the wrong data centre does. */
  step(1, "Exchanging the refresh token for an access token");

  let accessToken;
  {
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    });

    let json;
    try {
      const res = await fetch(`${chosen.accounts}/oauth/v2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      json = await res.json();
    } catch (e) {
      bad(`Could not reach ${chosen.accounts} — ${e.message}`);
      process.exitCode = 1;
      return;
    }

    if (!json.access_token) {
      bad(`Zoho said: ${json.error || "(no token, no reason given)"}`);
      if (json.error === "invalid_client") {
        console.log("\n     The client ID and secret were not accepted together.");
        console.log("     Most likely: the client secret was regenerated in the API");
        console.log("     Console after this refresh token was made. A refresh token");
        console.log("     only works with the secret it was minted with — so make a");
        console.log("     new one with Get Zoho Token, using the current secret.");
      }
      if (json.error === "invalid_code" || json.error === "invalid_grant") {
        console.log("\n     The refresh token itself was refused. It may have been");
        console.log("     revoked, or it belongs to a different Zoho data centre.");
      }
      console.log();
      process.exitCode = 1;
      return;
    }

    accessToken = json.access_token;
    ok("Zoho issued an access token — the client ID, secret and refresh token all match");
  }

  /* Step two: the organisation ID, which is the other thing the connections
   * screen cannot tell apart from a bad key. */
  step(2, "Asking for stock items");

  const url = new URL("/inventory/v1/items", chosen.api);
  url.searchParams.set("organization_id", orgId);
  url.searchParams.set("per_page", "50");
  url.searchParams.set("page", "1");

  let res, body;
  try {
    res = await fetch(url.toString(), {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}`, Accept: "application/json" },
    });
    body = await res.json();
  } catch (e) {
    bad(`Could not reach ${chosen.api} — ${e.message}`);
    process.exitCode = 1;
    return;
  }

  if (!res.ok) {
    bad(`HTTP ${res.status} — ${body && body.message ? body.message : res.statusText}`);
    if (res.status === 400) {
      console.log(`\n     Usually a wrong organisation ID. This tried ${orgId}.`);
      console.log("     It is the number in your Zoho address bar, and it is also");
      console.log("     under the gear icon, Organisation Profile.\n");
    }
    process.exitCode = 1;
    return;
  }

  const items = body.items || [];
  ok(`Zoho returned ${items.length} item(s)`);

  /* Step three: the mapping. Reported the way the connector treats it, so a
   * disagreement between this and the app is visible rather than assumed. */
  step(3, "What the connector would make of them");

  let skipped = 0;
  for (const i of items) {
    const sku = (i.sku || "").trim();
    if (!sku) {
      skipped++;
      console.log(`     skipped   "${i.name || "(no name)"}" — no SKU, nothing to match it to`);
      continue;
    }
    const onHand = Number(String(i.stock_on_hand ?? 0).replace(/,/g, "")) || 0;
    const reorder = i.reorder_level != null && i.reorder_level !== ""
      ? Number(String(i.reorder_level).replace(/,/g, ""))
      : null;
    console.log(
      `     ${sku.padEnd(14)} ${String(onHand).padStart(6)} on hand` +
      (reorder != null ? `, reorder at ${reorder}` : ", no reorder level") +
      (onHand <= (reorder ?? -1) ? "   <- below reorder" : "")
    );
  }

  console.log(
    `\n  ${items.length - skipped} item(s) would sync` +
    (skipped ? `, ${skipped} skipped for having no SKU.` : ".")
  );
  console.log("\n  Everything above worked. If Opservor still refuses this same");
  console.log("  connection, the fault is in the app or its deployment, not in");
  console.log("  these values.\n");
}

main().catch((e) => {
  if (rl) rl.close();
  console.error(`\n  ${e.message}\n`);
  process.exitCode = 1;
});
