/* Two decks for Opservor — one for clients, one for investors.
 *
 * Everything factual here is read from, or verified against, the codebase.
 * Where a number would have to be invented (market size, pricing, funding
 * ask) the slide says so rather than making one up. TS-BRAND-001 §9 applies:
 * "we will", never "our team does".
 *
 * Regenerate after any product change:  node build-decks.js
 */

const fs = require('fs');
const path = require('path');
const pptxgen = require('pptxgenjs');

const BRAND = 'C:/opservor-mvp/teraspheres-website/brand';
const OUT = 'C:/Users/ahsan/Documents/TeraSpheres_Archive/Decks';
fs.mkdirSync(OUT, { recursive: true });

/* ---------------------------------------------------------------- palette */
const DEEP = '0F172A';   // near-black navy, the app's own background
const PANEL = '1A2536';
const BLUE = '0EA5E9';
const CYAN = '22D3EE';
const AMBER = 'FFA940';
const RED = 'F87171';
const GREEN = '34D399';
const INK = '16202E';
const BODY = '3B4859';
const SOFT = '7C8798';
const LINE = 'DFE5EC';
const WASH = 'F5F8FB';

const H = 'Cambria';     // safe-list serif, renders true to width
const B = 'Calibri';

const W = 13.3, HGT = 7.5;
const M = 0.72;                 // page margin
const CW = W - M * 2;           // content width

const img = (f) => path.join(BRAND, f);

/* ------------------------------------------------------------- components */

function darkSlide(p) {
  const s = p.addSlide();
  s.background = { color: DEEP };
  return s;
}

function lightSlide(p, title, kicker) {
  const s = p.addSlide();
  s.background = { color: 'FFFFFF' };
  if (kicker) {
    s.addText(kicker.toUpperCase(), {
      x: M, y: 0.42, w: CW, h: 0.24, margin: 0,
      fontFace: B, fontSize: 11, bold: true, color: BLUE, charSpacing: 2,
    });
  }
  if (title) {
    s.addText(title, {
      x: M, y: kicker ? 0.68 : 0.5, w: CW, h: 0.72, margin: 0,
      fontFace: H, fontSize: 32, bold: true, color: INK,
    });
  }
  return s;
}

/** Numbered badge — the repeated motif, echoing the orbit mark. */
function badge(s, x, y, text, fill = BLUE, d = 0.44) {
  s.addShape('ellipse', { x, y, w: d, h: d, fill: { color: fill } });
  s.addText(String(text), {
    x, y, w: d, h: d, margin: 0,
    align: 'center', valign: 'middle',
    fontFace: B, fontSize: 13, bold: true, color: 'FFFFFF',
  });
}

/** A card with a soft tint — never an edge stripe. */
function card(s, x, y, w, h, fill = WASH) {
  s.addShape('roundRect', {
    x, y, w, h, rectRadius: 0.06,
    fill: { color: fill },
    line: { color: LINE, width: 0.75 },
  });
}

/** Big number with a small label under it. */
function stat(s, x, y, w, value, label, color = BLUE) {
  s.addText(String(value), {
    x, y, w, h: 0.78, margin: 0,
    fontFace: H, fontSize: 40, bold: true, color,
  });
  s.addText(label, {
    x, y: y + 0.76, w, h: 0.5, margin: 0,
    fontFace: B, fontSize: 12, color: SOFT,
  });
}

/**
 * The Guardian finding, drawn as the product draws it. This is the motif that
 * carries both decks — it is the thing being sold, so it appears as itself
 * rather than as a bullet list about itself.
 */
function findingCard(s, x, y, w, o) {
  const h = o.rows ? 3.5 : 2.35;
  s.addShape('roundRect', {
    x, y, w, h, rectRadius: 0.05,
    fill: { color: PANEL }, line: { color: '2C3B50', width: 1 },
  });

  s.addShape('roundRect', {
    x: x + 0.28, y: y + 0.26, w: 0.82, h: 0.28, rectRadius: 0.05,
    fill: { color: o.sevColor || RED },
  });
  s.addText(o.severity || 'critical', {
    x: x + 0.28, y: y + 0.26, w: 0.82, h: 0.28, margin: 0,
    align: 'center', valign: 'middle', fontFace: B, fontSize: 10, bold: true, color: 'FFFFFF',
  });

  let tagX = x + 1.2;
  for (const tag of o.tags || ['inventory']) {
    const tw = 0.26 + tag.length * 0.075;
    s.addShape('roundRect', {
      x: tagX, y: y + 0.26, w: tw, h: 0.28, rectRadius: 0.05,
      fill: { color: PANEL }, line: { color: '3A4B63', width: 0.75 },
    });
    s.addText(tag, {
      x: tagX, y: y + 0.26, w: tw, h: 0.28, margin: 0,
      align: 'center', valign: 'middle', fontFace: B, fontSize: 10, color: '9FB0C4',
    });
    tagX += tw + 0.12;
  }

  s.addText(o.title, {
    x: x + 0.28, y: y + 0.64, w: w - 0.56, h: 0.36, margin: 0,
    fontFace: H, fontSize: 16, bold: true, color: 'FFFFFF',
  });
  s.addText(o.detail, {
    x: x + 0.28, y: y + 1.02, w: w - 0.56, h: 0.62, margin: 0,
    fontFace: B, fontSize: 12, color: 'B7C4D4', lineSpacing: 16,
  });

  s.addShape('roundRect', {
    x: x + 0.28, y: y + 1.68, w: w - 0.56, h: 0.44, rectRadius: 0.05,
    fill: { color: '13314A' },
  });
  s.addText(
    [{ text: 'Recommended: ', options: { bold: true } }, { text: o.rec }],
    {
      x: x + 0.42, y: y + 1.68, w: w - 0.84, h: 0.44, margin: 0,
      valign: 'middle', fontFace: B, fontSize: 11.5, color: 'E4ECF5',
    }
  );

  if (o.rows) {
    const cols = ['ITEM', 'ORDER', 'AVAILABLE', 'PER DAY', 'DAYS LEFT'];
    const cw = (w - 0.56) / cols.length;
    cols.forEach((c, i) => {
      s.addText(c, {
        x: x + 0.28 + i * cw, y: y + 2.26, w: cw, h: 0.26, margin: 0,
        fontFace: B, fontSize: 9, bold: true, color: '7F90A5', charSpacing: 1,
      });
    });
    s.addShape('line', {
      x: x + 0.28, y: y + 2.53, w: w - 0.56, h: 0,
      line: { color: '32435C', width: 0.75 },
    });
    o.rows.forEach((r, ri) => {
      r.forEach((cell, i) => {
        s.addText(String(cell), {
          x: x + 0.28 + i * cw, y: y + 2.6 + ri * 0.32, w: cw, h: 0.3, margin: 0,
          valign: 'middle', fontFace: B, fontSize: 11,
          color: i === 4 ? AMBER : 'DCE6F0',
        });
      });
    });
  }
  return h;
}

/* ================================================================ CLIENT */

function clientDeck() {
  const p = new pptxgen();
  p.layout = 'LAYOUT_WIDE';
  p.author = 'TeraSpheres';
  p.company = 'TeraSpheres';
  p.title = 'Opservor — what your systems cannot tell you';

  /* 1 — title */
  let s = darkSlide(p);
  s.addImage({ path: img('opservor-512.png'), x: M, y: 1.5, w: 1.05, h: 1.05 });
  s.addText('OPSERVOR', {
    x: M, y: 2.75, w: CW, h: 0.32, margin: 0,
    fontFace: B, fontSize: 13, bold: true, color: CYAN, charSpacing: 4,
  });
  s.addText('What your systems\ncannot tell you', {
    x: M, y: 3.1, w: 9.4, h: 1.9, margin: 0,
    fontFace: H, fontSize: 46, bold: true, color: 'FFFFFF', lineSpacing: 52,
  });
  s.addText('Operational intelligence for logistics, warehousing and fleet', {
    x: M, y: 5.1, w: 9.4, h: 0.4, margin: 0,
    fontFace: B, fontSize: 17, color: '93A6BC',
  });
  s.addText('TeraSpheres  ·  Edmonton, Alberta', {
    x: M, y: 6.6, w: CW, h: 0.3, margin: 0,
    fontFace: B, fontSize: 11, color: '61738A',
  });
  s.addNotes('Opening line: "Every system you own reports what happened. None of them tell you what is about to."');

  /* 2 — the question */
  s = darkSlide(p);
  s.addText('A question your systems cannot answer', {
    x: M, y: 0.85, w: CW, h: 0.6, margin: 0,
    fontFace: H, fontSize: 30, bold: true, color: 'FFFFFF',
  });
  // Broken onto deliberate lines. At 32pt Cambria the first line of the
  // original wrapped, pushing a third line out of the box.
  s.addText('"Which of my depots is going to struggle\nnext Thursday, and why?"', {
    x: M, y: 2.05, w: CW, h: 1.6, margin: 0,
    fontFace: H, fontSize: 32, italic: true, color: CYAN, lineSpacing: 44,
  });
  s.addText(
    'Your warehouse system knows the docks are filling up. Your fleet system knows two ' +
    'vehicles are booked in for service. Your stock system knows an item is running down.\n\n' +
    'All three are correct. None of them talk to each other. So the answer only arrives ' +
    'on Thursday, when somebody spends the afternoon firefighting and calls it bad luck.',
    {
      x: M, y: 4.05, w: 9.8, h: 2.1, margin: 0,
      fontFace: B, fontSize: 15, color: 'A9B9CB', lineSpacing: 24,
    }
  );
  s.addNotes('Let the question sit for a second before reading the paragraph.');

  /* 3 — what the screen shows today */
  s = lightSlide(p, 'What your stock screen shows you today', 'The problem');
  card(s, M, 1.8, 5.6, 2.5);
  s.addText('BAK-00484', {
    x: M + 0.35, y: 2.05, w: 4.9, h: 0.4, margin: 0,
    fontFace: H, fontSize: 20, bold: true, color: INK,
  });
  s.addText([
    { text: 'On hand', options: { color: SOFT } },
    { text: '        28 units\n', options: { bold: true, color: INK } },
    { text: 'Reorder level', options: { color: SOFT } },
    { text: '   26 units\n', options: { bold: true, color: INK } },
    { text: 'Status', options: { color: SOFT } },
    { text: '          In stock', options: { bold: true, color: GREEN } },
  ], {
    x: M + 0.35, y: 2.6, w: 4.9, h: 1.4, margin: 0,
    fontFace: B, fontSize: 14, lineSpacing: 24,
  });

  s.addText('28 is above 26.\nSo it says you are fine.', {
    x: M + 6.3, y: 2.1, w: 5.6, h: 1.1, margin: 0,
    fontFace: H, fontSize: 26, bold: true, color: INK, lineSpacing: 34,
  });
  s.addText(
    'That is the whole of the logic. A number compared with another number.\n\n' +
    'It does not know how fast the item is leaving. It does not know how long ' +
    'your supplier takes. It has never once divided one by the other.',
    {
      x: M + 6.3, y: 3.35, w: 5.6, h: 1.6, margin: 0,
      fontFace: B, fontSize: 14, color: BODY, lineSpacing: 21,
    }
  );

  s.addShape('roundRect', {
    x: M, y: 4.75, w: CW, h: 1.55, rectRadius: 0.06,
    fill: { color: 'FEF6EC' }, line: { color: 'F3D9B4', width: 1 },
  });
  s.addText('It is not fine.', {
    x: M + 0.4, y: 4.95, w: CW - 0.8, h: 0.4, margin: 0,
    fontFace: H, fontSize: 19, bold: true, color: '8A5A17',
  });
  s.addText(
    'Seven units a day are leaving. 28 ÷ 7 = four days of stock. Your supplier takes ten. ' +
    'Ordering this morning still leaves six days with an empty shelf — and the screen ' +
    'above will show green every one of them.',
    {
      x: M + 0.4, y: 5.4, w: CW - 0.8, h: 0.8, margin: 0,
      fontFace: B, fontSize: 14, color: '6E4A16', lineSpacing: 20,
    }
  );
  s.addNotes('Real numbers from a live run. 28 available, 7 a day, 4 days cover, 10 day lead time.');

  /* 4 — what Guardian says */
  s = lightSlide(p, 'What Guardian says instead', 'The same item, same minute');
  findingCard(s, M, 1.85, CW, {
    severity: 'critical', tags: ['inventory'],
    title: 'Supplier 9 — BAK-00484, 4 days of cover',
    detail: 'Bakery item 484 has 4 days of cover. A replacement order takes about 10 days, ' +
            'so ordering today still leaves 6 days with nothing on the shelf.',
    rec: 'Raise an order to Supplier 9 for 184 units of BAK-00484.',
    rows: [['BAK-00484', '184', '28', '7', '4']],
  });
  s.addText(
    'Not an alert. An alert says a threshold was crossed — your stock screen already does that, ' +
    'and it is why 28 against 26 looks healthy. This says what is going to happen, when, ' +
    'and what to do about it.',
    {
      x: M, y: 5.7, w: CW, h: 0.9, margin: 0,
      fontFace: B, fontSize: 14.5, color: BODY, lineSpacing: 22,
    }
  );

  /* 5 — show the numbers */
  s = lightSlide(p, 'Every finding shows its working', 'Trust');
  s.addText(
    'An operations manager will not act on "trust me, Thursday will fall over" — and should not. ' +
    'So the arithmetic is on the page, not behind a support ticket.',
    { x: M, y: 1.8, w: CW, h: 0.7, margin: 0, fontFace: B, fontSize: 15, color: BODY, lineSpacing: 22 }
  );

  const steps = [
    ['1', 'Count what actually left', '758 units shipped over the last 90 days. Not a forecast — that happened.'],
    ['2', 'Turn it into a rate', '758 ÷ 90 = 7 units a day.'],
    ['3', 'Work out what is really yours', '46 on hand, 18 already promised to orders, so 28 can actually be sold.'],
    ['4', 'Divide', '28 ÷ 7 = 4 days of cover.'],
    ['5', 'Compare against the supplier', 'Four is less than ten. You are not approaching a problem. You are six days late.'],
  ];
  let y = 2.72;
  for (const [n, head, text] of steps) {
    badge(s, M, y, n, n === '5' ? AMBER : BLUE, 0.4);
    s.addText(head, {
      x: M + 0.62, y: y - 0.03, w: 4.1, h: 0.32, margin: 0,
      fontFace: B, fontSize: 14, bold: true, color: INK,
    });
    s.addText(text, {
      x: M + 4.85, y: y - 0.03, w: CW - 4.85, h: 0.5, margin: 0,
      fontFace: B, fontSize: 13, color: BODY, lineSpacing: 18,
    });
    y += 0.78;
  }
  s.addNotes('The fifth line is the one that matters. Everything above it is arithmetic; that is the judgement.');

  /* 6 — the cross-module one */
  s = darkSlide(p);
  s.addText('THE ONE NOBODY ELSE CAN DO', {
    x: M, y: 0.7, w: CW, h: 0.3, margin: 0,
    fontFace: B, fontSize: 11, bold: true, color: CYAN, charSpacing: 3,
  });
  s.addText('Two systems that never speak', {
    x: M, y: 1.05, w: CW, h: 0.6, margin: 0,
    fontFace: H, fontSize: 32, bold: true, color: 'FFFFFF',
  });
  findingCard(s, M, 1.95, CW, {
    severity: 'critical', tags: ['warehouse', 'fleet'], sevColor: RED,
    title: 'Calgary Depot loses 2 of 6 vehicles on Thursday',
    detail: '6 vehicles have been running from Calgary Depot. 2 of them are booked in for ' +
            'service on Thursday 06 Aug — 33% of the site\'s vehicles gone on one day. ' +
            'Dock use has risen from 88% to 94% over the same period.',
    rec: 'Move 1 of the Thursday bookings to a quieter day, or bring vehicles across from another site.',
  });
  s.addText(
    'Every fact in that sentence is ordinary. Your warehouse system knows the docks. ' +
    'Your fleet system knows the bookings. Nothing joins them — so nobody finds out until Thursday.',
    {
      x: M, y: 4.65, w: CW, h: 0.85, margin: 0,
      fontFace: B, fontSize: 15, color: 'A9B9CB', lineSpacing: 22,
    }
  );
  s.addShape('roundRect', {
    x: M, y: 5.65, w: CW, h: 0.95, rectRadius: 0.06,
    fill: { color: '13314A' },
  });
  s.addText(
    'No system you already own can produce this finding, because no system you already own can see both halves of it.',
    {
      x: M + 0.4, y: 5.65, w: CW - 0.8, h: 0.95, margin: 0, valign: 'middle',
      fontFace: H, fontSize: 17, italic: true, color: CYAN,
    }
  );

  /* 7 — how it works */
  s = lightSlide(p, 'How it works, in plain terms', 'Under the bonnet');
  const jobs = [
    [BLUE, 'Job one — work out what is true',
      'Arithmetic over your own history, done inside the database where it can see every row rather than the first page. ' +
      'Units shipped, days observed, stock committed, days of cover. No guessing, no model, no black box.'],
    [CYAN, 'Job two — say it well',
      'Turn that into a sentence a shift manager can act on without a training course. ' +
      '"Six days with nothing on the shelf" rather than "reorder point breach imminent".'],
  ];
  let jx = M;
  for (const [c, head, text] of jobs) {
    card(s, jx, 1.9, 5.86, 2.5);
    s.addShape('ellipse', { x: jx + 0.38, y: 2.2, w: 0.4, h: 0.4, fill: { color: c } });
    s.addText(head, {
      x: jx + 0.38, y: 2.75, w: 5.1, h: 0.36, margin: 0,
      fontFace: H, fontSize: 17, bold: true, color: INK,
    });
    s.addText(text, {
      x: jx + 0.38, y: 3.18, w: 5.1, h: 1.1, margin: 0,
      fontFace: B, fontSize: 13, color: BODY, lineSpacing: 19,
    });
    jx += 6.14;
  }
  s.addShape('roundRect', {
    x: M, y: 4.75, w: CW, h: 1.5, rectRadius: 0.06,
    fill: { color: WASH }, line: { color: LINE, width: 1 },
  });
  s.addText('Why that split matters to you', {
    x: M + 0.4, y: 4.95, w: CW - 0.8, h: 0.34, margin: 0,
    fontFace: B, fontSize: 14, bold: true, color: INK,
  });
  s.addText(
    'Language models are very good at job two and cannot do job one at all — hand one nothing true and it will ' +
    'produce something fluent and wrong. In operations that is worse than silence. So the numbers are worked ' +
    'out first, by arithmetic you can check, and only then turned into words.',
    {
      x: M + 0.4, y: 5.32, w: CW - 0.8, h: 0.85, margin: 0,
      fontFace: B, fontSize: 13.5, color: BODY, lineSpacing: 19,
    }
  );

  /* 8 — what it will not do */
  s = lightSlide(p, 'What it will not do', 'Read this slide carefully');
  s.addText(
    'Most software in this market is sold on what it might eventually do. This is what Opservor does not do today, ' +
    'stated before you ask.',
    { x: M, y: 1.78, w: CW, h: 0.6, margin: 0, fontFace: B, fontSize: 15, color: BODY, lineSpacing: 21 }
  );
  const nots = [
    ['It does not predict the future.', 'It divides what has happened by how fast it is happening. That is arithmetic, not prophecy.'],
    ['It does not know your supplier lead times.', 'Nothing records them yet, so it assumes ten days — and says so on every finding that relies on it.'],
    ['It does not replace your WMS or telematics.', 'It reads them. Keep what you have; this joins it up.'],
    ['It has no customers yet.', 'You would be the first. That is a real risk and it is priced into the conversation.'],
  ];
  y = 2.55;
  for (const [head, text] of nots) {
    s.addShape('ellipse', { x: M + 0.02, y: y + 0.06, w: 0.2, h: 0.2, fill: { color: AMBER } });
    s.addText(head, {
      x: M + 0.42, y, w: 5.0, h: 0.34, margin: 0,
      fontFace: B, fontSize: 14.5, bold: true, color: INK,
    });
    s.addText(text, {
      x: M + 5.5, y, w: CW - 5.5, h: 0.66, margin: 0,
      fontFace: B, fontSize: 13, color: BODY, lineSpacing: 18,
    });
    y += 0.92;
  }
  s.addText(
    'A supplier who tells you the limits before you sign is a supplier who will tell you when something breaks.',
    {
      x: M, y: 6.22, w: CW, h: 0.72, margin: 0,
      fontFace: H, fontSize: 16, italic: true, color: BLUE,
    }
  );

  /* 9 — the modules */
  s = lightSlide(p, 'What is in the product today', 'Built and running');
  const mods = [
    ['Guardian', 'Findings across every module'],
    ['Fleet', 'Vehicles, trips, mileage, maintenance'],
    ['Warehouse', 'Sites, shifts, docks, throughput'],
    ['Inventory', 'Stock, movements, suppliers'],
    ['Finance', 'Cost centres and transactions'],
    ['Workforce', 'Staff, attendance, hours'],
    ['Safety', 'Incidents and follow-up'],
    ['Reports', 'Totals over any date range'],
  ];
  let mx = M, my = 1.95;
  mods.forEach((m, i) => {
    card(s, mx, my, 2.9, 1.15, i === 0 ? 'EAF6FD' : WASH);
    s.addText(m[0], {
      x: mx + 0.26, y: my + 0.18, w: 2.4, h: 0.32, margin: 0,
      fontFace: H, fontSize: 16, bold: true, color: i === 0 ? '0A5C82' : INK,
    });
    s.addText(m[1], {
      x: mx + 0.26, y: my + 0.55, w: 2.42, h: 0.5, margin: 0,
      fontFace: B, fontSize: 11.5, color: i === 0 ? '2A7BA0' : SOFT, lineSpacing: 15,
    });
    mx += 3.0;
    if ((i + 1) % 4 === 0) { mx = M; my += 1.32; }
  });
  s.addText(
    'Every table is separated by company at the database level, with four roles and per-module permissions. ' +
    'Your data is not filtered from someone else\'s — it is walled off from it.',
    {
      x: M, y: 4.85, w: CW, h: 0.7, margin: 0,
      fontFace: B, fontSize: 14, color: BODY, lineSpacing: 20,
    }
  );
  s.addText([
    { text: '31 ', options: { bold: true, color: INK } }, { text: 'tables    ' },
    { text: '4 ', options: { bold: true, color: INK } }, { text: 'roles    ' },
    { text: '3 ', options: { bold: true, color: INK } }, { text: 'Guardian checks    ' },
    { text: '8 ', options: { bold: true, color: INK } }, { text: 'modules' },
  ], {
    x: M, y: 5.75, w: CW, h: 0.4, margin: 0,
    fontFace: B, fontSize: 15, color: SOFT,
  });

  /* 10 — what we need from you */
  s = lightSlide(p, 'What a trial would look like', 'Next step');
  const trial = [
    ['1', 'A read-only copy of three months of history', 'Stock movements, vehicle trips, maintenance bookings, shift records. Whatever you already export to a spreadsheet is enough.'],
    ['2', 'One afternoon', 'Loading it and running the checks against your real operation, not a demo.'],
    ['3', 'You tell us which findings are wrong', 'Every finding shows its working, so you can check it against what you already know. Wrong findings are more useful to us than right ones.'],
  ];
  y = 1.95;
  for (const [n, head, text] of trial) {
    card(s, M, y, CW, 1.35);
    badge(s, M + 0.32, y + 0.42, n, BLUE, 0.5);
    s.addText(head, {
      x: M + 1.05, y: y + 0.26, w: CW - 1.4, h: 0.36, margin: 0,
      fontFace: H, fontSize: 17, bold: true, color: INK,
    });
    s.addText(text, {
      x: M + 1.05, y: y + 0.66, w: CW - 1.4, h: 0.55, margin: 0,
      fontFace: B, fontSize: 13, color: BODY, lineSpacing: 18,
    });
    y += 1.5;
  }
  s.addText(
    'No integration work, no change to how your team works, nothing switched off.',
    {
      x: M, y: 6.4, w: CW, h: 0.4, margin: 0,
      fontFace: B, fontSize: 14, color: SOFT,
    }
  );

  /* 11 — close */
  s = darkSlide(p);
  s.addImage({ path: img('opservor-512.png'), x: M, y: 1.35, w: 0.95, h: 0.95 });
  s.addText('Every system you own\nreports what happened.', {
    x: M, y: 2.6, w: 10.5, h: 1.5, margin: 0,
    fontFace: H, fontSize: 34, color: '8FA3BA', lineSpacing: 46,
  });
  s.addText('None of them tell you\nwhat is about to.', {
    x: M, y: 4.15, w: 10.5, h: 1.5, margin: 0,
    fontFace: H, fontSize: 34, bold: true, color: 'FFFFFF', lineSpacing: 46,
  });
  s.addText('TeraSpheres  ·  Opservor  ·  Edmonton, Alberta', {
    x: M, y: 6.5, w: CW, h: 0.3, margin: 0,
    fontFace: B, fontSize: 12, color: '61738A',
  });

  return p.writeFile({ fileName: path.join(OUT, 'Opservor_Client_Deck.pptx') });
}

/* ============================================================== INVESTOR */

function investorDeck() {
  const p = new pptxgen();
  p.layout = 'LAYOUT_WIDE';
  p.author = 'TeraSpheres';
  p.company = 'TeraSpheres';
  p.title = 'TeraSpheres — Opservor';

  /* 1 — title */
  let s = darkSlide(p);
  s.addImage({ path: img('teraspheres-512.png'), x: M, y: 1.45, w: 1.05, h: 1.05 });
  s.addText('TERASPHERES', {
    x: M, y: 2.72, w: CW, h: 0.32, margin: 0,
    fontFace: B, fontSize: 13, bold: true, color: CYAN, charSpacing: 4,
  });
  s.addText('The gap between\nthe systems', {
    x: M, y: 3.06, w: 9.6, h: 1.9, margin: 0,
    fontFace: H, fontSize: 46, bold: true, color: 'FFFFFF', lineSpacing: 52,
  });
  s.addText('Opservor — operational intelligence for mid-market logistics', {
    x: M, y: 5.05, w: 9.6, h: 0.4, margin: 0,
    fontFace: B, fontSize: 17, color: '93A6BC',
  });
  s.addText('Ahsan Ahmad, Founder  ·  Edmonton, Alberta  ·  July 2026', {
    x: M, y: 6.6, w: CW, h: 0.3, margin: 0,
    fontFace: B, fontSize: 11, color: '61738A',
  });

  /* 2 — thesis */
  s = darkSlide(p);
  s.addText('The thesis', {
    x: M, y: 0.85, w: CW, h: 0.5, margin: 0,
    fontFace: B, fontSize: 13, bold: true, color: CYAN, charSpacing: 3,
  });
  // Four deliberate lines at 34pt. At 38pt the opening line wrapped and the
  // last line fell out of the box.
  s.addText(
    'A mid-sized distributor runs\nfour or five systems.\nEach one is correct.\nNone of them talk.',
    {
      x: M, y: 1.6, w: 11.4, h: 2.8, margin: 0,
      fontFace: H, fontSize: 34, bold: true, color: 'FFFFFF', lineSpacing: 48,
    }
  );
  s.addText(
    'Every operational failure that costs real money lives in the space between them — the depot that ran short ' +
    'of vehicles on its busiest day, the line that stopped because a part was ordered four days too late. ' +
    'Nobody sells software for that space, because selling it means joining data nobody owns together.',
    {
      x: M, y: 4.6, w: 11.0, h: 1.7, margin: 0,
      fontFace: B, fontSize: 16, color: 'A9B9CB', lineSpacing: 25,
    }
  );

  /* 3 — what everyone else sells */
  s = lightSlide(p, 'What the market already sells', 'Landscape');
  const seg = [
    ['Warehouse systems', 'Tell you what is in the building and where.', 'Blind to vehicles, people, cost.'],
    ['Telematics and fleet', 'Tell you where the vehicles are and how they drove.', 'Blind to stock, docks, orders.'],
    ['ERP and finance', 'Tell you what it cost, after it cost it.', 'Blind to next week.'],
    ['BI dashboards', 'Draw whatever you already know, more attractively.', 'Answer no question you did not ask.'],
  ];
  y = 1.95;
  for (const [name, does, blind] of seg) {
    card(s, M, y, CW, 1.05);
    s.addText(name, {
      x: M + 0.3, y: y + 0.2, w: 3.1, h: 0.62, margin: 0, valign: 'middle',
      fontFace: H, fontSize: 16, bold: true, color: INK,
    });
    s.addText(does, {
      x: M + 3.5, y: y + 0.2, w: 4.5, h: 0.62, margin: 0, valign: 'middle',
      fontFace: B, fontSize: 13, color: BODY, lineSpacing: 18,
    });
    s.addText(blind, {
      x: M + 8.2, y: y + 0.2, w: CW - 8.4, h: 0.62, margin: 0, valign: 'middle',
      fontFace: B, fontSize: 13, italic: true, color: 'A3592E', lineSpacing: 18,
    });
    y += 1.2;
  }
  s.addText(
    'Every one of them is a system of record. Opservor is not competing with any of them — it reads them, ' +
    'and answers the question none of them are shaped to answer.',
    {
      x: M, y: 6.35, w: CW, h: 0.6, margin: 0,
      fontFace: B, fontSize: 14.5, color: BODY, lineSpacing: 20,
    }
  );

  /* 4 — what Guardian is */
  s = lightSlide(p, 'The product', 'What Guardian is');
  findingCard(s, M, 1.85, CW, {
    severity: 'critical', tags: ['warehouse', 'fleet'],
    title: 'Calgary Depot loses 2 of 6 vehicles on Thursday',
    detail: '6 vehicles have been running from Calgary Depot. 2 are booked in for service on ' +
            'Thursday 06 Aug — 33% of the site\'s vehicles gone on one day. Dock use has risen ' +
            'from 88% to 94% over the same period.',
    rec: 'Move 1 of the Thursday bookings to a quieter day, or bring vehicles across from another site.',
  });
  s.addText(
    'Two facts from two systems, joined. The warehouse half and the fleet half are both unremarkable; ' +
    'the join is the product. Everything is worked out by arithmetic over the customer\'s own history and shown ' +
    'with its working, so it can be checked rather than believed.',
    {
      x: M, y: 4.55, w: CW, h: 0.9, margin: 0,
      fontFace: B, fontSize: 14.5, color: BODY, lineSpacing: 21,
    }
  );
  s.addText('Three checks are live: stock running out, stock that cannot be true, and depot capacity against fleet availability.', {
    x: M, y: 5.6, w: CW, h: 0.5, margin: 0,
    fontFace: B, fontSize: 13.5, italic: true, color: SOFT,
  });

  /* 5 — proof */
  s = lightSlide(p, 'It was tested against known answers', 'Proof, not a demo');
  s.addText(
    'The demo data is generated with a fixed number of problems deliberately planted in it, so a run either ' +
    'finds exactly those or the product is wrong. Against 800 products and 90 days of movements:',
    { x: M, y: 1.8, w: CW, h: 0.7, margin: 0, fontFace: B, fontSize: 15, color: BODY, lineSpacing: 21 }
  );
  const proof = [
    ['6', 'items with impossible stock', 'found', GREEN],
    ['6', 'items inside supplier lead time', 'found', GREEN],
    ['6', 'items just outside it', 'found', GREEN],
    ['0', 'problems invented', 'confirmed', BLUE],
  ];
  let px = M;
  for (const [n, label, verdict, c] of proof) {
    card(s, px, 2.7, 2.9, 2.0);
    s.addText(n, {
      x: px + 0.3, y: 2.92, w: 2.3, h: 0.75, margin: 0,
      fontFace: H, fontSize: 42, bold: true, color: c,
    });
    s.addText(label, {
      x: px + 0.3, y: 3.7, w: 2.35, h: 0.62, margin: 0,
      fontFace: B, fontSize: 12.5, color: BODY, lineSpacing: 17,
    });
    s.addText(verdict.toUpperCase(), {
      x: px + 0.3, y: 4.35, w: 2.3, h: 0.26, margin: 0,
      fontFace: B, fontSize: 10, bold: true, color: c, charSpacing: 1.5,
    });
    px += 3.0;
  }
  s.addText(
    'The first run before this discipline produced 72 criticals against the same catalogue. That was the data, ' +
    'not the check — and finding that out is exactly what a planted-answer test is for. A screen showing 72 ' +
    'urgent items is a screen nobody opens twice.',
    {
      x: M, y: 5.1, w: CW, h: 1.0, margin: 0,
      fontFace: B, fontSize: 14, color: BODY, lineSpacing: 21,
    }
  );

  /* 6 — the moat */
  s = darkSlide(p);
  s.addText('WHY THIS IS DEFENSIBLE', {
    x: M, y: 0.8, w: CW, h: 0.3, margin: 0,
    fontFace: B, fontSize: 11, bold: true, color: CYAN, charSpacing: 3,
  });
  s.addText('The join is the asset', {
    x: M, y: 1.15, w: CW, h: 0.7, margin: 0,
    fontFace: H, fontSize: 34, bold: true, color: 'FFFFFF',
  });
  const moat = [
    ['A single-module competitor cannot copy it', 'A warehouse vendor would have to acquire fleet data it has no relationship with, and vice versa. The finding needs both halves or it says nothing.'],
    ['The hard part is not the software', 'It is knowing which joins matter. Dock utilisation against maintenance bookings is obvious once written down and invisible until somebody who has run a depot writes it down.'],
    ['Every check compounds', 'Checks are rows of logic, not new products. Each one added works across every customer already connected, at no extra integration cost.'],
  ];
  y = 2.15;
  for (const [head, text] of moat) {
    s.addShape('roundRect', {
      x: M, y, w: CW, h: 1.35, rectRadius: 0.06, fill: { color: PANEL },
    });
    s.addText(head, {
      x: M + 0.42, y: y + 0.22, w: CW - 0.84, h: 0.36, margin: 0,
      fontFace: H, fontSize: 18, bold: true, color: CYAN,
    });
    s.addText(text, {
      x: M + 0.42, y: y + 0.63, w: CW - 0.84, h: 0.6, margin: 0,
      fontFace: B, fontSize: 13.5, color: 'AEBECF', lineSpacing: 19,
    });
    y += 1.5;
  }

  /* 7 — what is built */
  s = lightSlide(p, 'What is built today', 'Status');
  stat(s, M, 1.95, 2.5, '8', 'operational modules, all live');
  stat(s, M + 3.0, 1.95, 2.5, '31', 'database tables, all tenant-separated');
  stat(s, M + 6.0, 1.95, 2.5, '3', 'Guardian checks in production');
  stat(s, M + 9.0, 1.95, 2.5, '18', 'schema migrations shipped');

  s.addText('Deployed and running', {
    x: M, y: 3.5, w: CW, h: 0.34, margin: 0,
    fontFace: B, fontSize: 14, bold: true, color: INK,
  });
  const built = [
    'Multi-tenant separation enforced in the database, not the application — a bug in the code cannot leak another customer\'s data.',
    'Four roles with per-module permissions; finance and workforce require an explicit grant regardless of seniority.',
    'Three demo companies modelled on real sector shapes: 800, 1,200 and 5,000 stock items with matching staff and fleet.',
    'Continuous deployment from source control, with the live site checked for a response before a release is called done.',
  ];
  y = 3.95;
  for (const t of built) {
    s.addShape('ellipse', { x: M + 0.03, y: y + 0.07, w: 0.16, h: 0.16, fill: { color: BLUE } });
    s.addText(t, {
      x: M + 0.4, y, w: CW - 0.4, h: 0.55, margin: 0,
      fontFace: B, fontSize: 13.5, color: BODY, lineSpacing: 19,
    });
    y += 0.62;
  }
  s.addText('Not yet built: customer-facing user management, live system integrations, and any paying customer.', {
    x: M, y: 6.5, w: CW, h: 0.4, margin: 0,
    fontFace: B, fontSize: 13, italic: true, color: 'A3592E',
  });

  /* 8 — honesty as policy */
  s = lightSlide(p, 'Honesty is written into the build', 'How this is run');
  s.addText(
    'The release process refuses to publish a page claiming Guardian "watches", "predicts" or "learns" unless ' +
    'that behaviour exists in the code. It is an automated check, not a good intention.',
    { x: M, y: 1.8, w: CW, h: 0.72, margin: 0, fontFace: B, fontSize: 15, color: BODY, lineSpacing: 21 }
  );
  const rules = [
    ['Assumptions are labelled where they are used', 'Supplier lead time is assumed at ten days, and every finding that relies on it says so on screen.'],
    ['Inferences are labelled as inferences', 'Which vehicles serve which depot is worked out from where trips started, because nothing records it. The finding says that too.'],
    ['Demo data is marked as demo data', 'Every screen carries the badge. It is never cropped out for a slide.'],
    ['Unbuilt features are written in the future tense', 'A documented rule across every published document and page.'],
  ];
  y = 2.7;
  for (const [head, text] of rules) {
    card(s, M, y, CW, 0.92);
    s.addText(head, {
      x: M + 0.32, y: y + 0.13, w: 5.0, h: 0.32, margin: 0,
      fontFace: B, fontSize: 13.5, bold: true, color: INK,
    });
    s.addText(text, {
      x: M + 5.5, y: y + 0.13, w: CW - 5.8, h: 0.66, margin: 0,
      fontFace: B, fontSize: 12.5, color: BODY, lineSpacing: 17,
    });
    y += 1.03;
  }
  s.addText(
    'This costs sales in the short run and is the entire basis of the product in the long run. Operations people ' +
    'have been sold prediction before.',
    { x: M, y: 6.35, w: CW, h: 0.72, margin: 0, fontFace: H, fontSize: 15, italic: true, color: BLUE }
  );

  /* 9 — roadmap */
  s = lightSlide(p, 'What comes next', 'Roadmap');
  const road = [
    ['Now', 'Three checks, running against seeded operations', BLUE],
    ['Next', 'Capture real supplier lead times, replacing the ten-day assumption on every stock finding', BLUE],
    ['Next', 'Further cross-module checks: attendance against shift cover, cost drift against volume', BLUE],
    ['Then', 'First operator trial against three months of their own history', AMBER],
    ['Then', 'Live connections to the systems customers already run, replacing exports', AMBER],
  ];
  y = 2.0;
  for (const [when, what, c] of road) {
    s.addShape('ellipse', { x: M + 0.12, y: y + 0.16, w: 0.22, h: 0.22, fill: { color: c } });
    if (y < 5.4) {
      s.addShape('line', {
        x: M + 0.23, y: y + 0.38, w: 0, h: 0.55,
        line: { color: LINE, width: 1.5 },
      });
    }
    s.addText(when.toUpperCase(), {
      x: M + 0.6, y: y + 0.06, w: 1.1, h: 0.28, margin: 0,
      fontFace: B, fontSize: 10.5, bold: true, color: c, charSpacing: 1.5,
    });
    s.addText(what, {
      x: M + 1.85, y: y + 0.02, w: CW - 1.85, h: 0.56, margin: 0,
      fontFace: B, fontSize: 14, color: BODY, lineSpacing: 19,
    });
    y += 0.93;
  }
  s.addText(
    'Every item is a check or a connection. None of it requires a research breakthrough — which is the point. ' +
    'The value is in knowing which questions to ask, and that came from twenty years of running operations, ' +
    'not from a laboratory.',
    {
      x: M, y: 6.15, w: CW, h: 0.8, margin: 0,
      fontFace: B, fontSize: 13.5, color: BODY, lineSpacing: 19,
    }
  );

  /* 10 — founder */
  s = lightSlide(p, 'Why this founder', 'Team');
  card(s, M, 1.95, 5.7, 3.5);
  s.addText('Ahsan Ahmad', {
    x: M + 0.4, y: 2.22, w: 4.9, h: 0.48, margin: 0,
    fontFace: H, fontSize: 24, bold: true, color: INK,
  });
  s.addText('Founder, TeraSpheres', {
    x: M + 0.4, y: 2.68, w: 4.9, h: 0.3, margin: 0,
    fontFace: B, fontSize: 13, color: BLUE,
  });
  s.addText(
    'Twenty years leading operations in logistics, warehousing and distribution. ' +
    'Opservor is built from the inside — every check in it began as a problem that had ' +
    'to be solved on a shift, not as a feature request.',
    {
      x: M + 0.4, y: 3.2, w: 4.9, h: 1.5, margin: 0,
      fontFace: B, fontSize: 13.5, color: BODY, lineSpacing: 20,
    }
  );
  s.addText(
    'Building software for operations without having run operations is the ' +
    'reason so much of this market ships dashboards nobody opens twice.',
    {
      x: M + 6.3, y: 2.22, w: 5.6, h: 1.62, margin: 0,
      fontFace: H, fontSize: 19, italic: true, color: INK, lineSpacing: 27,
    }
  );
  s.addText(
    'Sole founder. That is a genuine risk and worth raising here rather than in diligence: ' +
    'there is no second person who knows the codebase, and hiring is the first thing capital would buy.',
    {
      x: M + 6.3, y: 3.9, w: 5.6, h: 1.4, margin: 0,
      fontFace: B, fontSize: 13.5, color: BODY, lineSpacing: 20,
    }
  );
  s.addText(
    'The written culture, hiring standards and conduct rules were set down before the first hire, on purpose — ' +
    'a company that writes its culture after it has people is describing an accident.',
    {
      x: M, y: 5.75, w: CW, h: 0.7, margin: 0,
      fontFace: B, fontSize: 13.5, color: SOFT, lineSpacing: 19,
    }
  );

  /* 11 — the numbers this deck does not contain */
  s = lightSlide(p, 'The numbers this deck does not contain', 'Deliberately blank');
  s.addText(
    'Four things an investor will ask for cannot be answered honestly yet. They are listed here rather than ' +
    'filled with plausible figures, because a made-up number in a deck is a lie that survives into diligence.',
    { x: M, y: 1.8, w: CW, h: 0.75, margin: 0, fontFace: B, fontSize: 15, color: BODY, lineSpacing: 21 }
  );
  const blanks = [
    ['Market size', 'Needs a defensible bottom-up count of mid-market operators running three or more disconnected systems, not a top-down logistics-software figure.'],
    ['Pricing', 'Needs one real conversation about what a depot manager\'s Thursday is worth. Nothing has been priced.'],
    ['Traction', 'None. No pilot, no letter of intent, no waiting list.'],
    ['The ask', 'Follows from the three above. Naming a figure before them is guessing.'],
  ];
  y = 2.75;
  for (const [head, text] of blanks) {
    s.addShape('roundRect', {
      x: M, y, w: CW, h: 0.86, rectRadius: 0.06,
      fill: { color: 'FEF6EC' }, line: { color: 'F3D9B4', width: 1 },
    });
    s.addText(head, {
      x: M + 0.32, y: y + 0.1, w: 2.6, h: 0.62, margin: 0, valign: 'middle',
      fontFace: H, fontSize: 15, bold: true, color: '8A5A17',
    });
    s.addText(text, {
      x: M + 3.1, y: y + 0.1, w: CW - 3.4, h: 0.66, margin: 0, valign: 'middle',
      fontFace: B, fontSize: 12.5, color: '6E4A16', lineSpacing: 17,
    });
    y += 0.97;
  }
  s.addNotes('Replace this slide once the first operator conversation has happened. Until then it is more credible than any figure that could go here.');

  /* 12 — close */
  s = darkSlide(p);
  s.addImage({ path: img('teraspheres-512.png'), x: M, y: 1.3, w: 0.95, h: 0.95 });
  s.addText('Every operational failure\nthat costs real money', {
    x: M, y: 2.55, w: 11.0, h: 1.4, margin: 0,
    fontFace: H, fontSize: 33, color: '8FA3BA', lineSpacing: 44,
  });
  s.addText('lives in the space\nbetween the systems.', {
    x: M, y: 4.0, w: 11.0, h: 1.4, margin: 0,
    fontFace: H, fontSize: 33, bold: true, color: 'FFFFFF', lineSpacing: 44,
  });
  s.addText('TeraSpheres  ·  Opservor  ·  ahsan.ahmad1@gmail.com', {
    x: M, y: 6.5, w: CW, h: 0.3, margin: 0,
    fontFace: B, fontSize: 12, color: '61738A',
  });

  return p.writeFile({ fileName: path.join(OUT, 'Opservor_Investor_Deck.pptx') });
}

/* -------------------------------------------------------------------- run */
(async () => {
  await clientDeck();
  await investorDeck();
  console.log('written to ' + OUT);
})();
