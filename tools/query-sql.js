/* Run a read-only query and print the rows.
 *
 * The companion to run-sql.js. That one applies a change; this one answers
 * "did it actually take?" — which is the question that matters after any
 * migration, and the one that is hardest to answer from a screen that might
 * be showing a cached page.
 *
 * Refuses anything that is not a SELECT. Not because a typo here would be
 * catastrophic, but because a tool that can read and write invites being used
 * for both, and then somebody runs an UPDATE while trying to check something.
 *
 * Uses SUPABASE_DB_URL from the environment, same as run-sql.js.
 *
 *   node tools/query-sql.js "select count(*) from guardian_finding"
 *   node tools/query-sql.js --file check.sql
 */

const fs = require('fs');
const { Client } = require('pg');

const args = process.argv.slice(2);
const fileFlag = args.indexOf('--file');
const sql = fileFlag >= 0 ? fs.readFileSync(args[fileFlag + 1], 'utf8') : args.join(' ');

if (!sql.trim()) {
  console.log('\n  usage: node tools/query-sql.js "select ..."\n');
  process.exit(1);
}

/* Read-only by construction. A tool that can also write will eventually be
 * used to write, and then somebody runs an UPDATE while trying to check
 * something.
 *
 * Leading comments have to come off first. The first version tested the raw
 * string, so a .sql file that opened with an explanatory comment — which is
 * every file worth keeping — was refused as though it were an UPDATE. */
const firstStatement = sql
  .replace(/\/\*[\s\S]*?\*\//g, ' ')     // block comments
  .replace(/^\s*--.*$/gm, '')            // line comments
  .trim();

if (!/^(select|with)\b/i.test(firstStatement)) {
  console.log('\n  This runs SELECT only. Use run-sql.js to change anything.');
  console.log(`  What it saw: ${firstStatement.slice(0, 60) || '(nothing)'}\n`);
  process.exit(1);
}

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.log('\n  SUPABASE_DB_URL is not set. Set it as you did for run-sql.js.\n');
  process.exit(1);
}

(async () => {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const res = await client.query(sql);
    console.log('');
    if (!res.rows.length) { console.log('  no rows\n'); return; }

    const cols = Object.keys(res.rows[0]);
    const width = (c) => Math.min(60, Math.max(c.length,
      ...res.rows.map((r) => String(r[c] ?? '').length)));
    const w = Object.fromEntries(cols.map((c) => [c, width(c)]));

    console.log('  ' + cols.map((c) => c.padEnd(w[c])).join('  '));
    console.log('  ' + cols.map((c) => '-'.repeat(w[c])).join('  '));
    for (const r of res.rows) {
      console.log('  ' + cols.map((c) => String(r[c] ?? '').slice(0, 60).padEnd(w[c])).join('  '));
    }
    console.log(`\n  ${res.rows.length} row${res.rows.length === 1 ? '' : 's'}\n`);
  } catch (e) {
    console.log(`\n  failed: ${e.message}\n`);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
})();
