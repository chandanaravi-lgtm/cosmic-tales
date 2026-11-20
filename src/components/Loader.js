import gsap from 'gsap';
import { APP, STRINGS } from '../config/app.config.js';
import { esc } from '../data/format.js';

/** Full-screen loading screen with a real progress bar. */
export class Loader {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'loader';
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');
    this.el.innerHTML = `
      <div class="loader-orbit" aria-hidden="true"><span class="lo-sun"></span><span class="lo-ring r1"><i></i></span><span class="lo-ring r2"><i></i></span></div>
      <h1 class="loader-title">${esc(APP.name)}</h1>
      <p class="loader-sub">${esc(STRINGS.loading)}</p>
      <div class="loader-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div>
      <p class="loader-pct">0%</p>`;
    root.appendChild(this.el);
    this.shown = 0;
  }

  progress(f) {
    const pct = Math.round(Math.max(this.shown, Math.min(1, f)) * 100);
    this.shown = pct / 100;
    this.el.querySelector('.loader-bar span').style.width = `${pct}%`;
    this.el.querySelector('.loader-bar').setAttribute('aria-valuenow', String(pct));
    this.el.querySelector('.loader-pct').textContent = `${pct}%`;
  }

  error(msg) {
    this.el.classList.add('is-error');
    this.el.querySelector('.loader-sub').textContent = msg;
  }

  done() {
    this.progress(1);
    gsap.to(this.el, { opacity: 0, duration: 0.9, delay: 0.2, ease: 'power2.out', onComplete: () => this.el.remove() });
  }
}

/** Small transient hint bubble at the bottom of the screen. */
export function toast(root, text, ms = 5200) {
  const el = document.createElement('div');
  el.className = 'toast glass';
  el.setAttribute('role', 'status');
  el.textContent = text;
  root.appendChild(el);
  gsap.fromTo(el, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 });
  gsap.to(el, { opacity: 0, y: 10, delay: ms / 1000, duration: 0.6, onComplete: () => el.remove() });
}
