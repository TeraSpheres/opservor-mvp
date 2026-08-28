/* Opservor — homepage hero master, mobile.
 *
 * Not the desktop hero made smaller. The desktop hero argues radially: six
 * systems around a centre, the eye picking out which three light up. A phone
 * has no room for that and no width for a four-column working, and a shrunk
 * version of both is how a good idea arrives looking cheap.
 *
 * So the argument is re-staged vertically, which a phone is actually good at.
 * Three systems stack down the screen. A single line runs through them into
 * the mark. The finding sits under it. Reading top to bottom IS the reasoning:
 * three things known separately, joined, and what that produces.
 *
 * The constraint that shaped everything: it must fit 390x844 — one iPhone
 * viewport, nothing below the fold. If the argument needs a scroll to land,
 * most of the people arriving from a LinkedIn post never see it. Six systems
 * became three, and the three are the three the finding is built from, so
 * nothing needed for the argument was cut. What went is decoration.
 *
 * Rendered at 3x for a 1170x2532 master.
 *
 * Run: node tools/build-hero-mobile.js
 */

const fs = require('fs');
const puppeteer = require('puppeteer-core');

const OUT = 'C:/Users/ahsan/Documents/TeraSpheres_Archive/Posts/Screens';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const MARK_FILE = 'C:/opservor-mvp/teraspheres-website/brand/opservor-1024.png';

const W = 390, H = 844, SCALE = 3;   // -> 1170 x 2532

const MARK = 'data:image/png;base64,'
  + fs.readFileSync(MARK_FILE).toString('base64');

/* The three the finding is built from. On desktop the other three appear and
 * stay dim; here they are absent, because a dim thing on a phone is not
 * restraint, it is clutter you cannot read. */
const CHAIN = [
  { k: 'INVENTORY',  v: '28 units on hand' },
  { k: 'MOVEMENT',   v: '630 units / 90 days' },
  { k: 'PURCHASING', v: '10 day lead time' },
];

const CSS = `
:root{
  --ink:#F2F6FB; --mut:#8FA6C4;
  --blue:#3B82F6; --cyan:#22D3EE; --amber:#FFA940; --red:#F8686B;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{
  background:
    radial-gradient(420px 380px at 78% 16%, rgba(37,99,235,.16), transparent 70%),
    linear-gradient(168deg,#0B1424 0%,#0A1120 58%,#070D18 100%);
  color:var(--ink);
  font-family:"Segoe UI","Inter",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;
  padding:0 20px;
  display:flex; flex-direction:column;
}

/* ---- bar ---- */
.bar{display:flex;align-items:center;gap:9px;padding:16px 0 0}
.bar .m{width:24px;height:24px;border-radius:50%;overflow:hidden;position:relative;
  background:radial-gradient(circle at 50% 42%,#0C1A33,#050C1A 70%);
  box-shadow:0 0 14px rgba(59,130,246,.5)}
.bar .m img{position:absolute;left:50%;top:50%;width:23px;height:23px;
  transform:translate(-50%,-50%)}
.bar .n{font-size:15px;font-weight:600;letter-spacing:-.2px}
.bar .burger{margin-left:auto;display:flex;flex-direction:column;gap:4px}
.bar .burger i{display:block;width:19px;height:1.5px;background:#5E7B9E;border-radius:1px}

/* ---- copy ---- */
.eyebrow{font-size:8.5px;letter-spacing:.26em;color:var(--cyan);margin:22px 0 10px}
h1{font-size:31px;line-height:1.1;font-weight:600;letter-spacing:-.85px}
h1 em{font-style:normal;color:#7FB4FF}
.sub{font-size:13px;line-height:1.55;color:var(--mut);margin-top:11px}
.sub b{color:#D6E3F2;font-weight:500}

.btn{display:flex;align-items:center;justify-content:center;gap:9px;margin-top:15px;
  background:linear-gradient(180deg,#3B82F6,#2563EB);border-radius:9px;
  padding:13px 0;font-size:12.5px;font-weight:600;letter-spacing:.1em;
  box-shadow:0 8px 22px rgba(37,99,235,.4)}
.btn .live{width:7px;height:7px;border-radius:50%;background:#8FF3D0;
  box-shadow:0 0 8px #3FD9A0}
.eng{text-align:center;margin-top:10px;font-size:8.5px;letter-spacing:.2em;color:#5E7B9E}

/* ---- the chain: three systems, one line through them ---- */
.chain{position:relative;margin-top:16px;padding-left:24px}
/* Runs past the last system and into the mark. Stopping it at PURCHASING made
 * the mark read as a separate thing sitting below the list, rather than as
 * what the list arrives at — which is the entire argument. */
.spine{position:absolute;left:7px;top:14px;bottom:-26px;width:1.5px;border-radius:1px;
  background:linear-gradient(180deg,rgba(34,211,238,.15),rgba(34,211,238,.85))}
.step{position:relative;display:flex;align-items:baseline;gap:8px;padding:7px 0}
.step:before{content:'';position:absolute;left:-22px;top:12px;width:9px;height:9px;
  border-radius:50%;background:#0A1220;border:1.5px solid rgba(34,211,238,.8);
  box-shadow:0 0 9px rgba(34,211,238,.5)}
.step .k{font-size:8.5px;letter-spacing:.18em;color:#5FD8EC;width:78px;flex:0 0 78px}
.step .v{font-size:14px;font-weight:600;color:#DCE8F6;letter-spacing:-.2px}

.join{display:flex;align-items:center;gap:11px;margin-top:2px}
.join .m{width:38px;height:38px;border-radius:50%;overflow:hidden;position:relative;
  flex:0 0 38px;margin-left:-11px;
  background:radial-gradient(circle at 50% 42%,#0C1A33,#050C1A 70%);
  box-shadow:0 0 22px rgba(59,130,246,.55)}
.join .m img{position:absolute;left:50%;top:50%;width:36px;height:36px;
  transform:translate(-50%,-50%)}
.join .g{font-size:9.5px;letter-spacing:.24em;color:#9EC6E4}
.join .s{font-size:8px;letter-spacing:.1em;color:#59768F;margin-top:3px}

/* ---- the finding ---- */
.find{margin-top:14px;margin-bottom:18px;
  background:linear-gradient(160deg,rgba(20,33,55,.98),rgba(14,25,42,.98));
  border:1px solid #2A3C58;border-left:3px solid var(--red);border-radius:12px;
  padding:15px 16px;box-shadow:0 18px 44px rgba(3,8,18,.62)}
.tags{display:flex;align-items:center;gap:7px;margin-bottom:10px}
.tag{font-size:8px;letter-spacing:.14em;padding:4px 8px;border-radius:4px;
  background:rgba(248,104,107,.14);color:#FF9DA0;border:1px solid rgba(248,104,107,.32)}
.demo{font-size:7.5px;letter-spacing:.12em;padding:4px 7px;border-radius:4px;
  background:rgba(143,166,196,.1);color:#8FA6C4;border:1px solid #2B3D57;margin-left:auto}
.find h2{font-size:21px;font-weight:600;letter-spacing:-.4px;line-height:1.15}
.find h2 em{font-style:normal;color:var(--amber)}
.figs{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:12px 0 11px}
.fig{background:rgba(9,17,31,.72);border:1px solid #23344E;border-radius:7px;padding:9px 10px}
.fig .n{font-size:7px;letter-spacing:.16em;color:#6C84A4;margin-bottom:5px}
.fig .v{font-family:Consolas,monospace;font-size:14.5px;font-weight:600;color:#EAF2FB}
.fig .v em{font-style:normal;color:var(--cyan)}
.fig .v em.w{color:var(--amber)}
.said{border-top:1px solid #23344E;padding-top:11px;display:flex;
  align-items:flex-end;justify-content:space-between;gap:12px}
.said p{font-size:11px;line-height:1.5;color:#A9BFD6}
.said p b{color:#DDE9F6;font-weight:600}
.why{font-size:9.5px;letter-spacing:.12em;color:#8FC0FF;white-space:nowrap}

/* The band left under the finding, doing a job rather than sitting empty:
 * it names what is below the fold, so scrolling is a choice rather than a
 * guess. margin-top:auto pins it to the bottom of the flex column. */
.more{margin-top:auto;padding-bottom:18px;text-align:center}
.more .t{font-size:8px;letter-spacing:.22em;color:#4E6B90}
.more .c{margin:8px auto 0;width:9px;height:9px;
  border-right:1.5px solid #33547B;border-bottom:1.5px solid #33547B;
  transform:rotate(45deg)}
`;

const step = (s) => `<div class="step"><div class="k">${s.k}</div><div class="v">${s.v}</div></div>`;

const HTML = `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><style>${CSS}</style>
<div class="bar">
  <div class="m"><img src="${MARK}"></div>
  <div class="n">Opservor</div>
  <div class="burger"><i></i><i></i><i></i></div>
</div>

<div class="eyebrow">OPERATIONAL INTELLIGENCE</div>
<h1>Operational intelligence that <em>thinks ahead.</em></h1>
<div class="sub">Your systems already know what is happening. Opservor connects what they know
  and surfaces what deserves attention &mdash; <b>before the consequence becomes obvious.</b></div>

<div class="btn"><span class="live"></span>SEE GUARDIAN THINK</div>
<div class="eng">POWERED BY GUARDIAN INTELLIGENCE</div>

<div class="chain">
  <div class="spine"></div>
  ${CHAIN.map(step).join('\n  ')}
</div>
<div class="join">
  <div class="m"><img src="${MARK}"></div>
  <div><div class="g">GUARDIAN</div><div class="s">CONNECTED ALL THREE</div></div>
</div>

<div class="find">
  <div class="tags"><span class="tag">RISK &middot; ATTENTION REQUIRED</span>
    <span class="demo">DEMO DATA</span></div>
  <h2>Six days with an <em>empty shelf.</em></h2>
  <div class="figs">
    <div class="fig"><div class="n">LEAVING PER DAY</div><div class="v">630 &divide; 90 = <em>7</em></div></div>
    <div class="fig"><div class="n">COVER LEFT</div><div class="v">28 &divide; 7 = <em class="w">4</em></div></div>
    <div class="fig"><div class="n">SUPPLIER TAKES</div><div class="v">10 &minus; 4 = <em class="w">6</em></div></div>
    <div class="fig"><div class="n">ON HAND</div><div class="v">28</div></div>
  </div>
  <div class="said">
    <p><b>No single system was wrong.</b> None knew enough alone.</p>
    <div class="why">WHY THIS MATTERS &rarr;</div>
  </div>
</div>

<div class="more">
  <div class="t">THE TEN INTELLIGENCE PACKS</div>
  <div class="c"></div>
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

  // The whole point is that nothing falls below the fold. If it does, say so
  // rather than shipping a master that quietly loses its own payoff.
  const over = await page.evaluate(() => document.body.scrollHeight - window.innerHeight);
  if (over > 0) console.log(`\n  WARNING: content overflows the viewport by ${over}px`);

  const dest = `${OUT}/OPSERVOR_00_Homepage_Hero_Mobile_3x.png`;
  await page.screenshot({ path: dest, type: 'png' });
  await browser.close();

  const kb = Math.round(fs.statSync(dest).size / 1024);
  console.log(`\n  OPSERVOR_00_Homepage_Hero_Mobile_3x.png  ${W * SCALE}x${H * SCALE}  ${kb} KB`);
  console.log(`  ${over > 0 ? 'DOES NOT FIT' : 'fits'} one 390x844 viewport\n`);
})();
