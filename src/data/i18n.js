import { APP, STRINGS } from '../config/app.config.js';

/**
 * Timeline translations. Only the text inside the timeline information box is
 * translated (titles, texts, details, photo captions and its few labels); the
 * navigation, the 3D scene and everything else stay in English.
 *
 * public/data/i18n/index.json lists the languages; each language is one small
 * file (public/data/i18n/<code>.json, made by scripts/translate.py) fetched
 * only when a reader picks it, then kept in memory. Indian scripts get a
 * bundled Noto font, also loaded only on first use.
 */
const files = new Map();
let index = null;

/** Self-hosted fonts for scripts not every device ships (loaded on first use). */
const FONTS = {
  hi: () => Promise.all([import('@fontsource/noto-sans-devanagari/400.css'), import('@fontsource/noto-sans-devanagari/700.css')]),
  kn: () => Promise.all([import('@fontsource/noto-sans-kannada/400.css'), import('@fontsource/noto-sans-kannada/700.css')]),
  ta: () => Promise.all([import('@fontsource/noto-sans-tamil/400.css'), import('@fontsource/noto-sans-tamil/700.css')]),
  te: () => Promise.all([import('@fontsource/noto-sans-telugu/400.css'), import('@fontsource/noto-sans-telugu/700.css')]),
};
export const SCRIPT_FONT = {
  hi: "'Noto Sans Devanagari', var(--font)",
  kn: "'Noto Sans Kannada', var(--font)",
  ta: "'Noto Sans Tamil', var(--font)",
  te: "'Noto Sans Telugu', var(--font)",
  ja: "'Hiragino Sans', 'Yu Gothic', 'Noto Sans JP', 'Noto Sans CJK JP', var(--font)",
};

/** [{code, name, english, coverage}] — English first. */
export async function languages() {
  if (!index) {
    index = fetch(`${APP.i18nUrl}index.json`)
      .then((r) => (r.ok ? r.json() : { languages: [] }))
      .then((j) => j.languages || [])
      .catch(() => []);
  }
  return [{ code: 'en', name: STRINGS.translate.english, english: 'English', coverage: 1 }, ...(await index)];
}

/** The translation file for `code` (null for English). Throws if it cannot be loaded. */
export function loadLanguage(code) {
  if (!code || code === 'en') return Promise.resolve(null);
  if (!files.has(code)) {
    const p = Promise.all([
      fetch(`${APP.i18nUrl}${code}.json`).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      (FONTS[code]?.() || Promise.resolve()).catch(() => {}), // a missing font is not fatal
    ]).then(([doc]) => doc);
    p.catch(() => files.delete(code)); // allow a retry later
    files.set(code, p);
  }
  return files.get(code);
}

export function savedLanguage() {
  try { return localStorage.getItem(APP.storageKeys.lang) || 'en'; } catch { return 'en'; }
}
export function saveLanguage(code) {
  try { localStorage.setItem(APP.storageKeys.lang, code); } catch { /* private mode */ }
}

/**
 * Everything the timeline box shows for one moment, in `doc`'s language
 * (or English when doc is null). `missing` counts strings that fell back.
 */
export function momentText(doc, machine, e, img) {
  const g = doc?.groups?.[machine.id] || {};
  const ui = doc?.groups?.ui || {};
  let missing = 0;
  const pick = (table, key, en) => {
    if (!doc || en == null || en === '') return en;
    const v = table[key];
    if (v) return v;
    missing++;
    return en;
  };
  const k = `e.${e.id}`;
  const t = {
    title: pick(g, `${k}.title`, e.title),
    text: pick(g, `${k}.text`, e.text),
    details: (e.details || []).map(([dk, dv], i) => [pick(g, `${k}.d${i}.k`, dk), pick(g, `${k}.d${i}.v`, dv)]),
    caption: img?.caption ? pick(g, `img.${img.id}`, img.caption) : '',
    type: pick(ui, `type.${e.type}`, STRINGS.eventTypes[e.type] || e.type),
    source: pick(ui, 'source', 'Source'),
    moreInfo: pick(ui, 'moreInfo', STRINGS.moreInfo.text),
    open: pick(ui, 'open', 'Open'),
    dataNotAvailable: pick(ui, 'dataNotAvailable', STRINGS.dataNotAvailable),
    photoComingSoon: pick(ui, 'photoComingSoon', STRINGS.photoComingSoon),
    relatedPhoto: pick(ui, 'relatedPhoto', STRINGS.relatedPhoto),
    fromPhotoSet: pick(ui, 'fromPhotoSet', STRINGS.fromPhotoSet),
    note: pick(ui, 'note', STRINGS.translate.note),
  };
  t.missing = missing;
  return t;
}
