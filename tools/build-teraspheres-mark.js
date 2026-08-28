/* Cut the locked TeraSpheres identity into the full production asset set.
 *
 * Six pieces of supplied artwork go in; every file the website, the documents
 * and the application need come out. Nothing here redraws the logo — each
 * output traces back to one of the six masters, so a derivative can never
 * drift from the thing it derives from.
 *
 * Three jobs per source:
 *
 *   1. Trim. The supplied files are mostly empty field. The content box is
 *      found by luminance, so every crop is measured rather than eyeballed
 *      and the six sets end up optically consistent with each other.
 *
 *   2. Key the field out. Which way round matters: on the dark artwork the
 *      logo is the bright pixels, so alpha is the brightest channel; on the
 *      light artwork the logo is the DARK pixels, so alpha is the inverse of
 *      the darkest channel. Running the dark rule over light artwork would
 *      erase the logo and keep the paper.
 *
 *   3. Resize. Lockups by width, marks as padded squares - a monogram scaled
 *      into a square without padding is a stretched monogram.
 *
 * Run: node tools/build-teraspheres-mark.js
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ART = 'C:/Users/ahsan/Documents/TeraSpheres_Archive/Posts/Guardian Dashboard Screens';
const OUT = 'C:/Users/ahsan/Documents/TeraSpheres_Archive/Design_Assets/TeraSpheres_V2';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

/* How far from the field a pixel must be before it counts as logo.
 * Light artwork needs a wider margin: paper is rarely pure white, and at a
 * threshold tuned for black the faintest tint at the edge of the sheet reads
 * as logo, the trim finds nothing to cut, and the mark ends up floating in a
 * frame of white while its siblings sit tight. */
const INK_DARK = 22;
const INK_LIGHT = 22;

const LOCKUP_W = [2048, 1200, 800, 400];
const MARK_S = [512, 256, 128, 64, 48, 32];

/* The six masters.
 *
 *   on:   'dark'  — logo is light on black
 *         'light' — logo is dark on white
 *   kind: 'lockup' — monogram + wordmark, sized by width
 *         'mark'   — monogram alone, sized as squares
 */
const SOURCES = [
  { file: `${ART}/New Corporate Logo for TeraSpheres.png`,
    slug: 'full-dark',      name: 'Full_Dark',      on: 'dark',  kind: 'lockup' },
  { file: `${ART}/New Corporate Logo without tagline for TeraSpheres.png`,
    slug: 'primary-dark',   name: 'Primary_Dark',   on: 'dark',  kind: 'lockup' },
  { file: `${ART}/Variants/Variant-2.png`,
    slug: 'full-light',     name: 'Full_Light',     on: 'light', kind: 'lockup' },
  { file: `${ART}/Variants/Variant-3.png`,
    slug: 'primary-light',  name: 'Primary_Light',  on: 'light', kind: 'lockup' },
  { file: `${ART}/Variants/Variant-4.png`,
    slug: 'mono-dark',      name: 'Monogram_Dark',  on: 'dark',  kind: 'mark' },
  { file: `${ART}/Variants/Variant-5-6.png`,
    slug: 'mono-light',     name: 'Monogram_Light', on: 'light', kind: 'mark' },
  { file: `${ART}/Variants/Variant-6.png`,
    slug: 'monochrome',     name: 'Monochrome',     on: 'light', kind: 'lockup' },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    args: ['--force-device-scale-factor=1'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 400, height: 300, deviceScaleFactor: 1 });

  let total = 0;
  for (const S of SOURCES) {
    if (!fs.existsSync(S.file)) {
      console.log(`\n  MISSING  ${path.basename(S.file)} — skipped`);
      continue;
    }

    const data = 'data:image/png;base64,' + fs.readFileSync(S.file).toString('base64');
    await page.setContent(`<img id="s" src="${data}">`, { waitUntil: 'load' });
    await page.evaluate(() => document.getElementById('s').decode());

    const built = await page.evaluate((INK, LOCKUP_W, MARK_S, S) => {
      const img = document.getElementById('s');
      const W = img.naturalWidth, H = img.naturalHeight;
      const dark = S.on === 'dark';

      const c0 = document.createElement('canvas');
      c0.width = W; c0.height = H;
      const g0 = c0.getContext('2d');
      g0.drawImage(img, 0, 0);
      const px = g0.getImageData(0, 0, W, H).data;

      /* What counts as ink.
       *
       * Some of the supplied artwork already has an alpha channel — the
       * monochrome file is black on nothing, not black on white. Treating it
       * as opaque and comparing against a "field" read from its corners meant
       * comparing transparent black to transparent black, finding no
       * difference anywhere, and reporting an empty image. So alpha is
       * checked first, and only artwork without it falls back to colour.
       *
       * For opaque artwork the field is measured from the corners rather than
       * assumed, because paper is rarely pure white. */
      let hasAlpha = false;
      for (let i = 3; i < px.length && !hasAlpha; i += 4 * 97) if (px[i] < 250) hasAlpha = true;

      const corner = (cx, cy) => {
        const i = (cy * W + cx) * 4;
        return [px[i], px[i + 1], px[i + 2]];
      };
      const cs = [corner(2, 2), corner(W - 3, 2), corner(2, H - 3), corner(W - 3, H - 3)];
      const field = [0, 1, 2].map((k) => cs.reduce((a, c) => a + c[k], 0) / 4);

      const isInk = (i) => hasAlpha
        ? px[i + 3] > 16
        : Math.max(
            Math.abs(px[i] - field[0]),
            Math.abs(px[i + 1] - field[1]),
            Math.abs(px[i + 2] - field[2]),
          ) > INK;

      /* Rows and columns are counted, not just touched.
       *
       * One of the light files carries a faint vignette in its paper. A single
       * pixel of that is enough to differ from the corner sample, so every row
       * and column contained "ink", the trim cut nothing, and the monogram
       * ended up floating in the middle of its own margin. Requiring a few ink
       * pixels before a line counts ignores that noise without discarding any
       * real edge — a logo's outermost row is never one pixel wide. */
      const rowN = new Int32Array(H), colN = new Int32Array(W);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (isInk((y * W + x) * 4)) { rowN[y]++; colN[x]++; }
        }
      }

      /* The cut-off is relative to the busiest line, not an absolute count.
       *
       * A fixed minimum could not separate the two failures. Low, and the
       * vignette in one file's paper made every row count as content so
       * nothing was trimmed. High enough to reject the vignette, and the
       * bright silver highlights at the edge of the monogram fell below it
       * too, so the trim cut into the logo itself.
       *
       * A row of the logo holds hundreds of ink pixels; a row of noise holds
       * a handful. Two per cent of the densest line separates them by a wide
       * margin and needs no tuning per file. */
      let peakR = 0, peakC = 0;
      for (let y = 0; y < H; y++) if (rowN[y] > peakR) peakR = rowN[y];
      for (let x = 0; x < W; x++) if (colN[x] > peakC) peakC = colN[x];
      const minR = Math.max(3, peakR * 0.02), minC = Math.max(3, peakC * 0.02);

      let x0 = -1, y0 = -1, x1 = -1, y1 = -1;
      for (let x = 0; x < W; x++) if (colN[x] >= minC) { if (x0 < 0) x0 = x; x1 = x; }
      for (let y = 0; y < H; y++) if (rowN[y] >= minR) { if (y0 < 0) y0 = y; y1 = y; }
      if (x1 < 0 || y1 < 0) return null;

      const cut = (outW, outH, keyed, pad) => {
        const sw = x1 - x0 + 1, sh = y1 - y0 + 1;
        const c = document.createElement('canvas');
        c.width = outW; c.height = outH;
        const g = c.getContext('2d');
        let dw = outW, dh = outH, dx = 0, dy = 0;
        if (pad) {
          const s = Math.min(outW / sw, outH / sh) * 0.9;
          dw = sw * s; dh = sh * s;
          dx = (outW - dw) / 2; dy = (outH - dh) / 2;
        }
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, x0, y0, sw, sh, dx, dy, dw, dh);
        if (keyed && !hasAlpha) {
          const d = g.getImageData(0, 0, outW, outH);
          const a = d.data;
          for (let i = 0; i < a.length; i += 4) {
            a[i + 3] = dark
              ? Math.max(a[i], a[i + 1], a[i + 2])
              : 255 - Math.min(a[i], a[i + 1], a[i + 2]);
          }
          g.putImageData(d, 0, 0);
        }
        return c.toDataURL();
      };

      const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
      const out = [];

      out.push({ name: `TERASPHERES_${S.name}_Master.png`, url: cut(cw, ch, false, false),
                 note: `${cw}x${ch}  on ${dark ? 'black' : 'white'}` });
      out.push({ name: `TERASPHERES_${S.name}_Master_transparent.png`, url: cut(cw, ch, true, false),
                 note: `${cw}x${ch}  transparent` });

      if (S.kind === 'lockup') {
        for (const w of LOCKUP_W) {
          const h = Math.round(ch * (w / cw));
          out.push({ name: `teraspheres-${S.slug}-${w}.png`, url: cut(w, h, true, false),
                     note: `${w}x${h}` });
        }
      } else {
        for (const s of MARK_S) {
          out.push({ name: `teraspheres-${S.slug}-${s}.png`, url: cut(s, s, true, true),
                     note: `${s}x${s}  square` });
        }
      }
      return { cw, ch, out };
    }, S.on === 'dark' ? INK_DARK : INK_LIGHT, LOCKUP_W, MARK_S, S);

    if (!built) { console.log(`\n  ${S.name}: no content found — skipped`); continue; }

    console.log(`\n  ${S.name}  (${path.basename(S.file)}, ${built.cw}x${built.ch})`);
    for (const f of built.out) {
      const buf = Buffer.from(f.url.split(',')[1], 'base64');
      fs.writeFileSync(path.join(OUT, f.name), buf);
      console.log(`    ${f.name.padEnd(48)} ${f.note.padEnd(26)} ${Math.round(buf.length / 1024)} KB`);
      total++;
    }
  }

  await browser.close();
  console.log(`\n  ${total} files in ${OUT}\n`);
})();
