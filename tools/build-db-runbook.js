/* Opservor — Database Operations Runbook
 *
 * Version 1.2 was written by hand on 25 July and rotted, as hand-written
 * inventories of growing things always do: it claimed 21 tables when there
 * were 32 and listed eight migrations when there were twenty-four.
 *
 * Worse, it contained an instruction that actively costs time — "paste the
 * entire migration file, do not run it in fragments" — written before anyone
 * discovered that the SQL editor truncates a long paste without saying so.
 *
 * So this generates. Counts, the migration table and the check list are read
 * from the codebase at build time. Only judgement lives in the text.
 *
 * Run: node tools/build-db-runbook.js
 */

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  Footer, PageNumber, LevelFormat, VerticalAlign,
} = require('docx');

const APP = 'C:/opservor-mvp/opservor-mvp';
const OUT = 'C:/Users/ahsan/Documents/TeraSpheres_Archive/Database';
fs.mkdirSync(OUT, { recursive: true });

const PAGE_W = 12240, M_L = 1296, M_R = 1296;
const CONTENT = PAGE_W - M_L - M_R;

const INK = '1A2432', BODY = '333F52', SOFT = '6B7787', RULE = 'D4DBE4';
const BLUE = '0EA5E9', SUN = 'FFA940', RED = 'F87171', DEEP = '0F172A';
const FONT = 'Segoe UI', MONO = 'Consolas';

/* ---------- facts, read rather than typed ---------- */

const migFiles = fs.readdirSync(path.join(APP, 'supabase/migrations'))
  .filter((f) => /^\d{4}_/.test(f)).sort();

const allSql = migFiles
  .map((f) => fs.readFileSync(path.join(APP, 'supabase/migrations', f), 'utf8'))
  .join('\n');

const TABLES = [...new Set(
  [...allSql.matchAll(/create table (?:if not exists )?(?:public\.)?([a-z_]+)/g)].map((m) => m[1])
)].sort();

const CHECKS = [...new Set(
  [...allSql.matchAll(/function (guardian_check_[a-z_]+)/g)].map((m) => m[1])
)].sort();

const RUNME = fs.readdirSync(path.join(APP, 'supabase/migrations'))
  .filter((f) => /^RUN_ME|^VERIFY/.test(f)).sort();

/** Size of each migration, because that is now an operational fact. */
const PASTE_LIMIT = 4300;
const OVERSIZE = migFiles
  .map((f) => [f, fs.statSync(path.join(APP, 'supabase/migrations', f)).size])
  .filter(([, size]) => size > PASTE_LIMIT);

const MIG_NOTES = {
  '0001': 'Core: company, app_user, alert, kpi_snapshot, category_score',
  '0002': 'Warehouse', '0003': 'Fleet', '0004': 'Inventory',
  '0005': 'Finance', '0006': 'Workforce',
  '0007': 'Movement-to-stock trigger, plus historical backfill',
  '0008': 'Safety and Reports',
  '0009': 'Tenant scoping everywhere; fleet mileage derived from trips',
  '0010': 'Fleet maintenance', '0011': 'Per-module totals',
  '0012': 'Report aggregates', '0013': 'Integration connections and identity map',
  '0014': 'Roles and module access', '0015': 'Guardian findings and the first check',
  '0016': 'Capacity clash check', '0017': 'Findings grouped by supplier',
  '0018': 'Single-item wording', '0019': 'Closed a read leak on findings',
  '0020': 'Encrypted credential storage', '0021': 'Guardian reports what it could not check',
  '0022': 'Depot on the vehicle', '0023': 'Capacity analysis split out',
  '0024': 'Capacity check rewritten to use the depot',
};

const MIGRATIONS = migFiles.map((f) => {
  const num = f.slice(0, 4);
  const size = fs.statSync(path.join(APP, 'supabase/migrations', f)).size;
  return [
    f.replace(/\.sql$/, ''),
    MIG_NOTES[num] || f.replace(/^\d{4}_/, '').replace(/\.sql$/, '').replace(/_/g, ' '),
    size > PASTE_LIMIT ? 'split' : 'one paste',
  ];
});

const TODAY = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/* ---------- builders ---------- */

const t = (text, o = {}) => new TextRun({ text, font: FONT, ...o });
const mono = (text, o = {}) => new TextRun({ text, font: MONO, size: 18, color: BODY, ...o });

const P = (text, o = {}) => new Paragraph({
  children: typeof text === 'string' ? [t(text, { size: 21, color: BODY })] : text,
  spacing: { after: 140, line: 282 }, ...o,
});

const H1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1, keepNext: true, pageBreakBefore: true,
  children: [t(text, { size: 38, bold: true, color: INK })],
  spacing: { after: 240 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: BLUE, space: 8 } },
});

const H2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2, keepNext: true,
  children: [t(text, { size: 26, bold: true, color: INK })],
  spacing: { before: 300, after: 130 },
});

const BUL = (text) => new Paragraph({
  numbering: { reference: 'bul', level: 0 },
  children: typeof text === 'string' ? [t(text, { size: 21, color: BODY })] : text,
  spacing: { after: 80, line: 282 },
});

const NUM = (text) => new Paragraph({
  numbering: { reference: 'num', level: 0 },
  children: [t(text, { size: 21, color: BODY })],
  spacing: { after: 80, line: 282 },
});

const SPACER = (h = 200) => new Paragraph({ children: [t('')], spacing: { after: h }, keepNext: true });

const CALL = (label, text, accent = SUN) => new Table({
  columnWidths: [CONTENT], width: { size: CONTENT, type: WidthType.DXA },
  borders: {
    top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE },
    insideVertical: { style: BorderStyle.NONE },
    left: { style: BorderStyle.SINGLE, size: 18, color: accent },
  },
  rows: [new TableRow({ cantSplit: true, children: [new TableCell({
    width: { size: CONTENT, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: 'F7F9FB' },
    margins: { top: 140, bottom: 140, left: 200, right: 200 },
    children: [
      new Paragraph({ children: [t(label.toUpperCase(), { size: 16, bold: true, color: accent, characterSpacing: 30 })], spacing: { after: 70 } }),
      new Paragraph({ children: [t(text, { size: 20, color: BODY })], spacing: { line: 290 } }),
    ],
  })] })],
});

function tbl(headers, rows, widths, opts = {}) {
  const sum = widths.reduce((a, x) => a + x, 0);
  if (sum !== CONTENT) throw new Error(`widths sum to ${sum}, need ${CONTENT}`);
  const hdr = new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: DEEP },
    margins: { top: 88, bottom: 88, left: 130, right: 130 },
    children: [new Paragraph({ children: [t(h, { size: 17, bold: true, color: 'FFFFFF', characterSpacing: 16 })] })],
  })) });
  const bodyRows = rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((cell, i) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: ri % 2 ? 'F4F6F9' : 'FFFFFF' },
    margins: { top: 76, bottom: 76, left: 130, right: 130 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ children: [
      String(cell) === 'split'
        ? t('split', { size: 19, bold: true, color: SUN })
        : (opts.monoCols && opts.monoCols.includes(i) ? mono(String(cell)) : t(String(cell), { size: 19, color: BODY })),
    ] })],
  })) }));
  return new Table({
    columnWidths: widths, width: { size: CONTENT, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [hdr, ...bodyRows],
  });
}

/* ---------- content ---------- */

const b = [];

b.push(
  new Paragraph({ children: [t('TERASPHERES', { size: 17, bold: true, color: SOFT, characterSpacing: 60 })], spacing: { after: 40 } }),
  new Paragraph({ children: [t('Database', { size: 48, bold: true, color: INK })], spacing: { after: 20 } }),
  new Paragraph({ children: [t('Operations Runbook', { size: 30, color: '4A5A68' })], spacing: { after: 160 } }),
  new Paragraph({ children: [t(`Version 1.3  ·  ${TODAY}`, { size: 19, color: SOFT })], spacing: { after: 40 } }),
  new Paragraph({
    children: [t(`PostgreSQL 15 · Supabase managed · ${TABLES.length} tables · ${migFiles.length} migrations`, { size: 19, color: SOFT })],
    spacing: { after: 300 },
  }),
  P('Operational procedure for the Opservor HQ database: how migrations are applied, what '
    + 'goes wrong when they are, how tenant isolation is verified, and what to check when '
    + 'something looks wrong.'),
  P([t('Counts, the migration table and the check list in this document are read from the '
      + 'codebase when it is generated. Version 1.2 was written by hand and said 21 tables '
      + 'when there were 32.', { size: 21, color: BODY, italics: true })]),
);

/* 1 — applying a migration */
b.push(
  H1('1  Applying a migration'),
  P('Migrations are plain SQL files in supabase/migrations, numbered in order. They are '
    + 'not applied automatically — a deploy ships code, never schema. Applying is a '
    + 'deliberate manual step through the Supabase SQL Editor.'),

  CALL('This replaces the instruction in version 1.2',
    'That version said: paste the entire migration file, do not run it in fragments. That '
    + 'is wrong and it costs hours. The SQL Editor truncates a long paste and says nothing '
    + 'about it. Measured on 15 August 2026: a 5,728-character file was cut off at 4,353 '
    + 'characters; a 3,367-character file arrived intact.',
    RED),

  H2('1.1  Why the truncation is worse than it sounds'),
  P('A paste that arrives short does not fail where it was cut. It fails wherever the '
    + 'missing text was needed — which is usually somewhere confusing.'),
  BUL('A DO block that loses its closing $$ reports "unterminated dollar-quoted string". '
    + 'That points at the quoting, not at the length, and sends you reading the wrong part '
    + 'of the file.'),
  BUL('A statement cut mid-clause reports "syntax error at end of input", which reads like '
    + 'a typo in SQL somebody else wrote.'),
  BUL('Worst of all, a file whose verification query survives but whose inserts did not '
    + 'reports success. An empty result grid looks exactly like a clean run.'),

  H2('1.2  Procedure'),
  NUM('Check the file size first. Anything over about 3,000 characters should be split '
    + 'before it is pasted, not after it fails.'),
  NUM('Open the SQL Editor and start a new query. Do not append to a tab that already has '
    + 'statements in it — running it re-runs everything above.'),
  NUM('Paste, then scroll to the bottom of the editor and confirm the last line matches the '
    + 'last line of the file. This is the only reliable check that the paste is complete.'),
  NUM('Run, and read the result grid. Every migration ends with a verification query.'),
  NUM('Confirm the expected values. Not merely that it succeeded.'),

  H2('1.3  Writing migrations so this hurts less'),
  BUL('Prefer plain statements over DO blocks. A short paste then fails on the statement it '
    + 'actually lost, rather than on the quoting of a block that spans the whole file.'),
  BUL('Keep files under 3,000 characters. Split into numbered parts where a function is '
    + 'genuinely too large — a function definition cannot be pasted in halves, so the split '
    + 'has to be into separate functions.'),
  BUL('Trim comments hard. In both observed failures the bulk of the file was explanation, '
    + 'not SQL. Reasoning belongs in the repository copy; the pasted copy should be lean.'),
  BUL('End every file with a verification query that returns a row saying it did NOT work, '
    + 'rather than returning no rows. "Success. No rows returned" reads as success and is '
    + 'how a failed seed was mistaken for a working one.'),
);

/* 2 — the migrations */
b.push(
  H1('2  The migrations'),
  P(`${MIGRATIONS.length} numbered migrations define the schema. They are applied in order `
    + 'and never edited after the fact. The third column is measured from the file: anything '
    + `over ${PASTE_LIMIT.toLocaleString()} characters cannot be pasted in one go.`),
  SPACER(120),
  tbl(['Migration', 'Adds', 'Paste'], MIGRATIONS, [3000, 5448, 1200], { monoCols: [0] }),
  SPACER(280),

  H2('2.1  Files that must be split'),
  OVERSIZE.length
    ? P(OVERSIZE.map(([f, s]) => `${f} (${s.toLocaleString()} chars)`).join('; ') + '.')
    : P('None currently exceed the paste limit.'),

  H2('2.2  Helper scripts'),
  P('Combined RUN_ME files exist for applying several migrations in one pass, and are '
    + 'written to be safely re-runnable: policies are dropped before being created, because '
    + 'PostgreSQL has no CREATE POLICY IF NOT EXISTS. Each preflights its dependencies and '
    + 'raises a clear exception if a prerequisite is missing.'),
  P('Present in the directory: ' + (RUNME.length ? RUNME.join(', ') : 'none') + '.'),
);

/* 3 — traps */
b.push(
  H1('3  Traps that have already caught us'),
  P('Each of these cost real time. They are recorded so they cost it once.'),

  H2('3.1  The SQL Editor has no signed-in user'),
  P('Functions declared SECURITY INVOKER resolve the tenant from auth.uid(). In the SQL '
    + 'Editor there is no session, so auth_company_id() returns null and the function '
    + 'returns nothing. That is the function working correctly, not failing. Run checks from '
    + 'the application, not from the editor.'),

  H2('3.2  ON CONFLICT needs a constraint that exists'),
  P('Migration 0009 dropped the global unique constraint on inventory_sku.sku and replaced '
    + 'it with one on (company_id, sku). Any statement using "on conflict (sku)" therefore '
    + 'matches no constraint and fails outright with 42P10. Read the schema as it is now, '
    + 'not as the migration that created the table left it.'),

  H2('3.3  Triggers make order matter'),
  P('Migration 0007 keeps inventory_sku.quantity_on_hand in step with the movement ledger '
    + 'by trigger. Seeding a stock level and then inserting ninety days of outbound '
    + 'movements drives the level far negative — 28 on hand less 630 shipped is -602. Set '
    + 'levels after the ledger, never before it. The stockout check ignores anything below '
    + 'zero, so the symptom is silence rather than an error.'),

  H2('3.4  A silent absence is not a clean result'),
  P('This is the same fault three times over, and the reason for the readiness function. A '
    + 'check that returns zero because it could not identify the tenant looks identical to '
    + 'one that looked and found nothing. A verification query that returns no rows looks '
    + 'identical to success. Whenever a query can be empty for two different reasons, make '
    + 'it say which.'),
  CALL('The rule',
    'A tool whose entire job is to say what is wrong must never go quiet when the broken '
    + 'thing is the tool.',
    BLUE),
);

/* 4 — verifying */
b.push(
  H1('4  Verifying the database'),

  H2('4.1  Tenant isolation'),
  P(`All ${TABLES.length} tables have row-level security enabled and a tenant policy. Two `
    + 'checks are worth running after any migration that touches policies:'),
  BUL('No policy should exist with cmd = ALL where the four operations differ. FOR ALL is '
    + 'one rule pretending to be four, and it governs SELECT and DELETE by its USING clause '
    + '— which is how a read leak reached production and was closed in 0019.'),
  BUL('integration_credential has row-level security enabled and deliberately no policy at '
    + 'all, so the browser role reads nothing. An audit that counts policies will report it '
    + 'as unprotected; it is the opposite.'),

  H2('4.2  Guardian'),
  P('Checks present: ' + (CHECKS.length ? CHECKS.join(', ') : 'none') + '.'),
  P('guardian_readiness() reports what each check needs and whether it has it. Run from the '
    + 'application it returns a row per check; run from the SQL Editor it correctly reports '
    + 'that the account is not linked, for the reason in section 3.1.'),

  H2('4.3  Read-only inspection'),
  P('VERIFY_all_tables.sql reports the state of the whole schema without modifying '
    + 'anything, and is safe to run at any time.'),
);

/* 5 — credentials and backup */
b.push(
  H1('5  Credentials and recovery'),

  H2('5.1  Where secrets live'),
  BUL('Application secrets are held in Vercel environment variables. The repository '
    + 'contains .env.example only.'),
  BUL('Customer integration tokens are encrypted at rest in integration_credential and '
    + 'decrypted only inside the sync route, for the length of one request. They are never '
    + 'written to a log, a summary or an error message — a provider returning 401 will often '
    + 'echo the token back in its own error body, so provider errors are translated rather '
    + 'than forwarded.'),
  BUL('The integration key and the service role key exist in Vercel and nowhere else. '
    + 'Neither belongs in a document, a chat or a screenshot.'),

  H2('5.2  Backups'),
  P('Supabase takes automated backups on the managed plan. Before any migration that drops '
    + 'or rewrites a policy, take a manual snapshot from the dashboard — restoring is far '
    + 'cheaper than reconstructing a policy set from memory.'),

  H2('5.3  If a login stops working'),
  P('A login with no app_user row can still authenticate but belongs to no company, so '
    + 'every screen comes up empty and every check returns nothing. The signature is the '
    + 'sidebar showing an email address where a name should be. REPAIR_my_login.sql in '
    + 'supabase/seed puts the record back.'),
);

/* revision history */
b.push(
  H1('Appendix  Revision history'),
  tbl(['Version', 'Date', 'Change'], [
    ['1.2', '25 July 2026', 'Hand-written. Recorded 21 tables and migrations 0001 to 0008.'],
    ['1.3', TODAY,
      'Generated rather than typed, after 1.2 was found claiming 21 tables against 32 and '
      + 'eight migrations against ' + migFiles.length + '. The instruction to paste whole '
      + 'files was removed — it is the direct cause of several lost hours — and replaced '
      + 'with the measured limit and a procedure that survives it. Traps section added, '
      + 'recording five failures that had already happened.'],
  ], [1300, 1800, 6548]),
);

/* ---------- document ---------- */

const doc = new Document({
  creator: 'TeraSpheres',
  title: 'Opservor Database Operations Runbook v1.3',
  numbering: {
    config: [
      { reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 420, hanging: 240 } } } }] },
      { reference: 'num', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 420, hanging: 240 } } } }] },
    ],
  },
  sections: [{
    properties: { page: { size: { width: PAGE_W, height: 15840 }, margin: { top: 1440, bottom: 1440, left: M_L, right: M_R } } },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: ['Opservor Database Runbook v1.3   ·   ', PageNumber.CURRENT], size: 16, color: SOFT, font: FONT })],
      })] }),
    },
    children: b,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  const file = path.join(OUT, 'Opservor_Database_Runbook_v1.3.docx');
  fs.writeFileSync(file, buf);
  console.log('  ' + file);
  console.log(`  ${(buf.length / 1024).toFixed(1)} KB · ${TABLES.length} tables · ${migFiles.length} migrations · ${CHECKS.length} checks · ${OVERSIZE.length} oversize`);
});
