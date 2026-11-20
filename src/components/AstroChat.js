import gsap from 'gsap';
import { APP, STRINGS } from '../config/app.config.js';
import { bus } from '../core/EventBus.js';
import { esc } from '../data/format.js';
import { astronautIcon, sendIcon, minimizeIcon } from './icons.js';

const S = STRINGS.chat;
const CFG = APP.chat;

/**
 * "Ask Astro": an astronaut button fixed in the lower-right corner (it never
 * moves). Click it and a chat window opens above it; questions are answered
 * by the retrieval engine in src/rag/engine.js, which only uses the team's
 * Data.zip. After `APP.chat.idleMs` without any interaction the window folds
 * back into the astronaut (a thin bar warns for the last few seconds).
 *
 * The engine and its 70 KB index are loaded only the first time the chat opens.
 *
 * It fades out of the way while a timeline plays, while the Gallery / Saved
 * panel is open, and (on narrow screens) while a Cosmic Card covers the bottom
 * of the screen — and fades back in afterwards, in the same corner.
 */
export class AstroChat {
  constructor(root, store) {
    this.store = store;
    this.open = false;
    this.busy = false;
    this.engine = null;
    this.lastActivity = Date.now();

    // ---- the astronaut button
    this.btn = document.createElement('button');
    this.btn.type = 'button';
    this.btn.className = 'astro-btn';
    this.btn.setAttribute('aria-label', S.open);
    this.btn.setAttribute('aria-expanded', 'false');
    this.btn.title = S.open;
    this.btn.innerHTML = `<span class="astro-ring" aria-hidden="true"></span>${astronautIcon()}`;

    // ---- the chat window
    this.panel = document.createElement('section');
    this.panel.className = 'astro-chat glass';
    this.panel.hidden = true;
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-labelledby', 'astro-title');
    this.panel.innerHTML = `
      <header class="astro-head">
        <span class="astro-mini" aria-hidden="true">${astronautIcon()}</span>
        <div class="astro-titles"><h2 id="astro-title">${esc(S.title)}</h2><p>${esc(S.subtitle)}</p></div>
        <button type="button" class="astro-close" aria-label="${esc(S.minimize)}" title="${esc(S.minimize)}">${minimizeIcon()}</button>
      </header>
      <div class="astro-log" role="log" aria-live="polite" aria-relevant="additions"></div>
      <form class="astro-form" autocomplete="off">
        <input class="astro-input" type="text" maxlength="300" placeholder="${esc(S.placeholder)}" aria-label="${esc(S.placeholder)}" enterkeyhint="send" />
        <button class="astro-send" type="submit" aria-label="${esc(S.send)}" title="${esc(S.send)}">${sendIcon()}</button>
      </form>
      <div class="astro-idle" aria-hidden="true"><span></span></div>
      <p class="astro-idle-text" aria-live="polite"></p>`;
    root.append(this.panel, this.btn);

    this.log = this.panel.querySelector('.astro-log');
    this.input = this.panel.querySelector('.astro-input');
    this.idleBar = this.panel.querySelector('.astro-idle span');
    this.idleText = this.panel.querySelector('.astro-idle-text');

    // fixed in the lower-right corner (CSS) — it never moves; one click / tap = open or fold.
    // Presses must not reach the 3D camera controls underneath (they would steal the click).
    this.btn.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.panel.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.btn.addEventListener('click', (e) => { e.stopPropagation(); this.toggle(); });
    this.panel.querySelector('.astro-close').addEventListener('click', () => this.close());
    this.panel.querySelector('.astro-form').addEventListener('submit', (e) => { e.preventDefault(); this.ask(this.input.value); });
    this.input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); this.close(); } });
    this.panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); this.close(); } });
    this.log.addEventListener('click', (e) => this.#onLogClick(e));

    // any interaction keeps the window open
    const poke = () => { this.lastActivity = Date.now(); this.#paintIdle(0); };
    for (const t of ['pointerdown', 'pointermove', 'keydown', 'input', 'wheel', 'focusin', 'touchstart']) {
      this.panel.addEventListener(t, poke, { passive: true });
      this.btn.addEventListener(t, poke, { passive: true });
    }
    this.idleTimer = setInterval(() => this.#checkIdle(), 250);
    window.addEventListener('resize', () => { if (this.open) this.#place(); });

    // ---- step out of the way of the timeline, the Gallery / Saved panels and (on phones) the Cosmic Card
    this.away = new Set();
    bus.on('view:state', ({ state }) => {
      this.#away('timeline', state === 'timeline');
      this.#away('card', state === 'machine' && innerWidth <= 900);
    });
    bus.on('overlay:open', ({ id }) => this.#away(`overlay-${id}`, true));
    bus.on('overlay:close', ({ id }) => this.#away(`overlay-${id}`, false));
  }

  get size() { return this.btn.offsetWidth || 64; }

  toggle() { return this.open ? this.close() : this.show(); }

  async show() {
    if (this.open || this.isAway) return;
    this.open = true;
    this.lastActivity = Date.now();
    this.btn.setAttribute('aria-expanded', 'true');
    this.btn.classList.add('is-open');
    this.panel.hidden = false;
    this.#place();
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    gsap.killTweensOf(this.panel);
    if (!reduce) {
      gsap.fromTo(this.panel, { scale: 0.15, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.42, ease: 'back.out(1.5)' });
      setTimeout(() => { if (this.open) { gsap.killTweensOf(this.panel); gsap.set(this.panel, { scale: 1, opacity: 1 }); } }, 600);
    }
    if (!this.started) { this.started = true; this.#greet(); }
    requestAnimationFrame(() => this.input.focus({ preventScroll: true }));
    this.#loadEngine();
  }

  close({ idle = false, quiet = false } = {}) {
    if (!this.open) return;
    this.open = false;
    this.btn.setAttribute('aria-expanded', 'false');
    this.btn.classList.remove('is-open');
    this.#paintIdle(0);
    const done = () => {
      if (this.open) return; // re-opened meanwhile
      gsap.killTweensOf(this.panel);
      this.panel.hidden = true; this.panel.style.opacity = ''; this.panel.style.transform = '';
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) done();
    else {
      gsap.to(this.panel, { scale: 0.15, opacity: 0, duration: 0.3, ease: 'power2.in', onComplete: done });
      setTimeout(done, 450); // GSAP slows tweens on very slow frames; never leave the window half-closed
    }
    if (!quiet && (!idle || this.panel.contains(document.activeElement))) this.btn.focus({ preventScroll: true });
    if (idle) {
      this.btn.classList.add('just-docked');
      setTimeout(() => this.btn.classList.remove('just-docked'), 900);
    }
  }

  /** Ask a question (from the box or a suggestion chip). */
  async ask(text) {
    const q = String(text || '').trim();
    if (!q || this.busy) return;
    this.input.value = '';
    this.#bubble('user', `<p>${esc(q)}</p>`);
    this.busy = true;
    const typing = this.#bubble('astro is-typing', `<span class="dots" aria-label="${esc(S.thinking)}"><i></i><i></i><i></i></span>`);
    try {
      const engine = await this.#loadEngine();
      await new Promise((r) => setTimeout(r, 380 + Math.random() * 260)); // a short "thinking" beat
      const res = engine.ask(q);
      typing.remove();
      this.#bubble('astro', this.#render(res));
    } catch (e) {
      console.warn('[astro]', e);
      typing.remove();
      this.#bubble('astro', `<p>${esc(S.error)}</p>`);
    } finally {
      this.busy = false;
      this.lastActivity = Date.now();
    }
  }

  // ------------------------------------------------------------ engine
  #loadEngine() {
    this._engine ||= Promise.all([
      import('../rag/engine.js'),
      fetch(CFG.indexUrl).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
    ]).then(([mod, index]) => {
      this.engine = new mod.AskAstro(index);
      this.docs = new Map(index.docs.map((d) => [d.id, d]));
      return this.engine;
    }).catch((e) => { this._engine = null; throw e; });
    return this._engine;
  }

  // ------------------------------------------------------------ rendering
  #greet() {
    this.#bubble('astro', `<p>${esc(S.hello)}</p>${this.#chips(this.#suggestions())}`);
  }

  #suggestions() {
    return this.engine?.suggestions() || ['When did Viking 1 land?', 'What did Armstrong say on the Moon?', 'How many times did Pathfinder bounce?', 'Why did NEAR stop talking?'];
  }

  #chips(list) {
    return `<div class="astro-chips">${list.map((q) => `<button type="button" class="astro-chip" data-ask="${esc(q)}">${esc(q)}</button>`).join('')}</div>`;
  }

  #docName(id) { return this.docs?.get(id)?.short || this.store.get(id)?.name || id; }

  #showBtn(id) {
    if (!this.store.get(id)) return '';
    return `<button type="button" class="astro-show" data-machine="${esc(id)}">${esc(S.show(this.#docName(id)))}</button>`;
  }

  #render(r) {
    if (r.kind === 'smalltalk') {
      if (r.talk === 'help') return `<p>${esc(S.help)}</p>${this.#chips(this.#suggestions().slice(0, 4))}`;
      return `<p>${esc(S[r.talk] || S.hello)}</p>`;
    }
    if (r.kind === 'refuse') {
      return `<p>${esc(S.refuse)}</p>${this.#chips(this.#suggestions().slice(0, 3))}`;
    }
    if (r.kind === 'notfound') {
      const id = r.docs[0], name = this.#docName(id);
      return `<p>${esc(S.notFound(name))}</p>${this.#chips([`When did ${name} launch?`, `What happened to ${name}?`])}`;
    }
    if (r.kind === 'list') {
      const items = r.items.map((i) => `<li><button type="button" class="astro-show is-link" data-machine="${esc(i.doc)}">${esc(this.#docName(i.doc))}</button> — ${esc(i.text)}</li>`).join('');
      return `<p>${esc(S.listIntro(S.where[r.body] || ''))}</p><ul class="astro-list">${items}</ul>`;
    }
    // answer: group sentences by file, keep the file's own words, show the source
    const groups = [];
    for (const it of r.items) {
      const g = groups.find((x) => x.doc === it.doc);
      if (g) g.text.push(it.text); else groups.push({ doc: it.doc, text: [it.text] });
    }
    const body = groups.map((g) => `<p class="astro-from">${esc(S.from(this.#docName(g.doc)))}</p><blockquote>${g.text.map((t) => esc(t)).join(' ')}</blockquote>`).join('');
    const src = groups.map((g) => esc(this.docs?.get(g.doc)?.file || g.doc)).join(' · ');
    const show = groups.map((g) => this.#showBtn(g.doc)).join('');
    return `${body}<p class="astro-src">${esc(S.sourceLabel)}: ${src}</p>${show ? `<div class="astro-actions">${show}</div>` : ''}`;
  }

  #bubble(cls, html) {
    const el = document.createElement('div');
    el.className = `astro-msg ${cls}`;
    el.innerHTML = cls.startsWith('astro') ? `<span class="astro-face" aria-hidden="true">${astronautIcon()}</span><div class="astro-text">${html}</div>` : `<div class="astro-text">${html}</div>`;
    this.log.appendChild(el);
    this.log.scrollTo({ top: this.log.scrollHeight, behavior: 'smooth' });
    return el;
  }

  #onLogClick(e) {
    const chip = e.target.closest('[data-ask]');
    if (chip) return this.ask(chip.dataset.ask);
    const show = e.target.closest('[data-machine]');
    if (show) bus.emit('machine:select', { id: show.dataset.machine, source: 'astro' });
  }

  // ------------------------------------------------------------ idle → dock
  #checkIdle() {
    if (!this.open || this.busy || document.hidden) { if (document.hidden) this.lastActivity = Date.now(); return; }
    const left = CFG.idleMs - (Date.now() - this.lastActivity);
    if (left <= 0) return this.close({ idle: true });
    this.#paintIdle(left < CFG.idleWarnMs ? 1 - left / CFG.idleWarnMs : 0);
  }

  #paintIdle(f) {
    this.panel.classList.toggle('is-idle', f > 0);
    this.idleBar.style.transform = `scaleX(${1 - f})`;
    const txt = f > 0 ? S.closingSoon : '';
    if (this.idleText.textContent !== txt) this.idleText.textContent = txt;
  }

  // ------------------------------------------------------------ placement
  /** Hide (reason on) / show again (all reasons off) — always back in the lower-right corner. */
  #away(reason, on) {
    const was = this.away.size > 0;
    if (on) this.away.add(reason); else this.away.delete(reason);
    const now = this.away.size > 0;
    if (now === was) return;
    if (now && this.open) this.close({ quiet: true });
    this.btn.classList.toggle('is-away', now);
    this.btn.toggleAttribute('inert', now);
    if (now) this.btn.setAttribute('aria-hidden', 'true'); else this.btn.removeAttribute('aria-hidden');
  }

  get isAway() { return this.away.size > 0; }

  /** Open the window above-left of the astronaut (it sits in the lower-right corner), fully on screen. */
  #place() {
    const m = 8, vw = innerWidth, vh = innerHeight;
    const b = this.btn.getBoundingClientRect();
    const W = Math.min(CFG.width, vw - 2 * m), H = Math.min(CFG.height, vh - 2 * m - (vw <= 760 ? b.height + 12 : 0));
    const left = Math.min(Math.max(m, b.right - W), vw - W - m);
    const top = vw <= 760 ? Math.max(m, b.top - 12 - H) : Math.min(Math.max(m, b.top + b.height * 0.4 - H), vh - H - m);
    Object.assign(this.panel.style, { width: `${W}px`, height: `${H}px`, left: `${left}px`, top: `${top}px`,
      transformOrigin: `${b.left + b.width / 2 - left}px ${b.top + b.height / 2 - top}px` });
    this.panel.dataset.side = 'up-left';
  }
}
