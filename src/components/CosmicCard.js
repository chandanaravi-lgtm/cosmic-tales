import gsap from 'gsap';
import { STRINGS, MODEL_CREDITS } from '../config/app.config.js';
import { bus } from '../core/EventBus.js';
import { esc, fieldValue, displayValue, abandonedLine, machineCode } from '../data/format.js';
import { cardImage, pickEventImages, preloadImage } from '../data/imagePicker.js';
import { hash01 } from '../scenes/geo.js';
import { mountImage, captionHTML } from './img.js';
import { placeholderArt, BODY_ACCENT } from './placeholder.js';
import { closeIcon, arrowIcon, flipIcon } from './icons.js';

const BODY_NAME = { moon: 'MOON', mars: 'MARS', 'deep-space': 'DEEP SPACE' };

/** Decorative QR-style grid (deterministic per machine, not a real code). */
function qrSVG(seed) {
  const n = 17, cells = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const finder = (x < 5 && y < 5) || (x > n - 6 && y < 5) || (x < 5 && y > n - 6);
    if (finder) continue;
    if (hash01(seed, x * 31 + y * 17) > 0.52) cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
  }
  const finder = (x, y) => `<rect x="${x}" y="${y}" width="5" height="5" fill="none" stroke="currentColor" stroke-width="1"/><rect x="${x + 1.6}" y="${y + 1.6}" width="1.8" height="1.8"/>`;
  return `<svg viewBox="-.5 -.5 ${n + 1} ${n + 1}" class="qr" aria-hidden="true"><g fill="currentColor">${cells.join('')}${finder(0, 0)}${finder(n - 5, 0)}${finder(0, n - 5)}</g></svg>`;
}

function barcodeSVG(seed) {
  let x = 0; const bars = [];
  for (let i = 0; i < 46; i++) {
    const w = 0.6 + Math.floor(hash01(seed, i) * 3) * 0.6;
    if (i % 2 === 0) bars.push(`<rect x="${x.toFixed(1)}" width="${w.toFixed(1)}" height="20"/>`);
    x += w;
  }
  return `<svg viewBox="0 0 ${x.toFixed(1)} 20" preserveAspectRatio="none" class="barcode" aria-hidden="true"><g fill="currentColor">${bars.join('')}</g></svg>`;
}

const CHIP = `<svg viewBox="0 0 54 40" class="chip" aria-hidden="true">
  <defs><linearGradient id="chipg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe7a3"/><stop offset=".5" stop-color="#c99a3b"/><stop offset="1" stop-color="#f3d27a"/></linearGradient></defs>
  <rect x="1" y="1" width="52" height="38" rx="7" fill="url(#chipg)" stroke="#8a6620" stroke-width="1"/>
  <path d="M1 14h16M1 26h16M37 14h16M37 26h16M17 1v38M37 1v38M17 20h20" stroke="#8a6620" stroke-width="1.1" fill="none"/>
  <rect x="21" y="9" width="12" height="22" rx="3" fill="none" stroke="#8a6620" stroke-width="1.1"/>
</svg>`;

const EMBLEM = `<svg viewBox="0 0 40 40" class="emblem" aria-hidden="true">
  <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".8"/>
  <ellipse cx="20" cy="20" rx="17" ry="6.5" fill="none" stroke="currentColor" stroke-width="1.2" transform="rotate(-28 20 20)"/>
  <path d="M20 9l2.4 6.6 7 .3-5.5 4.3 1.9 6.8L20 23l-5.8 4 1.9-6.8-5.5-4.3 7-.3z" fill="currentColor"/>
</svg>`;

export class CosmicCard {
  constructor(root, store) {
    this.store = store;
    this.el = document.createElement('div');
    this.el.className = 'card-overlay';
    this.el.hidden = true;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'false');
    this.el.setAttribute('aria-labelledby', 'card-name');
    root.appendChild(this.el);
    this.flipped = false;
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
  }

  get isOpen() { return !this.el.hidden; }

  open(id) {
    const m = this.store.get(id);
    if (!m) return;
    this.machine = m;
    this.flipped = false;
    this.#render(m);
    this.el.hidden = false;
    const card = this.el.querySelector('.cosmic-card');
    gsap.fromTo(card, { y: 40, opacity: 0, rotateX: 18, scale: 0.92 }, { y: 0, opacity: 1, rotateX: 0, scale: 1, duration: 0.7, ease: 'back.out(1.4)' });
    requestAnimationFrame(() => this.el.querySelector('.card-next')?.focus({ preventScroll: true }));
    bus.emit('card:open', { id });
  }

  close({ silent = false } = {}) {
    if (this.el.hidden) return;
    const card = this.el.querySelector('.cosmic-card');
    gsap.to(card, { y: 30, opacity: 0, scale: 0.95, duration: 0.3, ease: 'power2.in', onComplete: () => { this.el.hidden = true; } });
    if (!silent) bus.emit('card:close', { id: this.machine?.id });
  }

  /** Hide without animation (when switching to the timeline). */
  hide() { this.el.hidden = true; }

  #render(m) {
    const S = STRINGS.card;
    const ab = abandonedLine(m);
    const accent = BODY_ACCENT[m.body] || '#9fd8ff';
    const row = (label, field, extraClass = '') => {
      const v = fieldValue(field);
      return `<div class="field ${extraClass}"><dt>${esc(label)}</dt><dd class="${v ? '' : 'missing'}" title="${esc(displayValue(field))}">${esc(displayValue(field))}</dd></div>`;
    };
    const code = machineCode(m);
    const mrz = `CT<${(m.shortName || m.name).toUpperCase().replace(/[^A-Z0-9]+/g, '<')}<<${BODY_NAME[m.body]?.replace(' ', '<')}<<${(m.launchDate?.iso || '').replace(/-/g, '')}`.padEnd(44, '<').slice(0, 44);
    const sources = [...new Set([...collectSources(m)])];
    this.el.style.setProperty('--accent', accent);
    this.el.innerHTML = `
      <div class="card-scene">
        <button class="glass-btn icon-btn card-close" type="button" aria-label="${esc(STRINGS.close)}">${closeIcon()}</button>
        <article class="cosmic-card body-${esc(m.body)}" tabindex="-1">
          <div class="card-inner">
            <section class="card-face card-front" aria-label="Cosmic Card front">
              <div class="holo" aria-hidden="true"></div>
              <div class="guilloche" aria-hidden="true"></div>
              <header class="card-top">
                ${EMBLEM}
                <div class="card-titles"><span class="card-title">${esc(S.title)}</span><span class="card-sub">${esc(S.subtitle)}</span></div>
                <span class="body-chip">${esc(BODY_NAME[m.body] || '')}</span>
              </header>
              <div class="card-main">
                <div class="photo-col">
                  <div class="photo-frame"></div>
                  <div class="photo-caption"></div>
                </div>
                <dl class="fields">
                  <div class="field field-name"><dt>${esc(S.name)}</dt><dd id="card-name" title="${esc(m.name)}">${esc(m.name)}</dd></div>
                  ${row(S.launchDate, m.launchDate)}
                  ${row(S.launchSite, m.launchSite)}
                  ${row(S.purpose, m.purpose)}
                  <div class="field"><dt>${esc(ab.label)}</dt><dd class="status-${esc(ab.status || 'none')}" title="${esc(ab.value)}">${esc(ab.value)}</dd></div>
                  ${row(S.destination, m.destination)}
                </dl>
              </div>
              <footer class="card-bottom">
                ${CHIP}
                <div class="code-block">${barcodeSVG(m.id)}<span class="code">${esc(code)}</span></div>
                ${qrSVG(m.id)}
              </footer>
              <div class="mrz" aria-hidden="true">${esc(mrz)}</div>
            </section>
            <section class="card-face card-back" aria-label="Cosmic Card back">
              <div class="holo" aria-hidden="true"></div>
              <header class="card-top">${EMBLEM}<div class="card-titles"><span class="card-title">MISSION FILE</span><span class="card-sub">${esc(code)}</span></div></header>
              <dl class="fields back-fields">
                <div class="field"><dt>${esc(S.kind)}</dt><dd>${esc(m.kind || STRINGS.dataNotAvailable)}</dd></div>
                ${row(S.vehicle, m.launchVehicle)}
                <div class="field"><dt>${esc(S.aliases)}</dt><dd>${esc(m.aliases?.length ? m.aliases.join(' · ') : STRINGS.dataNotAvailable)}</dd></div>
                <div class="field"><dt>${esc(S.events)}</dt><dd>${m.events.length} → ${esc(STRINGS.next)}</dd></div>
                <div class="field"><dt>${esc(S.sources)}</dt><dd class="sources">${sources.map((s) => esc(this.store.sourceTitle(s))).join('<br>')}${MODEL_CREDITS[m.model] ? `<br><span class="model-credit">${esc(MODEL_CREDITS[m.model])}</span>` : ''}</dd></div>
              </dl>
              <div class="mag-stripe" aria-hidden="true"></div>
            </section>
          </div>
          <button class="card-flip" type="button" aria-label="${esc(STRINGS.flip)}" title="${esc(STRINGS.flip)}">${flipIcon()}</button>
          <button class="card-next" type="button">${esc(STRINGS.next)} ${arrowIcon('right')}</button>
        </article>
      </div>`;

    const img = cardImage(m);
    const art = m.markerShape === 'telescope' ? 'discovery' : 'landing';
    mountImage(this.el.querySelector('.photo-frame'), img, placeholderArt(art, accent, STRINGS.noMachinePhoto), { failedHTML: placeholderArt(art, accent, STRINGS.photoFailed), preferThumb: true, eager: true });
    this.el.querySelector('.photo-caption').innerHTML = img ? captionHTML(img) : '';
    // the timeline is one click away: warm its first photos now
    pickEventImages(m).slice(0, 2).forEach((i) => preloadImage(i));

    this.el.querySelector('.card-close').addEventListener('click', () => this.close());
    this.el.querySelector('.card-next').addEventListener('click', () => bus.emit('timeline:open', { id: m.id }));
    this.el.querySelector('.card-flip').addEventListener('click', () => this.flip());
    this.#tilt(this.el.querySelector('.cosmic-card'));
  }

  flip() {
    this.flipped = !this.flipped;
    gsap.to(this.el.querySelector('.card-inner'), { rotateY: this.flipped ? 180 : 0, duration: 0.8, ease: 'power3.inOut' });
  }

  /** Subtle 3D tilt + moving holographic sheen that follows the pointer. */
  #tilt(card) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', `${x * 100}%`);
      card.style.setProperty('--my', `${y * 100}%`);
      if (!reduce) gsap.to(card, { rotateY: (x - 0.5) * 12, rotateX: (0.5 - y) * 10, duration: 0.4, ease: 'power2.out' });
    });
    card.addEventListener('pointerleave', () => gsap.to(card, { rotateY: 0, rotateX: 0, duration: 0.8, ease: 'elastic.out(1, 0.6)' }));
  }
}

function* collectSources(node) {
  if (Array.isArray(node)) { for (const n of node) yield* collectSources(n); return; }
  if (!node || typeof node !== 'object') return;
  if (node.src) yield node.src;
  for (const v of Object.values(node)) if (v && typeof v === 'object') yield* collectSources(v);
}
