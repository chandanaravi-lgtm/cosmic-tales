import gsap from 'gsap';
import { APP, STRINGS } from '../config/app.config.js';
import { bus } from '../core/EventBus.js';
import { esc } from '../data/format.js';
import { cardImage } from '../data/imagePicker.js';
import { mountImage } from './img.js';
import { placeholderArt, BODY_ACCENT } from './placeholder.js';
import { closeIcon, checkIcon, bookmarkIcon } from './icons.js';

const S = STRINGS.saved;

/**
 * Saved items, kept in this browser (localStorage) — no account needed.
 * Items live in named collections ("Favourites", "Homework", or any the
 * reader makes). An item is a whole machine timeline or one timeline moment.
 *   { collections: [{ id, name, items: [{ type: 'timeline'|'moment', machineId, eventId?, at }] }] }
 */
export class SavedStore {
  constructor() {
    this.data = this.#read();
    if (!this.data.collections.length) {
      this.data.collections = S.defaultCollections.map((name, i) => ({ id: `c${i + 1}`, name, items: [] }));
      this.#write();
    }
  }

  #read() {
    try {
      const j = JSON.parse(localStorage.getItem(APP.storageKeys.saved) || 'null');
      if (j && Array.isArray(j.collections)) return j;
    } catch { /* corrupt or blocked: start fresh */ }
    return { collections: [] };
  }

  #write() {
    try { localStorage.setItem(APP.storageKeys.saved, JSON.stringify(this.data)); } catch { /* private mode: keep in memory */ }
    bus.emit('saved:changed', { count: this.count });
  }

  get collections() { return this.data.collections; }
  get count() { return this.data.collections.reduce((n, c) => n + c.items.length, 0); }

  createCollection(name) {
    const clean = String(name).trim().slice(0, 40);
    const found = this.collections.find((c) => c.name.toLowerCase() === clean.toLowerCase());
    if (found) return found;
    const c = { id: `c${Date.now().toString(36)}`, name: clean, items: [] };
    this.collections.push(c);
    this.#write();
    return c;
  }

  deleteCollection(id) {
    this.data.collections = this.collections.filter((c) => c.id !== id);
    this.#write();
  }

  /** Add an item; returns false if it was already in that collection. */
  add(collectionId, item) {
    const c = this.collections.find((x) => x.id === collectionId);
    if (!c) return false;
    if (c.items.some((i) => i.type === item.type && i.machineId === item.machineId && i.eventId === item.eventId)) return false;
    c.items.unshift({ ...item, at: Date.now() });
    this.#write();
    return true;
  }

  remove(collectionId, index) {
    const c = this.collections.find((x) => x.id === collectionId);
    if (!c) return;
    c.items.splice(index, 1);
    this.#write();
  }
}

/**
 * "Save" popover inside the timeline panel: asks WHAT to save (this moment or
 * the whole timeline) and WHERE (a collection, or a new one), then shows a
 * clear "Saved to …" confirmation with a shortcut to the Saved panel.
 */
export function openSavePopover(anchor, saved, machine, event) {
  document.querySelector('.save-pop')?.remove();
  const pop = document.createElement('form');
  pop.className = 'save-pop glass';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', S.ask);
  const options = saved.collections.map((c, i) => `<label class="sp-opt"><input type="radio" name="where" value="${esc(c.id)}" ${i === 0 ? 'checked' : ''}/><span>${esc(c.name)}</span></label>`).join('');
  pop.innerHTML = `
    <h3 class="sp-title">${esc(S.ask)}</h3>
    <fieldset class="sp-group"><legend>${esc(S.what)}</legend>
      <label class="sp-opt"><input type="radio" name="what" value="moment" checked/><span>${esc(S.thisMoment(event.title))}</span></label>
      <label class="sp-opt"><input type="radio" name="what" value="timeline"/><span>${esc(S.wholeTimeline(machine.shortName || machine.name))}</span></label>
    </fieldset>
    <fieldset class="sp-group"><legend>${esc(S.where)}</legend>
      <div class="sp-where">${options}
        <label class="sp-opt"><input type="radio" name="where" value="__new"/><span>${esc(S.newCollection)}</span></label>
      </div>
      <input class="sp-new" type="text" maxlength="40" placeholder="${esc(S.newPlaceholder)}" aria-label="${esc(S.newName)}" hidden/>
    </fieldset>
    <div class="sp-actions">
      <button type="button" class="glass-btn sp-cancel">${esc(S.cancel)}</button>
      <button type="submit" class="glass-btn sp-ok is-active">${bookmarkIcon(true)} ${esc(S.confirm)}</button>
    </div>`;
  anchor.closest('.timeline-overlay').appendChild(pop);
  const newInput = pop.querySelector('.sp-new');
  const close = () => { if (!pop.isConnected) return; gsap.to(pop, { opacity: 0, y: 8, duration: 0.18, onComplete: () => pop.remove() }); setTimeout(() => pop.remove(), 400); anchor.focus({ preventScroll: true }); };
  pop.addEventListener('change', () => {
    const isNew = pop.where.value === '__new';
    newInput.hidden = !isNew;
    if (isNew) newInput.focus();
  });
  pop.querySelector('.sp-cancel').addEventListener('click', close);
  pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  pop.addEventListener('pointerdown', (e) => e.stopPropagation());
  pop.addEventListener('submit', (e) => {
    e.preventDefault();
    let where = pop.where.value;
    if (where === '__new') {
      if (!newInput.value.trim()) { newInput.focus(); newInput.classList.add('is-invalid'); return; }
      where = saved.createCollection(newInput.value).id;
    }
    const item = pop.what.value === 'timeline' ? { type: 'timeline', machineId: machine.id } : { type: 'moment', machineId: machine.id, eventId: event.id };
    const ok = saved.add(where, item);
    const name = saved.collections.find((c) => c.id === where)?.name || '';
    pop.classList.add('is-done');
    pop.innerHTML = `<div class="sp-done" role="status">
        <span class="sp-check">${checkIcon()}</span>
        <p>${esc(ok ? S.done(name) : S.already(name))}</p>
        <button type="button" class="glass-btn sp-view">${esc(S.view)}</button>
      </div>`;
    gsap.fromTo(pop.querySelector('.sp-check'), { scale: 0.3 }, { scale: 1, duration: 0.45, ease: 'back.out(2.2)' });
    pop.querySelector('.sp-view').addEventListener('click', () => { pop.remove(); bus.emit('saved:open'); });
    pop.querySelector('.sp-view').focus({ preventScroll: true });
    // tidy itself away after a while — but not while the pointer is on it
    const auto = () => { if (!pop.isConnected) return; if (pop.matches(':hover')) return setTimeout(auto, 1500); close(); };
    setTimeout(auto, 12000); // long enough for a young reader to notice it
  });
  gsap.fromTo(pop, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' });
  requestAnimationFrame(() => pop.querySelector('input[name="what"]')?.focus({ preventScroll: true }));
  return pop;
}

/** The "Saved items" panel (header bookmark button): collections, open, remove. */
export class SavedPanel {
  constructor(root, store, saved) {
    this.store = store;
    this.saved = saved;
    this.el = document.createElement('div');
    this.el.className = 'modal-overlay saved-overlay';
    this.el.hidden = true;
    this.el.innerHTML = `
      <section class="modal saved-panel glass" role="dialog" aria-modal="true" aria-labelledby="saved-title">
        <header class="modal-head">
          <h2 id="saved-title">${bookmarkIcon(true)} ${esc(S.title)}</h2>
          <button type="button" class="glass-btn icon-btn modal-close" aria-label="${esc(S.close)}">${closeIcon()}</button>
        </header>
        <div class="saved-body"></div>
      </section>`;
    root.appendChild(this.el);
    this.body = this.el.querySelector('.saved-body');
    this.el.querySelector('.modal-close').addEventListener('click', () => this.close());
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.close(); });
    this.el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); this.close(); } });
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.body.addEventListener('click', (e) => this.#onClick(e));
    bus.on('saved:open', () => this.open());
    bus.on('saved:changed', () => { if (this.isOpen) this.#render(); });
  }

  get isOpen() { return !this.el.hidden; }

  open() {
    this.#render();
    this.el.hidden = false;
    bus.emit('overlay:open', { id: 'saved' });
    gsap.fromTo(this.el.querySelector('.modal'), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'power3.out' });
    this.el.querySelector('.modal-close').focus({ preventScroll: true });
  }

  close() {
    if (!this.isOpen) return;
    this.el.hidden = true;
    bus.emit('overlay:close', { id: 'saved' });
  }

  #render() {
    const cols = this.saved.collections;
    if (!this.saved.count) {
      this.body.innerHTML = `<p class="saved-empty">${esc(S.empty)}</p>${cols.map((c) => `<p class="saved-col-name is-empty">${esc(c.name)} · 0</p>`).join('')}`;
      return;
    }
    this.body.innerHTML = cols.map((c) => `
      <section class="saved-col" data-col="${esc(c.id)}">
        <h3 class="saved-col-name">${esc(c.name)} <span>${esc(S.count(c.items.length))}</span>
          ${c.items.length ? '' : `<button type="button" class="saved-del-col" data-del-col="${esc(c.id)}">${esc(S.deleteCollection)}</button>`}</h3>
        <ul class="saved-list">${c.items.map((it, i) => this.#item(c, it, i)).join('')}</ul>
      </section>`).join('');
    this.body.querySelectorAll('.saved-thumb[data-m]').forEach((el) => {
      const m = this.store.get(el.dataset.m);
      if (m) mountImage(el, cardImage(m), placeholderArt('milestone', BODY_ACCENT[m.body]), { preferThumb: true });
    });
  }

  #item(c, it, i) {
    const m = this.store.get(it.machineId);
    if (!m) return '';
    const e = it.type === 'moment' ? m.events.find((x) => x.id === it.eventId) : null;
    const title = e ? e.title : m.name;
    const meta = e ? `${S.moment} · ${m.shortName || m.name} · ${e.date?.label || ''}` : `${S.timeline} · ${m.events.length} moments`;
    return `<li class="saved-item">
        <span class="saved-thumb" data-m="${esc(m.id)}"></span>
        <span class="saved-text"><b>${esc(title)}</b><small>${esc(meta)}</small></span>
        <button type="button" class="glass-btn saved-open" data-open="${esc(c.id)}:${i}">${esc(S.open)}</button>
        <button type="button" class="glass-btn icon-btn saved-remove" data-remove="${esc(c.id)}:${i}" aria-label="${esc(S.removeAria(title))}" title="${esc(S.remove)}">${closeIcon()}</button>
      </li>`;
  }

  #onClick(e) {
    const open = e.target.closest('[data-open]');
    const rem = e.target.closest('[data-remove]');
    const del = e.target.closest('[data-del-col]');
    if (del) return this.saved.deleteCollection(del.dataset.delCol);
    const [cid, i] = (open || rem)?.dataset[open ? 'open' : 'remove'].split(':') || [];
    if (!cid) return;
    const it = this.saved.collections.find((c) => c.id === cid)?.items[+i];
    if (rem) return this.saved.remove(cid, +i);
    if (!it) return;
    this.close();
    const m = this.store.get(it.machineId);
    const index = it.type === 'moment' ? Math.max(0, m.events.findIndex((x) => x.id === it.eventId)) : 0;
    bus.emit('machine:select', { id: it.machineId, source: 'saved', timelineIndex: index });
  }
}
