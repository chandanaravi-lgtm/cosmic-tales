import { APP, STRINGS } from '../config/app.config.js';
import { bus } from '../core/EventBus.js';
import { esc } from '../data/format.js';
import { helmetIcon, playIcon } from './icons.js';

const S = STRINGS.narration;
const fmt = (s) => { s = Math.max(0, Math.round(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const speedLabel = (r) => `${r}×`;

/**
 * Glass "voice deck" shown in the timeline: narrator avatar, Listen / Pause /
 * Continue, a seekable progress bar with live captions, speed and voice pickers.
 * Pure view — it reflects narrator bus events and reports clicks via callbacks.
 */
export class VoiceDeck {
  constructor(parent, narrator, { onToggle }) {
    this.narrator = narrator;
    this.onToggle = onToggle;
    this.el = document.createElement('section');
    this.el.className = 'tl-voice glass is-loading';
    this.el.setAttribute('aria-label', S.region);
    this.el.innerHTML = `
      <div class="vd-avatar" aria-hidden="true">${helmetIcon()}</div>
      <button class="glass-btn vd-toggle" type="button"></button>
      <div class="vd-main">
        <p class="vd-caption" aria-live="polite"></p>
        <div class="vd-progress" role="slider" tabindex="0" aria-label="${esc(S.progress)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <div class="vd-rail"><div class="vd-fill"></div></div>
          <span class="vd-time">0:00 / 0:00</span>
        </div>
      </div>
      <div class="vd-group vd-speeds" role="group" aria-label="${esc(S.speed)}">
        <span class="vd-label">${esc(S.speed)}</span>
        ${APP.narration.speeds.map((r) => `<button type="button" class="vd-chip" data-rate="${r}" aria-pressed="false">${speedLabel(r)}</button>`).join('')}
      </div>
      <button type="button" class="vd-chip vd-cycle" aria-label="${esc(S.speed)}"></button>
      <div class="vd-group vd-voices" role="group" aria-label="${esc(S.voice)}"><span class="vd-label">${esc(S.voice)}</span></div>`;
    parent.appendChild(this.el);

    this.toggleBtn = this.el.querySelector('.vd-toggle');
    this.caption = this.el.querySelector('.vd-caption');
    this.fill = this.el.querySelector('.vd-fill');
    this.time = this.el.querySelector('.vd-time');
    this.progress = this.el.querySelector('.vd-progress');

    this.toggleBtn.addEventListener('click', () => this.onToggle());
    this.el.querySelectorAll('.vd-chip[data-rate]').forEach((b) => b.addEventListener('click', () => this.setRate(+b.dataset.rate)));
    // small screens: one button that cycles through the speeds
    this.el.querySelector('.vd-cycle').addEventListener('click', () => {
      const list = APP.narration.speeds;
      this.setRate(list[(list.indexOf(this.narrator.rate) + 1) % list.length]);
    });
    this.#bindSeek();

    this.offs = [
      bus.on('narration:state', ({ state }) => this.#paint(state)),
      bus.on('narration:progress', ({ time, duration }) => this.#progress(time, duration)),
      bus.on('narration:cue', ({ text }) => { if (text) this.caption.textContent = text; }),
    ];
    this.#paintRate();
    this.#paint(narrator.state);
  }

  /** Called once the manifest is known. */
  setEnabled(ok) {
    this.el.classList.remove('is-loading');
    this.enabled = ok;
    if (!ok) { this.el.classList.add('is-off'); this.caption.textContent = S.unavailable; return; }
    const box = this.el.querySelector('.vd-voices');
    box.querySelectorAll('.vd-chip').forEach((b) => b.remove());
    for (const [key, v] of Object.entries(this.narrator.voices)) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'vd-chip'; b.dataset.voice = key;
      b.textContent = v.label; b.title = v.description || v.label;
      b.addEventListener('click', () => { this.narrator.setVoice(key); this.#paintVoice(); });
      box.appendChild(b);
    }
    this.#paintVoice();
  }

  /** Whether the current timeline moment has a clip. */
  setAvailable(has, fallbackText = '') {
    this.el.classList.toggle('is-off', !has);
    this.toggleBtn.disabled = !has;
    this.caption.textContent = has ? fallbackText : (this.enabled === undefined ? S.loading : S.unavailable);
    if (!has) this.#progress(0, 0);
  }

  stepRate(dir) {
    const list = APP.narration.speeds;
    const i = list.indexOf(this.narrator.rate);
    this.setRate(list[Math.max(0, Math.min(list.length - 1, (i < 0 ? 1 : i) + dir))]);
  }

  setRate(r) { this.narrator.setRate(r); this.#paintRate(); }

  destroy() { this.offs.forEach((f) => f()); this.el.remove(); }

  #paintRate() {
    const cycle = this.el.querySelector('.vd-cycle');
    cycle.textContent = `${S.speed} ${speedLabel(this.narrator.rate)}`;
    this.el.querySelectorAll('.vd-chip[data-rate]').forEach((b) => {
      const on = +b.dataset.rate === this.narrator.rate;
      b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on));
    });
  }

  #paintVoice() {
    this.el.querySelectorAll('.vd-chip[data-voice]').forEach((b) => {
      const on = b.dataset.voice === this.narrator.voice;
      b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on));
    });
  }

  #paint(state) {
    const playing = state === 'playing' || state === 'loading';
    const started = this.narrator.clip && this.narrator.audio.currentTime > 0.05;
    const label = state === 'loading' ? S.loading
      : playing ? S.pause
      : state === 'ended' ? S.replay
      : started ? S.continue : S.listen;
    this.toggleBtn.innerHTML = `${playIcon(playing)}<span>${esc(label)}</span>`;
    this.toggleBtn.setAttribute('aria-label', label);
    this.toggleBtn.classList.toggle('is-active', playing);
    this.el.classList.toggle('is-speaking', state === 'playing');
    if (state === 'error') this.caption.textContent = S.failed;
  }

  #progress(t, d) {
    const f = d ? Math.min(1, t / d) : 0;
    this.fill.style.width = `${f * 100}%`;
    this.time.textContent = `${fmt(t)} / ${fmt(d)}`;
    this.progress.setAttribute('aria-valuenow', String(Math.round(f * 100)));
    this.progress.setAttribute('aria-valuetext', `${fmt(t)} of ${fmt(d)}`);
  }

  #bindSeek() {
    const rail = this.el.querySelector('.vd-rail');
    let drag = false;
    const at = (e) => { const r = rail.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); };
    this.progress.addEventListener('pointerdown', (e) => { if (!this.narrator.clip) return; drag = true; this.progress.setPointerCapture(e.pointerId); this.narrator.seek(at(e)); });
    this.progress.addEventListener('pointermove', (e) => drag && this.narrator.seek(at(e)));
    const up = () => { drag = false; };
    this.progress.addEventListener('pointerup', up);
    this.progress.addEventListener('pointercancel', up);
    this.progress.addEventListener('keydown', (e) => {
      const a = this.narrator.audio, d = a.duration || 1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault(); e.stopPropagation();
        this.narrator.seek((a.currentTime + (e.key === 'ArrowRight' ? 5 : -5)) / d);
      }
    });
  }
}
