/* TS-PROD-001 — Product Architecture
   Transcribed from the codebase, not from the specification and not from the
   website. Where the two disagree, this document records the disagreement
   rather than resolving it in the product's favour. */

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  Header, Footer, PageNumber, TableOfContents, ImageRun,
  LevelFormat, VerticalAlign,
} = require('docx');

const SITE = 'C:/opservor-mvp/teraspheres-website';
const APP  = 'C:/opservor-mvp/opservor-mvp';
const OUT  = 'C:/Users/ahsan/Documents/TeraSpheres_Archive/Codex';
fs.mkdirSync(OUT, { recursive: true });

const PAGE_W = 12240, PAGE_H = 15840;
const M_TOP = 1440, M_BOT = 1440, M_L = 1296, M_R = 1296;
const CONTENT = PAGE_W - M_L - M_R;

const C = { blue: '0EA5E9', cyan: '22D3EE', sun: 'FFA940', green: '34D399',
            red: 'F87171', deep: '0F172A' };
const INK = '1A2432', BODY = '333F52', SOFT = '6B7787', RULE = 'D4DBE4';
const FONT = 'Segoe UI', MONO = 'Consolas';

const t = (text, o = {}) => new TextRun({ text, font: FONT, ...o });
const mono = (text, o = {}) => new TextRun({ text, font: MONO, size: 18, color: BODY, ...o });

const P = (text, o = {}) => new Paragraph({
  children: typeof text === 'string' ? [t(text, { size: 21, color: BODY })] : text,
  spacing: { after: 140, line: 282 }, ...o,
});
const LEAD = (text) => new Paragraph({
  children: [t(text, { size: 24, color: INK })], spacing: { after: 210, line: 312 },
});
const H1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1, keepNext: true, pageBreakBefore: true,
  children: [t(text, { size: 40, bold: true, color: INK })],
  spacing: { before: 0, after: 240 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.blue, space: 8 } },
});
const H2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2, keepNext: true,
  children: [t(text, { size: 28, bold: true, color: INK })],
  spacing: { before: 300, after: 130 },
});
const H3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3, keepNext: true,
  children: [t(text, { size: 23, bold: true, color: '2C3A4E' })],
  spacing: { before: 230, after: 100 },
});
const BUL = (text, o = {}) => new Paragraph({
  numbering: { reference: 'bul', level: 0 },
  children: typeof text === 'string' ? [t(text, { size: 21, color: BODY })] : text,
  spacing: { after: 80, line: 282 }, ...o,
});
const NUM = (text) => new Paragraph({
  numbering: { reference: 'num', level: 0 },
  children: typeof text === 'string' ? [t(text, { size: 21, color: BODY })] : text,
  spacing: { after: 80, line: 282 },
});
const SPACER = (h = 200) => new Paragraph({ children: [t('')], spacing: { after: h }, keepNext: true });
const RULE_P = () => new Paragraph({
  children: [t('')], spacing: { before: 60, after: 200 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 2 } },
});

const CALL = (label, text, accent = C.sun) => new Table({
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
      new Paragraph({ children: [t(text, { size: 20, color: BODY })], spacing: { after: 0, line: 290 } }),
    ],
  })] })],
});

function tbl(headers, rows, widths, opts = {}) {
  const sum = widths.reduce((a, x) => a + x, 0);
  if (sum !== CONTENT) throw new Error(`widths sum to ${sum}, need ${CONTENT}`);
  const TONE = { yes: C.green, no: C.red, part: C.sun };
  const hdr = new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: C.deep },
    margins: { top: 88, bottom: 88, left: 130, right: 130 },
    children: [new Paragraph({ children: [t(h, { size: 17, bold: true, color: 'FFFFFF', characterSpacing: 16 })] })],
  })) });
  const bodyRows = rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((cell, i) => {
    const s = String(cell);
    const tone = opts.toneCol === i ? TONE[s.toLowerCase().startsWith('yes') ? 'yes'
      : s.toLowerCase().startsWith('no') ? 'no'
      : s.toLowerCase().startsWith('partial') ? 'part' : null] : null;
    return new TableCell({
      width: { size: widths[i], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: ri % 2 ? 'F4F6F9' : 'FFFFFF' },
      margins: { top: 76, bottom: 76, left: 130, right: 130 },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ children: [
        tone ? t(s, { size: 19, bold: true, color: tone })
          : (opts.monoCols && opts.monoCols.includes(i) ? mono(s) : t(s, { size: 19, color: BODY })),
      ] })],
    });
  }) }));
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

const img = (file, w, h, align = AlignmentType.LEFT) => new Paragraph({
  alignment: align, spacing: { before: 120, after: 120 },
  children: [new ImageRun({ type: 'png', data: fs.readFileSync(path.join(SITE, file)),
    transformation: { width: w, height: h } })],
});

/* ---------- facts read from the codebase ---------- */

const migFiles = fs.readdirSync(path.join(APP, 'supabase/migrations'))
  // Was /^000\d_/, which matched 0001 to 0009 and silently ignored every
  // migration from 0010 onward — fleet maintenance, integrations, roles and
  // the whole of Guardian. The table reference in version 1.0 was incomplete
  // for that reason and nobody noticed, because a short list still looks like
  // a list.
  .filter(f => /^\d{4}_/.test(f)).sort();

/* What each migration is for, in a sentence.
 *
 * Version 1.1 listed eight migrations in a hand-written table. There were
 * twenty-four by the time anyone looked. A typed list of a growing thing is a
 * promise to keep updating it, and that promise is always broken — so the rows
 * are generated from the directory and only the wording lives here. A
 * migration with no note still appears, named after its own filename, which is
 * wrong in a visible way rather than absent in an invisible one. */
const MIG_NOTES = {
  '0001': 'Core: company, app_user, alert, kpi_snapshot, category_score. Helper functions.',
  '0002': 'Warehouse',
  '0003': 'Fleet',
  '0004': 'Inventory',
  '0005': 'Finance',
  '0006': 'Workforce',
  '0007': 'Movement-to-stock trigger, plus historical backfill',
  '0008': 'Safety and Reports',
  '0009': 'Tenant scoping across every table; fleet mileage derived from trips',
  '0010': 'Fleet maintenance: scheduled and completed service work',
  '0011': 'Per-module totals',
  '0012': 'Report aggregates',
  '0013': 'Integration connections and the external identity map',
  '0014': 'Roles and module access. Owner, manager, staff, viewer.',
  '0015': 'Guardian findings table and the first check',
  '0016': 'The capacity clash check — warehouse pressure against vehicles off the road',
  '0017': 'Findings grouped by supplier rather than one card per item',
  '0018': 'Single-item wording, so one shortage does not read as a list of one',
  '0019': 'Closed a read leak: FOR ALL is one rule pretending to be four',
  '0020': 'Encrypted credential storage, readable only by the service role',
  '0021': 'Guardian reports what it could not check, instead of implying all-clear',
  '0022': 'A depot on the vehicle, so the capacity check stops guessing from trip text',
  '0023': 'Capacity analysis split out of the check',
  '0024': 'The capacity check rewritten to use the recorded depot',
};

const MIGRATIONS = migFiles.map((f) => {
  const num = f.slice(0, 4);
  const fallback = f.replace(/^\d{4}_/, '').replace(/\.sql$/, '').replace(/_/g, ' ');
  return [f.replace(/\.sql$/, ''), MIG_NOTES[num] || fallback];
});
const allSql = migFiles.map(f => fs.readFileSync(path.join(APP, 'supabase/migrations', f), 'utf8')).join('\n');
const TABLES = [...new Set([...allSql.matchAll(/create table (?:if not exists )?(?:public\.)?([a-z_]+)/g)].map(m => m[1]))].sort();
const MODULE_OF = (n) => {
  const p = n.split('_')[0];
  return ({ warehouse: 'Warehouse', fleet: 'Fleet', inventory: 'Inventory', finance: 'Finance',
            hr: 'Workforce', safety: 'Safety', report: 'Reports',
            guardian: 'Guardian', integration: 'Integrations' })[p] || 'Core';
};
const CORE = TABLES.filter(x => MODULE_OF(x) === 'Core');
const MODULE_TABLES = TABLES.filter(x => MODULE_OF(x) !== 'Core');

const TODAY = '9 August 2026';
const ISSUED_V1 = '26 July 2026';
const ISSUED_V11 = '16 August 2026';
const b = [];

/* ---------- cover ---------- */
b.push(
  new Paragraph({ children: [t('')], spacing: { after: 1400 } }),
  new Paragraph({ children: [t('TS-PROD-001', { size: 20, bold: true, color: C.blue, characterSpacing: 80 })], spacing: { after: 200 } }),
  new Paragraph({ children: [t('Product Architecture', { size: 62, bold: true, color: INK })], spacing: { after: 40 } }),
  new Paragraph({ children: [t('Opservor HQ — what is built, and how', { size: 32, color: '5A6B82' })], spacing: { after: 280 } }),
  new Paragraph({ children: [t('')], border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: C.blue, space: 6 } }, spacing: { after: 300 } }),
  new Paragraph({
    children: [t('Transcribed from the codebase — not from the specification, and not ' +
      'from the website. Where those disagree with the code, this document records the ' +
      'disagreement rather than settling it in the product\u2019s favour.', { size: 24, color: BODY })],
    spacing: { after: 1500, line: 320 },
  }),
  img('brand/opservor-plate-512.png', 150, 150, AlignmentType.CENTER),
  new Paragraph({ children: [t('')], spacing: { after: 800 } }),
  new Paragraph({ children: [t('Volume 3 of the TeraSpheres Codex', { size: 19, color: SOFT })], spacing: { after: 60 } }),
  new Paragraph({ children: [t(`Version 1.2  ·  ${TODAY}`, { size: 19, color: SOFT })] }),
);

/* ---------- control ---------- */
b.push(
  H1('Document control'),
  tbl(['Field', 'Value'], [
    ['Document ID', 'TS-PROD-001'],
    ['Title', 'Product Architecture'],
    ['Version', '1.0'],
    ['Status', 'Active'],
    ['Issued', TODAY],
    ['Owner', 'Ahsan Ahmad, Founder'],
    ['Covers', 'Opservor HQ v1 — seven modules, ' + TABLES.length + ' tables'],
    ['Source of truth', 'The opservor-mvp repository. This document is a transcription.'],
    ['Review', 'On any migration, or any change to the tenancy model'],
  ], [2400, 7248]),
  SPACER(300),

  H2('Method'),
  P('Every table name, count and constraint in this document was extracted from the ' +
    'migration files by script at build time, not typed by hand. The module and table ' +
    'lists in Section 5 and Appendix A regenerate from the repository, so they cannot ' +
    'silently drift.'),
  P('Behavioural claims — what a module does, what Ask Opservor answers — were read from ' +
    'the source. Where the code and the marketing copy disagree, Section 2 records both.'),

  CALL('The uncomfortable section',
    'Section 2 compares what the website claims the product does against what the code ' +
    'does. They do not match. That section is the most important one in this document ' +
    'and it should be read first.',
    C.red),
);

b.push(H1('Contents'), new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2' }));

/* ---------- 1 ---------- */
b.push(
  H1('1  Purpose'),
  LEAD('A record of what Opservor actually is at v1, precise enough that someone who has ' +
       'never seen the codebase could reason about it — and honest enough to be useful ' +
       'when something goes wrong.'),

  H2('1.1  Who this is for'),
  BUL('The first engineering hire, on their first day.'),
  BUL('Anyone conducting technical due diligence.'),
  BUL('A grant or funding body asking what has been built.'),
  BUL('The founder, in twelve months, having forgotten why something was done a ' +
      'particular way.'),

  H2('1.2  The rule this document follows'),
  P('The same rule as the rest of the Codex, from TS-BRAND-001 §9: nothing is described ' +
    'as existing that does not exist. In a product document that rule has teeth, because ' +
    'the gap between the specification and the build is exactly where a due-diligence ' +
    'process looks.'),
  P('Capability that is designed but not built appears in Section 11, in the future ' +
    'tense, and nowhere else.'),
);

/* ---------- 2 THE BIG ONE ---------- */
b.push(
  H1('2  Built, and not built'),
  LEAD('The website describes capability the code does not have. This section states the ' +
       'position plainly so that nobody — an investor, a customer, a new engineer — ' +
       'discovers it by surprise.'),

  H2('2.1  The comparison'),
  tbl(['Capability', 'Website says', 'Built?'], [
    ['Eight operational modules', 'Live', 'Yes'],
    ['Multi-tenant isolation in the database', 'Enforced in the database', 'Yes'],
    ['Roles and per-module permissions', 'Not claimed on the site', 'Yes'],
    ['Business Health Score', 'Composite operational score', 'Yes'],
    ['Guardian findings from real arithmetic', 'Shown on the site with its working', 'Yes'],
    ['Guardian reading across two modules at once', 'Shown on the site', 'Yes'],
    ['Spreadsheet import from any system', 'A trial needs only an export', 'Yes'],
    ['Cross-module reporting', 'Custom reporting', 'Partial'],
    ['Ask Opservor Q&A', 'Conversational insight', 'Partial'],
    ['Alerts', 'Real-time alerts, surfaced the moment they occur', 'Partial'],
    ['Guardian watches continuously', 'Stated as present fact', 'No'],
    ['Guardian learns from actions taken', 'Stated as present fact', 'No'],
    ['Guardian predicts and forecasts', 'Stated as present fact', 'No'],
    ['Predictive analytics', 'Stated as present fact', 'No'],
    ['Scheduled report delivery', 'Schedule it to arrive', 'No'],
    ['Live ERP / TMS / WMS / telematics connections', 'Connects to what is running', 'No'],
  ], [3900, 3648, 2100], { toneCol: 2 }),
  SPACER(280),

  H2('2.2  What "partial" means in each case'),
  H3('Cross-module reporting'),
  P('Report definitions and report runs are real: a definition can be created, a run ' +
    'recorded, and the reports interface reads across finance, fleet, workforce and ' +
    'inventory. What does not exist is scheduling, delivery, or export to any file format.'),

  H3('Ask Opservor'),
  P('Five fixed question patterns, matched by regular expression, answered from live ' +
    'database rows. It is not a language model and makes no external call. The code says ' +
    'so in its own header comment, and the fallback message shown to a user for an ' +
    'unmatched question ends with the words "live AI-powered Q&A is coming in v2".'),
  P('This is honest engineering and a reasonable v1. It is not what the website implies.'),

  H3('Alerts'),
  P('The alert table exists, is secured, and is read on the dashboard. Alerts are created ' +
    'by a person through a form. Nothing in the system generates an alert from a threshold, ' +
    'a trend or an anomaly — so "surfaced the moment they occur" describes a human noticing ' +
    'and typing.'),

  H2('2.3  Guardian'),
  P('At version 1.0 of this document, on ' + ISSUED_V1 + ', no component of Guardian was '
    + 'built. That has changed, and the record moves in both directions.'),

  H3('What runs now'),
  P('Three checks, in the database, over the tenant’s own history. Each produces a '
    + 'finding rather than an alert: a sentence saying what is going to happen, with the '
    + 'arithmetic that produced it attached and shown on the screen.'),
  BUL('Stockout risk. Outbound movements over ninety days give a daily rate; stock less '
    + 'what is reserved gives what is actually available; the two give days of cover, '
    + 'compared against supplier lead time. Findings group by supplier, because nobody '
    + 'orders one item at a time.'),
  BUL('Impossible stock. Items showing a negative quantity on hand, which is a records '
    + 'failure rather than a forecast, and is reported as one.'),
  BUL('Capacity clash. Dock pressure and pending orders at a site, read against the '
    + 'vehicles that have been running from it and which of those are booked for '
    + 'maintenance. The only check that reads two modules at once, and the reason the '
    + 'finding table carries an array of modules rather than a single value.'),
  P('Every finding states what it assumed. Supplier lead time is recorded nowhere, so ten '
    + 'days is used and the finding says so on screen. Which vehicles serve which site is '
    + 'now recorded on the vehicle, and each finding reports which of the two sources it '
    + 'actually used.'),

  H3('Silence was the defect'),
  P('Three faults were found and fixed after version 1.1, and they were the same fault '
    + 'wearing different clothes: the product reporting nothing when it should have '
    + 'reported that it could not tell.'),
  BUL('A refused run drew "Nothing to flag". The screen set an unavailable flag on '
    + 'failure and the reload immediately cleared it, because the table itself reads '
    + 'perfectly well — so a database that refused the checks and a depot with genuinely '
    + 'nothing wrong produced an identical screen.'),
  BUL('A check that could not identify the caller’s company returned zero. Zero means '
    + '"I looked and found nothing wrong"; a check that cannot resolve a tenant did not '
    + 'look. A sign-in with no user record was told, repeatedly and confidently, that a '
    + 'company it could not see was fine.'),
  BUL('The capacity check worked out which vehicles served which site by matching a '
    + 'trip’s starting point against a site’s name, exactly. Real trip origins are street '
    + 'addresses and geofence labels, so that match almost never succeeds — and when it '
    + 'fails, no site has a fleet and the check returns zero without a word. It had never '
    + 'fired on anything but seeded data.'),
  P('The first two are fixed on the screen and in a readiness function that reports what '
    + 'could not be checked and why. The third is fixed by recording the depot on the '
    + 'vehicle, taken from the provider’s own grouping, with the old inference kept as a '
    + 'fallback so an account without groups is no worse off than before.'),
  P('The rule this encodes, and the one worth carrying into everything built next: a tool '
    + 'whose entire job is to say what is wrong must never go quiet when the broken thing '
    + 'is the tool.'),

  H3('What still does not exist'),
  P('There is no model, no inference, no training signal, no forecasting and no '
    + 'continuous observation. The checks run when asked. Nothing learns from an action '
    + 'taken. The three present-tense claims in the table above remain unbuilt.'),
  P('The distance between three arithmetic checks that run on demand and an engine that '
    + 'watches continuously and learns is the whole of the remaining work.'),

  CALL('Decision on record',
    'Reviewed by the founder on 26 July 2026 and left as written. The position is that Guardian describes the product’s intended direction and the page will become accurate as the capability is built. That is the founder’s call and it is recorded here rather than argued. Where the wording carries different weight: in an investor deck, a grant application or a signed agreement, a present-tense capability claim is a representation rather than positioning. This section is the record of what was actually built on the date above, and exists to be checked against before those words are reused in any of those settings.',
    C.blue),
);

/* ---------- 3 ---------- */
b.push(
  H1('3  Stack'),
  tbl(['Layer', 'Choice', 'Note'], [
    ['Application', 'Next.js 14, App Router', 'Server components by default; server actions for mutations.'],
    ['Language', 'TypeScript', 'Shared types in src/lib/types.ts.'],
    ['UI', 'React 18', 'No component library. Styling is bespoke.'],
    ['Database', 'PostgreSQL 15 (Supabase)', 'Row-level security is the isolation boundary.'],
    ['Auth', 'Supabase Auth', 'Cookie session, refreshed in middleware on every request.'],
    ['Data access', '@supabase/ssr', 'Separate browser and server clients.'],
    ['Marketing site', 'Static HTML/CSS, no build step', 'Separate repository, separate host.'],
  ], [1900, 2900, 4848]),
  SPACER(280),

  H2('3.1  Why the marketing site is separate'),
  P('The website is plain HTML and CSS with a small generator script, deployed ' +
    'independently of the application. Nothing about a marketing page change can break ' +
    'the product, and nothing about a product deploy can take the site down. At this ' +
    'stage that separation costs nothing and removes a whole class of incident.'),

  H2('3.2  Environment and secrets'),
  P('No credentials are stored in either repository. Only an example environment file is ' +
    'committed. Supabase keys live in the host\u2019s environment variable store.'),
  P('The anonymous key is exposed to the browser by design; it is not a secret. It is safe ' +
    'only because row-level security is doing the work — which is why Section 4 matters ' +
    'more than any other part of this document.'),
);

/* ---------- 4 ---------- */
b.push(
  H1('4  Tenancy and security'),
  LEAD('One rule, applied without exception: a row belongs to a company, and the database ' +
       'refuses to return or accept rows belonging to any other.'),

  H2('4.1  The mechanism'),
  P('Every table carries a company_id column referencing company(id) with cascade delete. ' +
    'Row-level security is enabled on every table. Each table has a policy scoped FOR ALL ' +
    'with both a USING and a WITH CHECK clause, each testing company_id against a helper ' +
    'function.'),
  P('The helper resolves the current session to a tenant:'),
  SPACER(120),
  new Table({
    columnWidths: [CONTENT], width: { size: CONTENT, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      left: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      right: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
    },
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({
      width: { size: CONTENT, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: 'FAFBFC' },
      margins: { top: 150, bottom: 150, left: 200, right: 200 },
      children: [
        'create or replace function auth_company_id()',
        'returns uuid',
        'language sql',
        'security definer',
        'stable',
        'as $$',
        '  select company_id from app_user where auth_id = auth.uid()',
        '$$;',
      ].map(l => new Paragraph({
        children: [new TextRun({ text: l, font: MONO, size: 18, color: BODY })],
        spacing: { after: 0, line: 250 },
      })),
    })] })],
  }),
  SPACER(260),

  H2('4.2  Why WITH CHECK is not optional'),
  P('USING governs what a session may read. WITH CHECK governs what it may write. A policy ' +
    'with only USING will happily let a caller insert a row stamped with another tenant\u2019s ' +
    'company_id — it just will not be able to read it back afterwards.'),
  P('Both clauses are present on every policy. This is the single most important invariant ' +
    'in the schema, because the browser holds a key that is useless only for as long as ' +
    'this holds.'),

  H2('4.3  Coverage'),
  P(`All ${TABLES.length} tables have row-level security enabled and a tenant policy. ` +
    'Twenty-one are secured by explicit statements in their own migration; five are ' +
    'secured by a loop in migration 0008 that iterates an array of table names and ' +
    'executes the same statements dynamically.'),
  P('The loop is worth knowing about: a naive search of the migrations for "create policy" ' +
    'finds only one occurrence in 0008, because the other statements are inside a format ' +
    'string. Anyone auditing coverage by grep will conclude, wrongly, that four tables are ' +
    'unprotected.'),

  H2('4.4  The role limitation'),
  P('There is one policy per table and it grants full access — select, insert, update, ' +
    'delete — to any authenticated member of the tenant. There is no read-only role, no ' +
    'per-module scoping, and no administrative separation.'),
  P('For a single-operator product this is adequate. It stops being adequate the first ' +
    'time a customer has two employees with different authority, which will be early. ' +
    'Recorded as a defect in Section 10.'),

  H2('4.5  Authentication boundary'),
  P('Middleware runs on every request, refreshes the Supabase session cookie, and redirects ' +
    'unauthenticated requests to the login route. Authentication establishes identity; the ' +
    'database policies establish authority. The application is not trusted to enforce ' +
    'isolation and does not attempt to.'),
);

/* ---------- 5 ---------- */
b.push(
  H1('5  Data model'),

  H2('5.1  Conventions'),
  P('Five rules, applied to every table.'),
  SPACER(120),
  tbl(['Rule', 'Detail'], [
    ['Tenancy', 'company_id uuid not null references company(id) on delete cascade.'],
    ['Security', 'RLS enabled. One policy, FOR ALL, USING and WITH CHECK on company_id.'],
    ['Keys', 'uuid primary key default gen_random_uuid(). No sequences, no natural keys.'],
    ['Audit', 'State tables get created_at, updated_at and a BEFORE UPDATE trigger. ' +
              'Ledger tables get created_at only.'],
    ['Snapshots', 'Aggregate tables exist and are secured. Nothing writes to them.'],
  ], [1700, 7948]),
  SPACER(280),

  H2('5.2  Ledgers and state'),
  P('A ledger records something that happened; it should never change afterwards, so it ' +
    'has no updated_at and no update trigger. State tables describe how something is now, ' +
    'so they carry both.'),
  P('Ledgers: inventory_movement, finance_transaction, hr_attendance, report_run.'),

  CALL('Known inconsistency',
    'fleet_trip is a ledger by nature but carries updated_at and an update trigger, unlike ' +
    'the other four. It was written before the convention settled. Harmless in itself, but ' +
    'it means "does this table have updated_at" is not a reliable test for whether ' +
    'something is a ledger. Align it when Fleet is next touched.',
    C.sun),
  SPACER(240),

  H2('5.3  Table inventory'),
  P(`${TABLES.length} tables: ${CORE.length} core, ${MODULE_TABLES.length} across the ` +
    'seven modules. The full list with module assignment is in Appendix A, generated from ' +
    'the migrations at build time.'),
  SPACER(120),
  tbl(['Group', 'Count', 'Tables'], (() => {
    const g = {};
    for (const x of TABLES) (g[MODULE_OF(x)] = g[MODULE_OF(x)] || []).push(x);
    const order = ['Core', 'Warehouse', 'Fleet', 'Inventory', 'Finance', 'Workforce', 'Safety', 'Reports'];
    return order.filter(k => g[k]).map(k => [k, String(g[k].length), g[k].join(', ')]);
  })(), [1500, 900, 7248]),
);

/* ---------- 6 ---------- */
b.push(
  H1('6  The modules'),
  P('Each module ships as a unit: schema, security policy and interface. All seven read ' +
    'live data — none is a mockup.'),
  SPACER(160),
  tbl(['Module', 'Holds', 'Interface reads'], [
    ['Warehouse', 'Sites, daily snapshots', 'Site registry, shift productivity, dock utilisation, throughput'],
    ['Fleet', 'Vehicles, trips, metrics', 'Vehicle registry, trip log, distance and fuel, utilisation per vehicle'],
    ['Inventory', 'SKUs, movements, snapshots', 'SKU master, stock in and out, reserved quantity, reorder flagging'],
    ['Finance', 'Cost centres, transactions, snapshots', 'Revenue and expense capture, budget tracking, variance'],
    ['Workforce', 'Departments, employees, attendance, performance, snapshots', 'Departments, employee records, daily attendance'],
    ['Safety', 'Incidents, inspections, snapshots', 'Incident capture, inspection records'],
    ['Reports', 'Definitions, runs', 'Definition creation, run history, reads across four modules'],
  ], [1500, 3400, 4748]),
  SPACER(280),

  H2('6.1  Reachable by SQL, unreachable from the app'),
  P('Two tables are secured, correct, and have no interface: hr_performance and hr_snapshot. ' +
    'Performance review data can be written by SQL and cannot be entered or read through ' +
    'the product. This is a gap, not a design decision.'),

  H2('6.2  The catch-all route'),
  P('A dynamic route renders a "coming soon" placeholder for any module path that has no ' +
    'page of its own. It exists so an unknown module URL degrades to a placeholder rather ' +
    'than a 404. With all seven modules built it is currently unreachable in normal use.'),
);

/* ---------- 7 ---------- */
b.push(
  H1('7  Business Health Score'),
  P('A weighted composite across seven categories, calculated on read. This is real, ' +
    'deterministic, and fully specified — no model is involved and none is needed.'),
  SPACER(160),
  tbl(['Category', 'Weight'], [
    ['Finance', '0.20'], ['Operations', '0.20'], ['Customer', '0.15'],
    ['Fleet & Assets', '0.15'], ['HR', '0.10'],
    ['Safety & Compliance', '0.10'], ['Inventory & Procurement', '0.10'],
  ], [6648, 3000], { monoCols: [1] }),
  SPACER(280),

  H2('7.1  Bands'),
  tbl(['Score', 'Band'], [
    ['90 and above', 'Excellent'], ['75 to 89', 'Stable'], ['60 to 74', 'Watch'],
    ['40 to 59', 'At Risk'], ['below 40', 'Critical'],
  ], [3000, 6648]),
  SPACER(280),

  H2('7.2  What it depends on'),
  P('Category scores are entered by a person on the data entry screen. The composite is ' +
    'arithmetic over those entries. It is therefore only as good as the discipline of ' +
    'whoever enters it — a real limitation, and the clearest argument for deriving ' +
    'category scores from module data in v2 rather than collecting them by hand.'),
);

/* ---------- 8 ---------- */
b.push(
  H1('8  Ask Opservor'),
  P('Five question patterns, matched by regular expression against the user\u2019s text, ' +
    'answered from live database rows. No external call, no model.'),
  SPACER(160),
  tbl(['Pattern', 'Answers from'], [
    ['Health / score', 'Latest category scores, via the composite calculation'],
    ['Summary / overview', 'Composite score, latest KPI snapshot, open alert counts'],
    ['Approvals / pending', 'Open alerts, ranked by severity'],
    ['Fleet / utilisation', 'Latest KPI snapshot, plus the Fleet & Assets category score'],
    ['Revenue / profit', 'Latest KPI snapshot, with margin calculated'],
  ], [2400, 7248]),
  SPACER(280),

  H2('8.1  The approvals compromise'),
  P('The v1 data model has no approvals entity. The pattern answers instead from open ' +
    'alerts, on the reasoning that an open critical alert is the closest real thing to ' +
    'something awaiting a decision. The code documents this substitution in its own ' +
    'comments rather than hiding it, which is the right instinct.'),

  H2('8.2  Unmatched questions'),
  P('Anything outside the five patterns returns a message naming what can be answered. ' +
    'That message currently ends by telling the user that live AI-powered question ' +
    'answering is coming in v2 — a commitment made in the product interface, which should ' +
    'be tracked as such.'),
);

/* ---------- 9 ---------- */
b.push(
  H1('9  Schema change discipline'),

  H2('9.1  Numbered migrations'),
  P(`${MIGRATIONS.length} numbered migrations define the schema. They are applied in ` +
    'order and never edited after the fact. The table below is generated from the ' +
    'directory rather than typed, because the typed version said eight for as long as ' +
    'nobody counted.'),
  SPACER(120),
  tbl(['Migration', 'Adds'], MIGRATIONS, [3400, 6248], { monoCols: [0] }),
  SPACER(280),

  H2('9.2  Guarded and re-runnable'),
  P('Combined RUN_ME files exist for applying several migrations in one pass. They are ' +
    'written to be safely re-runnable: policies are dropped before being created, because ' +
    'PostgreSQL has no CREATE POLICY IF NOT EXISTS; and preflight blocks raise a clear ' +
    'exception if a prerequisite table is missing, rather than failing obscurely partway ' +
    'through.'),
  P('A read-only verification script, VERIFY_all_tables.sql, reports the state of the ' +
    'whole schema without modifying anything.'),

  H2('9.3  The lesson that produced this section'),
  CALL('Shipping code does not apply schema',
    'The Fleet and Inventory migrations were documented as applied on the strength of the ' +
    'module code being deployed. They had not been applied. This surfaced only when a ' +
    'later migration\u2019s preflight check refused to run. The documentation had recorded an ' +
    'assumption as a fact.',
    C.red),
  P('Two things changed as a result. Migrations are applied in the same session as the ' +
    'module ships. And the schema reference now distinguishes verified from reported — a ' +
    'migration is "verified" only when its effect has been observed in the database, not ' +
    'when someone believes they ran it.'),
);

/* ---------- 10 ---------- */
b.push(
  H1('10  Roles, and getting data in'),
  LEAD('Two capabilities built after version 1.0 of this document, both of which change '
    + 'what the product can be sold into.'),

  H2('10.1  Roles and module access'),
  P('Four roles — owner, manager, staff, viewer — and a per-module grant on top '
    + 'of them. Finance and workforce require an explicit grant regardless of seniority, '
    + 'because payroll and cost are the two things a warehouse supervisor has no business '
    + 'reading by default.'),
  P('Twenty-seven tables carry four policies each rather than one. That is deliberate and '
    + 'the reason is worth recording: a single FOR ALL policy governs DELETE by its USING '
    + 'clause, which is the read rule. Written that way, a viewer could delete every row '
    + 'they were allowed to look at, because DELETE never consults WITH CHECK. Splitting '
    + 'them is the only way to say may look, may not remove.'),
  P('The same mistake, mirrored, was later found on the findings table and fixed in 0019. '
    + 'FOR ALL is one rule pretending to be four, and it is wrong whenever the four differ.'),

  H2('10.2  Import'),
  P('A spreadsheet export from any system can be loaded: stock items, stock movements, '
    + 'vehicles or trips. Columns are matched by name against what each field is likely to '
    + 'arrive as — Material, Item Code, Part No, Unrestricted, Vendor — and the '
    + 'mapping is shown and correctable before anything is written.'),
  P('This exists because a live connection to a prospect’s SAP or telematics platform '
    + 'requires their IT department, a security review and procurement, which is months and '
    + 'is not granted to a supplier without customers. Every one of those systems also has '
    + 'an export button, which needs nobody’s permission.'),
  P('The parser is written rather than borrowed, because the files are all wrong in '
    + 'different ways: a byte-order mark silently renames the first column, commas and line '
    + 'breaks live inside quoted fields, and European exports separate with semicolons '
    + 'because there a comma is a decimal point.'),
  P('Two ambiguities cannot be resolved by looking at a value, and neither is guessed at. '
    + 'A date of 04/03/2026 is March in the United States and April elsewhere, so the column '
    + 'is searched for a value that settles it and the operator is asked when none exists. '
    + 'A quantity of 1.240 is one thousand two hundred and forty in a German export and '
    + 'one and a quarter in an American one, resolved by the column: stock cannot be '
    + 'fractional, a price can.'),
  P('A cell that cannot be read costs its whole row. Unknown and zero are not the same '
    + 'number, and a quantity defaulted to zero would flow into a stockout finding and be '
    + 'believed.'),

  H1('11  Known defects'),
  LEAD('Recorded so they stay decisions rather than becoming surprises. Severity is this ' +
       'document\u2019s assessment.'),
  SPACER(160),
  tbl(['#', 'Defect', 'Status'], [
    ['1', 'inventory_sku.sku carried a global unique constraint rather than '
      + 'unique (company_id, sku). Tenant B could not create a SKU code tenant A had used.',
      'Fixed — 0009'],
    ['2', 'One RLS policy per table granted full access to any authenticated tenant '
      + 'member. No read-only role, no per-module scoping.', 'Fixed — 0014'],
    ['3', 'A FOR ALL policy on guardian_finding also governed SELECT, so anyone with '
      + 'core write access could read findings drawn from modules they may not see.',
      'Fixed — 0019'],
    ['4', 'Snapshot tables are inert. Five modules define them; nothing populates them. '
      + 'Metrics are derived on read — correct at current volume, not correct for long.',
      'Open — medium'],
    ['5', 'hr_performance and hr_snapshot have no interface. Secured, reachable by SQL, '
      + 'unreachable from the product.', 'Open — medium'],
    ['6', 'fleet_trip is a ledger carrying updated_at and an update trigger, unlike the '
      + 'other ledgers.', 'Open — low'],
    ['7', 'No API credential can be stored, so no live connection to a customer system '
      + 'is possible. The reason it was refused has now been fixed; the storage itself '
      + 'has not been built.', 'Open — blocks integrations'],
    ['8', 'Supplier lead time is not recorded anywhere. Every stockout finding assumes '
      + 'ten days and says so. Capturing it per supplier would sharpen every one of them.',
      'Open — medium'],
  ], [500, 6748, 2400]),
  SPACER(280),

  CALL('What changed since version 1.0',
    'Three of the six defects recorded on 26 July have been fixed, including both of the '
    + 'ones that would have blocked a second customer. Two new entries appear instead: '
    + 'credential storage, which now blocks live integrations for a reason that no longer '
    + 'applies, and supplier lead time, which every stockout finding currently assumes. '
    + 'Defects are added here as they are found rather than when they are convenient.',
    C.blue),
);

/* ---------- 11 ---------- */
b.push(
  H1('12  What v2 requires'),
  LEAD('Written in the future tense throughout, because none of it exists.'),

  H2('11.1  To make the Guardian claims true'),
  NUM('Snapshot tables would need to be populated on a schedule, so that trend and ' +
      'seasonality have somewhere to live. Nothing predictive is possible while every ' +
      'metric is derived from the current state on read.'),
  NUM('Thresholds and anomaly detection would need to generate alerts automatically. ' +
      'Today a human types them.'),
  NUM('A forecasting method would need to be chosen, implemented and — critically — ' +
      'measured, so that a claim of accuracy could be made from evidence rather than hope.'),
  NUM('A language model would need to be integrated for open question answering, replacing ' +
      'the five fixed patterns.'),
  NUM('The recommendation loop — actions taken feeding back as training signal — is the ' +
      'largest item and depends on all four above.'),

  H2('11.2  To make the product sellable to a second customer'),
  BUL('Defect 1 (SKU uniqueness) fixed.'),
  BUL('A role model with at least read-only and administrator distinguished.'),
  BUL('Onboarding that creates a tenant without manual SQL.'),
  BUL('An interface for the two orphaned workforce tables.'),

  H2('11.3  Integrations'),
  P('Version 1.1 said no connector of any kind existed and that every row had been typed '
    + 'in. That is no longer true, and the correction matters in both directions.'),
  BUL('Four adapters are written: Samsara, Motive and Geotab for telematics, and Fleetio '
    + 'for maintenance. Each translates its own system into one shared shape, so nothing '
    + 'downstream — not the sync, not the database, not Guardian — knows where a vehicle '
    + 'came from.'),
  BUL('A CSV import exists, with its own parser, for operations that have data but no API '
    + 'worth calling.'),
  BUL('Credentials are encrypted at rest and readable only by the service role. The '
    + 'browser role cannot read the credential table at all: row-level security is enabled '
    + 'on it with no policy, deliberately.'),
  P('What that does not mean. None of the four has been run against a live account, and '
    + 'the connections screen says so on each of them rather than leaving it to be '
    + 'discovered. There is still no ERP, no WMS and no TMS connector, and nothing runs on '
    + 'a schedule — a sync happens when somebody presses a button.'),
  P('One finding from building them is worth recording, because it looks like an obvious '
    + 'thing to try and is a dead end. Telematics systems cannot supply scheduled '
    + 'maintenance. Samsara exposes driver inspections, Motive exposes inspections, Geotab '
    + 'has no maintenance entity at all — every one of those reports a vehicle being '
    + 'defective now, which is a different fact from a vehicle being booked in for '
    + 'Thursday. Only the second can be seen coming, and it lives in a maintenance system. '
    + 'That is why the fourth adapter is not a fourth telematics box.'),
);

/* ---------- 12 ---------- */
b.push(
  H1('13  Open questions'),
  P('Not defects — decisions that have not been made.'),
  SPACER(160),
  BUL('Whether category scores should continue to be entered by hand or be derived from ' +
      'module data. Deriving them removes the discipline problem and changes what the ' +
      'score means.'),
  BUL('Whether snapshots should be written by a scheduled job, by triggers, or on demand.'),
  BUL('Whether Guardian is a product surface or an engine underneath the modules. The ' +
      'marketing treats it as both.'),
  BUL('Whether the product targets single-site operators or multi-site enterprises. The ' +
      'schema supports multi-site; the interface assumes one operator.'),
  BUL('What the retention policy is for operational data. Nothing currently expires.'),
);

/* ---------- appendix ---------- */
b.push(
  H1('Appendix A  Table reference'),
  P(`All ${TABLES.length} tables, generated from the migration files at build time.`),
  SPACER(160),
  tbl(['Table', 'Module', 'Kind'],
    TABLES.map(x => [
      x,
      MODULE_OF(x),
      /snapshot|metrics|score/.test(x) ? 'Aggregate'
        : ['inventory_movement', 'finance_transaction', 'hr_attendance', 'report_run'].includes(x) ? 'Ledger'
        : 'State',
    ]),
    [4200, 2800, 2648], { monoCols: [0] }),

  H1('Appendix B  Revision history'),
  tbl(['Version', 'Date', 'Change'], [
    ['1.0', ISSUED_V1, 'First issue. Records the seven-module v1, the tenancy model, six '
      + 'known defects, and the gap between the website capability claims and the build.'],
    ['1.1', ISSUED_V11, 'Guardian moved from nothing built to three checks running, with what '
      + 'still does not exist stated as plainly as what does. Roles, per-module permissions '
      + 'and spreadsheet import added as section 10. Three defects closed, two opened. '
      + 'Rewritten because thirty commits had landed and the document had begun to '
      + 'understate the product, which is the same failure as overstating it.'],
    ['1.2', TODAY, 'Integrations corrected: version 1.1 said no connector existed and '
      + 'four now do, plus a CSV import — understating the product is the same failure '
      + 'as overstating it. Three silence defects recorded and closed, where the product '
      + 'reported nothing rather than reporting that it could not tell. The depot moved '
      + 'from inferred to recorded. The migration table is now generated from the '
      + 'directory, having claimed eight when there were twenty-four.'],
  ], [1300, 1800, 6548]),
  SPACER(400),
  RULE_P(),
  new Paragraph({ children: [t('TS-PROD-001 · Product Architecture · Version 1.2', { size: 18, color: SOFT })] }),
  new Paragraph({ children: [t('Ahsan Ahmad, Founder · founder@teraspheres.com', { size: 18, color: SOFT })] }),
);

/* ------------------------------------------------------------------ */

const doc = new Document({
  creator: 'Ahsan Ahmad',
  title: 'TS-PROD-001 — Product Architecture',
  description: 'Volume 3 of the TeraSpheres Codex',
  styles: {
    default: { document: { run: { font: FONT, size: 21, color: BODY } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: FONT, size: 40, bold: true, color: INK } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: FONT, size: 28, bold: true, color: INK } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: FONT, size: 23, bold: true, color: '2C3A4E' } },
    ],
  },
  numbering: { config: [
    { reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022',
      alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 200 } } } }] },
    { reference: 'num', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.',
      alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 380, hanging: 240 } } } }] },
  ] },
  features: { updateFields: true },
  sections: [{
    properties: {
      page: { size: { width: PAGE_W, height: PAGE_H },
              margin: { top: M_TOP, bottom: M_BOT, left: M_L, right: M_R, header: 720, footer: 720 } },
      titlePage: true,
    },
    headers: {
      default: new Header({ children: [new Paragraph({
        children: [t('TS-PROD-001  ·  Product Architecture', { size: 16, color: SOFT })],
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 6 } },
      })] }),
      first: new Header({ children: [new Paragraph({ children: [t('')] })] }),
    },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          t('Version 1.2', { size: 16, color: SOFT }),
          new TextRun({ children: ['\t'], font: FONT }),
          t('Page ', { size: 16, color: SOFT }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: SOFT, font: FONT }),
        ],
      })] }),
      first: new Footer({ children: [new Paragraph({ children: [t('')] })] }),
    },
    children: b,
  }],
});

const outFile = path.join(OUT, 'TS-PROD-001_Product_Architecture_v1.2.docx');
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outFile, buf);
  console.log(outFile);
  console.log(`${(buf.length / 1024).toFixed(1)} KB · ${TABLES.length} tables read from migrations`);
});
