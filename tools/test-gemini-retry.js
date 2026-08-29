/* Prove the Gemini retry actually retries.
 *
 * The bug this guards against was invisible in every check that existed:
 * TypeScript compiled, the build passed, the page rendered, and the feature
 * silently used the pattern matcher instead. It only showed up in a server
 * log nobody was reading. So it needs a test that fails when the behaviour
 * regresses, not another kind of check that cannot see it.
 *
 * There is no test runner in this project and adding one to test a single
 * function would be a poor trade. So this compiles the module with the
 * TypeScript compiler already installed, loads it with a fake fetch, and
 * asserts what happened.
 *
 * Run: node tools/test-gemini-retry.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const ts = require('typescript');
const Module = require('module');

const SRC = path.join(__dirname, '..', 'src', 'lib', 'ask-llm.ts');

/* Compile to CommonJS in memory. "server-only" is a Next.js guard that throws
 * outside a server component, so it is stubbed — the module under test does
 * not use it for anything but the guard. */
function load() {
  const source = fs.readFileSync(SRC, 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'askllm-'));
  const file = path.join(dir, 'ask-llm.js');
  fs.writeFileSync(file, js);

  const origResolve = Module._resolveFilename;
  Module._resolveFilename = function (request, ...rest) {
    if (request === 'server-only') return require.resolve('./_server-only-stub.js');
    return origResolve.call(this, request, ...rest);
  };
  fs.writeFileSync(path.join(__dirname, '_server-only-stub.js'), 'module.exports = {};\n');

  try {
    return require(file);
  } finally {
    Module._resolveFilename = origResolve;
  }
}

/* A fetch that plays back a scripted sequence of responses and records every
 * model it was asked for, so the test can assert on the order of attempts. */
function fakeFetch(script) {
  const calls = [];
  let i = 0;
  return {
    calls,
    fn: async (url) => {
      const model = String(url).match(/models\/([^:]+):/)?.[1] ?? '?';
      calls.push(model);
      const step = script[Math.min(i++, script.length - 1)];
      if (step.throw) throw new Error(step.throw);
      return {
        ok: step.status === 200,
        status: step.status,
        json: async () => step.body ?? {},
      };
    },
  };
}

const answer = (text) => ({ status: 200, body: { candidates: [{ content: { parts: [{ text }] } }] } });

const TESTS = [
  {
    name: 'a busy model is retried and then succeeds',
    script: [{ status: 503 }, { status: 503 }, answer('four days of cover')],
    expect: (r, calls) => r === 'four days of cover' && calls.length === 3
      && calls.every((m) => m === calls[0]),
    describe: 'three attempts, all against the same model, answer returned',
  },
  {
    name: 'rate limiting is retried, not abandoned',
    script: [{ status: 429 }, answer('28 units')],
    expect: (r, calls) => r === '28 units' && calls.length === 2,
    describe: 'retried once, answer returned',
  },
  {
    name: 'a model that stays busy hands over to the next name',
    script: [{ status: 503 }, { status: 503 }, { status: 503 }, answer('ok')],
    expect: (r, calls) => r === 'ok' && new Set(calls).size === 2,
    describe: 'exhausts the first model, then tries a different one',
  },
  {
    name: 'a retired model name is skipped immediately',
    script: [{ status: 404 }, answer('ok')],
    expect: (r, calls) => r === 'ok' && new Set(calls).size === 2 && calls.length === 2,
    describe: 'no retry on 404 — the name is gone, not busy',
  },
  {
    name: 'a rejected key stops everything',
    script: [{ status: 403 }, answer('should never be reached')],
    expect: (r, calls) => r === null && calls.length === 1,
    describe: 'one attempt, no further models tried',
  },
];

(async () => {
  const mod = load();
  process.env.GEMINI_API_KEY = 'test-key';
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_MODEL;

  const ctx = { findings: [], kpi: null, scores: [], openAlerts: [], readiness: [] };
  const realFetch = global.fetch;

  let failed = 0;
  console.log('');
  for (const t of TESTS) {
    const f = fakeFetch(t.script);
    global.fetch = f.fn;
    let result = null;
    try {
      result = await mod.askWithLlm('what needs my attention?', ctx);
    } catch (e) {
      result = `threw: ${e.message}`;
    }
    const pass = t.expect(result, f.calls);
    if (!pass) failed++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${t.name}`);
    console.log(`       expected: ${t.describe}`);
    console.log(`       attempts: ${f.calls.join(', ') || 'none'}`);
    if (!pass) console.log(`       returned: ${JSON.stringify(result)}`);
  }
  global.fetch = realFetch;

  try { fs.unlinkSync(path.join(__dirname, '_server-only-stub.js')); } catch {}

  console.log(`\n  ${TESTS.length - failed}/${TESTS.length} passed\n`);
  process.exit(failed ? 1 : 0);
})();
