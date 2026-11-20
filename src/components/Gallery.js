import gsap from 'gsap';
import { APP, STRINGS } from '../config/app.config.js';
import { bus } from '../core/EventBus.js';
import { esc } from '../data/format.js';
import { closeIcon, arrowIcon, galleryIcon, heartIcon } from './icons.js';

const S = STRINGS.gallery;

/** Liked photos, kept in this browser (localStorage) by photo file, so they survive a data rebuild. */
class LikeStore {
  constructor() {
    try { this.set = new Set(JSON.parse(localStorage.getItem(APP.storageKeys.liked) || '[]')); } catch { this.set = new Set(); }
  }
  has(p) { return this.set.has(p.local); }
  toggle(p) {
    if (this.set.has(p.local)) this.set.delete(p.local); else this.set.add(p.local);
    try { localStorage.setItem(APP.storageKeys.liked, JSON.stringify([...this.set])); } catch { /* private mode: liked for this visit only */ }
    return this.has(p);
  }
}

/**
 * Photo Gallery (header button): every photo from the photo pack and local
 * resources, each exactly once (public/data/gallery.json, made by
 * scripts/import_photos.py, which removes duplicate pictures). Two tabs:
 * "All photos" and "Liked". A grid of thumbnails with one-line names and a
 * heart to like each one; tap a photo to browse full-size photos one at a time
 * like a phone gallery — ← / → buttons, arrow keys or a swipe, Escape or × to
 * go back — with a Like button in the viewer too. In the Liked tab the viewer
 * browses only the liked photos.
 * The list and the thumbnails load only when the Gallery is first opened.
 */
export class Gallery {
  constructor(root) {
    this.likes = new LikeStore();
    this.tab = 'all';
    this.el = document.createElement('div');
    this.el.className = 'modal-overlay gallery-overlay';
    this.el.hidden = true;
    this.el.innerHTML = `
      <section class="modal gallery-panel glass" role="dialog" aria-modal="true" aria-labelledby="gallery-title">
        <header class="modal-head">
          <h2 id="gallery-title">${galleryIcon()} ${esc(S.title)}</h2>
          <div class="gallery-tabs" role="tablist" aria-label="${esc(S.title)}">
            <button type="button" class="gallery-tab is-on" role="tab" aria-selected="true" data-tab="all">${esc(S.all)} <span class="gallery-n" data-n="all"></span></button>
            <button type="button" class="gallery-tab" role="tab" aria-selected="false" data-tab="liked">${heartIcon(true)} ${esc(S.liked)} <span class="gallery-n" data-n="liked">0</span></button>
          </div>
          <button type="button" class="glass-btn icon-btn modal-close" aria-label="${esc(S.close)}" title="${esc(S.close)}">${closeIcon()}</button>
        </header>
        <div class="gallery-grid" role="list"></div>
      </section>
      <div class="viewer" hidden role="dialog" aria-modal="true" aria-label="${esc(S.title)}">
        <div class="viewer-top">
          <span class="viewer-pos" aria-live="polite"></span>
          <button type="button" class="glass-btn viewer-like" aria-pressed="false"></button>
          <button type="button" class="glass-btn icon-btn viewer-close" aria-label="${esc(S.back)}" title="${esc(S.back)}">${closeIcon()}</button>
        </div>
        <figure class="viewer-stage"><img class="viewer-img" alt="" decoding="async"/></figure>
        <p class="viewer-name"></p>
        <button type="button" class="glass-btn icon-btn viewer-prev" aria-label="${esc(S.prev)}" title="${esc(S.prev)}">${arrowIcon('left')}</button>
        <button type="button" class="glass-btn icon-btn viewer-next" aria-label="${esc(S.next)}" title="${esc(S.next)}">${arrowIcon('right')}</button>
      </div>
      <p class="gallery-toast" role="status" aria-live="polite" hidden></p>`;
    root.appendChild(this.el);
    this.grid = this.el.querySelector('.gallery-grid');
    this.viewer = this.el.querySelector('.viewer');
    this.img = this.el.querySelector('.viewer-img');
    this.photos = null;
    this.list = []; // indexes into this.photos for the current tab
    this.pos = 0;   // position in this.list shown in the viewer

    const $ = (s) => this.el.querySelector(s);
    $('.modal-close').addEventListener('click', () => this.close());
    $('.viewer-close').addEventListener('click', () => this.#closeViewer());
    $('.viewer-prev').addEventListener('click', () => this.#step(-1));
    $('.viewer-next').addEventListener('click', () => this.#step(1));
    $('.viewer-like').addEventListener('click', () => this.#toggleLike(this.list[this.pos]));
    this.el.querySelectorAll('.gallery-tab').forEach((b) => b.addEventListener('click', () => this.#setTab(b.dataset.tab)));
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.close(); });
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.grid.addEventListener('click', (e) => {
      const like = e.target.closest('.gallery-like');
      if (like) { this.#toggleLike(+like.dataset.i); return; }
      const open = e.target.closest('.gallery-open');
      if (open) this.#openViewer(this.list.indexOf(+open.dataset.i));
    });
    this.el.addEventListener('keydown', (e) => this.#keys(e));
    this.#swipe();
    bus.on('gallery:open', () => this.open());
  }

  get isOpen() { return !this.el.hidden; }

  async open() {
    this.el.hidden = false;
    bus.emit('overlay:open', { id: 'gallery' });
    gsap.fromTo(this.el.querySelector('.modal'), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'power3.out' });
    this.el.querySelector('.modal-close').focus({ preventScroll: true });
    if (!this.photos) await this.#load();
  }

  close() {
    if (!this.isOpen) return;
    this.viewer.hidden = true;
    this.el.hidden = true;
    bus.emit('overlay:close', { id: 'gallery' });
    document.querySelector('.gallery-btn')?.focus({ preventScroll: true });
  }

  async #load() {
    try {
      const r = await fetch(APP.galleryUrl);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      this.photos = (await r.json()).photos;
    } catch (e) {
      console.warn('[gallery]', e);
      this.grid.innerHTML = `<p class="gallery-error">${esc(S.error)}</p>`;
      return;
    }
    this.#render();
  }

  #setTab(tab) {
    if (!this.photos || tab === this.tab) return;
    this.tab = tab;
    this.el.querySelectorAll('.gallery-tab').forEach((b) => { const on = b.dataset.tab === tab; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', String(on)); });
    this.#render();
    this.grid.scrollTop = 0;
  }

  #counts() {
    this.el.querySelector('[data-n="all"]').textContent = this.photos.length;
    this.el.querySelector('[data-n="liked"]').textContent = this.photos.filter((p) => this.likes.has(p)).length;
  }

  #render() {
    this.#counts();
    this.list = this.photos.map((p, i) => i).filter((i) => this.tab === 'all' || this.likes.has(this.photos[i]));
    if (!this.list.length) { this.grid.innerHTML = `<p class="gallery-empty">${heartIcon(false)}<span>${esc(S.emptyLiked)}</span></p>`; return; }
    let group = null;
    this.grid.innerHTML = this.list.map((i) => {
      const p = this.photos[i];
      const head = this.tab === 'all' && p.group !== group ? `<h3 class="gallery-group" role="presentation">${esc(p.group)}</h3>` : '';
      group = p.group;
      return `${head}<div class="gallery-tile" role="listitem" data-i="${i}">
          <button type="button" class="gallery-open" data-i="${i}" aria-label="${esc(S.open(p.name))}">
            <span class="gallery-thumb"><img src="${esc(p.thumb)}" alt="" loading="lazy" decoding="async"/></span>
            <span class="gallery-name" title="${esc(p.name)}">${esc(p.name)}</span>
          </button>
          ${this.#likeButton('gallery-like', i)}
        </div>`;
    }).join('');
  }

  #likeButton(cls, i) {
    const p = this.photos[i], on = this.likes.has(p);
    return `<button type="button" class="${cls}${on ? ' is-liked' : ''}" data-i="${i}" aria-pressed="${on}" aria-label="${esc(on ? S.unlikeAria(p.name) : S.likeAria(p.name))}" title="${esc(on ? S.likedLabel : S.like)}">${heartIcon(on)}</button>`;
  }

  #toggleLike(i) {
    const p = this.photos[i];
    const on = this.likes.toggle(p);
    this.#flash(on ? S.likedToast : S.unlikedToast);
    // tile heart (if visible) — in the Liked tab an unliked photo leaves the grid
    if (this.tab === 'liked' && !on && this.viewer.hidden) { this.#render(); }
    else {
      const tileBtn = this.grid.querySelector(`.gallery-like[data-i="${i}"]`);
      if (tileBtn) { tileBtn.outerHTML = this.#likeButton('gallery-like', i); this.#pop(this.grid.querySelector(`.gallery-like[data-i="${i}"]`)); }
      this.#counts();
    }
    if (!this.viewer.hidden && this.list[this.pos] === i) { this.#paintViewerLike(); this.#pop(this.el.querySelector('.viewer-like')); }
  }

  #pop(btn) {
    if (!btn || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(btn, { scale: 0.6 }, { scale: 1, duration: 0.35, ease: 'back.out(3)' });
  }

  #flash(text) {
    const t = this.el.querySelector('.gallery-toast');
    t.textContent = text; t.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { t.hidden = true; }, 1800);
  }

  #paintViewerLike() {
    const p = this.photos[this.list[this.pos]], on = this.likes.has(p), b = this.el.querySelector('.viewer-like');
    b.classList.toggle('is-liked', on);
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? S.unlikeAria(p.name) : S.likeAria(p.name));
    b.innerHTML = `${heartIcon(on)} <span>${esc(on ? S.likedLabel : S.like)}</span>`;
  }

  #openViewer(pos) {
    if (pos < 0) return;
    this.viewer.hidden = false;
    this.#show(pos, 0);
    this.el.querySelector('.viewer-next').focus({ preventScroll: true });
  }

  #closeViewer() {
    this.viewer.hidden = true;
    const i = this.list[this.pos];
    if (this.tab === 'liked') this.#render(); // drop photos un-liked while browsing
    this.grid.querySelector(`.gallery-open[data-i="${i}"]`)?.focus({ preventScroll: true });
  }

  #step(d) {
    const n = this.list.length;
    this.#show((this.pos + d + n) % n, d);
  }

  #show(pos, dir) {
    const p = this.photos[this.list[pos]];
    this.pos = pos;
    // show the cached thumbnail at once, then swap in the full-size photo when it arrives
    this.img.src = p.thumb;
    this.img.alt = p.name;
    const full = new Image();
    full.decoding = 'async';
    full.onload = () => { if (this.pos === pos) this.img.src = p.local; };
    full.src = p.local;
    this.el.querySelector('.viewer-name').textContent = p.name;
    this.el.querySelector('.viewer-pos').textContent = `${this.tab === 'liked' ? `${S.liked} · ` : ''}${S.pos(pos + 1, this.list.length)}`;
    this.#paintViewerLike();
    if (dir) gsap.fromTo(this.img, { x: 50 * dir, opacity: 0.2 }, { x: 0, opacity: 1, duration: 0.3, ease: 'power2.out' });
    // warm the neighbours so the next swipe is instant
    for (const k of [pos + 1, pos - 1]) { const q = this.photos[this.list[(k + this.list.length) % this.list.length]]; const im = new Image(); im.src = q.local; }
  }

  #keys(e) {
    if (e.key === 'Escape') { e.stopPropagation(); if (!this.viewer.hidden) this.#closeViewer(); else this.close(); return; }
    if (this.viewer.hidden) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); this.#step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); this.#step(-1); }
  }

  #swipe() {
    let x0 = null;
    const stage = this.el.querySelector('.viewer-stage');
    stage.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    stage.addEventListener('pointerup', (e) => {
      if (x0 == null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 40) this.#step(dx < 0 ? 1 : -1);
    });
  }
}
