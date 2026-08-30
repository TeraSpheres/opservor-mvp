/* Prove the Zoho connector signs in at the right data centre.
 *
 * Zoho serves each region from its own data centre, and an account in one is
 * invisible to the others. The connector derives its sign-in host from the API
 * host, which held for every region until a real Canadian account turned up:
 * Canada serves its API from www.zohoapis.ca like everyone else but signs in
 * at accounts.zohocloud.ca, and accounts.zoho.ca does not exist at all.
 *
 * The failure was the dangerous kind. Nothing crashed. Zoho answered
 * "invalid_client", the screen said the client ID or secret was not accepted,
 * and an operator would have spent the afternoon re-copying a secret that was
 * correct all along.
 *
 * Every host below was checked against the live endpoint before being written
 * down. This test asserts the connector asks for those and not for something
 * it worked out by pattern.
 *
 * Run: node tools/test-zoho-region.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const ts = require('typescript');

const SRC = path.join(__dirname, '..', 'src', 'lib', 'connectors', 'zoho.ts');

/* Verified against the live endpoints. Seven regions follow one pattern and
 * Canada does not, which is the entire point of the table. */
const EXPECTED = [
  { api: 'https://www.zohoapis.com',    accounts: 'accounts.zoho.com' },
  { api: 'https://www.zohoapis.eu',     accounts: 'accounts.zoho.eu' },
  { api: 'https://www.zohoapis.in',     accounts: 'accounts.zoho.in' },
  { api: 'https://www.zohoapis.com.au', accounts: 'accounts.zoho.com.au' },
  { api: 'https://www.zohoapis.jp',     accounts: 'accounts.zoho.jp' },
  { api: 'https://www.zohoapis.ca',     accounts: 'accounts.zohocloud.ca' },
  { api: 'https://www.zohoapis.com.cn', accounts: 'accounts.zoho.com.cn' },
  { api: 'https://www.zohoapis.sa',     accounts: 'accounts.zoho.sa' },
];

function load() {
  const js = ts.transpileModule(fs.readFileSync(SRC, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoho-'));
  const file = path.join(dir, 'zoho.js');
  fs.writeFileSync(file, js);
  return require(file);
}

/* Records every URL asked for, and answers plausibly so verify() runs to the
 * end. Nothing leaves the machine. */
function fakeFetch(seen) {
  return async (url) => {
    seen.push(String(url));
    if (String(url).includes('/oauth/v2/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'test-token' }) };
    }
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ items: [], page_context: { has_more_page: false } }),
    };
  };
}

const CREDENTIALS = JSON.stringify({
  organizationId: '10234695',
  clientId: '1000.TEST',
  clientSecret: 'testsecret',
  refreshToken: '1000.testrefresh',
});

(async () => {
  const { zohoConnector } = load();
  const realFetch = global.fetch;

  let pass = 0;
  let fail = 0;

  for (const { api, accounts } of EXPECTED) {
    const seen = [];
    global.fetch = fakeFetch(seen);

    const result = await zohoConnector.verify({ token: CREDENTIALS, baseUrl: api });

    const tokenCall = seen.find((u) => u.includes('/oauth/v2/token')) || '';
    const host = tokenCall ? new URL(tokenCall).host : '(no token request)';
    const ok = host === accounts && result.ok;

    console.log(
      `  ${ok ? 'PASS' : 'FAIL'}  ${api.padEnd(30)} signs in at ${host}` +
      (ok ? '' : `  — expected ${accounts}`)
    );
    ok ? pass++ : fail++;
  }

  /* The specific regression: Canada must never be sent to a host that does not
   * resolve, however the derivation is rewritten later. */
  {
    const seen = [];
    global.fetch = fakeFetch(seen);
    await zohoConnector.verify({ token: CREDENTIALS, baseUrl: 'https://www.zohoapis.ca' });
    const ok = !seen.some((u) => u.includes('accounts.zoho.ca/'));
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  Canada never asks accounts.zoho.ca, which does not exist`);
    ok ? pass++ : fail++;
  }

  global.fetch = realFetch;
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exitCode = fail ? 1 : 0;
})();
