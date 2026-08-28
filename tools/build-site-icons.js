/* Put the V2 TeraSpheres identity into the website's brand folder.
 *
 * The whole point of doing it this way: every page already references these
 * exact filenames — teraspheres-128.png, teraspheres-fav-32.png,
 * teraspheres-plate-180.png. Writing the new mark INTO the existing names
 * means no HTML changes anywhere, and therefore no chance of a page being
 * missed. The site changes identity on the next deploy and not before.
 *
 * The old files are copied to brand/_v1 first. This overwrites a live
 * identity; it has to be undoable with a copy, not a regeneration.
 *
 * Which artwork goes where matters. The V2 identity is a wide horizontal
 * lockup, and the site's icon slots are square — a lockup squeezed into a
 * favicon is an unreadable smear. So every square slot takes the MONOGRAM,
 * and the lockup is written under its own names for the places that have
 * room for it.
 *
 * Run: node tools/build-site-icons.js
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const V2 = 'C:/Users/ahsan/Documents/TeraSpheres_Archive/Design_Assets/TeraSpheres_V2';
const BRAND = 'C:/opservor-mvp/teraspheres-website/brand';
const BACKUP = path.join(BRAND, '_v1');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const MONO = path.join(V2, 'TERASPHERES_Monogram_Dark_Master_transparent.png');
const LOCKUP = path.join(V2, 'TERASPHERES_Primary_Dark_Master_transparent.png');
const FULL = path.join(V2, 'TERASPHERES_Full_Dark_Master_transparent.png');

// Square slots the site already asks for, all fed by the monogram.
const SQUARES = [1024, 512, 256, 128, 64, 48, 32];
const FAVS = [16, 32, 48];
// The plate is the app-tile treatment: the mark on a rounded dark tile.
const PLATES = [512, 256, 180, 128, 64];
// Lockups, for the places with room for the full horizontal mark.
const LOCKUPS = [1600, 1200, 800, 400];

const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');

(async () => {
  for (const f of [MONO, LOCKUP, FULL]) {
    if (!fs.existsSync(f)) {
      console.log(`\n  Missing ${path.basename(f)} — run build-teraspheres-mark.js first.\n`);
      return;
    }
  }

  // Back up before touching anything.
  fs.mkdirSync(BACKUP, { recursive: true });
  let kept = 0;
  for (const f of fs.readdirSync(BRAND)) {
    if (!/^teraspheres[-.]/i.test(f)) continue;
    const src = path.join(BRAND, f);
    if (fs.statSync(src).isDirectory()) continue;
    const dst = path.join(BACKUP, f);
    if (!fs.existsSync(dst)) { fs.copyFileSync(src, dst); kept++; }
  }
  console.log(`\n  ${kept} original files copied to brand/_v1\n`);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    args: ['--force-device-scale-factor=1'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 300, height: 300, deviceScaleFactor: 1 });
  await page.setContent(
    `<img id="m" src="${b64(MONO)}"><img id="l" src="${b64(LOCKUP)}"><img id="f" src="${b64(FULL)}">`,
    { waitUntil: 'load' });
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));

  const files = await page.evaluate((SQUARES, FAVS, PLATES, LOCKUPS) => {
    const out = [];

    /* Square: the mark centred on transparency, with breathing room. 82% of
     * the frame — a mark that touches its own edges looks cramped against
     * every other icon in a browser tab strip. */
    const square = (img, S, inset) => {
      const c = document.createElement('canvas');
      c.width = S; c.height = S;
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      const s = Math.min(S / img.naturalWidth, S / img.naturalHeight) * inset;
      const w = img.naturalWidth * s, h = img.naturalHeight * s;
      g.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
      return c.toDataURL();
    };

    /* Plate: the app tile. A rounded square of the product navy with the mark
     * on it, so the icon has a body of its own on a home screen or a taskbar
     * rather than floating on whatever colour is behind it. */
    const plate = (img, S, fill, flat) => {
      const c = document.createElement('canvas');
      c.width = S; c.height = S;
      const g = c.getContext('2d');
      const r = S * 0.22;
      g.beginPath();
      g.moveTo(r, 0); g.arcTo(S, 0, S, S, r); g.arcTo(S, S, 0, S, r);
      g.arcTo(0, S, 0, 0, r); g.arcTo(0, 0, S, 0, r); g.closePath();
      const bg = g.createLinearGradient(0, 0, S, S);
      bg.addColorStop(0, '#132038'); bg.addColorStop(0.55, '#0C1526'); bg.addColorStop(1, '#070D18');
      g.fillStyle = bg; g.fill();
      g.clip();
      g.imageSmoothingQuality = 'high';
      const s = Math.min(S / img.naturalWidth, S / img.naturalHeight) * (fill || 0.62);
      const w = img.naturalWidth * s, h = img.naturalHeight * s;

      /* At favicon sizes the mark is flattened to one bright colour.
       *
       * Polished silver is a gradient running from near-black in the bevel to
       * near-white on the highlight, and it looks expensive at 512px. At 16px
       * those tones average into mid-grey against a navy tile and the glyph
       * disappears — which is what "a block logo on the tab" was. Flattening
       * throws away the metal and keeps the silhouette, which is the only
       * part that can survive at that size anyway.
       *
       * Above favicon sizes the metal is kept: there, it is the point. */
      if (flat) {
        const t = document.createElement('canvas');
        t.width = Math.ceil(w); t.height = Math.ceil(h);
        const tg = t.getContext('2d');
        tg.imageSmoothingQuality = 'high';
        tg.drawImage(img, 0, 0, t.width, t.height);
        const d = tg.getImageData(0, 0, t.width, t.height);
        const a = d.data;
        for (let i = 0; i < a.length; i += 4) {
          if (!a[i + 3]) continue;
          a[i] = 0xE9; a[i + 1] = 0xF1; a[i + 2] = 0xFC;
        }
        tg.putImageData(d, 0, 0);
        g.drawImage(t, (S - w) / 2, (S - h) / 2, w, h);
      } else {
        g.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
      }
      return c.toDataURL();
    };

    const wide = (img, W) => {
      const c = document.createElement('canvas');
      const H = Math.round(img.naturalHeight * (W / img.naturalWidth));
      c.width = W; c.height = H;
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, W, H);
      return { url: c.toDataURL(), note: `${W}x${H}` };
    };

    const m = document.getElementById('m');
    const l = document.getElementById('l');
    const f = document.getElementById('f');

    for (const S of SQUARES)
      out.push({ name: `teraspheres-${S}.png`, url: square(m, S, 0.82), note: `${S}x${S}  monogram` });

    /* Favicons take the plate, not the bare monogram.
     *
     * The first version put the transparent monogram straight into the
     * favicon and it came out as a pale grey smudge. The mark is polished
     * silver: its contrast comes from a bright highlight against a dark
     * ground, and on transparency there is no dark ground — it inherits
     * whatever the browser paints behind the tab, which is already dark.
     * Silver on dark grey at 16px is a blob.
     *
     * The plate gives it back the ground it was drawn against, and the mark
     * is drawn larger here than on the big tiles because at 16px margin is
     * the difference between a glyph and three grey pixels. */
    /* The smaller the icon, the more of the tile the glyph must take.
     * A margin that reads as poise at 48px is, at 16px, four wasted pixels
     * on each side of a mark that only had sixteen to work with. */
    const favFill = { 16: 0.94, 32: 0.86, 48: 0.8 };
    for (const S of FAVS)
      out.push({ name: `teraspheres-fav-${S}.png`, url: plate(m, S, favFill[S] || 0.82, false),
                 note: `${S}x${S}  favicon` });

    for (const S of PLATES)
      out.push({ name: `teraspheres-plate-${S}.png`, url: plate(m, S), note: `${S}x${S}  app tile` });

    for (const W of LOCKUPS) {
      const r = wide(l, W);
      out.push({ name: `teraspheres-lockup-${W}.png`, url: r.url, note: `${r.note}  primary` });
    }
    const rf = wide(f, 1600);
    out.push({ name: 'teraspheres-lockup-full-1600.png', url: rf.url, note: `${rf.note}  with tagline` });

    return out;
  }, SQUARES, FAVS, PLATES, LOCKUPS);

  await browser.close();

  for (const f of files) {
    const buf = Buffer.from(f.url.split(',')[1], 'base64');
    fs.writeFileSync(path.join(BRAND, f.name), buf);
    console.log(`  ${f.name.padEnd(34)} ${f.note.padEnd(24)} ${Math.round(buf.length / 1024)} KB`);
  }

  /* teraspheres.webp is referenced by the pages and cannot be written here —
   * canvas.toDataURL('image/webp') is not available in this build. Naming it
   * rather than silently leaving a stale file behind. */
  const webp = path.join(BRAND, 'teraspheres.webp');
  if (fs.existsSync(webp)) {
    console.log(`\n  NOTE  teraspheres.webp still holds the V1 mark and was not regenerated.`);
    console.log(`        Check whether any page still uses it before deploying.`);
  }

  console.log(`\n  ${files.length} files written to ${BRAND}\n`);
})();
