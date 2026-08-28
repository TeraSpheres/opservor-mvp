/* Put the real Opservor mark onto generated dashboard screens.
 *
 * The screens were produced by an image model, which redrew the mark beside
 * "Opservor HQ" from scratch on every screen. They look alike and they are
 * not alike: a plain glowing ball, slightly different each time, standing in
 * for the actual asset. Under the brand architecture in TS-BRAND-001 that
 * position is the primary product identity, so it has to be one file, not an
 * interpretation of one.
 *
 * Asking the model to "make the logo look like this" would drift again, and
 * regenerating the screen risks the numbers on it. So the screen is kept and
 * the mark is composited.
 *
 * The mark is FOUND rather than assumed. Each screen was generated separately,
 * so the ball is not in quite the same place or the same size on any two. The
 * page draws the screen to a canvas, scans the top-left corner for the blue
 * glow, and takes the centre and radius from what it finds. A hard-coded
 * position would be right on screen one and quietly wrong on screen seven.
 *
 * Run: node tools/fix-screen-mark.js
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

/* Which folder to work on. Both sets of generated screens carry the same
 * fault, so this is an argument rather than a constant:
 *   node tools/fix-screen-mark.js "<folder>"
 */
const DIR = process.argv[2]
  || 'C:/Users/ahsan/Documents/TeraSpheres_Archive/Posts/Guardian Dashboard Screens';
const OUT = path.join(DIR, 'Fixed');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const MARK_FILE = 'C:/opservor-mvp/teraspheres-website/brand/opservor-1024.png';

const MARK = 'data:image/png;base64,'
  + fs.readFileSync(MARK_FILE).toString('base64');

/* Two earlier versions of this were wrong in opposite directions, and both
 * failures are worth keeping written down.
 *
 * The first scanned a box wide enough to include the start of the GUARDIAN
 * line, which is light blue. Those pixels joined the bounding box, pulling
 * the centre right and inflating the diameter, and the disc then covered
 * "Opservor HQ" and "GUARDIAN" — it replaced the mark and ate the wordmark.
 *
 * The second clamped the disc so it could never reach the wordmark. That
 * protected the text, but screens 9 and 10 had been generated with a much
 * larger logo, so a clamped disc covered only its middle and the original
 * showed all round it. Two marks, one inside the other.
 *
 * The lesson: replacing the mark in place cannot work, because the thing
 * being replaced is a different size on every screen. So this does not
 * replace it. It ERASES whatever is there — the full extent, however big —
 * and redraws the mark at one canonical position and size on all ten. The
 * point of the exercise was consistency; a faithful cover of ten different
 * logos would have preserved the inconsistency exactly. */

// Generous enough to contain the largest original, stopping before the
// wordmark. A detection that spills past GUARD_X means something is wrong
// and the screen is reported rather than quietly damaged.
const SCAN = { x: 0, y: 4, w: 176, h: 150 };
const GUARD_X = 168;

// Where the mark goes on every screen, taken from the eight that were
// generated consistently: centre 53,58 and a 42-45px ball.
const MARK_CX = 50, MARK_CY = 58, MARK_D = 44;

/* The blue of the mark against the cyan of the GUARDIAN line. The mark's blue
 * runs 80-100 points more blue than green; the cyan wordmark only about 27.
 * 55 sits cleanly between them, and it is the difference the earlier version
 * got wrong. */
const BLUE = { min: 110, overRed: 60, overGreen: 55 };

const pngSize = (f) => {
  const b = fs.readFileSync(f);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};

(async () => {
  const files = fs.readdirSync(DIR).filter((f) => /\.png$/i.test(f)).sort();
  if (!files.length) { console.log('\nNo screens found.\n'); return; }

  fs.mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    args: ['--force-device-scale-factor=1'],
  });
  const page = await browser.newPage();

  console.log('');
  for (const file of files) {
    const src = path.join(DIR, file);
    const { w, h } = pngSize(src);
    const data = 'data:image/png;base64,' + fs.readFileSync(src).toString('base64');

    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html><meta charset="utf-8">
<style>*{margin:0;padding:0}html,body{width:${w}px;height:${h}px;overflow:hidden;background:#000}
.wrap{position:relative;width:${w}px;height:${h}px}
.wrap>img{width:${w}px;height:${h}px;display:block}</style>
<div class="wrap"><img id="shot" src="${data}"></div>`, { waitUntil: 'load' });

    await page.evaluate(() => document.getElementById('shot').decode());

    // Measure whatever mark is there, and sample the rail colour behind it.
    const found = await page.evaluate((S, B) => {
      const img = document.getElementById('shot');
      const c = document.createElement('canvas');
      c.width = S.w; c.height = S.h;
      const g = c.getContext('2d');
      g.drawImage(img, S.x, S.y, S.w, S.h, 0, 0, S.w, S.h);
      const d = g.getImageData(0, 0, S.w, S.h).data;
      const at = (x, y) => (y * S.w + x) * 4;

      /* The wordmark is found FIRST, and everything else is measured relative
       * to it. Two reasons, both learned the hard way:
       *
       * The GUARDIAN line is light blue — around 75 points more blue than
       * green — so it passes any threshold loose enough to catch the mark.
       * Scanning the whole corner for blue therefore returned a box spanning
       * the mark AND the GUARDIAN text, and the erase built from it wiped
       * both lines of type off six screens.
       *
       * And the ball carries a white specular highlight, so a naive "first
       * bright neutral pixel" lands inside the mark rather than on the O of
       * Opservor. A letter stroke is tall; a highlight is not. Requiring nine
       * consecutive bright rows in one column separates them cleanly. */
      let textX = S.w;
      for (let x = 30; x < S.w && textX === S.w; x++) {
        let run = 0;
        for (let y = 0; y < S.h; y++) {
          const i = at(x, y);
          const r = d[i], gg = d[i + 1], bb = d[i + 2];
          const lo = Math.min(r, gg, bb), hi = Math.max(r, gg, bb);
          if (lo > 150 && hi - lo < 40) { if (++run >= 14) { textX = x; break; } }
          else run = 0;
        }
      }
      if (textX >= S.w) return { noText: true };

      /* textX lands INSIDE the word, not at its start. A 14-row run needs a
       * full-height stroke, and the first of those is usually the p of
       * Opservor rather than the O, whose left side is a thin curve. So walk
       * back to find where the word actually begins.
       *
       * Walking until the first empty column was not enough: the first empty
       * column is the gap between the O and the p, so the walk stopped there
       * and the erase then ran straight through the O and sliced it in half
       * on three screens. Letter gaps are a few pixels wide; the space
       * between the mark and the type is far wider. Stepping over the small
       * gaps and stopping only at a wide one finds the true start. */
      let textLeft = textX, gap = 0;
      for (let x = textX - 1; x >= 0; x--) {
        let hits = 0;
        for (let y = 0; y < S.h; y++) {
          const i = at(x, y);
          const r = d[i], gg = d[i + 1], bb = d[i + 2];
          const lo = Math.min(r, gg, bb), hi = Math.max(r, gg, bb);
          if (lo > 140 && hi - lo < 45) hits++;
        }
        // Four, not one. On the two screens whose logo was drawn oversized,
        // the orbit ribbon carries a thin white specular streak, and a single
        // bright pixel was enough to read it as type — so the walk stopped on
        // the logo and left a crescent of it showing. A letter stroke puts
        // several bright pixels in a column; a hairline streak does not.
        if (hits >= 4) { textLeft = x; gap = 0; continue; }
        if (++gap >= 9) break;
      }

      // Now the mark, searched only to the left of the type, so neither line
      // of text can join its bounding box however blue it is.
      const limit = Math.max(0, textLeft - 4);
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
      for (let y = 0; y < S.h; y++) {
        for (let x = 0; x < limit; x++) {
          const i = at(x, y);
          const r = d[i], gr = d[i + 1], b = d[i + 2];
          if (b > B.min && b - r > B.overRed && b - gr > B.overGreen) {
            n++;
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        }
      }
      if (n < 40) return null;

      // The rail's own colour, read from a clean strip well below whatever
      // was found. Filling from a sample rather than a constant means the
      // patch matches this screen's gradient instead of a guess at it.
      let R = 0, G = 0, Bl = 0, m = 0;
      const sy = Math.min(S.h - 2, y1 + 22);
      for (let y = sy; y < Math.min(S.h, sy + 10); y++) {
        for (let x = 4; x < 30; x++) {
          const i = at(x, y); R += d[i]; G += d[i + 1]; Bl += d[i + 2]; m++;
        }
      }
      return { x0, y0, x1, y1, n, textX: S.x + textLeft,
        bg: m ? [Math.round(R / m), Math.round(G / m), Math.round(Bl / m)] : [10, 18, 32] };
    }, SCAN, BLUE);

    if (!found || found.noText) {
      const why = found && found.noText ? 'wordmark not found' : 'no mark found';
      console.log(`  ${file.padEnd(42)} ${why} — left untouched, check by eye`);
      continue;
    }

    const ex0 = SCAN.x + found.x0, ex1 = SCAN.x + found.x1;
    const ey0 = SCAN.y + found.y0, ey1 = SCAN.y + found.y1;

    // Stop short of the wordmark, and never inside the mark's own footprint.
    const eraseR = Math.max(MARK_CX + MARK_D / 2 + 4, found.textX - 4);

    await page.evaluate(({ MARK, ey0, ey1, bg, cx, cy, D, eraseR }) => {
      const wrap = document.querySelector('.wrap');
      const shot = document.getElementById('shot');

      /* Erase, one row at a time.
       *
       * Filling the whole patch with a single sampled colour left a visibly
       * lighter band behind the mark, because the rail carries a vertical
       * gradient and one sample cannot match all of it. So each row of the
       * patch takes the colour of that same row, read from a clean strip at
       * the far left of the rail — which reproduces the gradient exactly
       * instead of averaging it away.
       *
       * Alpha falls off at the top, bottom and right so no edge is visible
       * where the patch meets untouched pixels. */
      const top = Math.max(0, ey0 - 28), bot = ey1 + 28;
      const PW = Math.round(eraseR), PH = Math.round(bot - top);

      const read = document.createElement('canvas');
      read.width = shot.naturalWidth; read.height = shot.naturalHeight;
      read.getContext('2d').drawImage(shot, 0, 0);
      const rowPix = read.getContext('2d').getImageData(2, top, 12, PH).data;

      const cv = document.createElement('canvas');
      cv.width = PW; cv.height = PH;
      const cg = cv.getContext('2d');
      for (let y = 0; y < PH; y++) {
        let R = 0, G = 0, B2 = 0;
        for (let x = 0; x < 12; x++) {
          const i = (y * 12 + x) * 4;
          R += rowPix[i]; G += rowPix[i + 1]; B2 += rowPix[i + 2];
        }
        const fadeY = Math.min(1, Math.min(y, PH - 1 - y) / 18);
        cg.fillStyle = `rgba(${Math.round(R / 12)},${Math.round(G / 12)},${Math.round(B2 / 12)},${fadeY})`;
        cg.fillRect(0, y, PW, 1);
      }
      // Feather the right edge, where the patch meets the wordmark's gap.
      cg.globalCompositeOperation = 'destination-out';
      const grad = cg.createLinearGradient(PW - 5, 0, PW, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,1)');
      cg.fillStyle = grad;
      cg.fillRect(PW - 5, 0, 5, PH);

      const patch = document.createElement('img');
      patch.src = cv.toDataURL();
      patch.style.cssText = `position:absolute;left:0;top:${top}px;width:${PW}px;height:${PH}px`;
      wrap.appendChild(patch);

      // Redraw: the real asset, same place and same size on every screen.
      const disc = document.createElement('div');
      disc.style.cssText = `position:absolute;left:${cx - D / 2}px;top:${cy - D / 2}px;
        width:${D}px;height:${D}px;border-radius:50%;overflow:hidden;
        background:radial-gradient(circle at 50% 42%,#0C1A33 0%,#070F1E 66%,#040A14 100%);
        box-shadow:0 0 ${D * 0.36}px rgba(59,130,246,.5)`;
      const im = document.createElement('img');
      im.src = MARK;
      im.style.cssText = `position:absolute;left:50%;top:50%;width:${D * 0.98}px;
        height:${D * 0.98}px;transform:translate(-50%,-50%)`;
      disc.appendChild(im);
      wrap.appendChild(disc);
      return im.decode();
    }, { MARK, ey0, ey1, eraseR,
         cx: MARK_CX, cy: MARK_CY, D: MARK_D });

    const dest = path.join(OUT, file.replace(/\.png$/i, ' [mark].png'));
    await page.screenshot({ path: dest, type: 'png' });

    const was = `${ex1 - ex0 + 1}x${ey1 - ey0 + 1}`;
    console.log(`  ${file.padEnd(42)} was ${was.padEnd(8)} text@${String(found.textX).padEnd(4)} erase<${String(Math.round(eraseR)).padEnd(4)} -> ${MARK_D}px at ${MARK_CX},${MARK_CY}`);
  }

  await browser.close();
  console.log(`\n  written to ${OUT}\n`);
})();
