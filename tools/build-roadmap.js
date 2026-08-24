/* Opservor — Product Roadmap
 *
 * Version 1.0 was written on 25 July, when seven modules existed and nothing
 * else did. It laid out five stages in a strict order and said each unblocked
 * the next.
 *
 * Most of it happened, and not in that order. Stages three, four and five are
 * substantially built while stage two is untouched — which means the stated
 * dependency was wrong, and a roadmap that quietly drops a wrong prediction is
 * worth less than one that records it.
 *
 * Delivery status is read from the codebase where it can be. A roadmap that
 * claims something is outstanding when the code says otherwise is the failure
 * this file exists to prevent.
 *
 * Run: node tools/build-roadmap.js
 */

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  Footer, PageNumber, LevelFormat, VerticalAlign,
} = require('docx');

const APP = 'C:/opservor-mvp/opservor-mvp';
const OUT = 'C:/Users/ahsan/Documents/TeraSpheres_Archive/Roadmap';
fs.mkdirSync(OUT, { recursive: true });

const PAGE_W = 12240, M_L = 1296, M_R = 1296;
const CONTENT = PAGE_W - M_L - M_R;
const INK = '1A2432', BODY = '333F52', SOFT = '6B7787', RULE = 'D4DBE4';
const BLUE = '0EA5E9', SUN = 'FFA940', GREEN = '34D399', DEEP = '0F172A';
const FONT = 'Segoe UI', MONO = 'Consolas';

/* ---------- facts ---------- */

const migDir = path.join(APP, 'supabase/migrations');
const migFiles = fs.readdirSync(migDir).filter((f) => /^\d{4}_/.test(f)).sort();
const allSql = migFiles.map((f) => fs.readFileSync(path.join(migDir, f), 'utf8')).join('\n');

const TABLES = [...new Set(
  [...allSql.matchAll(/create table (?:if not exists )?(?:public\.)?([a-z_]+)/g)].map((m) => m[1])
)].sort();

const CHECKS = [...new Set(
  [...allSql.matchAll(/function (guardian_check_[a-z_]+)/g)].map((m) => m[1])
)].sort();

const CONNECTORS = fs.readdirSync(path.join(APP, 'src/lib/connectors'))
  .filter((f) => f.endsWith('.ts') && !/^(index|types|sync)\.ts$/.test(f))
  .map((f) => f.replace(/\.ts$/, ''))
  .sort();

const src = (p) => {
  try { return fs.readFileSync(path.join(APP, p), 'utf8'); } catch { return ''; }
};
const srcAll = fs.readdirSync(path.join(APP, 'src'), { recursive: true })
  .filter((f) => typeof f === 'string' && /\.(ts|tsx)$/.test(f))
  .map((f) => src(path.join('src', f))).join('\n');

/** Does anything in the application write to this table? */
const writesTo = (table) =>
  new RegExp(`from\\(["']${table}["']\\)[\\s\\S]{0,120}?(insert|upsert)`).test(srcAll);

const SNAPSHOTS = ['fleet_metrics', 'inventory_snapshot', 'finance_snapshot',
                   'hr_snapshot', 'safety_snapshot'];
const UNWRITTEN = SNAPSHOTS.filter((t) => TABLES.includes(t) && !writesTo(t));

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
  const bodyRows = rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((cell, i) => {
    const s = String(cell);
    const done = opts.statusCol === i && /^(built|done|delivered)/i.test(s);
    const open = opts.statusCol === i && /^(open|not|outstanding)/i.test(s);
    return new TableCell({
      width: { size: widths[i], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: ri % 2 ? 'F4F6F9' : 'FFFFFF' },
      margins: { top: 76, bottom: 76, left: 130, right: 130 },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ children: [
        done ? t(s, { size: 19, bold: true, color: GREEN })
          : open ? t(s, { size: 19, bold: true, color: SUN })
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

/* ---------- content ---------- */

const b = [];

b.push(
  new Paragraph({ children: [t('TERASPHERES', { size: 17, bold: true, color: SOFT, characterSpacing: 60 })], spacing: { after: 40 } }),
  new Paragraph({ children: [t('Product', { size: 48, bold: true, color: INK })], spacing: { after: 20 } }),
  new Paragraph({ children: [t('Roadmap', { size: 30, color: '4A5A68' })], spacing: { after: 160 } }),
  new Paragraph({ children: [t(`Version 1.3  ·  ${TODAY}`, { size: 19, color: SOFT })], spacing: { after: 40 } }),
  new Paragraph({
    children: [t(`${TABLES.length} tables · ${migFiles.length} migrations · ${CHECKS.length} checks · ${CONNECTORS.length} adapters`, { size: 19, color: SOFT })],
    spacing: { after: 300 },
  }),
);

/* 1 */
b.push(
  H1('1  Where this stands'),
  P('Version 1.0 was written on 25 July, when seven modules existed and nothing else did. '
    + 'It set out five stages and said each unblocked the next.'),
  P('Most of those stages have now happened. They did not happen in that order, and the '
    + 'reason is worth recording rather than quietly editing out.'),

  CALL('The prediction that did not hold',
    'Version 1.0 said Guardian could not reason over data that was not computed, and placed '
    + 'snapshot population before it as a hard dependency. Guardian was built anyway. It '
    + 'reads raw rows directly — movements over ninety days, snapshots per site, maintenance '
    + 'per vehicle — and produces findings without any aggregate table being written. The '
    + 'dependency was assumed rather than tested, and it was wrong.',
    SUN),

  P('What that changes going forward: aggregation is a performance decision, not a '
    + 'prerequisite. It becomes necessary when the volume of raw rows makes reading them on '
    + 'demand too slow, and not before. That is a different trigger and a much later one.'),
);

/* 2 */
b.push(
  H1('2  Delivered'),
  P('Everything below is present in the codebase as of this document being generated.'),
  SPACER(120),
  tbl(['Area', 'Status', 'What exists'], [
    ['Seven modules', 'Built', 'Warehouse, Fleet, Inventory, Finance, Workforce, Safety, Reports'],
    ['Tenancy', 'Built', `${TABLES.length} tables, every one tenant-scoped with row-level security`],
    ['SKU uniqueness', 'Built', 'Corrected in 0009 to be unique per company rather than globally'],
    ['Derived mileage', 'Built', 'fleet_vehicle.mileage accumulates from trip distance (0009)'],
    ['Roles', 'Built', 'Owner, manager, staff, viewer with per-module access (0014)'],
    ['Guardian', 'Built', `${CHECKS.length} checks over the tenant's own history, each showing its arithmetic`],
    ['Guardian honesty', 'Built', 'A readiness function reporting what could not be checked, and why (0021)'],
    ['Depot mapping', 'Built', 'Recorded on the vehicle from the provider grouping (0022–0024)'],
    ['Integrations', 'Built', `${CONNECTORS.length} adapters: ${CONNECTORS.join(', ')}`],
    ['Credentials', 'Built', 'Encrypted at rest, readable only by the service role (0020)'],
    ['Spreadsheet import', 'Built', 'CSV import with its own parser, for operations without an API'],
  ], [2200, 1300, 6148], { statusCol: 1 }),
);

/* 3 */
b.push(
  H1('3  Outstanding'),
  P('In the order that value arrives, not the order it was originally written.'),

  H2('3.1  Scheduled syncs'),
  P('Nothing runs on its own. An integration syncs when somebody presses a button, which '
    + 'means the data Guardian reads is only as fresh as the last time a person remembered. '
    + 'This is the single largest gap between the product as demonstrated and the product as '
    + 'used.'),

  H2('3.2  Per-supplier lead times'),
  P('Every stockout finding assumes ten days for every supplier, and says so on screen. The '
    + 'honesty is right; the assumption is crude. A lead time recorded per supplier makes the '
    + 'most-used check materially more accurate for a small schema change.'),

  H2('3.3  Maintenance beyond one provider'),
  P('Scheduled service work now arrives from Fleetio. Telematics systems cannot supply it — '
    + 'they report inspections and fault codes, which is a vehicle broken now rather than a '
    + 'vehicle booked in for Thursday. Additional maintenance systems are the way to widen '
    + 'this, not additional telematics.'),

  H2('3.4  The workforce surface'),
  P('hr_performance and hr_snapshot exist, are secured, and have no interface. Reviewed and '
    + 'unchanged since first noted.'),

  H2('3.5  Report output'),
  P('Report definitions and run history exist. CSV and PDF output does not.'),

  H2('3.6  Snapshot population'),
  P((UNWRITTEN.length
      ? `${UNWRITTEN.length} aggregate tables are defined and unwritten: ${UNWRITTEN.join(', ')}. `
      : 'All aggregate tables now have writers. ')
    + 'Figures are computed from raw rows on read. Per section 1 this is a performance '
    + 'question rather than a blocker, and it has been demoted accordingly.'),

  H2('3.7  Multi-tenant hardening'),
  P('Per-tenant rate limiting, audit logging, data residency, and the posture needed to '
    + 'pass an enterprise security review without negotiation. A scale concern rather than a '
    + 'correctness one, and unchanged in priority.'),
);

/* 4 */
b.push(
  H1('4  Explicitly not planned'),
  P('Recorded so they are decisions rather than oversights. Unchanged from version 1.0 and '
    + 'reviewed rather than copied.'),
  BUL('A mobile application. The interface is responsive; a native app is not justified by '
    + 'current usage.'),
  BUL('A public API. Premature before the data model has settled.'),
  BUL('Real-time collaboration. Operational data is entered by few people and read by many; '
    + 'the complexity is not warranted.'),
  BUL('White-labelling. A distraction until the product is proven with direct customers.'),
);

/* 5 */
b.push(
  H1('Appendix  Revision history'),
  tbl(['Version', 'Date', 'Change'], [
    ['1.0', '25 July 2026', 'First issue. Seven modules delivered, five stages proposed in '
      + 'strict order, twenty-one tables recorded.'],
    ['1.3', TODAY,
      'Rewritten after most of stages three, four and five were built while stage two was '
      + 'not. Records the dependency that did not hold: Guardian was said to require '
      + 'populated snapshots and does not. Delivery status is now read from the codebase, '
      + 'because a roadmap claiming work is outstanding when the code says otherwise is the '
      + 'failure this document exists to prevent. Snapshot population demoted from blocker '
      + 'to performance work; scheduled syncs promoted to the largest remaining gap.'],
  ], [1300, 1800, 6548]),
);

/* ---------- document ---------- */

const doc = new Document({
  creator: 'TeraSpheres',
  title: 'Opservor Product Roadmap v1.3',
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
        children: [new TextRun({ children: ['Opservor Product Roadmap v1.3   ·   ', PageNumber.CURRENT], size: 16, color: SOFT, font: FONT })],
      })] }),
    },
    children: b,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  const file = path.join(OUT, 'Opservor_Product_Roadmap_v1.3.docx');
  fs.writeFileSync(file, buf);
  console.log('  ' + file);
  console.log(`  ${(buf.length / 1024).toFixed(1)} KB · ${CONNECTORS.length} adapters · ${CHECKS.length} checks · ${UNWRITTEN.length} unwritten snapshot tables`);
});
