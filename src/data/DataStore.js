import { APP } from '../config/app.config.js';

/**
 * Read-only access to the verified machine data (public/data/machines.json,
 * produced by `npm run data`). The rest of the app never touches raw JSON.
 */
export class DataStore {
  constructor() {
    this.machines = [];
    this.byId = new Map();
    this.sources = {};
  }

  async load(url = APP.dataUrl) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
    const json = await res.json();
    this.sources = json.sources || {};
    this.machines = (json.machines || []).map((m) => this.#normalise(m));
    for (const m of this.machines) this.byId.set(m.id, m);
    return this;
  }

  /** Defensive defaults so a half-filled record never crashes the UI. */
  #normalise(m) {
    return {
      aliases: [], images: [], events: [], dataNotes: [],
      ...m,
      events: (m.events || []).map((e, i) => ({ details: [], ...e, index: i })),
    };
  }

  all() { return this.machines; }
  get(id) { return this.byId.get(id); }
  onBody(body) { return this.machines.filter((m) => m.body === body || m.anchor === body); }
  deepSpace() { return this.machines.filter((m) => m.body === 'deep-space'); }
  sourceTitle(id) { return this.sources[id]?.title || id; }

  /**
   * Search names + aliases. Ranking: prefix match on a word > substring.
   * Returns [{machine, label, matched}] (matched = alias that hit, if any).
   */
  search(query, limit = 8) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out = [];
    for (const m of this.machines) {
      const names = [m.name, m.shortName, ...m.aliases].filter(Boolean);
      let best = null;
      for (const n of names) {
        const l = n.toLowerCase();
        const i = l.indexOf(q);
        if (i < 0) continue;
        const score = (i === 0 ? 0 : /\s|[“"(]/.test(l[i - 1]) ? 1 : 2) + (n === m.name || n === m.shortName ? 0 : 0.5);
        if (!best || score < best.score) best = { score, matched: n };
      }
      if (best) out.push({ machine: m, score: best.score, matched: best.matched === m.name || best.matched === m.shortName ? null : best.matched });
    }
    return out.sort((a, b) => a.score - b.score || a.machine.name.localeCompare(b.machine.name)).slice(0, limit);
  }

  /**
   * Global search for the header: planets (and Deep Space), machines (names +
   * aliases) and timeline moments (titles, then story text). Each group is
   * capped so the list stays short and quick to scan.
   *   -> [{ type: 'planet'|'machine'|'moment', label, meta, ... }]
   * @param {Array<{id,name}>} places  bodies that can be flown to
   */
  searchAll(query, places = [], { planets = 3, machines = 5, moments = 5 } = {}) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const where = { moon: 'on the Moon', mars: 'on Mars', 'deep-space': 'in deep space' };
    const rank = (text) => {
      const l = String(text || '').toLowerCase();
      const i = l.indexOf(q);
      return i < 0 ? null : i === 0 ? 0 : /[\s“"(\-]/.test(l[i - 1]) ? 1 : 2;
    };

    const placeHits = places
      .map((p) => ({ p, s: rank(p.name) }))
      .filter((x) => x.s != null)
      .sort((a, b) => a.s - b.s)
      .slice(0, planets)
      .map(({ p }) => {
        const n = p.id === 'deepspace' ? this.deepSpace().length : this.onBody(p.id).length;
        return { type: 'planet', id: p.id, label: p.name, meta: n ? `${n} machine${n === 1 ? '' : 's'} to explore` : 'Fly there' };
      });

    const machineHits = this.search(query, machines).map((r) => ({
      type: 'machine', id: r.machine.id, label: r.machine.name, matched: r.matched,
      meta: `${r.machine.kind ? `${r.machine.kind} · ` : ''}${where[r.machine.body] || ''}`,
    }));

    const momentHits = [];
    for (const m of this.machines) {
      for (const e of m.events) {
        const t = rank(e.title);
        const s = t != null ? t : rank(e.text) != null ? 3 : null;
        if (s != null) momentHits.push({ s, type: 'moment', machineId: m.id, index: e.index, label: e.title, meta: `${m.shortName || m.name} · ${e.date?.label || ''}` });
      }
    }
    momentHits.sort((a, b) => a.s - b.s);

    return [...placeHits, ...machineHits, ...momentHits.slice(0, moments)];
  }
}
