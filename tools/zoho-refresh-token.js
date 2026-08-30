#!/usr/bin/env node
/* Turns a Zoho grant code into a refresh token.
 *
 * Zoho's Self Client hands you a code that lives for ten minutes and can be
 * used exactly once. Trading it for a refresh token is a single HTTP request,
 * but it is the one step in the whole setup that cannot be done by clicking,
 * and doing it with curl means typing a client secret onto a command line
 * where the shell will remember it.
 *
 * Zoho gives that code about three minutes. That is not enough time to go
 * hunting for a client secret, so the values can be written into
 * zoho-values.txt beforehand and only what is missing gets asked for at the
 * prompt. Fill in the region, ID and secret at leisure; then fetch a code and
 * have only that one thing left to do against the clock.
 *
 * Typing into a masked prompt turned out to be its own obstacle — a paste that
 * silently fails looks exactly like one that worked — so the file is the
 * better path and the prompt is the fallback.
 *
 *   node tools/zoho-refresh-token.js [path to values file]
 */

const readline = require("readline");
const fs = require("fs");
const path = require("path");

/** Filled in beforehand, so the three-minute code is the only thing rushed. */
const VALUES_FILE = process.argv[2] || path.join(__dirname, "zoho-values.txt");

/**
 * Reads "key = value" lines, ignoring blanks and anything after a #.
 *
 * Deliberately forgiving: this file is edited in Notepad by someone who is
 * not going to be told their config has a syntax error. Unknown keys are
 * ignored and a missing file is not a problem, it just means prompting.
 */
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

/* Zoho runs separate data centres and an account in one is invisible to the
 * others. The token has to be minted in the same one the API will be called
 * in — getting that pair out of step produces an "invalid client" error that
 * sends you looking at the secret instead of the region.
 *
 * Both hosts are written out rather than derived from the region. Seven of the
 * eight follow accounts.zoho.<suffix>, and Canada does not: it signs in at
 * accounts.zohocloud.ca while still serving its API from www.zohoapis.ca.
 * A rule with one exception in it is not a rule, so each was checked against
 * the live endpoint and the answer recorded here. */
const REGIONS = {
  com: {
    label: "United States / rest of world",
    accounts: "https://accounts.zoho.com",
    api: "https://www.zohoapis.com",
  },
  eu: {
    label: "Europe",
    accounts: "https://accounts.zoho.eu",
    api: "https://www.zohoapis.eu",
  },
  in: {
    label: "India",
    accounts: "https://accounts.zoho.in",
    api: "https://www.zohoapis.in",
  },
  "com.au": {
    label: "Australia",
    accounts: "https://accounts.zoho.com.au",
    api: "https://www.zohoapis.com.au",
  },
  jp: {
    label: "Japan",
    accounts: "https://accounts.zoho.jp",
    api: "https://www.zohoapis.jp",
  },
  ca: {
    label: "Canada — your Zoho address says zohocloud.ca",
    accounts: "https://accounts.zohocloud.ca",
    api: "https://www.zohoapis.ca",
  },
  "com.cn": {
    label: "China",
    accounts: "https://accounts.zoho.com.cn",
    api: "https://www.zohoapis.com.cn",
  },
  sa: {
    label: "Saudi Arabia",
    accounts: "https://accounts.zoho.sa",
    api: "https://www.zohoapis.sa",
  },
};

/* Opened by main() rather than on load. Attaching to stdin is a side effect,
 * and a module that is only being required for its exchange function should
 * not take hold of the terminal — doing so crashed on the way out. */
let rl = null;

function ask(question) {
  return new Promise((resolve) => rl.question(question, (a) => resolve(a.trim())));
}

/* Same prompt, but the terminal is told not to echo. A client secret read out
 * over a shoulder is still a leaked client secret.
 *
 * Only when there is a terminal to mute. Muting works by intercepting what
 * readline writes back, and with piped input there is nothing being echoed to
 * intercept — the interception then eats the prompts instead, which is how
 * this was found. */
function askSecret(question) {
  if (!process.stdin.isTTY) return ask(question);

  return new Promise((resolve) => {
    const echo = rl._writeToOutput.bind(rl);
    let shown = false;
    rl._writeToOutput = function (s) {
      if (!shown) { rl.output.write(s); shown = true; return; }
      if (s.includes("\n")) rl.output.write("\n");
    };
    rl.question(question, (a) => {
      rl._writeToOutput = echo;
      rl.output.write("\n");
      resolve(a.trim());
    });
  });
}

/**
 * Says what arrived, without saying what it was.
 *
 * A masked prompt shows nothing as you type, which is right for a secret and
 * useless when something goes wrong — a paste that silently failed and a
 * paste that worked look identical, and the first sign of trouble is then an
 * error from Zoho that blames the wrong thing. A character count gives it
 * away immediately and gives away nothing else.
 */
function receipt(name, value, expectedPrefix) {
  if (!value) {
    console.log(`    ^ nothing arrived for the ${name.toLowerCase()}`);
    return;
  }

  const notes = [`${value.length} characters`];

  /* Both of these are Zoho's public format, not a secret — every Zoho client
   * ID and grant code begins this way, so saying it leaks nothing. */
  if (expectedPrefix && !value.startsWith(expectedPrefix)) {
    notes.push(`does not start "${expectedPrefix}" — check what was copied`);
  }
  if (/\s/.test(value)) {
    notes.push("contains a space or line break — probably copied with something else");
  }

  console.log(`    ^ ${name}: ${notes.join(", ")}`);
}

/* Zoho's errors are single words, and passing them through would tell an
 * operator nothing they could act on. Each of these has a different fix. */
const EXPLAIN = {
  invalid_code:
    "The grant code was refused. Those expire after the few minutes you chose\n" +
    "  and work only once — go back to the API Console and generate a new one.",
  invalid_client:
    "Zoho did not accept the client ID or secret. Check you copied both in full,\n" +
    "  and that this Self Client belongs to the region you picked.",
  invalid_grant:
    "The code was refused. Most often it was already used, or it was created in\n" +
    "  a different Zoho region than the one you picked.",
};

/**
 * Trades the one-time grant code for a refresh token.
 *
 * Separated from the prompting so it can be tested. Returns a result rather
 * than throwing, because every failure here is something the operator can fix
 * and none of them is exceptional.
 */
async function exchange(accountsHost, clientId, clientSecret, code) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
  });

  let res;
  try {
    res = await fetch(`${accountsHost}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch (e) {
    return { ok: false, reason: `Could not reach Zoho: ${e.message}` };
  }

  let json;
  try {
    json = await res.json();
  } catch {
    return { ok: false, reason: `Zoho replied with something that was not JSON (${res.status}).` };
  }

  if (!json.refresh_token) {
    return {
      ok: false,
      error: json.error,
      reason: EXPLAIN[json.error] || `Zoho said: ${json.error || res.status}`,
    };
  }

  return { ok: true, refreshToken: json.refresh_token };
}

async function main() {
  rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log("\n  Zoho refresh token\n  " + "-".repeat(50));

  const saved = readValuesFile(VALUES_FILE);
  const fromFile = Object.keys(saved).length > 0;

  if (fromFile) {
    console.log(`  Read from ${path.basename(VALUES_FILE)}: ${Object.keys(saved).join(", ")}`);
    console.log("  Anything missing is asked for below.\n");
  } else {
    console.log("  Nothing you type here is saved anywhere.\n");
  }

  let region = saved.region;
  if (!region) {
    console.log("  Which Zoho region is your account in?");
    console.log("  Look at the address bar when you are signed in to Zoho —");
    console.log("  the bit after 'zoho' is your region.\n");
    for (const [k, v] of Object.entries(REGIONS)) {
      console.log(`    ${k.padEnd(8)} ${v.label}`);
    }
    region = (await ask("\n  Region [com]: ")) || "com";
  }

  const chosen = REGIONS[region];
  if (!chosen) {
    console.error(`\n  "${region}" is not one of the regions listed above.\n`);
    rl.close();
    process.exitCode = 1;
    return;
  }

  const accountsHost = chosen.accounts;

  /* Values from the file are visible in Notepad already, so masking them here
   * would hide nothing and only cost the operator the confirmation that the
   * right thing was picked up. Only what is typed gets masked. */
  const clientId = saved.client_id || (await askSecret("  Client ID: "));
  receipt("Client ID", clientId, "1000.");
  const clientSecret = saved.client_secret || (await askSecret("  Client secret: "));
  receipt("Client secret", clientSecret);
  const code = saved.grant_code || (await askSecret("  Grant code (starts 1000.): "));
  receipt("Grant code", code, "1000.");
  rl.close();

  if (!clientId || !clientSecret || !code) {
    console.error(
      "\n  One of those arrived empty, so nothing was sent.\n\n" +
      "  If you pasted and saw nothing appear, that part is normal — but the\n" +
      "  count under each prompt should have been more than zero. Right-click\n" +
      "  pastes in this window; Ctrl+V may not.\n"
    );
    process.exitCode = 1;
    return;
  }

  console.log(`\n  Asking ${accountsHost} for a refresh token…`);

  const result = await exchange(accountsHost, clientId, clientSecret, code);

  if (!result.ok) {
    console.error(`\n  Zoho would not issue a refresh token.\n\n  ${result.reason}\n`);

    /* A dead code left in the file is a trap: every later run reads the same
     * expired value and fails the same way, and nothing on screen says the
     * code being tried is the old one. Worse, the file is the slow path for
     * this particular value — saving it there spends the three minutes before
     * the request is even made. */
    if (saved.grant_code && (result.error === "invalid_code" || result.error === "invalid_grant")) {
      console.error("  That code came from zoho-values.txt, so every run from now on will");
      console.error("  retry the same expired one. Clear the grant_code line and leave it");
      console.error("  empty — it will be asked for here instead.\n");
      console.error("  Then start this window FIRST and let it wait at the prompt. Fetch");
      console.error("  the code from Zoho only once it is waiting, and the three minutes");
      console.error("  are spent pasting rather than clicking about.\n");
    }

    /* Not process.exit. Ending the process while the request's socket is still
     * closing trips an assertion inside Node on Windows, which prints a line
     * of C source and makes a handled error look like a crash. */
    process.exitCode = 1;
    return;
  }

  console.log("\n  " + "-".repeat(50));
  console.log("  Refresh token — this is the fourth value for the form:\n");
  console.log(`    ${result.refreshToken}\n`);
  console.log("  " + "-".repeat(50));
  console.log("\n  This one does not expire. Paste it straight into the");
  console.log("  Connections screen. Do not put it in a document or a chat.\n");

  if (chosen.api !== "https://www.zohoapis.com") {
    console.log("  Your region is not the default, so on the Connections screen open");
    console.log('  "Different region or a test server?" and put in:\n');
    console.log(`    ${chosen.api}\n`);
  }

  /* Said rather than done. Deleting a file the operator wrote, without being
   * asked to, is not this tool's decision to make. */
  if (fromFile) {
    console.log(`  Now open ${path.basename(VALUES_FILE)} and clear the client secret`);
    console.log("  line. It has done its job and there is no reason to leave a\n");
    console.log("  secret sitting in a text file.\n");
  }
}

/* Prompting only when run directly, so the exchange above can be required and
 * tested without a terminal attached. */
if (require.main === module) {
  main().catch((e) => {
    if (rl) rl.close();
    console.error(`\n  ${e.message}\n`);
    process.exit(1);
  });
}

module.exports = { exchange, EXPLAIN, REGIONS };
