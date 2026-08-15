/* The post, as a picture.
 *
 * The text version reached 273 people and got nothing. Not because the
 * observation is wrong, but because two hundred people scrolled past a wall of
 * words in a feed built for images. So the same argument, made in the format
 * the feed actually rewards.
 *
 * Square, because LinkedIn gives square and portrait more height in the feed
 * than landscape. Big numbers, because it has to work as a thumbnail on a
 * phone before anyone decides to stop.
 *
 * There is no image generator here, so this builds a PowerPoint slide sized
 * exactly to the image. Open it and use File → Export → PNG, or right-click
 * the slide and Save as Picture. Two clicks and it is a JPEG.
 *
 * Run: node tools/build-post-image.js
 */

const fs = require('fs');
const path = require('path');
const pptxgen = require('pptxgenjs');

const OUT = 'C:/Users/ahsan/Documents/TeraSpheres_Archive/Posts';
fs.mkdirSync(OUT, { recursive: true });

/* 1080 x 1080 at 96 dots per inch. LinkedIn's own recommendation for a square
 * image, and the size it will not resample. */
const SIDE = 11.25;

const INK = '0B1220';
const WHITE = 'FFFFFF';
const MUTED = '8496AC';
const GREEN = '3FD9A0';
const AMBER = 'FFA940';
const RED = 'F8686B';
const LINE = '243449';

const DISPLAY = 'Georgia';
const BODY = 'Calibri';
const DATA = 'Consolas';

const p = new pptxgen();
p.defineLayout({ name: 'SQUARE', width: SIDE, height: SIDE });
p.layout = 'SQUARE';
p.author = 'TeraSpheres';
p.title = 'The stock screen that says green';

const s = p.addSlide();
s.background = { color: INK };

const M = 1.05;
const W = SIDE - M * 2;

/* ---- the screen, as it looks ---- */

s.addText('WHAT YOUR STOCK SCREEN SAYS', {
  x: M, y: 0.95, w: W, h: 0.3, margin: 0,
  fontFace: DATA, fontSize: 13, color: MUTED, charSpacing: 3,
});

// A row per figure, laid out like a readout rather than a sentence.
const rows = [
  ['On hand', '28', WHITE],
  ['Reorder level', '26', WHITE],
  ['Status', 'IN STOCK', GREEN],
];

let y = 1.5;
for (const [label, value, colour] of rows) {
  s.addText(label, {
    x: M, y, w: W * 0.55, h: 0.62, margin: 0, valign: 'middle',
    fontFace: BODY, fontSize: 21, color: MUTED,
  });
  s.addText(value, {
    x: M + W * 0.55, y, w: W * 0.45, h: 0.62, margin: 0, valign: 'middle',
    align: 'right', fontFace: DATA, fontSize: 27, bold: true, color: colour,
  });
  y += 0.72;
}

s.addShape('line', {
  x: M, y: y + 0.18, w: W, h: 0,
  line: { color: LINE, width: 1.25 },
});

/* ---- what it does not say ---- */

s.addText('WHAT IT DOES NOT SAY', {
  x: M, y: y + 0.55, w: W, h: 0.3, margin: 0,
  fontFace: DATA, fontSize: 13, color: AMBER, charSpacing: 3,
});

y += 1.1;
const hidden = [
  ['Leaving the shelf', '7 a day'],
  ['Supplier takes', '10 days'],
];
for (const [label, value] of hidden) {
  s.addText(label, {
    x: M, y, w: W * 0.55, h: 0.62, margin: 0, valign: 'middle',
    fontFace: BODY, fontSize: 21, color: MUTED,
  });
  s.addText(value, {
    x: M + W * 0.55, y, w: W * 0.45, h: 0.62, margin: 0, valign: 'middle',
    align: 'right', fontFace: DATA, fontSize: 27, bold: true, color: AMBER,
  });
  y += 0.72;
}

/* ---- the punch ---- */

s.addShape('roundRect', {
  x: M, y: y + 0.35, w: W, h: 2.15, rectRadius: 0.08,
  fill: { color: '17212F' },
});

s.addText('28 ÷ 7 = four days of stock.', {
  x: M + 0.5, y: y + 0.62, w: W - 1, h: 0.5, margin: 0,
  fontFace: DISPLAY, fontSize: 26, bold: true, color: WHITE,
});

s.addText('The order needed placing six days ago.', {
  x: M + 0.5, y: y + 1.18, w: W - 1, h: 0.5, margin: 0,
  fontFace: DISPLAY, fontSize: 26, bold: true, color: RED,
});

s.addText('And the screen stays green the whole way down.', {
  x: M + 0.5, y: y + 1.72, w: W - 1, h: 0.4, margin: 0,
  fontFace: BODY, fontSize: 18, color: MUTED,
});

/* ---- the question, which is what earns a comment ---- */

s.addText('Has any stock system you have used ever divided one by the other?', {
  x: M, y: SIDE - 1.5, w: W, h: 0.5, margin: 0,
  fontFace: BODY, fontSize: 19, italic: true, color: '9FB0C4',
});

p.writeFile({ fileName: path.join(OUT, 'post-stock-screen.pptx') }).then((f) => {
  console.log('  ' + f);
  console.log('  Open it, then File → Export → Change File Type → PNG.');
});
