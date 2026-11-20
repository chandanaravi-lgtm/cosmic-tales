/**
 * "Ask Astro" answer engine — retrieval only, no text generation.
 *
 * Knowledge = public/data/rag-index.json, built by scripts/build_rag.py from
 * the team's Data.zip (and nothing else). Every answer is made of sentences
 * copied word for word from that index, with the file they came from, so the
 * assistant cannot invent facts or drift onto other topics.
 *
 * Pipeline for one question:
 *   1. small talk / help / "which machines?" requests get fixed replies
 *   2. find machine names ("Viking", "Eagle", "it" = the last machine discussed)
 *   3. score every sentence with BM25 (+ its paragraph, + a bonus for the
 *      kind of answer asked for: dates for "when", numbers for "how much"…)
 *   4. DOMAIN GATE: refuse unless the question is clearly about the files
 *   5. answer with the best 1–3 sentences from the best-matching file
 * Pure JS (no DOM) so it can be unit-tested in Node: scripts/test-rag.mjs.
 */

// ---------------------------------------------------------------- text tools
const STOP = new Set(`a an the and or but if of to in on at by for from with about into onto over under up down out off as is are was were be been
being am do does did done doing have has had having i me my we our you your he she it its they them their this that these those there here what
which who whom whose when where why how can could would should will shall may might must tell know say said please also just than then so very
much many more most some any all each both one ones get got let make made like want wanna need see show give find thing things kind lot really
okay ok hey hi hello thanks thank yes no not dont doesnt didnt cant isnt wasnt arent werent im youre ive lets anything something everything
explain describe question questions answer information info detail details fact facts still ever even`.split(/\s+/));

// generic words that are part of the topic but do not identify a file on their own
const TOPIC_WORDS = new Set(['nasa', 'mission', 'missions', 'spacecraft', 'machine', 'machines', 'space', 'moon', 'lunar', 'mars', 'martian',
  'asteroid', 'rover', 'rovers', 'lander', 'landers', 'probe', 'probes', 'telescope', 'astronaut', 'astronauts', 'orbiter', 'module']);

// everyday words that appear in the files but never make a question "about the files" on their own
const GENERIC = new Set(['time', 'day', 'days', 'year', 'years', 'today', 'tomorrow', 'now', 'people', 'person', 'world', 'way', 'best', 'good',
  'new', 'first', 'long', 'big', 'number', 'work', 'thing', 'place', 'part', 'name', 'use', 'used', 'help', 'start', 'end', 'go', 'come', 'take',
  'high', 'low', 'small', 'large', 'old', 'young', 'man', 'men', 'woman', 'water', 'earth', 'sun', 'light', 'speed']);
// words that just phrase a "list the machines" request
const LIST_WORDS = new Set(['go', 'went', 'gone', 'travel', 'traveled', 'visit', 'visited', 'sent', 'send', 'land', 'landed', 'explore',
  'explored', 'file', 'files', 'data', 'cover', 'covered', 'there', 'exist', 'included', 'include', 'have', 'list']);

/** Very small English stemmer — the same rules run on the files and on the question. */
export function stem(w) {
  if (w.length <= 3 || /\d/.test(w)) return w;
  if (w.endsWith('ies') && w.length > 4) return `${w.slice(0, -3)}y`;
  if (w.endsWith('sses')) return w.slice(0, -2);
  if (w.endsWith('ing') && w.length > 5) w = w.slice(0, -3);
  else if (w.endsWith('ed') && w.length > 4) w = w.slice(0, -2);
  else if (w.endsWith('es') && w.length > 4 && /(ch|sh|x|ss|z)es$/.test(w)) w = w.slice(0, -2);
  else if (w.endsWith('s') && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
  if (w.endsWith('ly') && w.length > 4) w = w.slice(0, -2);
  else if (w.endsWith('er') && w.length > 5) w = w.slice(0, -2); // lander -> land, orbiter -> orbit
  if (/([b-df-hj-np-tv-z])\1$/.test(w) && !/(ll|ss|zz)$/.test(w)) w = w.slice(0, -1); // stopp -> stop
  if (w.endsWith('e') && w.length > 3) w = w.slice(0, -1); // name/named -> nam, image/images -> imag
  return w;
}

// the lists above hold plain words; questions are compared as stems
const STEMMED = (set) => new Set([...set].map((w) => stem(w)));
const TOPIC = STEMMED(TOPIC_WORDS);
const GENERIC_S = STEMMED(GENERIC);
const LIST_S = STEMMED(LIST_WORDS);

export function words(text) {
  return String(text).toLowerCase().replace(/[’‘`]/g, "'").replace(/'s\b/g, '').replace(/'/g, '').split(/[^a-z0-9]+/).filter(Boolean);
}
export const tokens = (text) => words(text).filter((w) => !STOP.has(w)).map(stem);

// question words -> extra search words (weight < 1). Written as plain words, stemmed at start-up.
const SYNONYMS = {
  land: ['touch', 'touchdown', 'set', 'landing'], landed: ['touch', 'set'], touchdown: ['land'],
  launch: ['lift', 'liftoff', 'launched'], liftoff: ['launch', 'lift'], rocket: ['vehicle', 'launch'],
  weigh: ['mass', 'kg', 'pounds', 'kilograms'], heavy: ['mass', 'pounds', 'kilograms'], weight: ['mass', 'pounds', 'kilograms'],
  big: ['diameter', 'size', 'meters'], size: ['diameter', 'meters'],
  picture: ['images', 'photos', 'photographs'], photo: ['images', 'pictures', 'photographs'], image: ['photos', 'pictures'],
  find: ['found', 'discovered', 'showed', 'suggested', 'results'], found: ['discovered', 'showed', 'results'], discover: ['found', 'discovered', 'discovery'],
  learn: ['found', 'showed', 'results', 'indicated'],
  life: ['biological', 'organic', 'alive'], alive: ['life', 'biological'],
  die: ['end', 'ended', 'lost', 'contact', 'stopped', 'last'], dead: ['end', 'lost', 'stopped'],
  end: ['ended', 'stopped', 'lost', 'terminated', 'shut', 'retired', 'last'], stop: ['stopped', 'ended', 'lost', 'terminated', 'last', 'contact', 'succumbed'],
  fate: ['crashed', 'impact', 'lost'], happen: ['fate', 'happened'],
  broke: ['failure', 'damaged', 'inoperable', 'problem'], broken: ['failure', 'damaged', 'inoperable'], fail: ['failure', 'aborted', 'inoperable', 'damaged'],
  problem: ['failure', 'aborted', 'damaged', 'inoperable', 'surge', 'faulty'], wrong: ['faulty', 'failure', 'aborted', 'problem'],
  name: ['named', 'renamed', 'honor'], called: ['named', 'renamed'], renamed: ['named', 'honor'],
  rover: ['sojourner', 'vehicle', 'lrv'], buggy: ['rover', 'vehicle', 'lrv'], car: ['rover', 'vehicle'], drive: ['rover', 'traversed', 'covered', 'drove'],
  soil: ['sample', 'samples', 'sand'], dirt: ['soil', 'sand'], sand: ['soil'], dig: ['trenches', 'scoop', 'sampler'], scoop: ['sampler', 'trenches'],
  rock: ['rocks', 'samples', 'pebbles'], temperature: ['degrees', 'cold'], cold: ['temperature', 'degrees'], hot: ['temperature', 'degrees'],
  water: ['wet', 'ice', 'floodplain'], quake: ['seismic', 'seismometer', 'moonquake'], earthquake: ['seismic', 'seismometer'],
  planet: ['planets', 'exoplanets'], star: ['stars', 'stellar'], camera: ['imaging', 'television', 'images'],
  astronaut: ['crew', 'commander', 'pilot'], crew: ['astronauts', 'commander', 'pilot'], walk: ['moonwalk', 'eva', 'stepped'],
  wheel: ['wheels', 'reaction'], fuel: ['propellant'], power: ['solar', 'rtg', 'batteries', 'generator'], battery: ['batteries', 'power'],
  speed: ['mph', 'km', 'meters', 'second'], fast: ['speed', 'mph'], cost: ['million', '$'], far: ['distance', 'miles', 'kilometers', 'covered', 'km', 'traversed'],
  bounce: ['bounced', 'bounces'], airbag: ['airbags', 'bounced'], weather: ['temperature', 'wind', 'pressure', 'dust'],
  fly: ['crew', 'astronauts', 'commander', 'pilot', 'carried'], flew: ['crew', 'astronauts', 'commander', 'pilot', 'carried'],
  pilot: ['commander', 'crew'], drove: ['covered', 'traversed', 'km'], talk: ['contact', 'communications', 'data'], talking: ['contact', 'communications'],
  measure: ['recorded', 'measured', 'instruments', 'sensors', 'data'], stay: ['hours', 'minutes', 'spent', 'surface'],
  work: ['retired', 'retiring', 'operating', 'functioning'], working: ['retired', 'retiring', 'operating'],
  experiment: ['experiments', 'instruments', 'package'], instrument: ['instruments', 'experiments'],
};

// ---------------------------------------------------------------- question types
// what each kind of question looks for: `q` = in the question, `s` = in an answer sentence, `add` = extra search words
const QTYPES = [
  { id: 'when', q: /\bwhen\b|what (date|year|day|month|time)|\bwhich (year|date|day)\b|\bdate\b|\byear\b/, s: /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Aug|Sept?|Oct|Nov|Dec)\b|\b(19|20)\d\d\b|\d\d:\d\d/ },
  { id: 'where', add: ['region', 'latitude', 'longitude', 'area', 'site'], q: /\bwhere\b|\blocation\b|\bsite\b|\bwhich (place|region|area|crater)\b/, s: /latitude|longitude|\bsite\b|region|area|located|Vallis|Planitia|Procellarum|Tranquil|Canaveral|crater|plain|Hadley|Apennine|Imbrium|Cygnus|Himeros/i },
  { id: 'number', q: /\bhow (much|heavy|big|large|long|far|fast|many|tall|wide|high|deep|old|hot|cold)\b|\bmass\b|\bweigh|\bsize\b|\bspeed\b|\bdistance\b|\bcost\b/, s: /\d/ },
  { id: 'who', add: ['commander', 'pilot', 'honor'], q: /\bwho\b|\bwhich astronauts?\b|\bnamed (after|for)\b|\bhonou?r/, s: /\b[A-Z]\. [A-Z][a-z]+|\b[A-Z][a-z]+ [A-Z]\. [A-Z][a-z]+|\bastronauts [A-Z]|Commander [A-Z]|pilot [A-Z]|named after|in honou?r|Jr\./ },
  { id: 'why', add: ['because'], q: /\bwhy\b|\breason\b|\bcause/, s: /because|due to|so that|\bso\b|ran out|faulty|failure|prevent|in order|therefore|resulted|succumbed|accidentally|robbed/i },
  { id: 'duration', add: ['hours', 'minutes', 'days', 'months'], q: /\bhow long\b|\bhow much time\b|\bduration\b/, s: /\d+ (hours?|minutes?|days?|weeks?|months?|years?)\b/ },
  { id: 'end', add: ['retired', 'retiring', 'last', 'contact', 'ended'], q: /\b(end|ended|stop|stopped|die|died|dead|lost|last contact|fate|happened to|retired?|shut)\b|\bstill (work|alive|active|running|operat|on)/, s: /last contact|\blost\b|ended|shut down|stopped|terminated|retired|\bfate\b|crash|unsuccessful|no longer|succumbed/i },
];

// "Launch Date: 1969-11-14." / "July 20, 1976: Lander touched down." — the files' fact lines
const FACT_LINE = /^[A-Z][^:.]{1,45}(?:\.[^:.]{0,20})?: \S/;

const SMALLTALK = [
  { re: /^(hi|hello|hey|hiya|yo|greetings|good (morning|afternoon|evening))\b/, kind: 'hello' },
  { re: /\b(thanks|thank you|thx|cheers|awesome|cool|great|nice)\b/, kind: 'thanks' },
  { re: /\b(bye|goodbye|see you|later)\b/, kind: 'bye' },
  { re: /\b(who|what) are you\b|\byour name\b|\bwhat can you (do|answer)\b|\bhelp\b|\bhow do (i|you) (use|ask)\b/, kind: 'help' },
];
const LIST_RE = /\b(which|what|list|name|how many|all( the)?|tell me (the|all))\b.*\b(machines?|missions?|spacecraft|rovers?|landers?|probes?|telescopes?)\b|\bwhat do you know\b|\bwhat('s| is) (in )?(the|your) (data|files?)\b/;
const PRONOUN_RE = /\b(it|its|it's|they|them|their|this (one|mission|machine|spacecraft)|that (one|mission|machine|spacecraft)|the (lander|rover|spacecraft|mission|probe|telescope|module))\b/;
const BODY_WORDS = { moon: /\b(moon|lunar)\b/, mars: /\b(mars|martian|red planet)\b/, 'deep-space': /\b(deep space|asteroid|stars?|exoplanets?)\b/ };

export class AskAstro {
  /** @param {object} index  parsed rag-index.json */
  constructor(index, { k1 = 1.2, b = 0.75 } = {}) {
    this.docs = index.docs;
    this.docById = new Map(index.docs.map((d) => [d.id, d]));
    this.k1 = k1; this.b = b; this.sb = 0.5; // sentences: milder length penalty so full, informative sentences can win
    this.sentences = [];
    this.passages = index.passages.map((p, pi) => {
      const toks = [];
      for (let si = 0; si < p.sentences.length; si++) {
        const t = tokens(p.sentences[si]);
        toks.push(...t);
        this.sentences.push({ id: this.sentences.length, doc: p.doc, pi, si, text: p.sentences[si], section: p.section, toks: t, tf: tf(t) });
      }
      return { ...p, pi, toks, tf: tf(toks) };
    });
    this.sDf = df(this.sentences); this.pDf = df(this.passages);
    this.sAvg = avg(this.sentences); this.pAvg = avg(this.passages);
    this.vocab = new Set(this.sDf.keys());
    this.syn = new Map(Object.entries(SYNONYMS).map(([k, v]) => [stem(k), [...new Set(v.flatMap((w) => tokens(w)))]]));
    // machine names, longest first so "apollo 11" wins over "apollo"
    this.names = this.docs.flatMap((d) => d.names.map((n) => ({ doc: d.id, name: n.toLowerCase() }))).sort((a, b) => b.name.length - a.name.length);
    this.state = { lastDoc: null };
  }

  reset() { this.state = { lastDoc: null }; }

  // ------------------------------------------------------------ public API
  /**
   * @returns {{kind:'answer'|'list'|'notfound'|'refuse'|'smalltalk', text?:string,
   *            items?:Array<{doc:string,text:string}>, docs?:string[]}}
   */
  ask(question) {
    const raw = String(question || '').trim();
    const q = raw.toLowerCase().replace(/[’‘]/g, "'");
    if (!q) return this.#small('help');

    const ent = this.#entities(raw, q);
    const talk = SMALLTALK.find((s) => s.re.test(q));
    const content = tokens(q);
    if (talk && !ent.length && content.filter((t) => this.vocab.has(t)).length === 0) return this.#small(talk.kind);
    const askedBeyondList = content.filter((t) => !TOPIC.has(t) && !LIST_S.has(t) && !['moon', 'mar', 'deep', 'planet', 'red', 'asteroid'].includes(t));
    if (LIST_RE.test(q) && !ent.length && askedBeyondList.length === 0) return this.#list(q);

    // which files may answer: named machines > "it/they" (last machine) > a named place > everything
    const bodies = Object.entries(BODY_WORDS).filter(([, re]) => re.test(q)).map(([b]) => b);
    const bodyDocs = this.docs.filter((d) => bodies.includes(d.body)).map((d) => d.id);
    // "it" refers back to the last machine — unless the question names a place that machine is not at
    const followUp = !ent.length && this.state.lastDoc && PRONOUN_RE.test(q) && (!bodyDocs.length || bodyDocs.includes(this.state.lastDoc));
    const allowed = ent.length ? new Set(ent) : followUp ? new Set([this.state.lastDoc]) : bodyDocs.length ? new Set(bodyDocs) : null;
    // drop only the machine's own name ("Viking 1") from what is being asked; sub-topics such as
    // "Lunar Roving Vehicle", "K2" or "Eros" stay as search words
    const nameToks = new Set(ent.flatMap((d) => tokens(this.docById.get(d).short)));
    const terms = content.filter((t) => !nameToks.has(t));            // what is asked ABOUT the machine
    const topical = terms.filter((t) => !TOPIC.has(t) && !/^\d+$/.test(t));
    const qtype = QTYPES.filter((t) => t.q.test(q));

    // "tell me about Viking 1" -> overview of that file; "tell me about Mars" -> the machines there
    if (allowed && topical.length === 0 && !qtype.length) return ent.length || followUp ? this.#overview([...allowed]) : this.#list(q);

    // ---- DOMAIN GATE (questions that name no machine)
    if (!allowed) {
      if (!topical.length) {
        // only topic words ("tell me about mars") -> overview of that place's machines, else refuse
        const body = Object.entries(BODY_WORDS).find(([, re]) => re.test(q))?.[0];
        return body ? this.#list(q, body) : this.#refuse(raw);
      }
      // no machine and no place named: be strict, this is where off-topic questions arrive.
      // Need 2+ specific words, every one of them found in the files.
      const specific = topical.filter((t) => !GENERIC_S.has(t));
      const unknown = topical.filter((t) => !this.vocab.has(t) && t.length >= 3);
      if (specific.length < 2 || unknown.length) return this.#refuse(raw);
    } else if (followUp && topical.length && topical.every((t) => GENERIC_S.has(t))) {
      return this.#refuse(raw); // "what time is it?" is not a follow-up question
    }

    const scored = this.#score(terms.length ? terms : content, qtype, allowed, new Set(topical));
    const best = scored[0];
    if (!best || best.score <= 0) return allowed ? this.#notFound([...allowed], raw) : this.#refuse(raw);

    if (!allowed) {
      // the best sentence's paragraph must contain most of what was asked, and be a strong match
      const pass = this.passages[best.pi];
      const hit = topical.filter((t) => pass.tf.has(t) || this.#synHit(t, pass.tf)).length;
      const need = Math.min(2, topical.length);
      if (hit < need || best.base < 2.2) return this.#refuse(raw);
    } else if (topical.length) {
      // a named machine: the answer must actually mention something that was asked
      const pass = this.passages[best.pi];
      const hit = topical.some((t) => best.tf.has(t) || pass.tf.has(t) || this.#synHit(t, best.tf) || this.#synHit(t, pass.tf));
      if (!hit) return ent.length || followUp ? this.#notFound([...allowed], raw) : this.#refuse(raw);
    }

    // several machines named ("Viking 1 or Pathfinder?") -> one best sentence each
    if (ent.length > 1) {
      const items = ent.map((d) => scored.find((s) => s.doc === d && s.score > 0)).filter(Boolean)
        .map((s) => ({ doc: s.doc, text: s.text }));
      if (items.length) { this.state.lastDoc = items[items.length - 1].doc; return { kind: 'answer', items, docs: items.map((i) => i.doc) }; }
    }

    const doc = best.doc;
    const picked = this.#compose(scored.filter((s) => s.doc === doc), best, qtype);
    this.state.lastDoc = doc;
    return { kind: 'answer', items: picked.map((s) => ({ doc, text: s.text })), docs: [doc] };
  }

  /** Suggested questions for the chat's chips (fixed; all answerable from the files). */
  suggestions() {
    return ['When did Viking 1 land?', 'What did Armstrong say on the Moon?', 'How many times did Pathfinder bounce?', 'Why did NEAR stop talking?', 'Who was Sojourner named after?', 'What did Surveyor 3 find out about the soil?'];
  }

  // ------------------------------------------------------------ internals
  #entities(raw, q) {
    const found = [];
    let rest = ` ${q} `;
    for (const { doc, name } of this.names) {
      // "near" is an everyday word: only the capitalised NEAR, or "near shoemaker", counts
      if (name === 'near' && !/\bNEAR\b/.test(raw)) continue;
      const re = new RegExp(`(^|[^a-z0-9])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`);
      if (re.test(rest)) {
        if (!found.includes(doc)) found.push(doc);
        rest = rest.replace(re, ' ');
      }
    }
    // a bare "apollo" with no number means all three Apollo landers
    if (/\bapollo\b/.test(rest) && !found.some((d) => d.startsWith('apollo'))) found.push('apollo-11-lm', 'apollo-12-lm', 'apollo-15-lm');
    return found;
  }

  #synHit(t, tfMap) { return (this.syn.get(t) || []).some((x) => tfMap.has(x)); }

  #score(terms, qtype, allowed, topical = new Set(terms)) {
    const weights = new Map();
    // what is really being asked counts fully; topic words ("lunar", "module") only a little
    const lowTopic = topical.size ? 0.15 : 0.6;
    for (const t of terms) weights.set(t, Math.max(weights.get(t) || 0, topical.has(t) ? 1 : lowTopic));
    for (const t of terms) for (const s of this.syn.get(t) || []) if (!weights.has(s)) weights.set(s, 0.55);
    for (const qt of qtype) for (const w of qt.add || []) for (const s of tokens(w)) if (!weights.has(s)) weights.set(s, 0.45);
    // words that count as "answering what was asked": the asked words and their synonyms (not the helper words)
    const asked = new Set([...topical].flatMap((t) => [t, ...(this.syn.get(t) || [])]));
    const N = this.sentences.length, P = this.passages.length;
    const pScore = new Map();
    const out = [];
    for (const s of this.sentences) {
      if (allowed && !allowed.has(s.doc)) continue;
      let base = 0;
      for (const [t, w] of weights) base += w * bm25(s.tf.get(t) || 0, s.toks.length, this.sAvg, this.sDf.get(t) || 0, N, this.k1, this.sb);
      if (!pScore.has(s.pi)) {
        const p = this.passages[s.pi];
        let ps = 0;
        for (const [t, w] of weights) ps += w * bm25(p.tf.get(t) || 0, p.toks.length, this.pAvg, this.pDf.get(t) || 0, P, this.k1, this.b);
        pScore.set(s.pi, ps);
      }
      const typeHit = qtype.length > 0 && qtype.some((qt) => qt.s.test(s.text));
      // the sentence itself must match something; its paragraph only adds context
      let score = base > 0 ? base + 0.35 * pScore.get(s.pi) : 0;
      if (asked.size && score > 0 && ![...asked].some((t) => s.tf.has(t))) score *= 0.25; // matches only helper words
      if (typeHit && score > 0) score *= 1.45;
      // the files' own fact lines ("July 20, 1976: Lander touched down.") answer when/where/how-much best
      if (typeHit && score > 0 && FACT_LINE.test(s.text) && qtype.some((qt) => ['when', 'where', 'number'].includes(qt.id))) score *= 1.35;
      if (qtype.length && !typeHit && score > 0) score *= 0.8;
      if (!allowed && this.state.lastDoc === s.doc) score *= 1.1; // gentle preference for the current topic
      out.push({ ...s, base, score, typeHit });
    }
    return out.sort((a, b) => b.score - a.score);
  }

  /** best sentence + up to 2 strong neighbours from the same file, in reading order, ~80 words max */
  #compose(docScored, best, qtype = []) {
    const pick = [best];
    let wordsUsed = best.text.split(/\s+/).length;
    // "who/when/where" but the best sentence has no name/date/place: add the neighbour that does
    if (qtype.length && !best.typeHit) {
      const nb = docScored.find((s) => s.pi === best.pi && Math.abs(s.si - best.si) <= 2 && s.typeHit);
      if (nb) { pick.push(nb); wordsUsed += nb.text.split(/\s+/).length; }
    }
    for (const s of docScored.slice(1, 12)) {
      if (pick.length >= 3 || wordsUsed > 70) break;
      const near = s.pi === best.pi && Math.abs(s.si - best.si) <= 2;
      if (s.score < best.score * (near ? 0.45 : 0.7)) continue;
      if (pick.some((p) => jaccard(p.toks, s.toks) > 0.55)) continue;
      const n = s.text.split(/\s+/).length;
      if (wordsUsed + n > 95) continue;
      pick.push(s); wordsUsed += n;
    }
    return pick.sort((a, b) => a.pi - b.pi || a.si - b.si);
  }

  #overview(docIds) {
    const items = docIds.map((d) => {
      const sents = this.sentences.filter((s) => s.doc === d && s.text.split(/\s+/).length >= 7);
      return sents.slice(0, docIds.length > 1 ? 1 : 2).map((s) => ({ doc: d, text: s.text }));
    }).flat();
    this.state.lastDoc = docIds[docIds.length - 1];
    return { kind: 'answer', items, docs: docIds };
  }

  #list(q, bodyHint = null) {
    const body = bodyHint || Object.entries(BODY_WORDS).find(([, re]) => re.test(q))?.[0];
    const docs = this.docs.filter((d) => !body || d.body === body);
    const items = docs.map((d) => {
      const first = this.sentences.find((s) => s.doc === d.id && s.text.split(/\s+/).length >= 7);
      return { doc: d.id, text: first?.text || d.name };
    });
    return { kind: 'list', body, items, docs: docs.map((d) => d.id) };
  }

  #notFound(docIds, raw) { return { kind: 'notfound', docs: docIds, question: raw }; }
  #refuse(raw) { return { kind: 'refuse', question: raw }; }
  #small(kind) { return { kind: 'smalltalk', talk: kind }; }
}

// ---------------------------------------------------------------- maths
function tf(toks) { const m = new Map(); for (const t of toks) m.set(t, (m.get(t) || 0) + 1); return m; }
function df(units) { const m = new Map(); for (const u of units) for (const t of u.tf.keys()) m.set(t, (m.get(t) || 0) + 1); return m; }
function avg(units) { return units.reduce((a, u) => a + u.toks.length, 0) / Math.max(1, units.length); }
function bm25(f, len, avgLen, n, N, k1, b) {
  if (!f) return 0;
  const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
  return idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * len) / avgLen)));
}
function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  let i = 0; for (const x of A) if (B.has(x)) i++;
  return i / Math.max(1, A.size + B.size - i);
}
