/* Swap the TS seal on the Intelligence Pack badges for the Opservor sphere.
 *
 * The badges are generated artwork and cannot be edited by the model that
 * made them — asking for a changed seal returns a different badge, not the
 * same badge with a different seal. So the change is made here instead: the
 * original PNG is kept whole and a sphere is drawn over the inner disc of
 * the existing metal seal. The ring, the creature, the plate and every
 * letter of the motto survive untouched.
 *
 * The sphere is the same gradient the product screens use, so the two match
 * by construction rather than by eye.
 *
 * Coordinates are per badge because the seal does not sit in quite the same
 * place on each one. They are in source pixels, on a 1254 square.
 *
 * Run: node tools/badge-sphere.js            (all badges)
 *      node tools/badge-sphere.js 06 09      (just those)
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const DIR = 'C:/Users/ahsan/Documents/TeraSpheres_Archive/Posts/New folder';
const OUT = path.join(DIR, 'Sphere');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

/* cx, cy — centre of the seal. r — radius of the dark disc inside the metal
 * ring, i.e. how much of it the sphere should fill. Measured, not guessed;
 * if one looks off, adjust that row alone. */
const BADGES = [
  { id:'01', file:'OPSERVOR_Badge_01_Growth_Hummingbird.png',   cx:628, cy:840, r:52 },
  { id:'02', file:'OPSERVOR_Badge_02_Improve_Honeybee.png',     cx:630, cy:846, r:55 },
  { id:'03', file:'OPSERVOR_Badge_03_Change_Chameleon.png',     cx:628, cy:878, r:52 },
  { id:'04', file:'OPSERVOR_Badge_04_Resilience_SeaTurtle.png', cx:630, cy:872, r:55 },
  { id:'05', file:'OPSERVOR_Badge_05_Strategy_Compass.png',     cx:632, cy:855, r:58 },
  { id:'06', file:'OPSERVOR_Badge_06_Risk_Eagle.png',           cx:630, cy:855, r:58 },
  { id:'07', file:'OPSERVOR_Badge_07_Simulate_Dolphin.png',     cx:630, cy:872, r:55 },
  { id:'08', file:'OPSERVOR_Badge_08_Root_Octopus.png',         cx:630, cy:818, r:55 },
  { id:'09', file:'OPSERVOR_Badge_09_Memory_Elephant.png',      cx:632, cy:855, r:58 },
  { id:'10', file:'OPSERVOR_Badge_10_Proof_Lighthouse.png',     cx:630, cy:855, r:58 },
];

const SIZE = 1254;

/* The mark itself — the real Opservor asset, not an approximation of it.
 *
 * The first version of this drew a blue gradient ball copied from the CSS in
 * the screen renderer. That was wrong twice over: it was a flat sphere where
 * the actual mark is a dotted globe inside two orbital ribbons, and it made
 * the badges disagree with the brand folder, which is the source of truth.
 * So the file is loaded and composited instead.
 *
 * The mark is clipped to the seal's circle over a dark disc, which is the
 * ground it is already designed to sit on — see opservor-plate-512.png. */
const MARK = 'data:image/png;base64,' + fs.readFileSync(
  'C:/opservor-mvp/teraspheres-website/brand/opservor-1024.png').toString('base64');

const sphere = (r) => {
  // The orbits reach almost the full width of the source square, so the mark
  // is set a little under the disc to keep them off the metal rim.
  const d = r * 2, m = d * 0.94;
  return `
<div style="
  position:absolute; left:${-r}px; top:${-r}px;
  width:${d}px; height:${d}px; border-radius:50%; overflow:hidden;
  background:radial-gradient(circle at 50% 42%, #0C1A33 0%, #060D1C 62%, #03070F 100%);
  box-shadow:
    0 0 ${r * 0.42}px rgba(59,130,246,.55),
    inset 0 ${r * 0.1}px ${r * 0.26}px rgba(120,180,255,.16),
    inset 0 ${-r * 0.18}px ${r * 0.3}px rgba(0,0,0,.55);
">
  <img src="${MARK}" style="
    position:absolute; left:50%; top:50%;
    width:${m}px; height:${m}px; transform:translate(-50%,-50%);
  ">
</div>`;
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  const only = process.argv.slice(2);
  const todo = BADGES
    .filter((b) => !only.length || only.includes(b.id))
    .filter((b) => {
      const ok = fs.existsSync(path.join(DIR, b.file));
      if (!ok) console.log(`  skipped ${b.id} — ${b.file} not there yet`);
      return ok;
    });

  if (!todo.length) { console.log('\nNothing to do.\n'); return; }

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    args: ['--allow-file-access-from-files', '--force-device-scale-factor=1'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: SIZE, height: SIZE, deviceScaleFactor: 1 });

  console.log('');
  for (const b of todo) {
    // A page made with setContent lives at about:blank, and Chrome will not
    // let that document load a file:// image. So the badge goes in inline.
    const src = 'data:image/png;base64,'
      + fs.readFileSync(path.join(DIR, b.file)).toString('base64');

    await page.setContent(`<!doctype html>
<style>
  *{margin:0;padding:0}
  html,body{width:${SIZE}px;height:${SIZE}px;overflow:hidden;background:#000}
  .wrap{position:relative;width:${SIZE}px;height:${SIZE}px}
  .wrap img{width:${SIZE}px;height:${SIZE}px;display:block}
  .seal{position:absolute;left:${b.cx}px;top:${b.cy}px;width:0;height:0}
</style>
<div class="wrap">
  <img src="${src}">
  <div class="seal">${sphere(b.r)}</div>
</div>`, { waitUntil: 'load' });

    // setContent resolves before the image has decoded, which would screenshot
    // a blank frame. Wait for the actual decode.
    // Both the badge and the mark, or the screenshot catches a half-drawn frame.
    await page.evaluate(() => Promise.all(
      [...document.querySelectorAll('img')].map((i) => i.decode())
    ));

    const dest = path.join(OUT, b.file.replace('.png', '_Sphere.png'));
    await page.screenshot({ path: dest, type: 'png' });

    const kb = Math.round(fs.statSync(dest).size / 1024);
    console.log(`  ${b.id}  ${path.basename(dest).padEnd(48)} ${String(kb).padStart(4)} KB`);
  }

  await browser.close();
  console.log(`\n  ${todo.length} written to ${OUT}\n`);
})();
