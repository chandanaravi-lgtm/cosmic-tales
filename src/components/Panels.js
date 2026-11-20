import gsap from 'gsap';
import { STRINGS } from '../config/app.config.js';
import { bus } from '../core/EventBus.js';
import { esc, statusLabel, launchYear } from '../data/format.js';
import { cardImage } from '../data/imagePicker.js';
import { mountImage } from './img.js';
import { placeholderArt, BODY_ACCENT } from './placeholder.js';
import { closeIcon, deepSpaceIcon } from './icons.js';

/** Side panel listing deep-space machines: thumbnail + name + status. */
export class DeepSpacePanel {
  constructor(root, store) {
    this.store = store;
    this.el = document.createElement('aside');
    this.el.className = 'side-panel glass';
    this.el.hidden = true;
    this.el.setAttribute('aria-label', STRINGS.deepSpaceTitle);
    root.appendChild(this.el);
  }

  get isOpen() { return !this.el.hidden; }

  open() {
    const items = this.store.deepSpace();
    this.el.innerHTML = `
      <header class="panel-head">${deepSpaceIcon()}<div><h2>${esc(STRINGS.deepSpaceTitle)}</h2><p>${esc(STRINGS.deepSpaceIntro)}</p></div>
        <button class="glass-btn icon-btn panel-close" type="button" aria-label="${esc(STRINGS.close)}">${closeIcon()}</button></header>
      <ul class="panel-list">
        ${items.map((m) => `
          <li><button class="panel-item" type="button" data-id="${esc(m.id)}">
            <span class="thumb"></span>
            <span class="pi-text"><span class="pi-name">${esc(m.name)}</span>
              <span class="pi-meta">${esc(m.kind || '')}${launchYear(m) ? ` · launched ${esc(launchYear(m))}` : ''}</span>
              <span class="pi-status status-${esc(m.abandoned?.status || 'none')}">${esc(statusLabel(m))}${m.abandoned?.value ? ` · ${esc(m.abandoned.value)}` : ''}</span></span>
          </button></li>`).join('')}
      </ul>`;
    this.el.querySelectorAll('.panel-item').forEach((b, i) => {
      const m = items[i];
      mountImage(b.querySelector('.thumb'), cardImage(m), placeholderArt(m.markerShape === 'telescope' ? 'discovery' : 'arrival', BODY_ACCENT['deep-space'], STRINGS.noMachinePhoto), { preferThumb: true });
      b.addEventListener('click', () => bus.emit('machine:select', { id: b.dataset.id, source: 'deepspace' }));
    });
    this.el.querySelector('.panel-close').addEventListener('click', () => this.close());
    this.el.hidden = false;
    gsap.fromTo(this.el, { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: 'power3.out' });
    gsap.fromTo(this.el.querySelectorAll('.panel-list li'), { y: 12, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.07, delay: 0.15 });
  }

  close() {
    if (this.el.hidden) return;
    gsap.to(this.el, { x: 40, opacity: 0, duration: 0.25, onComplete: () => { this.el.hidden = true; } });
  }
}

/**
 * Chip bar of machines on the focused body (Moon/Mars). Gives keyboard
 * and touch users a reliable way to pick a machine besides the 3D markers.
 */
export class BodyMachinesBar {
  constructor(root, store) {
    this.store = store;
    this.el = document.createElement('nav');
    this.el.className = 'machines-bar glass';
    this.el.hidden = true;
    root.appendChild(this.el);
    bus.on('machine:hover', ({ id }) => this.el.querySelectorAll('button').forEach((b) => b.classList.toggle('is-hover', b.dataset.id === id)));
  }

  show(bodyId, bodyName) {
    const items = this.store.onBody(bodyId);
    if (!items.length) return this.hide();
    this.el.setAttribute('aria-label', STRINGS.machinesHere(items.length, bodyName));
    this.el.innerHTML = `<span class="mb-title">${esc(STRINGS.machinesHere(items.length, bodyName))}</span>
      ${items.map((m) => `<button type="button" class="mb-chip body-${esc(m.body)}" data-id="${esc(m.id)}"><span class="dot" aria-hidden="true"></span>${esc(m.shortName || m.name)}<span class="mb-year">${esc(launchYear(m) || '')}</span></button>`).join('')}`;
    this.el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => bus.emit('machine:select', { id: b.dataset.id, source: 'bar' })));
    this.el.hidden = false;
    gsap.fromTo(this.el, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' });
  }

  hide() { this.el.hidden = true; }
}
