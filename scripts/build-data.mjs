#!/usr/bin/env node
/**
 * build-data.mjs  —  data/machines.source.json  ->  public/data/machines.json
 *
 * Why this exists (Hard Rule #1: "data source = the provided data folder only"):
 * every fact in machines.source.json carries `src` (a file id in data-raw/sources)
 * and `quote` (a short verbatim snippet). This script checks that each quote
 * really occurs in the extracted source text (data-raw/text/<src>.txt) and that
 * every image URL occurs in that source's image list. If anything cannot be
 * verified the build FAILS, so made-up facts cannot slip into the app.
 *
 * It also writes docs/DATA_GAPS.md: which machines lack which fields/images.
 *
 *   npm run data
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

const source = JSON.parse(rd('data/machines.source.json'));
const photos = exists('data/photos.json') ? JSON.parse(rd('data/photos.json')) : { machines: {} };
const gallery = exists('public/data/gallery.json') ? JSON.parse(rd('public/data/gallery.json')).photos : [];
const machineBody = Object.fromEntries(source.machines.map((m) => [m.id, m.body]));
const links = exists('data/links.json') ? JSON.parse(rd('data/links.json')) : { machines: {} };
const textCache = {};
const imageCache = {};

// Compare on letters+digits only, so PDF line breaks, curly quotes, dashes and
// degree signs do not cause false failures — but every word must still match.
const norm = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');

function sourceText(id) {
  if (!(id in textCache)) {
    const p = `data-raw/text/${id}.txt`;
    textCache[id] = exists(p) ? norm(rd(p)) : null;
  }
  return textCache[id];
}
function sourceImages(id) {
  if (!(id in imageCache)) {
    const p = `data-raw/text/${id}.images.json`;
    const j = exists(p) ? JSON.parse(rd(p)) : { images: [], imageLinks: [] };
    imageCache[id] = new Set([...j.images.map((i) => i.src), ...j.imageLinks.map((l) => l.href)]);
  }
  return imageCache[id];
}

const errors = [];
let checked = 0;

/** Recursively verify every {src, quote|quotes} object. */
function verify(node, where) {
  if (Array.isArray(node)) return node.forEach((n, i) => verify(n, `${where}[${i}]`));
  if (!node || typeof node !== 'object') return;
  const quotes = node.quote ? [node.quote] : node.quotes || [];
  if (quotes.length) {
    if (!node.src) errors.push(`${where}: quote without src`);
    const t = sourceText(node.src);
    if (t == null) errors.push(`${where}: unknown source "${node.src}"`);
    else
      for (const q of quotes) {
        checked++;
        if (!t.includes(norm(q))) errors.push(`${where}: quote not found in ${node.src}: "${q}"`);
      }
  }
  for (const [k, v] of Object.entries(node)) if (k !== 'quote' && k !== 'quotes') verify(v, `${where}.${k}`);
}

/** Human label for a "more information" link, from its host. */
const LINK_SITES = { 'science.nasa.gov': 'NASA Science', 'nssdc.gsfc.nasa.gov': 'NASA Space Science Data Coordinated Archive' };

for (const m of source.machines) {
  verify(m, m.id);

  // ---- photo pack (data/photos.json -> local WebP made by `npm run photos`)
  // Rule: every moment of a timeline shows a DIFFERENT photo — a photo is never shown twice in one
  // timeline. In order: the moment's own photo (data/photos.json "events", or a new moment photo in
  // data-raw/photos-new/), else one of the machine's photos no other moment uses, else a RELATED
  // photo of the same world from the gallery ("relatedFill", captioned "Related photo"), else a
  // drawn "photo coming soon" picture. docs/PHOTOS_NEEDED.md lists every moment still without its own photo.
  const pack = photos.machines[m.id];
  if (pack) {
    m.images = pack.images.map((p) => {
      checked++;
      const raw = `data-raw/photos/${pack.folder}/${p.file}`;
      const local = `images/rovers/${m.id}/${p.id}.webp`, thumb = `images/rovers/${m.id}/${p.id}-thumb.webp`;
      if (!exists(raw)) errors.push(`${m.id}.images.${p.id}: photo-pack file missing: ${raw}`);
      if (!exists(`public/${local}`) || !exists(`public/${thumb}`)) errors.push(`${m.id}.images.${p.id}: run \`npm run photos\` (missing public/${local})`);
      return { id: p.id, kind: 'photo', local, thumb, alt: p.alt, caption: p.caption, src: 'photo-pack', pack: `${pack.folder}/${p.file}` };
    });
    for (const id of Object.keys(pack.events || {})) if (!m.events.some((e) => e.id === id)) errors.push(`${m.id}: photos.json names unknown event "${id}"`);
    for (const id of Object.keys(pack.wanted || {})) if (!m.events.some((e) => e.id === id)) errors.push(`${m.id}: photos.json "wanted" names unknown event "${id}"`);
    const shown = new Set();
    for (const e of m.events) {
      e.image = null; e.photoOwn = false;
      const own = pack.events?.[e.id];
      if (own && !shown.has(own)) { e.image = own; e.photoOwn = true; shown.add(own); }
    }
    // a photo made for this moment (data-raw/photos-new/<machine>/<moment>.jpg) always wins
    for (const e of m.events) {
      const local = `images/rovers/${m.id}/ev-${e.id}.webp`;
      if (!exists(`public/${local}`)) continue;
      checked++;
      const capFile = `data-raw/photos-new/${m.id}/${e.id}.txt`;
      const caption = exists(capFile) ? rd(capFile).trim() : '';
      m.images.push({ id: `ev-${e.id}`, kind: 'photo', local, thumb: `images/rovers/${m.id}/ev-${e.id}-thumb.webp`, alt: caption || e.title, caption, src: 'photo-pack', pack: `photos-new/${m.id}` });
      if (e.image) shown.delete(e.image);
      e.image = `ev-${e.id}`; e.photoOwn = true; shown.add(e.image);
    }
    // the machine's other photos fill moments that have none (each used once)
    const spare = m.images.filter((i) => !shown.has(i.id)).map((i) => i.id);
    for (const e of m.events) if (!e.image && spare.length) { e.image = spare.shift(); e.photoBorrowed = true; shown.add(e.image); }
    // then a related photo of the same world from the gallery
    const pool = (photos.relatedFill?.[m.body] || []).flatMap((k) => (k.startsWith('*')
      ? gallery.filter((g) => g.machine && g.machine !== m.id && machineBody[g.machine] === k.slice(1)).map((g) => g.pack)
      : [k]));
    const shownFiles = new Set(m.images.filter((i) => shown.has(i.id)).map((i) => i.local));
    for (const e of m.events) {
      if (e.image) continue;
      const g = pool.map((k) => gallery.find((x) => x.pack === k)).find((x) => x && !shownFiles.has(x.local));
      if (!g) continue;
      if (!exists(`public/${g.local}`)) { errors.push(`${m.id}: related photo missing: public/${g.local} (run npm run photos)`); continue; }
      shownFiles.add(g.local);
      m.images.push({ id: `rel-${e.id}`, kind: 'photo', local: g.local, thumb: g.thumb, alt: g.name, caption: g.name, src: 'photo-pack', pack: g.pack, related: true });
      e.image = `rel-${e.id}`; e.photoRelated = true;
    }
    const used = new Map();
    for (const e of m.events) {
      if (!e.image) continue;
      const f = m.images.find((i) => i.id === e.image)?.local;
      if (used.has(f)) errors.push(`${m.id}: photo ${f} repeats ("${used.get(f)}" and "${e.id}") — every moment needs its own photo`);
      used.set(f, e.id);
    }
  } else {
    for (const img of m.images || []) {
      checked++;
      if (!sourceImages(img.src).has(img.url)) errors.push(`${m.id}.images.${img.id}: url not in ${img.src}: ${img.url}`);
      const file = path.basename(new URL(img.url).pathname);
      img.local = exists(`public/images/${file}`) ? `images/${file}` : null;
    }
  }
  const ids = new Set((m.images || []).map((i) => i.id));
  for (const e of m.events) if (e.image && !ids.has(e.image)) errors.push(`${m.id}.${e.id}: unknown image "${e.image}"`);

  // ---- "for more information" link (data/links.json -> data-raw/links/*.txt)
  const linkFile = links.machines[m.id];
  m.moreInfo = null;
  if (linkFile) {
    const p = `data-raw/links/${linkFile}`;
    const url = exists(p) ? (rd(p).match(/https?:\/\/\S+/) || [])[0] : null;
    if (!url) errors.push(`${m.id}: no URL found in ${p}`);
    else { checked++; m.moreInfo = { url, site: LINK_SITES[new URL(url).hostname] || new URL(url).hostname, file: p }; }
  }
}

if (errors.length) {
  console.error(`\n✖ Data verification failed (${errors.length}):\n  ` + errors.join('\n  '));
  process.exit(1);
}

// ---------------------------------------------------------------- output
const out = {
  generatedAt: new Date().toISOString(),
  sources: { ...source.sources, 'photo-pack': { title: 'Team photo pack (photos only, not facts)', file: 'data-raw/photos/' } },
  machines: source.machines,
};
fs.mkdirSync(path.join(ROOT, 'public/data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'public/data/machines.json'), JSON.stringify(out, null, 1));

// ---------------------------------------------------------------- gap report
const CARD_FIELDS = [
  ['launchDate', 'Launch date'],
  ['launchSite', 'Launch location'],
  ['launchVehicle', 'Launch vehicle'],
  ['purpose', 'Purpose'],
  ['destination', 'Destination'],
  ['abandoned', 'Year abandoned / status'],
];
const missing = (v) => v == null || v.value == null;
const rows = [];
const notes = [];
const needed = []; // [machine, [{e, wanted}]]
for (const m of source.machines) {
  const gaps = CARD_FIELDS.filter(([k]) => missing(m[k])).map(([, l]) => l);
  if (!m.images?.length) gaps.push('Images (none)');
  if (m.location && (m.location.lat == null || m.location.lon == null)) gaps.push('Landing coordinates');
  const noImg = m.events.filter((e) => !e.image || e.photoRelated).length;
  const pack = photos.machines[m.id];
  const need = m.events.filter((e) => !e.image || e.photoRelated);
  if (pack && need.length) needed.push([m, need.map((e) => ({ e, wanted: pack.wanted?.[e.id] || `A photo of: ${e.title}` }))]);
  const undated = m.events.filter((e) => !e.date?.iso).length;
  const model = m.model ? `\`${m.model}\` model` : 'none (stylised stand-in)';
  rows.push(
    `| ${m.name} | ${m.images?.length || 0} | ${m.events.length} | ${noImg} | ${undated} | ${model} | ${m.moreInfo ? 'yes' : '**missing**'} | ${gaps.length ? gaps.join(', ') : '—'} |`,
  );
  for (const n of m.dataNotes || []) notes.push(`- **${m.name}:** ${n}`);
}
const header = fs.existsSync(path.join(ROOT, 'docs/DATA_GAPS.header.md')) ? rd('docs/DATA_GAPS.header.md') : '';
const report = `${header}
## Machine data coverage (generated by \`npm run data\` — ${new Date().toISOString().slice(0, 10)})

${checked} facts/images were checked against the raw source files; all verified.

| Machine | Photos | Events | Events still needing their own photo | Events w/o exact date | 3D model | More-info link | Missing fields (shown as "Data not available") |
|---|---|---|---|---|---|---|---|
${rows.join('\n')}

### Photos left out of the photo pack

${(photos.excluded || []).map((x) => `- \`${x.folder}/${x.file}\` — ${x.reason}`).join('\n') || '—'}
${Object.entries(photos.machines).filter(([, p]) => p.note).map(([id, p]) => `\n- **${id}:** ${p.note}`).join('')}

## Notes, conflicts and display decisions

${notes.join('\n')}
`;
const totalNeeded = needed.reduce((n, [, l]) => n + l.length, 0);
const photosNeeded = `# Photos needed — ${totalNeeded} unique photos

_Generated by \`npm run data\`. Every timeline moment shows a different photo. The moments below have no photo of
their own yet: for now each borrows a related photo of the same world (captioned "Related photo"). Add a real one
and it replaces the borrowed photo automatically._

**What to send:** real NASA (or other public-domain / properly credited) photos of the exact moment, **landscape**,
at least **800 px wide**, JPG / PNG / WebP, **no watermarks**. One photo per moment.

**How to add them:** put each file in \`data-raw/photos-new/<machine-id>/\` with the file name shown below (any of
.jpg .jpeg .png .webp .jfif), optionally with a same-named \`.txt\` file holding a one-line caption, then run

\`\`\`bash
npm run photos && npm run data
\`\`\`

A zip with the same layout (\`viking-1/soil.jpg\`, …) can simply be unzipped into \`data-raw/photos-new/\`.

| Machine | How many | Moment | File name | Recommended subject |
|---|---|---|---|---|
${needed.map(([m, list]) => list.map(({ e, wanted }, i) => `| ${i ? '' : m.name} | ${i ? '' : list.length} | ${e.date?.label || ''} · ${e.title} | \`${m.id}/${e.id}.jpg\` | ${wanted} |`).join('\n')).join('\n')}
| **Total** | **${totalNeeded}** | | | |
`;
fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs/DATA_GAPS.md'), report.replace('### Photos left out of the photo pack', `### Photos still needed\n\n${totalNeeded} unique photos (${needed.map(([m, l]) => `${m.shortName || m.name}: ${l.length}`).join(', ')}) — send real, landscape photos (≥ 800 px wide, no watermarks), one per moment. How to add them: [PHOTOS_NEEDED.md](PHOTOS_NEEDED.md).\n\n| Machine | How many | Moment | File name | Recommended subject |\n|---|---|---|---|---|\n${needed.map(([m, list]) => list.map(({ e, wanted }, i) => `| ${i ? '' : m.name} | ${i ? '' : list.length} | ${e.date?.label || ''} · ${e.title} | \`${m.id}/${e.id}.jpg\` | ${wanted} |`).join('\n')).join('\n')}\n| **Total** | **${totalNeeded}** | | | |\n\n### Photos left out of the timelines (still shown in the Gallery)`));
fs.writeFileSync(path.join(ROOT, 'docs/PHOTOS_NEEDED.md'), photosNeeded);
console.log(`✔ ${source.machines.length} machines, ${checked} facts verified -> public/data/machines.json, docs/DATA_GAPS.md, docs/PHOTOS_NEEDED.md (${totalNeeded} photos needed)`);
