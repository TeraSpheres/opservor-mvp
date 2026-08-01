/* QA for the generated decks, without a renderer.
 *
 * There is no LibreOffice or Python on this machine, so the usual
 * convert-to-image-and-look pass is not available. This checks what can be
 * checked from the XML itself:
 *
 *   - every part is well-formed and every colour is a legal 6-digit hex
 *     (a '#' or an 8-digit value corrupts the file silently)
 *   - nothing sits outside the slide canvas — pptxgenjs writes out-of-bounds
 *     coordinates rather than clamping them, so the shape is simply absent
 *   - no text box is asked to hold more text than it has room for, which is
 *     the most common and most visible defect
 *
 * The text-fit estimate is approximate. It uses average glyph widths for the
 * two fonts in use, so it is a screen for gross overflow rather than a
 * guarantee of typesetting. Anything it flags is worth looking at; anything
 * marginal is reported separately rather than passed silently.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DECKS = 'C:/Users/ahsan/Documents/TeraSpheres_Archive/Decks';
const TMP = path.join(process.env.TEMP || '.', 'deck-qa');

const EMU = 914400;
const SLIDE_W = 13.333, SLIDE_H = 7.5;

/* Average glyph width as a fraction of point size. Measured from the metrics
 * of each family rather than guessed: Calibri is narrow, Cambria wider. */
const GLYPH = { Calibri: 0.465, Cambria: 0.505 };

function unzip(file, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  // Expand-Archive refuses anything not named .zip, so it gets a copy that is.
  const asZip = dest + '.zip';
  fs.copyFileSync(file, asZip);
  execSync(
    `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${asZip}' -DestinationPath '${dest}' -Force"`,
    { stdio: 'pipe' }
  );
  fs.rmSync(asZip, { force: true });
}

function checkDeck(name) {
  const file = path.join(DECKS, name);
  const dest = path.join(TMP, name.replace(/\W/g, '_'));
  unzip(file, dest);

  const problems = [], marginal = [];
  const slideDir = path.join(dest, 'ppt', 'slides');
  const slides = fs.readdirSync(slideDir)
    .filter((f) => /^slide\d+\.xml$/.test(f))
    .sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]);

  let boxes = 0;

  for (const f of slides) {
    const n = +f.match(/\d+/)[0];
    const xml = fs.readFileSync(path.join(slideDir, f), 'utf8');

    /* colours */
    for (const m of xml.matchAll(/val="([^"]*)"[^>]*\/>\s*<\/a:solidFill>|srgbClr val="([^"]+)"/g)) {
      const v = m[1] || m[2];
      if (v && !/^[0-9A-Fa-f]{6}$/.test(v)) {
        problems.push(`slide ${n}: illegal colour "${v}"`);
      }
    }

    /* shapes: geometry + text */
    for (const sp of xml.split(/<p:sp>/).slice(1)) {
      const off = sp.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/);
      const ext = sp.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
      if (!off || !ext) continue;

      const x = +off[1] / EMU, y = +off[2] / EMU;
      const w = +ext[1] / EMU, h = +ext[2] / EMU;

      if (x < -0.01 || y < -0.01 || x + w > SLIDE_W + 0.01 || y + h > SLIDE_H + 0.01) {
        problems.push(
          `slide ${n}: shape outside canvas — x ${x.toFixed(2)} y ${y.toFixed(2)} ` +
          `w ${w.toFixed(2)} h ${h.toFixed(2)}`
        );
      }

      /* text fit
       *
       * Each <a:p> is a paragraph and wraps independently, so lines are
       * counted per paragraph and summed. A shape's text is the runs inside
       * it; rPr is a container element here, not self-closing. */
      const paras = [...sp.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)].map((m) => m[1]);
      const withText = paras.filter((t) => /<a:t>/.test(t));
      if (!withText.length) continue;
      boxes++;

      const face = /Cambria/.test(sp) ? 'Cambria' : 'Calibri';
      const spacing = (sp.match(/<a:lnSpc><a:spcPts val="(\d+)"\/>/) || [])[1];

      // lIns="0" is what margin:0 writes; otherwise PowerPoint insets 0.1" each side.
      const inset = /lIns="0"/.test(sp) ? 0 : 0.2;
      const usable = Math.max(w - inset, 0.3);

      let lines = 0, biggest = 0, first = '';
      for (const para of withText) {
        let chars = 0, pts = 0;
        for (const r of para.matchAll(/<a:r>([\s\S]*?)<\/a:r>/g)) {
          const sz = +((r[1].match(/\bsz="(\d+)"/) || [])[1] || 1800) / 100;
          const t = (r[1].match(/<a:t>([^<]*)<\/a:t>/) || [])[1] || '';
          chars += t.length;
          pts = Math.max(pts, sz);
          if (!first) first = t;
        }
        if (!chars) { lines += 1; continue; }
        biggest = Math.max(biggest, pts);
        const charW = (pts * GLYPH[face]) / 72;
        lines += Math.max(Math.ceil(chars / Math.max(Math.floor(usable / charW), 1)), 1);
      }

      const lineH = spacing ? +spacing / 100 / 72 : (biggest * 1.22) / 72;
      const need = lines * lineH;

      const label = first.slice(0, 46).replace(/\s+/g, ' ');
      if (need > h * 1.18) {
        problems.push(
          `slide ${n}: text overflows — needs ${need.toFixed(2)}" in ${h.toFixed(2)}"  "${label}…"`
        );
      } else if (need > h) {
        marginal.push(`slide ${n}: tight — ${need.toFixed(2)}" in ${h.toFixed(2)}"  "${label}…"`);
      }
    }
  }

  return { name, slides: slides.length, boxes, problems, marginal };
}

let bad = 0;
for (const d of fs.readdirSync(DECKS).filter((f) => f.endsWith('.pptx'))) {
  const r = checkDeck(d);
  console.log(`\n${r.name}`);
  console.log(`  ${r.slides} slides, ${r.boxes} text boxes checked`);
  if (r.problems.length) {
    bad += r.problems.length;
    console.log(`  ${r.problems.length} PROBLEM(S):`);
    for (const p of r.problems) console.log('    ' + p);
  } else {
    console.log('  no colour, bounds or overflow problems');
  }
  if (r.marginal.length) {
    console.log(`  ${r.marginal.length} tight (worth a look, not necessarily wrong):`);
    for (const m of r.marginal.slice(0, 8)) console.log('    ' + m);
  }
}
console.log(bad ? `\n${bad} problem(s) to fix` : '\nboth decks clean');
process.exit(bad ? 1 : 0);
