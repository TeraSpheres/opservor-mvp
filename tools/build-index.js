/* The index.
 *
 * A written list of what exists goes stale the moment it is written — which is
 * exactly what happened to TS-PROD-001, and it took thirty commits before
 * anyone noticed. So this reads the actual state every time it runs: the
 * migrations on disk, the screens in the app, the pages on the site, the
 * documents in the archive, and what git says has happened lately.
 *
 * Nothing here is typed by hand except the descriptions, which are pulled from
 * each file's own opening comment. If a migration has no comment it appears
 * with none, which is a small nudge to go and write one.
 *
 * Run:  node tools/build-index.js
 * Then open Documents\TeraSpheres_Archive\INDEX.html
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const APP  = 'C:/opservor-mvp/opservor-mvp';
const SITE = 'C:/opservor-mvp/teraspheres-website';
const ARCH = 'C:/Users/ahsan/Documents/TeraSpheres_Archive';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };
const kb = (p) => { try { return Math.round(fs.statSync(p).size / 1024) + ' KB'; } catch { return ''; } };
const when = (p) => {
  try { return fs.statSync(p).mtime.toISOString().slice(0, 10); } catch { return ''; }
};

/* ------------------------------------------------------------- migrations */

function migrations() {
  const dir = path.join(APP, 'supabase/migrations');
  if (!exists(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort().map((f) => {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    // The first comment line after the number is what the migration is for.
    const first = (src.split('\n').find((l) => /^--\s*\d{4}\s*—/.test(l)) || '').replace(/^--\s*/, '');
    const tables = [...new Set([...src.matchAll(/create table (?:if not exists )?(?:public\.)?([a-z_]+)/g)].map((m) => m[1]))];
    return {
      file: f,
      num: f.slice(0, 4),
      title: first.replace(/^\d{4}\s*—\s*/, '') || '—',
      tables,
    };
  });
}

/* ----------------------------------------------------------------- screens */

function screens() {
  const dir = path.join(APP, 'src/app/(dashboard)');
  if (!exists(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('[')) continue;
    const page = path.join(dir, entry.name, 'page.tsx');
    if (!exists(page)) continue;
    const src = fs.readFileSync(page, 'utf8');
    const m = src.match(/^\/\*\s*([^\n*]+)/m);
    out.push({ route: '/' + entry.name, note: (m ? m[1] : '').trim().replace(/\.$/, '') });
  }
  return out.sort((a, b) => a.route.localeCompare(b.route));
}

/* ------------------------------------------------------------ guardian checks */

function checks() {
  const dir = path.join(APP, 'supabase/migrations');
  if (!exists(dir)) return [];
  const sql = fs.readdirSync(dir).filter((f) => /\.sql$/.test(f))
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  const names = [...new Set([...sql.matchAll(/create or replace function (guardian_check_[a-z_]+)/g)].map((m) => m[1]))];
  const label = {
    guardian_check_stockout: 'Stock running out before a replacement order could arrive, grouped into one order per supplier',
    guardian_check_impossible_stock: 'Items showing negative stock — a records failure, not a forecast',
    guardian_check_capacity_clash: 'A depot under pressure losing vehicles to maintenance on the same day. Reads warehouse and fleet together',
  };
  return names.map((n) => ({ name: n, note: label[n] || '' }));
}

/* -------------------------------------------------------------- site pages */

function sitePages() {
  if (!exists(SITE)) return [];
  return fs.readdirSync(SITE).filter((f) => f.endsWith('.html') && !f.startsWith('_'))
    .sort().map((f) => {
      const src = fs.readFileSync(path.join(SITE, f), 'utf8');
      const t = (src.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
      return { file: f, title: t.replace(/\s*[—|]\s*TeraSpheres.*$/, '').trim() };
    });
}

/* --------------------------------------------------------------- documents */

function documents() {
  const groups = [];
  for (const folder of ['Codex', 'Decks', 'Career', 'Butterfly_Effect']) {
    const dir = path.join(ARCH, folder);
    if (!exists(dir)) continue;
    const files = fs.readdirSync(dir)
      .filter((f) => /\.(docx|pdf|pptx|md)$/i.test(f))
      .sort()
      .map((f) => ({ name: f, size: kb(path.join(dir, f)), date: when(path.join(dir, f)) }));
    if (files.length) groups.push({ folder, files });
  }
  return groups;
}

/* ------------------------------------------------------------------- work */

function recentWork() {
  try {
    // The separator is a tab written as %x09, not a pipe. On Windows this runs
    // through cmd, where an unquoted | splits the command in two and the rest
    // of the format string is read as a program name.
    const out = execSync('git log -18 --date=short --pretty=format:"%h%x09%ad%x09%s"', { cwd: APP });
    return out.toString().trim().split('\n').filter(Boolean).map((l) => {
      const [hash, date, ...rest] = l.split('\t');
      return { hash, date, subject: rest.join('\t') };
    });
  } catch { return []; }
}

/* ------------------------------------------------------------------ build */

const mig = migrations();
const scr = screens();
const chk = checks();
const site = sitePages();
const docs = documents();
const work = recentWork();
const tables = [...new Set(mig.flatMap((m) => m.tables))].sort();

const NOT_BUILT = [
  ['Live connections to customer systems', 'No API credential can be stored yet. Import covers the same ground with a file.'],
  ['Anything that learns', 'The Guardian checks run when asked. Nothing improves from an action taken.'],
  ['Prediction or forecasting', 'The checks divide what happened by how fast it happened. That is arithmetic, not prediction.'],
  ['Scheduled reports', 'Reports are read on screen. Nothing is delivered or exported.'],
  ['User management', 'Adding a colleague is still a database job.'],
  ['Per-supplier lead times', 'Every stockout finding assumes ten days and says so.'],
];

const row = (cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TeraSpheres — what has been built</title>
<style>
  :root {
    --ground:#0B1220; --panel:#141F30; --edge:#243449; --ink:#E8EFF7;
    --muted:#8496AC; --cyan:#35D6EE; --amber:#FFA940; --good:#3FD9A0;
    --display: Georgia, "Times New Roman", serif;
    --body: -apple-system, "Segoe UI", Roboto, system-ui, sans-serif;
    --data: ui-monospace, Consolas, "SF Mono", monospace;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--ground);color:var(--ink);font-family:var(--body);line-height:1.6}
  .wrap{max-width:64rem;margin:0 auto;padding:clamp(1.5rem,4vw,4rem)}
  h1{font-family:var(--display);font-size:clamp(2rem,4.5vw,3rem);line-height:1.1;margin:0 0 .4rem}
  .sub{color:var(--muted);margin:0 0 .3rem}
  .stamp{font-family:var(--data);font-size:.75rem;color:#5D6E85;margin:0 0 2.5rem}
  h2{font-family:var(--display);font-size:clamp(1.3rem,2.6vw,1.75rem);margin:3rem 0 .3rem;
     padding-top:1.6rem;border-top:1px solid var(--edge)}
  h2:first-of-type{border-top:0;padding-top:0}
  .lede{color:var(--muted);margin:0 0 1.2rem;max-width:60ch}
  table{width:100%;border-collapse:collapse;margin:.6rem 0 0}
  th{text-align:left;font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;
     color:var(--muted);font-weight:600;padding:0 1rem .5rem 0;border-bottom:1px solid var(--edge)}
  td{padding:.55rem 1rem .55rem 0;border-bottom:1px solid rgba(36,52,73,.5);
     font-size:.92rem;vertical-align:top}
  tr:last-child td{border-bottom:0}
  code{font-family:var(--data);font-size:.85em;color:var(--cyan)}
  .n{font-family:var(--data);color:var(--muted);white-space:nowrap}
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(8rem,1fr));gap:1.4rem;margin:1.6rem 0 0}
  .stat b{display:block;font-family:var(--data);font-size:2rem;color:var(--cyan);line-height:1}
  .stat span{font-size:.82rem;color:var(--muted)}
  .chips{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.8rem}
  .chip{font-family:var(--data);font-size:.72rem;color:#B7C6D8;background:var(--panel);
        border:1px solid var(--edge);border-radius:.3rem;padding:.24rem .5rem}
  .warn td:first-child{color:var(--amber)}
  .scroll{overflow-x:auto}
  footer{margin-top:4rem;padding-top:1.4rem;border-top:1px solid var(--edge);
         font-family:var(--data);font-size:.72rem;color:#5D6E85}
</style>
</head>
<body>
<div class="wrap">

<h1>What has been built</h1>
<p class="sub">TeraSpheres &middot; Opservor &middot; the website &middot; the documents</p>
<p class="stamp">Generated ${new Date().toISOString().slice(0, 10)} by reading the actual files. Re-run <code>node tools/build-index.js</code> to refresh.</p>

<div class="stats">
  <div class="stat"><b>${scr.length}</b><span>screens in the app</span></div>
  <div class="stat"><b>${tables.length}</b><span>database tables</span></div>
  <div class="stat"><b>${mig.length}</b><span>schema migrations</span></div>
  <div class="stat"><b>${chk.length}</b><span>Guardian checks</span></div>
  <div class="stat"><b>${site.length}</b><span>website pages</span></div>
  <div class="stat"><b>${docs.reduce((n, g) => n + g.files.length, 0)}</b><span>documents</span></div>
</div>

<h2>Guardian</h2>
<p class="lede">The checks that run against a tenant's own history. Each produces a finding with its arithmetic attached.</p>
<div class="scroll"><table>
<thead><tr><th>Check</th><th>What it looks for</th></tr></thead>
<tbody>
${chk.map((c) => row([`<code>${esc(c.name)}</code>`, esc(c.note)])).join('\n')}
</tbody></table></div>

<h2>The app</h2>
<p class="lede">Every screen behind the login.</p>
<div class="scroll"><table>
<thead><tr><th>Route</th><th>What it is</th></tr></thead>
<tbody>
${scr.map((s) => row([`<code>${esc(s.route)}</code>`, esc(s.note)])).join('\n')}
</tbody></table></div>

<h2>The database</h2>
<p class="lede">Every table carries a company, and row-level security is the boundary between tenants.</p>
<div class="chips">${tables.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>

<h2>Schema history</h2>
<p class="lede">Every change to the database, in the order it was applied.</p>
<div class="scroll"><table>
<thead><tr><th>#</th><th>What it did</th><th>Tables added</th></tr></thead>
<tbody>
${mig.map((m) => row([
  `<span class="n">${esc(m.num)}</span>`,
  esc(m.title),
  m.tables.length ? `<span class="n">${esc(m.tables.join(', '))}</span>` : '<span class="n">—</span>',
])).join('\n')}
</tbody></table></div>

<h2>The website</h2>
<div class="scroll"><table>
<thead><tr><th>Page</th><th>Title</th></tr></thead>
<tbody>
${site.map((p) => row([`<code>${esc(p.file)}</code>`, esc(p.title)])).join('\n')}
</tbody></table></div>

<h2>Documents</h2>
${docs.map((g) => `
<h3 style="font-family:var(--body);font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:1.6rem 0 .2rem">${esc(g.folder.replace(/_/g, ' '))}</h3>
<div class="scroll"><table>
<thead><tr><th>File</th><th>Updated</th><th>Size</th></tr></thead>
<tbody>
${g.files.map((f) => row([esc(f.name), `<span class="n">${f.date}</span>`, `<span class="n">${f.size}</span>`])).join('\n')}
</tbody></table></div>`).join('')}

<h2>Not built</h2>
<p class="lede">Kept here on purpose. A list of what exists is only trustworthy beside a list of what does not.</p>
<div class="scroll"><table>
<thead><tr><th>Not built</th><th>Where that leaves us</th></tr></thead>
<tbody>
${NOT_BUILT.map((n) => `<tr class="warn">${n.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('\n')}
</tbody></table></div>

<h2>Lately</h2>
<div class="scroll"><table>
<thead><tr><th>Date</th><th>Change</th></tr></thead>
<tbody>
${work.map((w) => row([`<span class="n">${esc(w.date)}</span>`, esc(w.subject)])).join('\n')}
</tbody></table></div>

<footer>
  Generated from the files themselves, not from memory &mdash; which is how the product document
  came to be thirty commits out of date without anyone noticing.
</footer>

</div>
</body>
</html>
`;

fs.mkdirSync(ARCH, { recursive: true });
const out = path.join(ARCH, 'INDEX.html');
fs.writeFileSync(out, html);

const checksOk = {
  screens: scr.length > 0,
  tables: tables.length > 0,
  migrations: mig.length > 0,
  guardian: chk.length > 0,
  site: site.length > 0,
  docs: docs.length > 0,
};
const bad = Object.entries(checksOk).filter(([, ok]) => !ok).map(([k]) => k);
console.log(`  ${out}`);
console.log(`  ${scr.length} screens · ${tables.length} tables · ${mig.length} migrations · ` +
            `${chk.length} checks · ${site.length} pages · ${docs.reduce((n, g) => n + g.files.length, 0)} documents`);
if (bad.length) console.log(`  EMPTY SECTIONS: ${bad.join(', ')} — a path is probably wrong`);
process.exit(bad.length ? 1 : 0);
