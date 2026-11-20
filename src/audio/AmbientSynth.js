/**
 * Generated ambient "space" soundtrack (no audio files):
 *   - a slow, detuned drone chord through a breathing low-pass filter,
 *   - filtered noise for a soft "solar wind",
 *   - occasional glassy chimes through a synthetic reverb.
 * Browsers block audio until the user interacts, so the AudioContext is only
 * created/resumed from a click/keypress.
 */
export class AmbientSynth {
  constructor() {
    this.ctx = null;
    this.on = false;
  }

  #build() {
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.ducker = ctx.createGain(); // separate from master so ducking never fights the on/off fade
    this.ducker.gain.value = this.duckLevel ?? 1;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(this.ducker).connect(comp).connect(ctx.destination);

    // synthetic reverb impulse
    const len = ctx.sampleRate * 4.5, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.55;
    this.reverb.connect(wet).connect(this.master);

    // drone: A1, E2, A2, C#3-ish, detuned pairs
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 420; filter.Q.value = 0.7;
    const lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
    lfo.frequency.value = 0.035; lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(filter.frequency); lfo.start();
    const droneGain = ctx.createGain(); droneGain.gain.value = 0.16;
    filter.connect(droneGain);
    droneGain.connect(this.master);
    droneGain.connect(this.reverb);
    for (const f of [55, 82.4, 110, 138.6, 164.8]) {
      for (const det of [-6, 5]) {
        const o = ctx.createOscillator();
        o.type = f < 100 ? 'sawtooth' : 'triangle';
        o.frequency.value = f; o.detune.value = det;
        const g = ctx.createGain(); g.gain.value = f < 100 ? 0.12 : 0.08;
        o.connect(g).connect(filter); o.start();
      }
    }

    // solar wind: band-passed noise with slow sweep
    const nb = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = nb; noise.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 0.6;
    const nlfo = ctx.createOscillator(), nlg = ctx.createGain();
    nlfo.frequency.value = 0.05; nlg.gain.value = 400; nlfo.connect(nlg).connect(bp.frequency); nlfo.start();
    const ng = ctx.createGain(); ng.gain.value = 0.035;
    noise.connect(bp).connect(ng).connect(this.master); noise.start();

    this.#scheduleChime();
  }

  #scheduleChime() {
    const wait = 4000 + Math.random() * 7000;
    this.chimeTimer = setTimeout(() => {
      if (this.on) this.#chime();
      this.#scheduleChime();
    }, wait);
  }

  #chime() {
    const ctx = this.ctx, t = ctx.currentTime;
    const scale = [440, 554.4, 659.3, 830.6, 880, 1108.7];
    const f = scale[(Math.random() * scale.length) | 0];
    for (const [mult, amp] of [[1, 0.05], [2.01, 0.018]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * mult;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
      o.connect(g); g.connect(this.reverb); g.connect(this.master);
      o.start(t); o.stop(t + 3.6);
    }
  }

  /** Must be called from a user gesture the first time. */
  async setOn(on) {
    this.on = on;
    if (on && !this.ctx) this.#build();
    if (!this.ctx) return;
    if (on && this.ctx.state === 'suspended') await this.ctx.resume();
    const g = this.master.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(on ? 0.5 : 0, t + (on ? 2.5 : 0.6));
  }

  /** Lower the music (e.g. while the narrator talks). level: 0-1 of normal. */
  duck(level) {
    this.duckLevel = level;
    if (!this.ctx) return;
    const g = this.ducker.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(level, t + (level < 1 ? 0.4 : 1.5));
  }

  /** Short UI "blip" for selections (only when sound is on). */
  blip(freq = 880) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.12);
    g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.3);
  }
}
