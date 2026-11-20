import gsap from 'gsap';
import { APP, STRINGS } from '../config/app.config.js';
import { bus } from '../core/EventBus.js';
import { esc } from '../data/format.js';
import { pickEventImages, preloadImage } from '../data/imagePicker.js';
import { mountImage, captionHTML } from './img.js';
import { placeholderArt, BODY_ACCENT } from './placeholder.js';
import { closeIcon, arrowIcon, playIcon, externalIcon, bookmarkIcon, translateIcon } from './icons.js';
import { VoiceDeck } from './VoiceDeck.js';
import { languages, loadLanguage, savedLanguage, saveLanguage, momentText, SCRIPT_FONT } from '../data/i18n.js';
import { openSavePopover } from './Saved.js';

/** "Play story" step length for moments that have no voice clip. */
const STORY_STEP_MS = 6000;

/**
 * Timeline view. The bottom scrubber only stops on KEY EVENTS from the data
 * (launch, landing, discovery, problems, loss of signal, end…), evenly spaced
 * so close-together events (e.g. three in one day) stay easy to pick.
 * Drag the handle, click the bar, or use ←/→ (Home/End) keys.
 *
 * Voice-over: two flags drive the narrator.
 *   listen — the user wants to hear the narrator (Listen pressed, not paused);
 *            moving to another moment then plays that moment's clip.
 *   story  — "Play story": auto-advance to the next moment when a clip ends.
 * Pausing (either button, or N) clears `listen`, which also pauses the story;
 * Continue resumes both from where they stopped.
 *
 * The information box is one fixed, screen-sized panel that never scrolls:
 * if a moment is too long, #fit() steps through tighter layouts (smaller type
 * and photo, then fewer details) until it fits. Above the text: a language
 * picker (translates only this box — see src/data/i18n.js) and Save.
 */
export class Timeline {
  constructor(root, store, narrator, saved) {
    this.store = store;
    this.narrator = narrator;
    this.saved = saved;
    this.lang = savedLanguage();
    this.langDoc = null;
    window.addEventListener('resize', () => { if (this.isOpen) this.#fit(); });
    // a script font (Tamil, Kannada…) arriving after the first layout changes the text size: fit again
    document.fonts?.addEventListener?.('loadingdone', () => { if (this.isOpen) this.#fit(); });
    this.el = document.createElement('div');
    this.el.className = 'timeline-overlay';
    this.el.hidden = true;
    this.el.setAttribute('role', 'region');
    this.el.setAttribute('aria-label', 'Mission timeline');
    root.appendChild(this.el);
    this.index = 0;
    this.story = false;
    this.listen = false;
    this.timer = null;
    this.onKey = (e) => this.#key(e);
    bus.on('narration:ended', () => {
      if (!this.isOpen || !this.storyRunning) return;
      if (this.index >= this.machine.events.length - 1) this.#endStory();
      else this.#scheduleAdvance(APP.narration.storyGap);
    });
    bus.on('narration:state', ({ state }) => {
      // a clip that fails to load should not stall "Play story"
      if (state === 'error' && this.isOpen && this.storyRunning) this.#scheduleAdvance(STORY_STEP_MS / 2);
      this.#paintPlay();
    });
  }

  get isOpen() { return !this.el.hidden; }

  get storyRunning() { return this.story && this.listen; }

  open(id, index = 0) {
    const m = this.store.get(id);
    if (!m || !m.events.length) return;
    this.machine = m;
    this.images = pickEventImages(m);
    this.index = -1;
    this.#render(m);
    this.el.hidden = false;
    gsap.fromTo(this.el.querySelector('.tl-bar'), { y: 80, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' });
    gsap.fromTo(this.el.querySelector('.tl-voice'), { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, delay: 0.08, ease: 'power3.out' });
    gsap.fromTo(this.el.querySelector('.tl-head'), { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, delay: 0.1 });
    this.#initLanguage();
    this.go(index, { instant: true });
    window.addEventListener('keydown', this.onKey);
    requestAnimationFrame(() => this.el.querySelector('.tl-handle')?.focus({ preventScroll: true }));
    this.narrator.ready().then((ok) => {
      if (!this.isOpen || this.machine !== m) return;
      this.narratorOk = ok;
      this.deck.setEnabled(ok);
      this.#narrate();
    });
  }

  close({ toCard = false } = {}) {
    if (this.el.hidden) return;
    this.story = false;
    this.listen = false;
    this.#clearTimer();
    this.narrator.stop();
    this.el.querySelector('.save-pop')?.remove();
    window.removeEventListener('keydown', this.onKey);
    gsap.to(this.el, { opacity: 0, duration: 0.25, onComplete: () => { this.el.hidden = true; this.el.style.opacity = ''; } });
    bus.emit('timeline:close', { id: this.machine.id, toCard });
  }

  #render(m) {
    const n = m.events.length;
    const accent = BODY_ACCENT[m.body] || '#9fd8ff';
    this.el.style.setProperty('--accent', accent);
    let lastYear = null;
    const ticks = m.events.map((e, i) => {
      const year = (e.date?.iso || '').slice(0, 4) || null;
      const showYear = year && year !== lastYear;
      if (year) lastYear = year;
      const left = n === 1 ? 50 : (i / (n - 1)) * 100;
      return `<button class="tl-tick type-${esc(e.type)}" type="button" style="left:${left}%" data-i="${i}" tabindex="-1"
          aria-label="${esc(`${e.date?.label || ''}: ${e.title}`)}">
        <span class="tl-dot" aria-hidden="true"></span>
        ${showYear ? `<span class="tl-year">${esc(year)}</span>` : ''}
        <span class="tl-tip glass" role="tooltip"><b>${esc(e.title)}</b><span>${esc(e.date?.label || '')} · ${esc(STRINGS.eventTypes[e.type] || e.type)}</span></span>
      </button>`;
    }).join('');

    this.el.innerHTML = `
      <div class="tl-head">
        <button class="glass-btn tl-back" type="button">${arrowIcon('left')} ${esc(STRINGS.backToCard)}</button>
        <h2 class="tl-machine">${esc(m.name)}</h2>
        <button class="glass-btn icon-btn tl-close" type="button" aria-label="${esc(STRINGS.close)}">${closeIcon()}</button>
      </div>
      <div class="tl-stage">
        <article class="tl-event glass">
          <div class="tl-tools">
            <label class="tl-lang" title="${esc(STRINGS.translate.aria)}">${translateIcon()}<span class="sr-only">${esc(STRINGS.translate.aria)}</span>
              <select aria-label="${esc(STRINGS.translate.aria)}"><option value="en">${esc(STRINGS.translate.english)}</option></select>
            </label>
            <button type="button" class="glass-btn tl-save" aria-label="${esc(STRINGS.saved.saveAria)}">${bookmarkIcon(false)} ${esc(STRINGS.saved.save)}</button>
          </div>
          <div class="ev-content" aria-live="polite"></div>
          <p class="tl-notice" role="status" hidden></p>
        </article>
      </div>
      <div class="tl-bar glass">
        <button class="glass-btn icon-btn tl-play" type="button" aria-label="${esc(STRINGS.play)}" title="${esc(STRINGS.play)}">${playIcon(false)}</button>
        <div class="tl-track">
          <div class="tl-rail"><div class="tl-fill"></div></div>
          ${ticks}
          <div class="tl-handle" role="slider" tabindex="0" aria-label="Key moment" aria-valuemin="1" aria-valuemax="${n}" aria-valuenow="1"></div>
        </div>
        <span class="tl-count" aria-hidden="true"></span>
      </div>`;

    this.track = this.el.querySelector('.tl-track');
    this.handle = this.el.querySelector('.tl-handle');
    this.fill = this.el.querySelector('.tl-fill');
    this.el.querySelector('.tl-back').addEventListener('click', () => this.close({ toCard: true }));
    this.el.querySelector('.tl-close').addEventListener('click', () => this.close());
    this.el.querySelector('.tl-play').addEventListener('click', () => this.#toggleStory());
    this.el.querySelector('.tl-save').addEventListener('click', (e) => openSavePopover(e.currentTarget, this.saved, this.machine, this.machine.events[this.index]));
    this.el.querySelector('.tl-lang select').addEventListener('change', (e) => this.#setLanguage(e.target.value));
    this.el.querySelectorAll('.tl-tick').forEach((t) => t.addEventListener('click', (e) => { e.stopPropagation(); this.#manual(); this.go(+t.dataset.i); }));
    this.#bindDrag();
    this.deck?.destroy();
    this.deck = new VoiceDeck(this.el, this.narrator, { onToggle: () => this.#toggleListen() });
    if (this.narratorOk !== undefined) this.deck.setEnabled(this.narratorOk);
  }

  #pos(i) { const n = this.machine.events.length; return n === 1 ? 0.5 : i / (n - 1); }

  #nearest(frac) { const n = this.machine.events.length; return Math.round(Math.min(1, Math.max(0, frac)) * (n - 1)); }

  #bindDrag() {
    let dragging = false;
    const frac = (e) => { const r = this.track.getBoundingClientRect(); return (e.clientX - r.left) / r.width; };
    const onMove = (e) => {
      if (!dragging) return;
      const f = Math.min(1, Math.max(0, frac(e)));
      this.handle.style.left = `${f * 100}%`;
      this.fill.style.width = `${f * 100}%`;
      const i = this.#nearest(f);
      // while dragging, only swap the picture/text; the voice starts on release
      if (i !== this.index) this.#show(i, i > this.index ? 1 : -1, { quiet: true });
    };
    const onUp = (e) => {
      if (!dragging) return;
      dragging = false;
      this.track.classList.remove('is-dragging');
      this.go(this.#nearest(frac(e))); // snap
    };
    this.track.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.tl-tick')) return;
      this.#manual();
      dragging = true;
      this.track.classList.add('is-dragging');
      this.track.setPointerCapture(e.pointerId);
      onMove(e);
    });
    this.track.addEventListener('pointermove', onMove);
    this.track.addEventListener('pointerup', onUp);
    this.track.addEventListener('pointercancel', onUp);
  }

  #key(e) {
    if (this.el.hidden || e.target.tagName === 'INPUT' || e.ctrlKey || e.metaKey || e.altKey) return;
    const n = this.machine.events.length;
    const map = { ArrowRight: this.index + 1, ArrowLeft: this.index - 1, Home: 0, End: n - 1 };
    if (e.target.closest?.('.vd-progress') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) return;
    if (e.key in map) { e.preventDefault(); this.#manual(); this.go(map[e.key]); }
    else if (e.key === 'Escape') this.close();
    else if (e.key === ' ' && document.activeElement === this.handle) { e.preventDefault(); this.#toggleStory(); }
    else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); this.#toggleListen(); }
    else if (e.key === '-' || e.key === '_') this.deck.stepRate(-1);
    else if (e.key === '+' || e.key === '=') this.deck.stepRate(1);
  }

  /** Move the handle to event i (with snap animation) and show it. */
  go(i, { instant = false } = {}) {
    const n = this.machine.events.length;
    i = Math.max(0, Math.min(n - 1, i));
    const p = `${this.#pos(i) * 100}%`;
    if (instant) { this.handle.style.left = p; this.fill.style.width = p; }
    else { gsap.to(this.handle, { left: p, duration: 0.35, ease: 'power3.out' }); gsap.to(this.fill, { width: p, duration: 0.35, ease: 'power3.out' }); }
    if (i !== this.index) this.#show(i, i > this.index ? 1 : -1);
    else if (this.needsNarrate) this.#narrate();
  }

  #show(i, dir, { quiet = false } = {}) {
    const m = this.machine, e = m.events[i];
    this.index = i;
    const n = m.events.length;
    this.handle.setAttribute('aria-valuenow', String(i + 1));
    this.handle.setAttribute('aria-valuetext', `${e.date?.label || ''} — ${e.title}`);
    this.el.querySelector('.tl-count').textContent = `${i + 1} / ${n}`;
    this.el.querySelectorAll('.tl-tick').forEach((t, k) => { t.classList.toggle('is-current', k === i); t.classList.toggle('is-past', k < i); });

    const box = this.el.querySelector('.ev-content');
    const swap = () => {
      this.#paintMoment();
      gsap.fromTo(box, { x: 40 * dir, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: 'power3.out' });
      gsap.fromTo(box.querySelectorAll('.ev-details > div'), { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, stagger: 0.05, delay: 0.12 });
    };
    if (box.innerHTML) gsap.to(box, { x: -30 * dir, opacity: 0, duration: 0.18, ease: 'power2.in', onComplete: swap });
    else swap();
    // warm the neighbouring moments' photos so stepping or "Play story" never waits
    preloadImage(this.images[i + 1]);
    preloadImage(this.images[i - 1]);
    bus.emit('timeline:event', { id: m.id, index: i, event: e });
    if (quiet) { this.needsNarrate = true; this.narrator.stop(); this.#clearTimer(); }
    else this.#narrate();
  }

  /** Fill the box with moment `this.index`, in the chosen language, then fit it. */
  #paintMoment() {
    const m = this.machine, i = this.index, e = m.events[i], n = m.events.length;
    const img = this.images[i];
    const t = momentText(this.langDoc, m, e, img);
    const box = this.el.querySelector('.ev-content');
    const code = this.langDoc ? this.lang : 'en';
    box.lang = code;
    box.dataset.index = String(i);
    box.style.setProperty('--script-font', SCRIPT_FONT[code] || 'var(--font)');
    const details = t.details.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
    const tag = img?.related ? t.relatedPhoto : img?.borrowed ? t.fromPhotoSet : '';
    const caption = img ? `${tag ? `<span class="borrowed">${esc(tag)}${t.caption ? ': ' : ''}</span>` : ''}${esc(t.caption)}` : '';
    box.innerHTML = `
      <div class="ev-media"><div class="ev-frame"></div>${caption ? `<figcaption class="ev-caption">${caption}</figcaption>` : ''}</div>
      <div class="ev-body">
        <div class="ev-meta"><span class="ev-type type-${esc(e.type)}">${esc(t.type)}</span><span class="ev-date">${esc(e.date?.label || t.dataNotAvailable)}</span></div>
        <h3 class="ev-title">${esc(t.title)}</h3>
        <p class="ev-text">${esc(t.text)}</p>
        ${i === n - 1 ? this.#moreInfoHTML(m, t) : ''}
        ${details ? `<dl class="ev-details">${details}</dl>` : ''}
        <p class="ev-source">${esc(t.source)}: ${esc(this.store.sourceTitle(e.src))}${this.langDoc ? ` · <span class="ev-ai">${esc(t.note)}</span>` : ''}</p>
      </div>`;
    const accent = BODY_ACCENT[m.body];
    mountImage(box.querySelector('.ev-frame'), img, placeholderArt(e.type, accent, t.photoComingSoon), { failedHTML: placeholderArt(e.type, accent, STRINGS.photoFailed), eager: true });
    this.#notice(this.langDoc && t.missing ? STRINGS.translate.partial : '');
    this.#fit();
    document.fonts?.ready.then(() => { if (this.isOpen && this.index === i) this.#fit(); });
  }

  /**
   * No scrolling: if the moment is taller than its box, step through tighter
   * densities (smaller type and photo, then fewer details) until it fits.
   */
  #fit() {
    const box = this.el.querySelector('.tl-event');
    if (!box) return;
    const levels = ['', 'd1', 'd2', 'd3', 'd4'];
    for (const d of levels) {
      box.dataset.density = d;
      if (box.scrollHeight <= box.clientHeight + 1) return;
    }
  }

  #notice(text) {
    const p = this.el.querySelector('.tl-notice');
    if (!p) return;
    p.hidden = !text;
    p.textContent = text;
  }

  // ------------------------------------------------------------ translation
  async #initLanguage() {
    const sel = this.el.querySelector('.tl-lang select');
    const list = await languages();
    if (!this.isOpen || !sel.isConnected) return;
    sel.innerHTML = list.map((l) => `<option value="${esc(l.code)}" lang="${esc(l.code)}">${esc(l.code === 'en' ? l.name : `${l.name} · ${l.english}`)}</option>`).join('');
    if (!list.some((l) => l.code === this.lang)) this.lang = 'en';
    sel.value = this.lang;
    if (this.lang !== 'en' && !this.langDoc) this.#setLanguage(this.lang, { quiet: true });
  }

  async #setLanguage(code, { quiet = false } = {}) {
    this.lang = code;
    saveLanguage(code);
    if (code === 'en') { this.langDoc = null; this.#paintMoment(); return; }
    if (!quiet) this.#notice(STRINGS.translate.loading);
    try {
      const doc = await loadLanguage(code);
      if (this.lang !== code || !this.isOpen) return;
      this.langDoc = doc;
    } catch (e) {
      console.warn('[translate]', e);
      this.langDoc = null;
      this.#paintMoment();
      this.#notice(STRINGS.translate.failed);
      return;
    }
    this.#paintMoment();
  }

  /** End of the story: the machine's "more information" link (opens in a new tab). */
  #moreInfoHTML(m, t) {
    const link = m.moreInfo;
    if (!link?.url) return `<p class="ev-more is-missing">${esc(STRINGS.moreInfo.missing)}</p>`;
    return `<div class="ev-more">
        <p>${esc(t?.moreInfo || STRINGS.moreInfo.text)}</p>
        <a class="glass-btn ev-more-link" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">
          ${esc(STRINGS.moreInfo.button(link.site))} ${externalIcon()}<span class="sr-only"> ${esc(STRINGS.moreInfo.newTab)}</span>
        </a>
      </div>`;
  }

  // ------------------------------------------------------------ voice-over
  /** Load the current moment's clip; play it if the user is listening. */
  #narrate() {
    this.needsNarrate = false;
    this.#clearTimer();
    const m = this.machine, e = m.events[this.index];
    if (!this.narratorOk) {
      this.deck.setAvailable(false);
      if (this.narratorOk === false && this.storyRunning) this.#scheduleAdvance(STORY_STEP_MS);
      return;
    }
    const has = this.narrator.load(m.id, e.id, m.events[this.index + 1]?.id);
    this.deck.setAvailable(has, STRINGS.narration.hint);
    if (!this.listen) return;
    if (has) this.narrator.play();
    else if (this.story) this.#scheduleAdvance(STORY_STEP_MS);
  }

  /** Continue listening / the story from where it was paused. */
  #resume() {
    this.listen = true;
    if (this.narratorOk && this.narrator.clip) {
      // the clip finished while paused in the gap before the next moment
      if (this.narrator.state === 'ended' && this.story) this.#advance();
      else this.narrator.play();
    } else if (this.story) this.#scheduleAdvance(STORY_STEP_MS);
    this.#paintPlay();
  }

  #pauseAll() {
    this.listen = false;
    this.#clearTimer();
    this.narrator.pause();
    this.#paintPlay();
  }

  /** Listen / Pause / Continue button (and the N key). */
  #toggleListen() {
    if (this.narrator.isPlaying || (this.storyRunning && this.timer)) this.#pauseAll();
    else this.#resume();
  }

  /** "Play story" button in the bar (and Space on the handle). */
  #toggleStory() {
    if (this.storyRunning) return this.#pauseAll();
    if (this.story) return this.#resume();
    this.story = true;
    this.listen = true;
    if (this.index >= this.machine.events.length - 1) this.go(0);
    else this.#narrate(); // (re)start the current moment from the top
    this.#paintPlay();
  }

  #advance() {
    if (!this.storyRunning) return;
    if (this.index >= this.machine.events.length - 1) return this.#endStory();
    this.go(this.index + 1);
  }

  #scheduleAdvance(ms) {
    this.#clearTimer();
    this.timer = setTimeout(() => { this.timer = null; this.#advance(); }, ms);
    this.#paintPlay();
  }

  #clearTimer() { clearTimeout(this.timer); this.timer = null; }

  #endStory() {
    this.story = false;
    this.#clearTimer();
    this.#paintPlay();
  }

  /** The user moved the scrubber themselves: stop auto-advancing, keep listening. */
  #manual() {
    if (!this.story) return;
    this.#endStory();
  }

  #paintPlay() {
    const b = this.el.querySelector('.tl-play');
    if (!b) return;
    const running = this.storyRunning;
    b.innerHTML = playIcon(running);
    const l = running ? STRINGS.pause : this.story ? STRINGS.continueStory : STRINGS.play;
    b.setAttribute('aria-label', l); b.title = l;
    b.classList.toggle('is-active', running);
  }
}
