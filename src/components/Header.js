import { APP, STRINGS } from '../config/app.config.js';
import { bus } from '../core/EventBus.js';
import { esc } from '../data/format.js';
import { soundIcon, searchIcon, closeIcon, galleryIcon, bookmarkIcon } from './icons.js';

/**
 * Clear-glass header: app name (also "home"), Moon / Mars / Deep Space tabs,
 * and on the right controls that are ALWAYS visible: the Search bar, Gallery,
 * Saved and Sound. On wide screens the search bar is always open; on smaller
 * ones a Search button opens it. Its Cancel (×) clears and closes it — and
 * Gallery / Saved / Sound never move or disappear. Results (a clear-glass
 * list) cover planets, machines & missions and timeline moments.
 * (The "back to the whole solar system" button lives bottom-left: ui/ZoomOutButton.js.)
 */
export class Header {
  constructor(root, store, bodies) {
    this.store = store;
    this.bodies = bodies;
    this.el = document.createElement('header');
    this.el.className = 'app-header glass';
    this.el.innerHTML = `
      <button class="brand" type="button" aria-label="${esc(STRINGS.homeAria)}">
        <span class="brand-mark" aria-hidden="true"></span>
        <span class="brand-text"><span class="brand-name">${esc(APP.name)}</span><span class="brand-tag">${esc(APP.tagline)}</span></span>
      </button>
      <nav class="filters" aria-label="Destinations">
        <button class="filter tab-moon" data-view="moon" type="button" aria-pressed="false">${esc(STRINGS.moon)}</button>
        <button class="filter tab-mars" data-view="mars" type="button" aria-pressed="false">${esc(STRINGS.mars)}</button>
        <button class="filter tab-deep" data-view="deepspace" type="button" aria-pressed="false">${esc(STRINGS.deepSpace)}</button>
      </nav>
      <div class="header-tools">
        <div class="search" role="search">
          <button class="glass-btn icon-btn search-toggle" type="button" aria-label="${esc(STRINGS.searchAria)}" title="${esc(STRINGS.searchAria)}" aria-expanded="false">${searchIcon()}</button>
          <div class="search-box glass">
            <input type="search" autocomplete="off" spellcheck="false" placeholder="${esc(STRINGS.searchPlaceholder)}" tabindex="-1"
              aria-label="${esc(STRINGS.searchAria)}" role="combobox" aria-expanded="false" aria-controls="search-list" aria-autocomplete="list" />
            <button class="search-cancel" type="button" aria-label="${esc(STRINGS.searchCancel)}" title="${esc(STRINGS.searchCancel)}" tabindex="-1">${closeIcon()}</button>
            <ul id="search-list" class="search-list glass" role="listbox" hidden></ul>
          </div>
        </div>
        <button class="glass-btn icon-btn gallery-btn" type="button" aria-label="${esc(STRINGS.gallery.button)}" title="${esc(STRINGS.gallery.button)}">${galleryIcon()}</button>
        <button class="glass-btn icon-btn saved-btn" type="button" aria-label="${esc(STRINGS.saved.button)}" title="${esc(STRINGS.saved.button)}">${bookmarkIcon(false)}<span class="saved-badge" hidden></span></button>
        <button class="glass-btn icon-btn sound-btn" type="button" aria-pressed="false" aria-label="${esc(STRINGS.soundOff)}" title="${esc(STRINGS.soundOff)}">${soundIcon(false)}</button>
      </div>`;
    root.appendChild(this.el);
    this.#bind();
  }

  #bind() {
    const $ = (s) => this.el.querySelector(s);
    $('.brand').addEventListener('click', () => bus.emit('view:home'));
    this.el.querySelectorAll('.filter').forEach((b) => b.addEventListener('click', () => {
      const v = b.dataset.view;
      if (v === 'deepspace') bus.emit('view:deepspace'); else bus.emit('view:body', { id: v });
    }));
    $('.sound-btn').addEventListener('click', () => bus.emit('sound:toggle'));
    $('.gallery-btn').addEventListener('click', () => bus.emit('gallery:open'));
    $('.saved-btn').addEventListener('click', () => bus.emit('saved:open'));
    // wide screens: the search bar is always open
    this.wide = matchMedia('(min-width: 1280px)');
    const syncWide = () => { if (this.wide.matches) { this.input.tabIndex = 0; this.el.querySelector('.search-cancel').tabIndex = 0; } else if (!this.searchOpen) this.#openSearch(false); };
    this.wide.addEventListener('change', syncWide);

    // ---- search with live suggestions
    this.input = $('.search input');
    this.list = $('.search-list');
    this.searchWrap = $('.search');
    this.active = -1;
    $('.search-toggle').addEventListener('click', () => this.#openSearch(true));
    $('.search-cancel').addEventListener('mousedown', (e) => e.preventDefault()); // keep focus logic simple
    $('.search-cancel').addEventListener('click', () => this.closeSearch());
    this.input.addEventListener('input', () => this.#suggest());
    this.input.addEventListener('keydown', (e) => this.#keys(e));
    // clicking anywhere else: close the list; close the whole box if nothing was typed
    this.input.addEventListener('blur', () => setTimeout(() => {
      if (this.el.contains(document.activeElement) && this.searchWrap.contains(document.activeElement)) return;
      if (this.input.value.trim()) this.#closeList(); else this.closeSearch({ refocus: false });
    }, 160));
    this.input.addEventListener('focus', () => { if (this.input.value.trim()) this.#suggest(); });
    if (this.wide.matches) { this.input.tabIndex = 0; this.el.querySelector('.search-cancel').tabIndex = 0; }
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) { e.preventDefault(); this.#openSearch(true); }
    });
  }

  get searchOpen() { return this.searchWrap.classList.contains('is-open'); }

  #openSearch(open) {
    this.searchWrap.classList.toggle('is-open', open);
    this.el.querySelector('.search-toggle').setAttribute('aria-expanded', String(open));
    const reachable = open || this.wide?.matches;
    this.input.tabIndex = reachable ? 0 : -1;
    this.el.querySelector('.search-cancel').tabIndex = reachable ? 0 : -1;
    if (open) requestAnimationFrame(() => { this.input.focus(); if (this.input.value) this.#suggest(); });
    else this.#closeList();
  }

  /** Back to the normal header (Search, Gallery, Saved and Sound all visible). */
  closeSearch({ refocus = true } = {}) {
    this.input.value = '';
    this.#openSearch(false);
    if (document.activeElement === this.input) this.input.blur();
    if (refocus && !this.wide.matches) this.el.querySelector('.search-toggle').focus({ preventScroll: true });
  }

  /** Number of saved items, shown as a small badge on the Saved button. */
  setSavedCount(n) {
    const b = this.el.querySelector('.saved-btn');
    const badge = b.querySelector('.saved-badge');
    badge.hidden = !n;
    badge.textContent = n > 99 ? '99+' : String(n);
    b.querySelector('svg').outerHTML = bookmarkIcon(n > 0);
    b.setAttribute('aria-label', n ? `${STRINGS.saved.button} (${STRINGS.saved.count(n)})` : STRINGS.saved.button);
  }

  #suggest() {
    const q = this.input.value;
    this.results = this.store.searchAll(q, this.bodies);
    this.active = this.results.length ? 0 : -1;
    if (!q.trim()) return this.#closeList();
    this.list.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
    if (!this.results.length) {
      this.list.innerHTML = `<li class="empty" role="option" aria-disabled="true">${esc(STRINGS.noResults)}<span class="sr-meta">${esc(STRINGS.noResultsHint)}</span></li>`;
      return;
    }
    const needle = q.trim().toLowerCase();
    const mark = (text) => {
      const i = text.toLowerCase().indexOf(needle);
      if (i < 0) return esc(text);
      return `${esc(text.slice(0, i))}<mark>${esc(text.slice(i, i + needle.length))}</mark>${esc(text.slice(i + needle.length))}`;
    };
    let lastType = null;
    this.list.innerHTML = this.results.map((r, i) => {
      const head = r.type !== lastType ? `<li class="sr-group" role="presentation">${esc(STRINGS.searchGroups[r.type])}</li>` : '';
      lastType = r.type;
      return `${head}<li role="option" id="sr-${i}" data-i="${i}" aria-selected="${i === this.active}" class="sr-${r.type}${i === this.active ? ' is-active' : ''}">
        <span class="sr-name">${mark(r.label)}</span>
        <span class="sr-meta">${r.matched ? `aka ${mark(r.matched)} · ` : ''}${esc(r.meta || '')}</span>
      </li>`;
    }).join('');
    this.list.querySelectorAll('li[data-i]').forEach((li) => li.addEventListener('mousedown', (e) => { e.preventDefault(); this.#choose(this.results[+li.dataset.i]); }));
    this.input.setAttribute('aria-activedescendant', this.active >= 0 ? `sr-${this.active}` : '');
  }

  #keys(e) {
    const n = this.results?.length || 0;
    if (e.key === 'ArrowDown' && n) { e.preventDefault(); this.active = (this.active + 1) % n; this.#paint(); }
    else if (e.key === 'ArrowUp' && n) { e.preventDefault(); this.active = (this.active - 1 + n) % n; this.#paint(); }
    else if (e.key === 'Enter' && this.active >= 0 && n) { e.preventDefault(); this.#choose(this.results[this.active]); }
    else if (e.key === 'Escape') { e.stopPropagation(); this.closeSearch(); }
  }

  #paint() {
    this.list.querySelectorAll('li[data-i]').forEach((li) => {
      const on = +li.dataset.i === this.active;
      li.classList.toggle('is-active', on);
      li.setAttribute('aria-selected', String(on));
      if (on) li.scrollIntoView({ block: 'nearest' });
    });
    this.input.setAttribute('aria-activedescendant', `sr-${this.active}`);
  }

  #choose(r) {
    this.closeSearch();
    if (r.type === 'planet') {
      if (r.id === 'deepspace') bus.emit('view:deepspace'); else bus.emit('view:body', { id: r.id });
    } else if (r.type === 'moment') {
      bus.emit('machine:select', { id: r.machineId, source: 'search', timelineIndex: r.index });
    } else {
      bus.emit('machine:select', { id: r.id, source: 'search' });
    }
  }

  #closeList() {
    this.list.hidden = true;
    this.input.setAttribute('aria-expanded', 'false');
  }

  /** Reflect current view on the tabs. */
  setActive(view) {
    this.el.querySelectorAll('.filter').forEach((b) => {
      const on = b.dataset.view === view;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }

  setSound(on) {
    const b = this.el.querySelector('.sound-btn');
    b.innerHTML = soundIcon(on);
    b.setAttribute('aria-pressed', String(on));
    const label = on ? STRINGS.soundOn : STRINGS.soundOff;
    b.setAttribute('aria-label', label);
    b.title = label;
  }
}
