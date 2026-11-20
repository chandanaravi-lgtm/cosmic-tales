import { APP } from '../config/app.config.js';
import { bus } from '../core/EventBus.js';

/**
 * Voice-over player for the timeline.
 *
 * Clips are pre-rendered with Kokoro TTS (scripts/generate_voice.py) and listed in
 * a small manifest (public/data/narration.json, loaded lazily on first use).
 * One <audio> element is reused for every clip — that keeps iOS/Safari happy once
 * the user has pressed play once — and the next clip is prefetched while the
 * current one plays. Pitch is preserved when the speed changes.
 *
 * Bus events (anything can listen — e.g. the ambient synth ducks under the voice):
 *   narration:state    { state: 'idle'|'loading'|'playing'|'paused'|'ended'|'error', clip }
 *   narration:progress { time, duration }
 *   narration:cue      { index, text }
 *   narration:ended    { machineId, eventId }
 */
export class Narrator {
  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    for (const k of ['preservesPitch', 'mozPreservesPitch', 'webkitPreservesPitch']) if (k in this.audio) this.audio[k] = true;
    this.prefetch = new Audio();
    this.prefetch.preload = 'auto';
    this.manifest = null;
    this.clip = null;
    this.state = 'idle';
    this.cueIndex = -1;

    const saved = JSON.parse(localStorage.getItem(APP.storageKeys.narration) || '{}');
    this.voice = saved.voice || APP.narration.defaultVoice;
    this.rate = APP.narration.speeds.includes(saved.rate) ? saved.rate : 1;

    const a = this.audio;
    a.addEventListener('playing', () => this.#set('playing'));
    a.addEventListener('pause', () => { if (!a.ended && this.state === 'playing') this.#set('paused'); });
    a.addEventListener('waiting', () => this.state === 'playing' && this.#set('loading'));
    a.addEventListener('timeupdate', () => this.#tick());
    a.addEventListener('ended', () => {
      this.#set('ended');
      bus.emit('narration:ended', { machineId: this.clip?.machineId, eventId: this.clip?.eventId });
    });
    a.addEventListener('error', () => { if (this.clip) this.#set('error'); });
  }

  /** Fetch the manifest once. Resolves false if narration has not been generated. */
  ready() {
    this._ready ||= fetch(APP.narration.manifestUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { this.manifest = j; return !!j; })
      .catch(() => false);
    return this._ready;
  }

  get voices() { return this.manifest?.voices || {}; }

  has(machineId, eventId) { return !!this.#entry(machineId, eventId); }

  #entry(machineId, eventId, voice = this.voice) {
    const e = this.manifest?.clips?.[machineId]?.[eventId];
    return e?.voices?.[voice] || (e && Object.values(e.voices)[0]) || null;
  }

  /** Point the player at an event's clip (does not start playback). */
  load(machineId, eventId, nextEventId = null) {
    this.audio.pause();
    const c = this.#entry(machineId, eventId);
    this.clip = c ? { ...c, machineId, eventId } : null;
    this.cueIndex = -1;
    if (!c) { this.audio.removeAttribute('src'); this.audio.load(); this.#set('idle'); return false; }
    this.audio.src = c.url;
    this.audio.playbackRate = this.rate;
    this.#set('idle');
    bus.emit('narration:progress', { time: 0, duration: c.duration });
    bus.emit('narration:cue', { index: -1, text: '' });
    // warm the next clip so "Play story" flows without a gap
    const next = nextEventId && this.#entry(machineId, nextEventId);
    if (next) this.prefetch.src = next.url;
    return true;
  }

  async play() {
    if (!this.clip) return false;
    if (this.audio.ended) this.audio.currentTime = 0;
    this.audio.playbackRate = this.rate;
    this.#set('loading');
    try { await this.audio.play(); return true; } catch (e) {
      if (e.name !== 'AbortError') { console.warn('[narrator]', e); this.#set('error'); }
      return false;
    }
  }

  pause() { if (!this.audio.paused) this.audio.pause(); else if (this.state === 'loading') this.#set('paused'); }

  stop() { this.audio.pause(); this.clip = null; this.#set('idle'); }

  get isPlaying() { return this.state === 'playing' || this.state === 'loading'; }

  seek(frac) {
    if (!this.clip) return;
    const d = this.audio.duration || this.clip.duration;
    this.audio.currentTime = Math.max(0, Math.min(d - 0.05, frac * d));
    this.#tick();
  }

  setRate(rate) {
    this.rate = rate;
    this.audio.playbackRate = rate;
    this.#save();
  }

  /** Switch voice and carry on from the same point in the story. */
  async setVoice(voice) {
    if (voice === this.voice) return;
    const wasPlaying = this.isPlaying;
    const frac = this.clip ? this.audio.currentTime / (this.audio.duration || this.clip.duration || 1) : 0;
    this.voice = voice;
    this.#save();
    if (!this.clip) return;
    const { machineId, eventId } = this.clip;
    this.load(machineId, eventId);
    if (frac > 0.02) {
      await new Promise((r) => this.audio.addEventListener('loadedmetadata', r, { once: true }));
      this.seek(frac);
    }
    if (wasPlaying) this.play();
  }

  #save() { localStorage.setItem(APP.storageKeys.narration, JSON.stringify({ voice: this.voice, rate: this.rate })); }

  #tick() {
    if (!this.clip) return;
    const t = this.audio.currentTime;
    bus.emit('narration:progress', { time: t, duration: this.audio.duration || this.clip.duration });
    const cues = this.clip.cues || [];
    let i = -1;
    while (i + 1 < cues.length && cues[i + 1].t <= t + 0.05) i++;
    if (i !== this.cueIndex) { this.cueIndex = i; bus.emit('narration:cue', { index: i, text: cues[i]?.text || '' }); }
  }

  #set(state) {
    if (state === this.state) return;
    this.state = state;
    bus.emit('narration:state', { state, clip: this.clip });
  }
}
