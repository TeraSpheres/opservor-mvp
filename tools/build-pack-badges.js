/* Cut the ten Intelligence Pack badges down to web sizes.
 *
 * The masters are 1254px square and about 2.5 MB each — twenty-five megabytes
 * of badge on a page that shows them at 150px would be a page nobody waits
 * for. They are trimmed to their own artwork first, because the generated
 * masters carry different amounts of dead margin and a row of badges cropped
 * differently reads as a row of badges at different sizes.
 *
 * Run: node tools/build-pack-badges.js
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const SRC = 'C:/Users/ahsan/Documents/TeraSpheres_Archive/Posts/New folder/Sphere';
const OUT = 'C:/opservor-mvp/teraspheres-website/brand/packs';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const SIZES = [400, 200];
const INK = 22;          // how far from the black field a pixel must be

const PACKS = [
  ['01', 'growth'], ['02', 'improve'], ['03', 'change'], ['04', 'resilience'],
  ['05', 'strategy'], ['06', 'risk'], ['07', 'simulate'], ['08', 'root'],
  ['09', 'memory'], ['10', 'proof'],
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const files = fs.readdirSync(SRC).filter((f) => /\.png$/i.test(f));

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    args: ['--force-device-scale-factor=1'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 300, height: 300, deviceScaleFactor: 1 });

  let n = 0;
  console.log('');
  for (const [num, slug] of PACKS) {
    const file = files.find((f) => f.startsWith(`OPSERVOR_Badge_${num}_`));
    if (!file) { console.log(`  ${slug.padEnd(11)} master not found — skipped`); continue; }

    const data = 'data:image/png;base64,'
      + fs.readFileSync(path.join(SRC, file)).toString('base64');
    await page.setContent(`<img id="s" src="${data}">`, { waitUntil: 'load' });
    await page.evaluate(() => document.getElementById('s').decode());

    const cuts = await page.evaluate((INK, SIZES) => {
      const img = document.getElementById('s');
      const W = img.naturalWidth, H = img.naturalHeight;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const px = g.getImageData(0, 0, W, H).data;

      // Trim to the artwork. The badges sit on black with uneven margins.
      const rowN = new Int32Array(H), colN = new Int32Array(W);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          if (Math.max(px[i], px[i + 1], px[i + 2]) > INK) { rowN[y]++; colN[x]++; }
        }
      }
      let pr = 0, pc = 0;
      for (let y = 0; y < H; y++) if (rowN[y] > pr) pr = rowN[y];
      for (let x = 0; x < W; x++) if (colN[x] > pc) pc = colN[x];
      const mr = Math.max(3, pr * 0.02), mc = Math.max(3, pc * 0.02);
      let x0 = -1, y0 = -1, x1 = -1, y1 = -1;
      for (let x = 0; x < W; x++) if (colN[x] >= mc) { if (x0 < 0) x0 = x; x1 = x; }
      for (let y = 0; y < H; y++) if (rowN[y] >= mr) { if (y0 < 0) y0 = y; y1 = y; }
      if (x1 < 0) return null;

      const sw = x1 - x0 + 1, sh = y1 - y0 + 1;
      const out = [];
      for (const S of SIZES) {
        const o = document.createElement('canvas');
        o.width = S; o.height = S;
        const og = o.getContext('2d');
        og.imageSmoothingQuality = 'high';
        // Fit inside the square without stretching; badges are near-square
        // but not exactly, and one stretched badge in a row of ten shows.
        const s = Math.min(S / sw, S / sh);
        const w = sw * s, h = sh * s;
        og.drawImage(img, x0, y0, sw, sh, (S - w) / 2, (S - h) / 2, w, h);
        // Black is the badge's own ground, so it is kept rather than keyed —
        // these sit on a dark page and the medallion needs its field.
        out.push({ size: S, url: o.toDataURL() });
      }
      return { sw, sh, out };
    }, INK, SIZES);

    if (!cuts) { console.log(`  ${slug.padEnd(11)} no artwork found — skipped`); continue; }

    for (const { size, url } of cuts.out) {
      const buf = Buffer.from(url.split(',')[1], 'base64');
      fs.writeFileSync(path.join(OUT, `pack-${slug}-${size}.png`), buf);
      if (size === SIZES[SIZES.length - 1]) {
        console.log(`  ${slug.padEnd(11)} ${String(cuts.sw)}x${cuts.sh} -> ${size}px  ${Math.round(buf.length / 1024)} KB`);
      }
    }
    n++;
  }

  await browser.close();
  console.log(`\n  ${n} packs written to ${OUT}\n`);
})();
