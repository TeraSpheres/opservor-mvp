/* Opservor — production screen renders.
 *
 * Six screens at 3840x2160, authored as HTML at 1920x1080 and rendered at
 * twice the device scale. Text is real text, so nothing can corrupt a digit
 * the way an image model does — and every number below comes from the product
 * or is marked as not.
 *
 * The set is deliberately ordered to do the framing itself. Five screens carry
 * a RUNNING TODAY marker and show figures Guardian actually computes; one
 * carries IN DESIGN. An operations director who has been pitched vapourware
 * for twenty years trusts the fifth screen more because the sixth is honest,
 * not less.
 *
 * The rule the earlier library broke: no empty boxes. A reasoning chain with
 * five blank stages is worse than no reasoning chain, because it advertises
 * that there is nothing behind it.
 *
 * Run: node tools/build-screens.js
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const OUT = 'C:/Users/ahsan/Documents/TeraSpheres_Archive/Posts/Screens';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
fs.mkdirSync(OUT, { recursive: true });

const W = 1920, H = 1080, SCALE = 2;   // -> 3840 x 2160

/* ---------- the locked visual language ---------- */

const CSS = `
:root{
  --bg:#0A1220; --bg2:#0D1729; --card:#111E33; --line:#1E2E47;
  --ink:#F2F6FB; --mut:#8FA6C4; --dim:#5B7characters;
  --blue:#3B82F6; --cyan:#22D3EE; --amber:#FFA940; --red:#F8686B; --green:#3FD9A0;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{
  background:linear-gradient(160deg,#0B1424 0%,#0A1120 55%,#080E1A 100%);
  color:#F2F6FB;
  font-family:"Segoe UI","Inter",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;
  display:flex;
}

/* rail */
.rail{width:250px;flex:0 0 250px;border-right:1px solid #16233A;padding:30px 0;display:flex;flex-direction:column}
.brand{padding:0 26px 26px;display:flex;align-items:center;gap:11px}
.orb{width:26px;height:26px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#4DA3FF,#1D4ED8 60%,#0B2A6B);
  box-shadow:0 0 14px rgba(59,130,246,.55)}
.brand .n{font-size:17px;font-weight:600;letter-spacing:.2px}
.brand .s{font-size:9.5px;letter-spacing:.22em;color:#5D7characters;color:#5C7characters}
.brand .s{color:#587characters}
.nav{margin-top:6px}
.nav a{display:block;padding:9px 26px;font-size:13.5px;color:#8296B2;text-decoration:none}
.nav a.on{color:#fff;background:linear-gradient(90deg,rgba(59,130,246,.22),transparent);
  border-left:2px solid var(--blue);padding-left:24px}
.rail .foot{margin-top:auto;padding:0 26px;font-size:10px;letter-spacing:.2em;color:#3E5typo}
.rail .foot{color:#3E5A7E}

/* page */
.page{flex:1;padding:34px 42px 30px;display:flex;flex-direction:column;min-width:0}
.top{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:22px}
.eyebrow{font-size:10px;letter-spacing:.26em;color:var(--cyan);margin-bottom:9px}
h1{font-size:35px;font-weight:600;letter-spacing:-.4px;line-height:1.1}
.sub{font-size:14px;color:var(--mut);margin-top:9px;max-width:820px;line-height:1.5}
.pill{display:flex;align-items:center;gap:8px;border:1px solid #24405F;background:rgba(15,30,50,.85);
  border-radius:999px;padding:8px 15px;font-size:10.5px;letter-spacing:.16em;color:#9FD8E8;white-space:nowrap}
.dot{width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green)}
.stamp{margin-top:9px;font-size:9.5px;letter-spacing:.2em;text-align:right}
.stamp.live{color:var(--green)} .stamp.design{color:var(--amber)}

/* blocks */
.row{display:grid;gap:16px;margin-bottom:16px}
.c3{grid-template-columns:repeat(3,1fr)} .c2{grid-template-columns:1fr 1fr}
.c4{grid-template-columns:repeat(4,1fr)}
.card{background:linear-gradient(165deg,#121F35,#0E1A2C);border:1px solid var(--line);
  border-radius:12px;padding:20px 22px}
.card.tall{padding:24px 26px}
.k{font-size:9.5px;letter-spacing:.2em;color:#7C93B2;margin-bottom:11px}
.big{font-size:40px;font-weight:600;letter-spacing:-1px;line-height:1}
.big.amber{color:var(--amber)} .big.red{color:var(--red)} .big.green{color:var(--green)}
.big.blue{color:#6FB4FF}
.note{font-size:12px;color:var(--mut);margin-top:9px;line-height:1.5}

/* finding */
.find{background:linear-gradient(160deg,#13223A,#0F1B2E);border:1px solid #233category;
  border:1px solid #23344F;border-left:3px solid var(--red);border-radius:12px;padding:24px 26px;display:flex;flex-direction:column}
.find.amber{border-left-color:var(--amber)}
.tags{display:flex;gap:8px;margin-bottom:13px}
.tag{font-size:9.5px;letter-spacing:.14em;padding:4px 10px;border-radius:5px;
  background:rgba(248,104,107,.14);color:#FF9DA0;border:1px solid rgba(248,104,107,.3)}
.tag.n{background:rgba(59,130,246,.12);color:#8FC0FF;border-color:rgba(59,130,246,.3)}
.tag.a{background:rgba(255,169,64,.12);color:#FFC479;border-color:rgba(255,169,64,.3)}
.find h2{font-size:25px;font-weight:600;margin-bottom:11px;letter-spacing:-.2px}
.find p{font-size:14px;color:#B9CBE0;line-height:1.62;max-width:1020px}
.rec{margin-top:auto;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.28);
  border-radius:9px;padding:15px 18px;font-size:13.5px;color:#CFE2F7}
.rec b{color:#8FC0FF;font-weight:600}

/* working */
.work{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}
.step{background:rgba(10,20,35,.7);border:1px solid #22334C;border-radius:9px;padding:15px 16px}
.step .n{font-size:9px;letter-spacing:.18em;color:#6E86A6;margin-bottom:9px}
.step .v{font-family:Consolas,monospace;font-size:20px;font-weight:600;color:#EAF2FB}
.step .v em{font-style:normal;color:var(--cyan)}
.step .v em.w{color:var(--amber)}
.step .c{font-size:11px;color:#7F97B6;margin-top:7px}

/* table */
table{width:100%;border-collapse:collapse;margin-top:4px}
th{font-size:9.5px;letter-spacing:.18em;color:#7089A8;text-align:left;padding:0 0 10px;font-weight:400}
td{font-size:13px;color:#CBDAEB;padding:9px 0;border-top:1px solid #1B2B42}
td.m{font-family:Consolas,monospace}
td.r{text-align:right} th.r{text-align:right}
td .bad{color:var(--red);font-weight:600}
td .ok{color:var(--green)}

/* blocked */
.blk{border:1px solid rgba(255,169,64,.32);background:rgba(255,169,64,.07);
  border-radius:10px;padding:17px 19px;margin-bottom:12px}
.blk .t{font-size:14px;font-weight:600;color:#FFC479;margin-bottom:6px}
.blk .d{font-size:12.5px;color:#C3CFDE;line-height:1.55}

/* territories */
.terr{border-radius:12px;padding:22px 24px;border:1px solid var(--line);
  background:linear-gradient(165deg,#121F35,#0E1A2C);display:flex;flex-direction:column}
.terr .h{font-size:11px;letter-spacing:.22em;margin-bottom:14px}
.terr .v{font-size:34px;font-weight:600;letter-spacing:-.8px}
.terr .l{font-size:12px;color:var(--mut);margin-top:9px;line-height:1.5}
.pro .h{color:var(--red)} .imp .h{color:var(--green)}
.gro .h{color:var(--cyan)} .pre .h{color:var(--amber)}

.bar{margin-top:auto;display:flex;align-items:center;justify-content:space-between;
  font-size:10px;letter-spacing:.18em;color:#4E6B90;border-top:1px solid #16233A;padding-top:13px}
`;

const rail = (active) => `
<div class="rail">
  <div class="brand"><div class="orb"></div>
    <div><div class="n">Opservor HQ</div><div class="s">GUARDIAN</div></div></div>
  <div class="nav">
    ${['Dashboard','Guardian','Inventory','Fleet','Warehouse','Connections','Reports']
      .map(x=>`<a class="${x===active?'on':''}">${x}</a>`).join('')}
  </div>
  <div class="foot">TERASPHERES</div>
</div>`;

const head = (eyebrow, title, sub, live) => `
<div class="top">
  <div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><div class="sub">${sub}</div></div>
  <div>
    <div class="pill"><span class="dot"></span> GUARDIAN ACTIVE</div>
    <div class="stamp ${live ? 'live' : 'design'}">${live ? 'RUNNING TODAY' : 'IN DESIGN'}</div>
  </div>
</div>`;

const foot = (l, r) => `<div class="bar"><span>${l}</span><span>${r}</span></div>`;

/* ---------- the screens ---------- */
/* Figures below are the ones Guardian computes from the seeded tenant:
 * SKU-7821 at 28 on hand, 630 shipped over 90 days, 26 reorder, 10-day lead;
 * Calgary Depot with 6 vehicles and 2 booked on the same Thursday. */

const SCREENS = [
{ file:'01_Morning_Brief', nav:'Guardian', live:true, body:`
${head('MORNING BRIEF','Three things deserve your attention.',
  'Nine findings are open. These three change what happens this week; the rest can wait.',true)}
<div class="row c3">
  <div class="card"><div class="k">NEEDING ACTION NOW</div><div class="big red">3</div>
    <div class="note">Inside the window where doing something still helps.</div></div>
  <div class="card"><div class="k">OPEN IN TOTAL</div><div class="big">9</div>
    <div class="note">Across inventory, warehouse and fleet.</div></div>
  <div class="card"><div class="k">SOONEST RUNS OUT</div><div class="big amber">4 days</div>
    <div class="note">SKU-7821, Hydraulic Filter, from Supplier 9.</div></div>
</div>
<div class="find">
  <div class="tags"><span class="tag">CRITICAL</span><span class="tag n">INVENTORY</span></div>
  <h2>Supplier 9 — SKU-7821, 4 days of cover</h2>
  <p>Twenty-eight on hand against a reorder level of twenty-six, so the stock screen reads
  healthy. Seven leave every day and the supplier takes ten, which means ordering this
  morning still leaves six days with an empty shelf.</p>
  <div class="work">
    <div class="step"><div class="n">WHAT LEFT</div><div class="v">630 ÷ 90 = <em>7</em></div><div class="c">units a day, over ninety days observed</div></div>
    <div class="step"><div class="n">AGAINST THE LINE</div><div class="v">28 vs <em>26</em></div><div class="c">above reorder, so nothing flagged it</div></div>
    <div class="step"><div class="n">TIME REMAINING</div><div class="v">28 ÷ 7 = <em class="w">4</em></div><div class="c">days of cover left</div></div>
    <div class="step"><div class="n">SUPPLIER TAKES</div><div class="v">10 − 4 = <em class="w">6</em></div><div class="c">days with nothing on the shelf</div></div>
  </div>
  <div class="rec"><b>Recommended:</b> raise one order to Supplier 9 for 184 units of SKU-7821.
  Lead time is assumed at ten days — no per-supplier lead time is recorded yet, and this finding says so.</div>
</div>
<div class="row c2" style="margin-top:16px;margin-bottom:0">
  <div class="card"><div class="tags"><span class="tag">CRITICAL</span><span class="tag n">WAREHOUSE + FLEET</span></div>
    <div style="font-size:18px;font-weight:600;margin:4px 0 8px">Calgary Depot loses 2 of 6 vehicles on Thursday</div>
    <div class="note" style="margin-top:0">A third of the site's vehicles booked for service on one morning, while
    dock use there has risen from 88% to 94%. Both bookings were made weeks ago, by different people, on different systems.</div></div>
  <div class="card"><div class="tags"><span class="tag a">COULD NOT CHECK</span><span class="tag n">FLEET</span></div>
    <div style="font-size:18px;font-weight:600;margin:4px 0 8px">One check could not run</div>
    <div class="note" style="margin-top:0">No vehicle could be matched to a site at three of your depots, so capacity there is
    unknown rather than clear. Recording a depot against each vehicle fixes it.</div></div>
</div>
${foot('OPSERVOR · GUARDIAN · MORNING BRIEF','SHOWS ITS WORKING · STATES ITS ASSUMPTIONS')}
`},

{ file:'02_Four_Days', nav:'Inventory', live:true, body:`
${head('INVENTORY INTELLIGENCE','Everything was green. Four days of stock.',
  'The stock screen compares what you have against a reorder level. It never divides one number by the other.',true)}
<div class="row c4">
  <div class="card"><div class="k">ON HAND</div><div class="big">28</div><div class="note">units, counted today</div></div>
  <div class="card"><div class="k">REORDER LEVEL</div><div class="big green">26</div><div class="note">above the line — reads healthy</div></div>
  <div class="card"><div class="k">LEAVING PER DAY</div><div class="big amber">7</div><div class="note">630 units over 90 days</div></div>
  <div class="card"><div class="k">DAYS OF COVER</div><div class="big red">4</div><div class="note">against a 10-day lead time</div></div>
</div>
<div class="find">
  <div class="tags"><span class="tag n">SKU-7821</span><span class="tag n">HYDRAULIC FILTER</span><span class="tag n">SUPPLIER 9</span></div>
  <h2>The data was there. The understanding wasn't.</h2>
  <p>Every system involved was correct. Inventory knew the count. Purchasing knew the lead time.
  The movement ledger knew the rate. Nothing read all three at once — and the one number that
  mattered, four days, existed nowhere until it was calculated.</p>
  <table>
    <tr><th>MOVEMENT WINDOW</th><th class="r">UNITS</th><th class="r">PER DAY</th><th class="r">DAYS OF COVER</th><th class="r">EXPOSURE</th></tr>
    <tr><td class="m">Last 90 days, outbound</td><td class="m r">630</td><td class="m r">7.00</td>
      <td class="m r"><span class="bad">4</span></td><td class="m r"><span class="bad">6 days</span></td></tr>
    <tr><td class="m">Reorder quantity on file</td><td class="m r">184</td><td class="m r">—</td>
      <td class="m r">26 days</td><td class="m r"><span class="ok">covered</span></td></tr>
  </table>
  <div class="rec"><b>28 ÷ 7 = 4 days.</b> The supplier takes ten. Six days of exposure, and the screen stayed green the whole way down.</div>
</div>
${foot('OPSERVOR · FOUR DAYS','EVERY FIGURE COMPUTED FROM THE MOVEMENT LEDGER')}
`},

{ file:'03_Explain_Why', nav:'Guardian', live:true, body:`
${head('EXPLAIN WHY','How this finding was reached.',
  'Every finding carries its working. An operations manager will not act on “trust me”, and should not have to.',true)}
<div class="row c2">
  <div class="card tall"><div class="k">WHAT WAS READ</div>
    <table>
      <tr><th>SOURCE</th><th class="r">ROWS</th><th class="r">WINDOW</th></tr>
      <tr><td>Outbound movements</td><td class="m r">90</td><td class="m r">90 days</td></tr>
      <tr><td>Stock on hand</td><td class="m r">1</td><td class="m r">current</td></tr>
      <tr><td>Reorder level</td><td class="m r">1</td><td class="m r">current</td></tr>
      <tr><td>Supplier lead time</td><td class="m r">0</td><td class="m r">not recorded</td></tr>
    </table>
    <div class="note">Three of the four came from your own records. The fourth did not exist, so an assumption was used and is stated below rather than hidden.</div>
  </div>
  <div class="card tall"><div class="k">WHAT WAS ASSUMED</div>
    <div class="blk"><div class="t">Lead time: 10 days</div>
      <div class="d">No per-supplier lead time is recorded anywhere in the system. Ten days is
      applied to every supplier until one is. If Supplier 9 actually takes seven, the exposure
      is three days rather than six — the shortage is real either way.</div></div>
    <div class="note">This is the only assumption in the finding. Everything else is arithmetic over rows you can go and look at.</div>
  </div>
</div>
<div class="find amber">
  <div class="tags"><span class="tag a">ARITHMETIC</span><span class="tag n">NO MODEL · NO ESTIMATE</span></div>
  <h2>Nothing here was predicted. It was divided.</h2>
  <p>There is no forecast in this finding and no confidence score, because neither is needed.
  The rate is what actually left the shelf. The cover is one number divided by another. The
  exposure is a subtraction. Anyone can check it in their head, which is the point.</p>
  <div class="work">
    <div class="step"><div class="n">STEP ONE</div><div class="v">Σ outbound = <em>630</em></div><div class="c">sum of ninety days of picks</div></div>
    <div class="step"><div class="n">STEP TWO</div><div class="v">630 ÷ 90 = <em>7</em></div><div class="c">mean daily consumption</div></div>
    <div class="step"><div class="n">STEP THREE</div><div class="v">28 ÷ 7 = <em class="w">4</em></div><div class="c">days until zero</div></div>
    <div class="step"><div class="n">STEP FOUR</div><div class="v">10 − 4 = <em class="w">6</em></div><div class="c">days short, if ordered today</div></div>
  </div>
  <div class="rec"><b>Go and check it.</b> The ninety movement rows behind this finding are listed under Inventory, filtered to SKU-7821.</div>
</div>
${foot('OPSERVOR · EXPLAIN WHY','ARITHMETIC · SOURCES · ASSUMPTIONS STATED')}
`},

{ file:'04_Cross_System', nav:'Fleet', live:true, body:`
${head('CROSS-SYSTEM INTELLIGENCE','Two systems. Both right. One bad Thursday.',
  'The maintenance schedule was correct. The dock plan was correct. Nothing read both.',true)}
<div class="row c4">
  <div class="card"><div class="k">VEHICLES AT SITE</div><div class="big">6</div><div class="note">running from Calgary Depot</div></div>
  <div class="card"><div class="k">BOOKED THAT DAY</div><div class="big amber">2</div><div class="note">both in for service Thursday</div></div>
  <div class="card"><div class="k">CAPACITY LOST</div><div class="big red">33%</div><div class="note">a third of the site, on one day</div></div>
  <div class="card"><div class="k">DOCK USE</div><div class="big amber">88 → 94%</div><div class="note">this week against the fortnight before</div></div>
</div>
<div class="find">
  <div class="tags"><span class="tag">CRITICAL</span><span class="tag n">WAREHOUSE</span><span class="tag n">FLEET</span></div>
  <h2>Calgary Depot loses 2 of 6 vehicles on Thursday</h2>
  <p>Six vehicles work from Calgary Depot. Two are booked in for service on the same Thursday —
  a third of the site's vehicles gone on one day, while dock use there has risen from 88% to 94%
  over the same period. Neither booking is wrong. Neither system could see the other one.</p>
  <table>
    <tr><th>SYSTEM</th><th>WHAT IT KNEW</th><th class="r">STATUS ON ITS OWN</th></tr>
    <tr><td>Maintenance schedule</td><td>Two routine services booked, weeks in advance, by two different people</td><td class="r"><span class="ok">correct</span></td></tr>
    <tr><td>Dock plan</td><td>Thursday is the busiest morning of the week at this site</td><td class="r"><span class="ok">correct</span></td></tr>
    <tr><td>Vehicle assignment</td><td>Which six vehicles work from this depot</td><td class="r"><span class="ok">correct</span></td></tr>
    <tr><td>Anything reading all three</td><td>—</td><td class="r"><span class="bad">did not exist</span></td></tr>
  </table>
  <div class="rec"><b>Recommended:</b> move one of the Thursday bookings to a quieter day, or bring a
  vehicle across from another site for that morning. Either costs nothing today and everything on Thursday.</div>
</div>
${foot('OPSERVOR · CROSS-SYSTEM INTELLIGENCE','WAREHOUSE + FLEET · THE ONLY CHECK THAT READS TWO MODULES')}
`},

{ file:'05_Could_Not_Check', nav:'Guardian', live:true, body:`
${head('WHAT COULD NOT BE CHECKED','Nothing to flag is not the same as nothing wrong.',
  'A check that could not run did not look. Reporting that as all-clear is the failure this screen exists to prevent.',true)}
<div class="row c3">
  <div class="card"><div class="k">CHECKS THAT RAN</div><div class="big green">2</div>
    <div class="note">Stock cover and impossible stock, over your own history.</div></div>
  <div class="card"><div class="k">COULD NOT RUN</div><div class="big amber">1</div>
    <div class="note">Reported below, with what it needs.</div></div>
  <div class="card"><div class="k">TREATED AS UNKNOWN</div><div class="big">1 area</div>
    <div class="note">Not treated as clear. That distinction is the whole point.</div></div>
</div>
<div class="find amber">
  <div class="tags"><span class="tag a">NOT A CLEAN BILL OF HEALTH</span></div>
  <h2>Capacity clash — cannot run</h2>
  <p>No vehicle could be matched to a site. A trip is matched to a site when its starting point is
  exactly that site's name, and none of the last thirty days of trips matched. Until a depot is
  recorded against each vehicle, this check cannot run at all — so whether your sites have a
  capacity problem this fortnight is unknown, not clear.</p>
  <table>
    <tr><th>CHECK</th><th>WHAT IT NEEDS</th><th class="r">HAS IT</th></tr>
    <tr><td>Stock cover</td><td>Outbound movements in the last 90 days</td><td class="r"><span class="ok">yes — 90 rows</span></td></tr>
    <tr><td>Impossible stock</td><td>Stock items recorded for this company</td><td class="r"><span class="ok">yes — 5,000 items</span></td></tr>
    <tr><td>Capacity clash</td><td>Vehicles mapped to a depot</td><td class="r"><span class="bad">no — none matched</span></td></tr>
    <tr><td>Capacity clash</td><td>Warehouse figures in the last 28 days</td><td class="r"><span class="ok">yes</span></td></tr>
    <tr><td>Capacity clash</td><td>Maintenance booked in the next 14 days</td><td class="r"><span class="ok">yes — 2 jobs</span></td></tr>
  </table>
  <div class="rec"><b>To fix it:</b> record a depot against each vehicle, or connect a telematics system
  — every one of them already groups vehicles by yard, and the connection reads it automatically.</div>
</div>
${foot('OPSERVOR · READINESS','A TOOL THAT SAYS WHAT IS WRONG MUST NOT GO QUIET WHEN THE TOOL IS WRONG')}
`},

{ file:'06_CEO_Command', nav:'Dashboard', live:false, body:`
${head('EXECUTIVE VIEW','Five things deserve executive attention.',
  'Everything else can wait. This screen is the direction Opservor is being built towards — Protect runs today; the other three are in design.',false)}
<div class="row c4">
  <div class="terr pro"><div class="h">PROTECT</div><div class="v">6 days</div>
    <div class="l">Exposure on SKU-7821 if the order is not raised today. One of nine open findings.</div></div>
  <div class="terr imp"><div class="h">IMPROVE</div><div class="v">In design</div>
    <div class="l">Waste and duplicated movement, found by comparing what a process costs against what it produces.</div></div>
  <div class="terr gro"><div class="h">GROW</div><div class="v">In design</div>
    <div class="l">Capacity that exists but is unsold, and customers whose behaviour matches ones already buying.</div></div>
  <div class="terr pre"><div class="h">PREPARE</div><div class="v">In design</div>
    <div class="l">Whether a contingency plan would actually hold under today's conditions rather than the day it was written.</div></div>
</div>
<div class="find amber">
  <div class="tags"><span class="tag a">VISION</span><span class="tag n">PROTECT IS BUILT · THE OTHER THREE ARE NOT</span></div>
  <h2>What is real today, stated plainly</h2>
  <p>Guardian runs three checks over a tenant's own history and reports what it could not check.
  That is Protect, and it is live. Improve, Grow and Prepare are the direction, not the product —
  and this screen says so rather than letting a demonstration imply otherwise.</p>
  <table>
    <tr><th>TERRITORY</th><th>WHAT EXISTS TODAY</th><th class="r">STATUS</th></tr>
    <tr><td>Protect</td><td>Three checks, nine open findings, each showing its arithmetic and its assumptions</td><td class="r"><span class="ok">running</span></td></tr>
    <tr><td>Improve</td><td>Nothing built. The data model would support it; the reasoning does not exist</td><td class="r">in design</td></tr>
    <tr><td>Grow</td><td>Nothing built</td><td class="r">in design</td></tr>
    <tr><td>Prepare</td><td>Nothing built</td><td class="r">in design</td></tr>
  </table>
  <div class="rec"><b>Why say so on the screen:</b> the first question a buyer asks is whether they can see
  it on their own data. A demonstration that cannot survive that question costs more than it wins.</div>
</div>
${foot('OPSERVOR · EXECUTIVE VIEW','PROTECT · IMPROVE · GROW · PREPARE')}
`},
];

/* ---------- render ---------- */

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--force-device-scale-factor=' + SCALE, '--hide-scrollbars'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: SCALE });

  for (const s of SCREENS) {
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head>
      <body>${rail(s.nav)}<div class="page">${s.body}</div></body></html>`;

    await page.setContent(html, { waitUntil: 'load' });
    const file = path.join(OUT, `OPSERVOR_${s.file}_4K.png`);
    await page.screenshot({ path: file, type: 'png' });

    const kb = (fs.statSync(file).size / 1024).toFixed(0);
    console.log(`  ${path.basename(file).padEnd(42)} ${W * SCALE}x${H * SCALE}  ${kb} KB  ${s.live ? 'running' : 'in design'}`);
  }

  await browser.close();
  console.log(`\n  ${SCREENS.length} screens written to ${OUT}`);
})();
