/* Run one SQL file against the database.
 *
 * This exists because the Supabase SQL editor truncates a paste at roughly
 * 4,300 characters without saying so. A function definition longer than that
 * arrives half-written, the editor reports success, and a check that was
 * working stops working — with no error to explain it. One migration in this
 * project is 5,285 characters after every comment is stripped, and it will
 * not be the last.
 *
 * Deliberately not `supabase db push`. That replays the whole migration
 * folder, and this database has twenty-eight migrations already applied with
 * no history table to prove it. Three of them contain statements that are not
 * safe to run twice. Pushing would be the most expensive way to find that out.
 *
 * So: one file, one transaction, no history, no cleverness. If any statement
 * fails, nothing is committed.
 *
 * THE PASSWORD IS NEVER READ FROM A FILE OR AN ARGUMENT. It comes from the
 * environment, so it is never committed, never in a screenshot, and never in
 * a chat. Set it in your terminal, run this, then close the terminal.
 *
 *   $env:SUPABASE_DB_URL = "postgresql://..."      (PowerShell)
 *   node tools/run-sql.js supabase/migrations/0025_whatever.sql
 *
 * The connection string is in the Supabase dashboard under
 * Project Settings -> Database -> Connection string -> URI.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const file = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

if (!file) {
  console.log('\n  usage: node tools/run-sql.js <file.sql> [--dry-run]\n');
  process.exit(1);
}
if (!fs.existsSync(file)) {
  console.log(`\n  no such file: ${file}\n`);
  process.exit(1);
}

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.log('\n  SUPABASE_DB_URL is not set.\n');
  console.log('  Get it from: Supabase dashboard -> Project Settings -> Database');
  console.log('               -> Connection string -> URI\n');
  console.log('  Then, in PowerShell:');
  console.log('    $env:SUPABASE_DB_URL = "postgresql://..."');
  console.log('    node tools/run-sql.js ' + file + '\n');
  process.exit(1);
}

const sql = fs.readFileSync(file, 'utf8');

/* A rough statement count, for the report only. Splitting SQL properly is
 * hard and unnecessary — the whole file goes to the server as one string,
 * which is what makes dollar-quoted function bodies work. */
const approxStatements = sql.split(/;\s*$/m).filter((s) => s.trim()).length;

(async () => {
  console.log(`\n  file       ${path.basename(file)}`);
  console.log(`  size       ${sql.length} characters   (the SQL editor truncates near 4,300)`);
  console.log(`  statements ~${approxStatements}`);

  if (dryRun) {
    console.log('\n  --dry-run: nothing was sent.\n');
    return;
  }

  // Supabase requires TLS. rejectUnauthorized is off because the pooler
  // presents a certificate for a different host than the one dialled; the
  // connection is still encrypted.
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
  } catch (e) {
    console.log(`\n  could not connect: ${e.message}`);
    console.log('  check the connection string, and that your IP is allowed in Supabase.\n');
    process.exit(1);
  }

  try {
    await client.query('begin');
    await client.query(sql);
    await client.query('commit');
    console.log('\n  applied, and committed.\n');
  } catch (e) {
    await client.query('rollback').catch(() => {});
    console.log('\n  FAILED — nothing was changed.');
    console.log(`  ${e.message}`);
    if (e.position) {
      const upto = sql.slice(0, Number(e.position));
      console.log(`  at line ${upto.split('\n').length}: ${upto.split('\n').pop().trim().slice(-70)}`);
    }
    console.log('');
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
})();
