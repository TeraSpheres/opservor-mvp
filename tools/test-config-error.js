/* Prove a misconfigured key never reaches the browser.
 *
 * A service role key was pasted into the hosting dashboard with a line break
 * in it. Nothing showed the break — not the dashboard, not the build, not the
 * logs. supabase-js tried to make an HTTP header out of it, threw a TypeError
 * quoting the value, and the route handed that message to the browser. The key
 * that bypasses every row-level policy in the database appeared in a red box
 * on a customer's screen.
 *
 * Two things are asserted here. That such a key is rejected before it reaches
 * a library at all, and that whatever a library does throw is never repeated
 * outward. The second matters more: the first only guards the case already
 * known about.
 *
 * Run: node tools/test-config-error.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const ts = require('typescript');
const Module = require('module');

const SRC = path.join(__dirname, '..', 'src', 'lib', 'supabase', 'admin.ts');

/* A believable secret, and the same one with the line break that caused this.
 * Not a real key — the real one was rotated the moment it was seen. */
const GOOD_KEY = 'sb_secret_examplekeythatisnotreal_0000000000';
const BROKEN_KEY = 'sb_secret_examplekey\nthatisnotreal_0000000000';

function load() {
  const js = ts.transpileModule(fs.readFileSync(SRC, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-'));
  const file = path.join(dir, 'admin.js');
  fs.writeFileSync(file, js);

  const stub = path.join(dir, 'stub.js');
  fs.writeFileSync(stub, 'module.exports = { createClient: () => ({}) };\n');

  const origResolve = Module._resolveFilename;
  Module._resolveFilename = function (request, ...rest) {
    if (request === 'server-only') return stub;
    if (request === '@supabase/supabase-js') return stub;
    return origResolve.call(this, request, ...rest);
  };
  try {
    return require(file);
  } finally {
    Module._resolveFilename = origResolve;
  }
}

let pass = 0;
let fail = 0;
function check(name, ok, detail) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  ok ? pass++ : fail++;
}

const { createAdminClient, integrationKey, configErrorMessage, ConfigError } = load();

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';

/* 1. A key with a line break is refused, and the complaint does not quote it. */
process.env.SUPABASE_SERVICE_ROLE_KEY = BROKEN_KEY;
try {
  createAdminClient();
  check('a key with a line break is refused', false, 'it was accepted');
} catch (e) {
  check('a key with a line break is refused', e instanceof ConfigError, e.constructor.name);
  check(
    'the complaint does not contain the key',
    !e.message.includes('sb_secret') && !e.message.includes('thatisnotreal'),
    e.message.slice(0, 60)
  );
  check('the complaint says what to do', /single|unbroken|line/i.test(e.message));
}

/* 2. A key with a trailing newline is a paste artefact, not a fault. Trimmed. */
process.env.SUPABASE_SERVICE_ROLE_KEY = `  ${GOOD_KEY}\n`;
try {
  createAdminClient();
  check('a trailing newline is trimmed rather than refused', true);
} catch (e) {
  check('a trailing newline is trimmed rather than refused', false, e.message);
}

/* 3. A missing key names itself without inventing a value. */
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
try {
  createAdminClient();
  check('a missing key is refused', false, 'it was accepted');
} catch (e) {
  check('a missing key is refused', e instanceof ConfigError);
  check('and it names which one', e.message.includes('SUPABASE_SERVICE_ROLE_KEY'));
}

/* 4. INTEGRATION_KEY gets the same treatment. */
process.env.INTEGRATION_KEY = 'too-short';
try {
  integrationKey();
  check('a short INTEGRATION_KEY is refused', false, 'it was accepted');
} catch (e) {
  check('a short INTEGRATION_KEY is refused', e instanceof ConfigError);
  check('without quoting it back', !e.message.includes('too-short'), e.message.slice(0, 50));
}

/* 5. The one that matters. Whatever a library throws, however much of the key
 *    it quotes, none of it goes outward. */
{
  const leaky = new TypeError(
    `Headers.set: "${BROKEN_KEY}" is an invalid header value.`
  );
  const originalError = console.error;
  console.error = () => {};
  const out = configErrorMessage(leaky);
  console.error = originalError;

  check('a library error is not passed through', !out.includes('Headers.set'));
  check('and the key is not in what the browser gets', !out.includes('sb_secret'), out.slice(0, 50));
  check('but the operator is told where to look', /server log/i.test(out));
}

/* 6. Our own message still gets through, or every fault becomes a shrug. */
{
  const ours = new ConfigError('INTEGRATION_KEY is not set. Integrations cannot run without it.');
  const out = configErrorMessage(ours);
  check('our own wording is kept', out === ours.message, out.slice(0, 50));
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exitCode = fail ? 1 : 0;
