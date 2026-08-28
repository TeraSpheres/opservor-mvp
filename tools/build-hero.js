/* Opservor — homepage hero master.
 *
 * One image whose job is to make the argument before anyone reads the page:
 * the company already holds the information, no single system held enough of
 * it, and the thing worth paying for is the connection between them.
 *
 * Rendered as HTML text rather than generated as art, for the same reason the
 * product screens are: the whole claim rests on arithmetic, and an image model
 * will hand back 630 / 90 = 9 looking immaculate. Every figure here is one the
 * seeded tenant's checks actually compute.
 *
 * Three layers, as specified:
 *   1. Six operational systems, each holding one true fact, unconnected.
 *   2. The Opservor mark between them, joining only the meaningful pairs.
 *   3. One finding, carrying its own working.
 *
 * The brand hierarchy from TS-BRAND-001 section 2.3 is load-bearing here:
 * Opservor leads, Guardian appears only beneath it and never alone, and
 * TeraSpheres does not appear in the hero at all - it returns in the footer.
 *
 * Run: node tools/build-hero.js
 */

const fs = require('fs');
const puppeteer = require('puppeteer-core');

const OUT = 'C:/Users/ahsan/Documents/TeraSpheres_Archive/Posts/Screens';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const MARK_FILE = 'C:/opservor-mvp/teraspheres-website/brand/opservor-1024.png';

const W = 1920, H = 1080, SCALE = 2;   // -> 3840 x 2160

const MARK = 'data:image/png;base64,'
  + fs.readFileSync(MARK_FILE).toString('base64');

/* ---------- geometry ----------
 * Two columns of three, the mark between them, the finding across the bottom.
 * A ring was tried first and read as decoration; a grid reads as systems. */
const PANEL_X = 806;                       // left copy occupies 42%
const NODE_W = 268, NODE_H = 104;
const COL_L = 858, COL_R = 1580;
const ROWS = [168, 308, 448];
const CX = 1353, CY = 340, MARK_D = 138;   // the mark, centred between columns

/* The three on the left are the three the finding is built from. That is why
 * they are the three that light. The right-hand cluster connects too, but
 * dimly - "not everything connects to everything" is the point. */
const NODES = [
  { col:'L', row:0, k:'INVENTORY',   v:'28 units on hand',        lit:true  },
  { col:'L', row:1, k:'MOVEMENT',    v:'630 units / 90 days',     lit:true  },
  { col:'L', row:2, k:'PURCHASING',  v:'10 day lead time',        lit:true  },
  { col:'R', row:0, k:'FLEET',       v:'Calgary Depot',           lit:false },
  { col:'R', row:1, k:'MAINTENANCE', v:'2 jobs booked',           lit:false },
  { col:'R', row:2, k:'WAREHOUSE',   v:'Dock use 88% \u2192 94%', lit:false },
];

const nodeBox = (n) => {
  const x = n.col === 'L' ? COL_L : COL_R;
  return { x, y: ROWS[n.row], w: NODE_W, h: NODE_H };
};

// Line from the node's inner edge to the edge of the mark, not its centre —
// a line that disappears under the mark reads as a line that stops there.
const lines = NODES.map((n) => {
  const b = nodeBox(n);
  const x1 = n.col === 'L' ? b.x + b.w : b.x;
  const y1 = b.y + b.h / 2;
  const dx = CX - x1, dy = CY - y1;
  const len = Math.hypot(dx, dy) || 1;
  const gap = MARK_D / 2 + 10;
  return {
    x1, y1,
    x2: CX - (dx / len) * gap,
    y2: CY - (dy / len) * gap,
    lit: n.lit,
  };
});

const CSS = `
:root{
  --bg:#0A1220; --card:#111E33; --line:#1E2E47;
  --ink:#F2F6FB; --mut:#8FA6C4;
  --blue:#3B82F6; --cyan:#22D3EE; --amber:#FFA940; --red:#F8686B;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{
  background:
    radial-gradient(1100px 760px at 72% 30%, rgba(37,99,235,.14), transparent 68%),
    linear-gradient(155deg,#0B1424 0%,#0A1120 55%,#070D18 100%);
  color:var(--ink);
  font-family:"Segoe UI","Inter",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;
  position:relative;
}

/* ---- left: the argument in words ---- */
.copy{position:absolute;left:104px;top:262px;width:640px}
.eyebrow{font-size:11px;letter-spacing:.28em;color:var(--cyan);margin-bottom:26px}
h1{font-size:60px;line-height:1.06;font-weight:600;letter-spacing:-1.4px}
h1 em{font-style:normal;color:#7FB4FF}
.sub{font-size:19px;line-height:1.62;color:var(--mut);margin-top:28px}
.sub b{color:#D6E3F2;font-weight:500}

.cta{display:flex;align-items:center;gap:26px;margin-top:44px}
.btn{display:flex;align-items:center;gap:11px;
  background:linear-gradient(180deg,#3B82F6,#2563EB);
  border-radius:9px;padding:16px 26px;font-size:14px;font-weight:600;
  letter-spacing:.1em;box-shadow:0 10px 30px rgba(37,99,235,.42)}
.btn .live{width:8px;height:8px;border-radius:50%;background:#8FF3D0;
  box-shadow:0 0 9px #3FD9A0}
.alt{font-size:14px;color:#9FB6D2;border-bottom:1px solid #2C4October}
.alt{border-bottom:1px solid #2C4straight}
.alt{border-bottom:1px solid #2C4661;padding-bottom:3px}

.eng{margin-top:40px;display:flex;align-items:center;gap:11px;
  font-size:10.5px;letter-spacing:.2em;color:#5F7characters}
.eng{color:#5E7B9E}
.eng .d{width:22px;height:1px;background:#26period}
.eng .d{background:#263C58}

/* ---- right: the same argument in a picture ---- */
.field{position:absolute;left:${PANEL_X}px;top:0;width:${W - PANEL_X}px;height:${H}px}
svg.wires{position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:visible}

.node{position:absolute;border-radius:11px;padding:17px 19px;
  background:linear-gradient(165deg,rgba(18,31,53,.96),rgba(13,24,42,.96));
  border:1px solid #22334E}
.node .k{font-size:9.5px;letter-spacing:.2em;color:#7189A8;margin-bottom:9px}
.node .v{font-size:17px;font-weight:600;color:#DCE8F6;letter-spacing:-.2px}
.node.lit{border-color:rgba(34,211,238,.44);
  box-shadow:0 0 0 1px rgba(34,211,238,.1),0 12px 34px rgba(6,14,28,.6)}
.node.lit .k{color:#5FD8EC}

.mark{position:absolute;left:${CX - PANEL_X - MARK_D / 2}px;top:${CY - MARK_D / 2}px;
  width:${MARK_D}px;height:${MARK_D}px;border-radius:50%;overflow:hidden;
  background:radial-gradient(circle at 50% 42%,#0C1A33,#050C1A 70%);
  box-shadow:0 0 46px rgba(59,130,246,.5),0 0 100px rgba(59,130,246,.2)}
.mark img{position:absolute;left:50%;top:50%;width:${MARK_D * 0.94}px;
  height:${MARK_D * 0.94}px;transform:translate(-50%,-50%)}
.eng2{position:absolute;left:${CX - PANEL_X - 200}px;width:400px;top:${CY + MARK_D / 2 + 18}px;text-align:center}
.eng2 .g{font-size:12px;letter-spacing:.26em;color:#9EC6E4}
.eng2 .s{font-size:9.5px;letter-spacing:.14em;color:#5A7characters;margin-top:6px}
.eng2 .s{color:#59768F}

/* ---- the finding ---- */
.find{position:absolute;left:${COL_L - PANEL_X}px;top:652px;
  width:${COL_R + NODE_W - COL_L}px;
  background:linear-gradient(160deg,rgba(20,33,55,.98),rgba(14,25,42,.98));
  border:1px solid #2A3C58;border-left:3px solid var(--red);
  border-radius:13px;padding:26px 30px;
  box-shadow:0 30px 70px rgba(3,8,18,.66)}
.tags{display:flex;align-items:center;gap:10px;margin-bottom:15px}
.tag{font-size:9.5px;letter-spacing:.16em;padding:5px 11px;border-radius:5px;
  background:rgba(248,104,107,.14);color:#FF9DA0;border:1px solid rgba(248,104,107,.32)}
.demo{font-size:9px;letter-spacing:.16em;padding:5px 10px;border-radius:5px;
  background:rgba(143,166,196,.1);color:#8FA6C4;border:1px solid #2B3D57;margin-left:auto}
.find h2{font-size:31px;font-weight:600;letter-spacing:-.5px}
.find h2 em{font-style:normal;color:var(--amber)}

.figs{display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin:20px 0 18px}
.fig{background:rgba(9,17,31,.72);border:1px solid #23344E;border-radius:8px;padding:13px 15px}
.fig .n{font-size:8.5px;letter-spacing:.18em;color:#6C84A4;margin-bottom:7px}
.fig .v{font-family:Consolas,monospace;font-size:21px;font-weight:600;color:#EAF2FB}
.fig .v em{font-style:normal;color:var(--cyan)}
.fig .v em.w{color:var(--amber)}

.said{display:flex;align-items:center;justify-content:space-between;gap:24px;
  border-top:1px solid #23344E;padding-top:16px}
.said p{font-size:13.5px;color:#A9BFD6;line-height:1.55;max-width:790px}
.said p b{color:#DDE9F6;font-weight:600}
.why{font-size:12px;letter-spacing:.14em;color:#8FC0FF;white-space:nowrap}
`;

const node = (n) => {
  const b = nodeBox(n);
  return `<div class="node${n.lit ? ' lit' : ''}" style="left:${b.x - PANEL_X}px;top:${b.y}px;width:${b.w}px;height:${b.h}px">
    <div class="k">${n.k}</div><div class="v">${n.v}</div></div>`;
};

const wire = (l) => `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}"
  stroke="${l.lit ? 'url(#lit)' : 'url(#dim)'}"
  stroke-width="${l.lit ? 2 : 1.2}" stroke-linecap="round"/>`;

const HTML = `<!doctype html><meta charset="utf-8"><style>${CSS}</style>
<div class="copy">
  <div class="eyebrow">OPERATIONAL INTELLIGENCE</div>
  <h1>Operational intelligence<br>that <em>thinks ahead.</em></h1>
  <div class="sub">Your systems already know what is happening. Opservor connects what they
    know, understands what it means, and surfaces what deserves attention &mdash;
    <b>before the consequence becomes obvious.</b></div>
  <div class="cta">
    <div class="btn"><span class="live"></span>SEE GUARDIAN THINK</div>
    <div class="alt">Request a demonstration</div>
  </div>
  <div class="eng"><span class="d"></span>POWERED BY GUARDIAN INTELLIGENCE</div>
</div>

<svg class="wires">
  <defs>
    <linearGradient id="lit" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#22D3EE" stop-opacity=".18"/>
      <stop offset="100%" stop-color="#22D3EE" stop-opacity=".85"/>
    </linearGradient>
    <linearGradient id="dim" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#3B82F6" stop-opacity=".08"/>
      <stop offset="100%" stop-color="#3B82F6" stop-opacity=".32"/>
    </linearGradient>
  </defs>
  ${lines.map(wire).join('\n  ')}
</svg>

<div class="field">
  ${NODES.map(node).join('\n  ')}

  <div class="mark"><img src="${MARK}"></div>
  <div class="eng2"><div class="g">GUARDIAN</div>
    <div class="s">OPERATIONAL INTELLIGENCE ENGINE</div></div>

  <div class="find">
    <div class="tags"><span class="tag">RISK &middot; ATTENTION REQUIRED</span>
      <span class="demo">DEMO DATA &middot; ILLUSTRATIVE</span></div>
    <h2>Six days with an <em>empty shelf.</em></h2>
    <div class="figs">
      <div class="fig"><div class="n">ON HAND</div><div class="v">28</div></div>
      <div class="fig"><div class="n">LEAVING PER DAY</div><div class="v">630 &divide; 90 = <em>7</em></div></div>
      <div class="fig"><div class="n">COVER LEFT</div><div class="v">28 &divide; 7 = <em class="w">4</em></div></div>
      <div class="fig"><div class="n">SUPPLIER TAKES</div><div class="v">10 &minus; 4 = <em class="w">6</em></div></div>
    </div>
    <div class="said">
      <p>Guardian connected Inventory, Movement and Purchasing.
        <b>No single system was wrong &mdash; none knew enough alone.</b></p>
      <div class="why">WHY THIS MATTERS &rarr;</div>
    </div>
  </div>
</div>`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    args: ['--force-device-scale-factor=1', '--font-render-hinting=none'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: SCALE });
  await page.setContent(HTML, { waitUntil: 'load' });
  await page.evaluate(() => Promise.all(
    [...document.querySelectorAll('img')].map((i) => i.decode())
  ));

  const dest = `${OUT}/OPSERVOR_00_Homepage_Hero_4K.png`;
  await page.screenshot({ path: dest, type: 'png' });
  await browser.close();

  const kb = Math.round(fs.statSync(dest).size / 1024);
  console.log(`\n  OPSERVOR_00_Homepage_Hero_4K.png  ${W * SCALE}x${H * SCALE}  ${kb} KB\n`);
})();
