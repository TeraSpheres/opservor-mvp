/* Screenshot the real pages, not the icons in isolation. An icon set can look
 * right in a contact sheet and still be wrong in the header it actually sits
 * in — wrong size, wrong crop, wrong contrast against the real background. */
const fs = require('fs'), path = require('path'), pup = require('puppeteer-core');

const SITE = 'C:/opservor-mvp/teraspheres-website';
const OUT = 'C:/Users/ahsan/AppData/Local/Temp/claude/C--opservor-mvp-opservor-mvp/f2354faf-b4dc-431f-b21f-699c7756d8bf/scratchpad';

(async () => {
  const b = await pup.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--allow-file-access-from-files', '--force-device-scale-factor=1'],
  });
  const p = await b.newPage();

  // Desktop header
  await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await p.goto('file:///' + encodeURI(path.join(SITE, 'index.html').replace(/\\/g, '/')),
    { waitUntil: 'networkidle0' });
  await p.evaluate(() => Promise.all(
    [...document.images].filter((i) => i.complete).map((i) => i.decode().catch(() => {}))));
  await p.screenshot({ path: path.join(OUT, 'site-top.png'), clip: { x: 0, y: 0, width: 1440, height: 260 } });

  // Footer
  const h = await p.evaluate(() => document.body.scrollHeight);
  await p.screenshot({ path: path.join(OUT, 'site-foot.png'),
    clip: { x: 0, y: Math.max(0, h - 340), width: 1440, height: 340 } });

  // Mobile header
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await p.reload({ waitUntil: 'networkidle0' });
  await p.screenshot({ path: path.join(OUT, 'site-mobile.png'), clip: { x: 0, y: 0, width: 390, height: 300 } });

  const bad = await p.evaluate(() =>
    [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.getAttribute('src')));
  await b.close();

  console.log(bad.length ? '  broken images: ' + bad.join(', ') : '  every image on the page loaded');
  console.log('  ' + OUT + '/site-top.png  site-foot.png  site-mobile.png');
})();
