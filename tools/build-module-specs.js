/* Opservor — Module Specifications
 *
 * Version 1.2 was written by hand on 25 July and covers the seven original
 * modules. It has no section for Guardian and none for Integrations, because
 * neither existed. It also predates every column added by ALTER since.
 *
 * So the schema is read out of the migrations instead: tables from CREATE,
 * later columns from ALTER, each attributed to the migration that added it.
 * A hand-typed schema is a promise to keep retyping it, and that promise is
 * always broken.
 *
 * What stays typed is judgement — what a module is for, what its interface can
 * actually do, and what is missing. Those cannot be derived and should not be
 * guessed.
 *
 * Run: node tools/build-module-specs.js
 */

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  Footer, PageNumber, LevelFormat, VerticalAlign,
} = require('docx');

const APP = 'C:/opservor-mvp/opservor-mvp';
const OUT = 'C:/Users/ahsan/Documents/TeraSpheres_Archive/Module_Specs';
fs.mkdirSync(OUT, { recursive: true });

const PAGE_W = 12240, M_L = 1296, M_R = 1296;
const CONTENT = PAGE_W - M_L - M_R;
const INK = '1A2432', BODY = '333F52', SOFT = '6B7787', RULE = 'D4DBE4';
const BLUE = '0EA5E9', SUN = 'FFA940', DEEP = '0F172A';
const FONT = 'Segoe UI', MONO = 'Consolas';

/* ---------- schema, read from the migrations ---------- */

const migDir = path.join(APP, 'supabase/migrations');
const migFiles = fs.readdirSync(migDir).filter((f) => /^\d{4}_/.test(f)).sort();

/** table -> { cols: [{name, addedBy}], mig } */
const SCHEMA = {};

for (const f of migFiles) {
  const sql = fs.readFileSync(path.join(migDir, f), 'utf8');
  const mig = f.replace(/\.sql$/, '');

  for (const m of sql.matchAll(/create table (?:if not exists )?(?:public\.)?([a-z_]+)\s*\(([\s\S]*?)\n\);/g)) {
    const cols = m[2].split('\n').map((l) => l.trim())
      .filter((l) => l && !/^(--|constraint|unique|primary key|check|foreign key)/i.test(l))
      .map((l) => l.split(/\s+/)[0].replace(/,$/, ''))
      .filter((c) => /^[a-z_]+$/.test(c))
      .map((name) => ({ name, addedBy: mig }));
    SCHEMA[m[1]] = { cols, mig };
  }

  // Columns added later. Version 1.2 could not have shown these because it was
  // written before any of them, and a schema document that stops at CREATE is
  // wrong the first time anyone runs an ALTER.
  for (const m of sql.matchAll(/alter table (?:only )?(?:public\.)?([a-z_]+)\s+add column (?:if not exists )?([a-z_]+)/gi)) {
    const [, table, col] = m;
    if (SCHEMA[table] && !SCHEMA[table].cols.some((c) => c.name === col)) {
      SCHEMA[table].cols.push({ name: col, addedBy: mig });
    }
  }
}

const MODULES = [
  ['Warehouse',    'warehouse',  'Sites and daily shift productivity. Dock utilisation, orders processed and pending, per site per shift.'],
  ['Fleet',        'fleet',      'Vehicle registry, trip log, and the service work booked against each vehicle.'],
  ['Inventory',    'inventory',  'SKU master and the movement ledger. Stock on hand is derived from movements by trigger, not typed.'],
  ['Finance',      'finance',    'Cost centres and the revenue and expense ledger.'],
  ['Workforce',    'hr',         'Departments, employees and attendance capture.'],
  ['Safety',       'safety',     'Incident capture with severity, inspections, and corrective actions.'],
  ['Reports',      'report',     'Cross-module period reporting with a logged run history.'],
  ['Guardian',     'guardian',   'Findings computed over the tenant’s own history. Not a module in the operational sense — it reads the others and writes nothing back to them.'],
  ['Integrations', 'integration','Connections to outside systems, the identity map that stops a second sync duplicating a fleet, and encrypted credential storage.'],
];

const CORE = Object.keys(SCHEMA)
  .filter((t) => !MODULES.some(([, prefix]) => t.startsWith(prefix + '_') || t === prefix))
  .sort();

/** Screens that exist, so "interface" is observed rather than claimed. */
const PAGES = (() => {
  const dir = path.join(APP, 'src/app/(dashboard)');
  try { return fs.readdirSync(dir).filter((d) => !/\.|\[/.test(d)).sort(); }
  catch { return []; }
})();

const CONNECTORS = fs.readdirSync(path.join(APP, 'src/lib/connectors'))
  .filter((f) => f.endsWith('.ts') && !/^(index|types|sync)\.ts$/.test(f))
  .map((f) => f.replace(/\.ts$/, '')).sort();

const TOTAL_TABLES = Object.keys(SCHEMA).length;
const TODAY = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/* ---------- builders ---------- */

const t = (text, o = {}) => new TextRun({ text, font: FONT, ...o });
const mono = (text, o = {}) => new TextRun({ text, font: MONO, size: 17, color: BODY, ...o });

const P = (text, o = {}) => new Paragraph({
  children: typeof text === 'string' ? [t(text, { size: 21, color: BODY })] : text,
  spacing: { after: 140, line: 282 }, ...o,
});
const H1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1, keepNext: true, pageBreakBefore: true,
  children: [t(text, { size: 36, bold: true, color: INK })],
  spacing: { after: 220 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: BLUE, space: 8 } },
});
const H2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2, keepNext: true,
  children: [t(text, { size: 24, bold: true, color: INK })],
  spacing: { before: 280, after: 120 },
});
const BUL = (text) => new Paragraph({
  numbering: { reference: 'bul', level: 0 },
  children: typeof text === 'string' ? [t(text, { size: 21, color: BODY })] : text,
  spacing: { after: 80, line: 282 },
});
const SPACER = (h = 180) => new Paragraph({ children: [t('')], spacing: { after: h }, keepNext: true });

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
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: [t(h, { size: 16, bold: true, color: 'FFFFFF', characterSpacing: 14 })] })],
  })) });
  const bodyRows = rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((cell, i) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: ri % 2 ? 'F4F6F9' : 'FFFFFF' },
    margins: { top: 68, bottom: 68, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ children: [
      opts.monoCols && opts.monoCols.includes(i) ? mono(String(cell)) : t(String(cell), { size: 18, color: BODY }),
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
  new Paragraph({ children: [t('Opservor', { size: 48, bold: true, color: INK })], spacing: { after: 20 } }),
  new Paragraph({ children: [t('Module Specifications', { size: 30, color: '4A5A68' })], spacing: { after: 160 } }),
  new Paragraph({ children: [t(`Version 1.3  ·  ${TODAY}`, { size: 19, color: SOFT })], spacing: { after: 40 } }),
  new Paragraph({
    children: [t(`${MODULES.length} modules · ${TOTAL_TABLES} tables · ${migFiles.length} migrations`, { size: 19, color: SOFT })],
    spacing: { after: 300 },
  }),
);

b.push(
  H1('1  Purpose and how to read this'),
  P('The data model for each module, with the tables it owns, the columns on them, and the '
    + 'migration that introduced each.'),
  P('The schema in this document is read out of the migrations when it is generated, '
    + 'including columns added later by ALTER. Version 1.2 was typed by hand, covered seven '
    + 'modules, and had no section for Guardian or Integrations because neither existed when '
    + 'it was written.'),

  CALL('What is derived and what is judgement',
    'Tables, columns and the migration each came from are read from the codebase and cannot '
    + 'drift. What a module is for, what its interface can actually do, and what is missing '
    + 'are written by hand — those cannot be derived, and guessing them would be worse than '
    + 'leaving them out.',
    BLUE),

  H2('1.1  Principles that apply everywhere'),
  BUL('Every table carries company_id and is scoped by row-level security. There is no '
    + 'unscoped table.'),
  BUL('State tables carry created_at, updated_at and an update trigger. Ledger tables carry '
    + 'created_at only, because a ledger row that changes is not a ledger.'),
  BUL('Derived values are derived. Stock on hand follows the movement ledger by trigger; '
    + 'vehicle mileage accumulates from trips. Neither is typed in, and seeding one before '
    + 'its source produces a number that is wrong in a direction nothing checks.'),
  BUL('Aggregate tables exist for five modules and nothing writes to them. Figures are '
    + 'computed from raw rows on read.'),

  H2('1.2  Screens'),
  P('Present under the dashboard: ' + (PAGES.length ? PAGES.join(', ') : 'none') + '.'),
);

/* per module */
let n = 2;
for (const [name, prefix, purpose] of MODULES) {
  const tables = Object.keys(SCHEMA)
    .filter((t) => t.startsWith(prefix + '_') || t === prefix).sort();
  if (!tables.length) continue;

  b.push(H1(`${n}  ${name}`), P(purpose));

  for (const table of tables) {
    const { cols, mig } = SCHEMA[table];
    const later = cols.filter((c) => c.addedBy !== mig);
    b.push(
      H2(table),
      P([
        t('Created by ', { size: 20, color: SOFT }),
        mono(mig, { size: 18 }),
        t(`  ·  ${cols.length} columns`, { size: 20, color: SOFT }),
      ]),
      SPACER(80),
      tbl(['Column', 'Added by'],
        cols.map((c) => [c.name, c.addedBy === mig ? '—' : c.addedBy]),
        [3400, 6248], { monoCols: [0, 1] }),
      SPACER(200),
    );
    if (later.length) {
      b.push(P(`Added after the table was created: ${later.map((c) => c.name).join(', ')}.`));
    }
  }
  n++;
}

/* core */
b.push(
  H1(`${n}  Core`),
  P('Tables that belong to no module: the tenant itself, its people, and the shared '
    + 'scoring and alerting surfaces.'),
);
for (const table of CORE) {
  const { cols, mig } = SCHEMA[table];
  b.push(
    H2(table),
    P([t('Created by ', { size: 20, color: SOFT }), mono(mig, { size: 18 }),
       t(`  ·  ${cols.length} columns`, { size: 20, color: SOFT })]),
    SPACER(80),
    tbl(['Column', 'Added by'],
      cols.map((c) => [c.name, c.addedBy === mig ? '—' : c.addedBy]),
      [3400, 6248], { monoCols: [0, 1] }),
    SPACER(200),
  );
}
n++;

/* integrations detail */
b.push(
  H1(`${n}  Integration adapters`),
  P(`${CONNECTORS.length} adapters are written: ${CONNECTORS.join(', ')}. Each translates `
    + 'its own system into one shared shape, so nothing downstream knows where a record came '
    + 'from.'),
  P('None has been run against a live account. The connections screen states that on each '
    + 'of them rather than leaving it to be found out.'),
  P('Telematics systems supply vehicles and trips. They cannot supply scheduled maintenance '
    + '— their maintenance endpoints report inspections and fault codes, which is a vehicle '
    + 'broken now rather than a vehicle booked in for a date. Scheduled work comes from a '
    + 'maintenance system, which is why the fourth adapter is not a fourth telematics box.'),
);
n++;

b.push(
  H1('Appendix  Revision history'),
  tbl(['Version', 'Date', 'Change'], [
    ['1.2', '25 July 2026', 'Hand-written. Seven modules, twenty-one tables, no Guardian and '
      + 'no Integrations sections.'],
    ['1.3', TODAY,
      `Generated from the migrations. ${MODULES.length} modules and ${TOTAL_TABLES} tables, `
      + 'including Guardian and Integrations. Columns added by ALTER are now shown and '
      + 'attributed — a schema document that stops at CREATE is wrong the first time anyone '
      + 'alters a table, which had already happened.'],
  ], [1300, 1800, 6548]),
);

/* ---------- document ---------- */

const doc = new Document({
  creator: 'TeraSpheres',
  title: 'Opservor Module Specifications v1.3',
  numbering: {
    config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022',
      alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 420, hanging: 240 } } } }] }],
  },
  sections: [{
    properties: { page: { size: { width: PAGE_W, height: 15840 }, margin: { top: 1440, bottom: 1440, left: M_L, right: M_R } } },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: ['Opservor Module Specifications v1.3   ·   ', PageNumber.CURRENT], size: 16, color: SOFT, font: FONT })],
      })] }),
    },
    children: b,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  const file = path.join(OUT, 'Opservor_Module_Specifications_v1.3.docx');
  fs.writeFileSync(file, buf);
  console.log('  ' + file);
  console.log(`  ${(buf.length / 1024).toFixed(1)} KB · ${TOTAL_TABLES} tables · ${CORE.length} core · ${MODULES.length} modules`);
});
