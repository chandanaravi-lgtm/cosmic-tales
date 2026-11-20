import * as THREE from 'three';
import gsap from 'gsap';
import './styles/base.css';
import './styles/header.css';
import './styles/card.css';
import './styles/timeline.css';
import './styles/panels.css';
import './styles/chat.css';
import './styles/overlays.css';

import { APP, STRINGS } from './config/app.config.js';
import { BODIES, DEEP_SPACE, VIEWS } from './config/bodies.js';
import { bus } from './core/EventBus.js';
import { AssetLoader } from './core/AssetLoader.js';
import { SceneManager } from './scenes/SceneManager.js';
import { SolarSystem } from './scenes/SolarSystem.js';
import { CameraDirector } from './scenes/CameraDirector.js';
import { MachineMarkers } from './scenes/MachineMarkers.js';
import { createStarfield, createAsteroidBelt, createSpaceDust } from './scenes/Starfield.js';
import { DataStore } from './data/DataStore.js';
import { Header } from './components/Header.js';
import { CosmicCard } from './components/CosmicCard.js';
import { Timeline } from './components/Timeline.js';
import { DeepSpacePanel, BodyMachinesBar } from './components/Panels.js';
import { ZoomOutButton } from './components/ZoomOutButton.js';
import { AstroChat } from './components/AstroChat.js';
import { Gallery } from './components/Gallery.js';
import { SavedStore, SavedPanel } from './components/Saved.js';
import { Loader, toast } from './components/Loader.js';
import { AmbientSynth } from './audio/AmbientSynth.js';
import { Narrator } from './audio/Narrator.js';

const TAU = Math.PI * 2;
/**
 * Resolve when a camera flight lands — or at most `secs` later. On a very slow
 * device GSAP stretches tweens instead of skipping frames, so the card / bar
 * must not wait forever for the camera.
 */
const arrival = (flight, secs) => Promise.race([flight, new Promise((r) => setTimeout(r, secs * 1000))]);
const shortestAngle = (from, to) => from + ((((to - from) % TAU) + TAU + Math.PI) % TAU) - Math.PI;

/**
 * App controller: a small state machine (home | body | deepspace | machine)
 * that reacts to bus events and coordinates scene + UI. Features talk to it
 * only through the bus, so new modes (quiz, compare, VR…) can be added
 * alongside without touching the others.
 */
class App {
  /** Current view; mirrored on <body data-view> so CSS can react (e.g. the zoom-out button). */
  get state() { return this._state; }
  set state(v) {
    if (this._state === v) return;
    this._state = v;
    document.body.dataset.view = v;
    bus.emit('view:state', { state: v }); // e.g. Ask Astro steps aside while a timeline plays
  }

  async start() {
    const ui = document.getElementById('ui');
    this.ui = ui;
    this.loader = new Loader(ui);
    document.title = APP.name;

    if (!this.#webglOk()) return this.loader.error(STRINGS.webglError);

    this.sm = new SceneManager(document.getElementById('stage'));
    this.assets = new AssetLoader(this.sm.renderer);
    this.assets.onProgress((f) => this.loader.progress(f * 0.95));
    this.store = new DataStore();

    try {
      this.system = new SolarSystem(this.sm.scene, this.assets);
      await Promise.all([this.store.load(), this.system.build()]);
      performance.mark('ct:assets-loaded');
    } catch (e) {
      console.error(e);
      return this.loader.error(e.message?.includes('machines') || e.message?.includes('data') ? STRINGS.dataError : `${STRINGS.dataError} (${e.message})`);
    }

    const scene = this.sm.scene;
    const stars = createStarfield();
    const belt = createAsteroidBelt(DEEP_SPACE.asteroidBelt.inner, DEEP_SPACE.asteroidBelt.outer);
    const dust = createSpaceDust();
    scene.add(stars, belt, dust);

    this.director = new CameraDirector(this.sm.camera, this.sm.controls);
    this.markers = new MachineMarkers({
      scene, camera: this.sm.camera, renderer: this.sm.renderer, dom: this.sm.labels.domElement,
      system: this.system, loader: this.assets, store: this.store,
    });
    this.markers.build();
    performance.mark('ct:markers-built');

    // places the header search can fly to (planets, the Moon, Eros, Deep Space)
    const places = [
      ...BODIES.filter((b) => b.kind !== 'star').map((b) => ({ id: b.id, name: b.name })),
      { id: 'eros', name: DEEP_SPACE.eros.name },
      { id: 'deepspace', name: STRINGS.deepSpace },
    ];
    this.header = new Header(ui, this.store, places);
    this.zoomOut = new ZoomOutButton(ui);
    this.astro = new AstroChat(ui, this.store); // "Ask Astro": answers only from data-raw/rag/Data.zip
    this.card = new CosmicCard(ui, this.store);
    this.narrator = new Narrator();
    this.saved = new SavedStore();
    this.timeline = new Timeline(ui, this.store, this.narrator, this.saved);
    this.gallery = new Gallery(ui);
    this.savedPanel = new SavedPanel(ui, this.store, this.saved);
    this.header.setSavedCount(this.saved.count);
    bus.on('saved:changed', ({ count }) => this.header.setSavedCount(count));
    this.deepPanel = new DeepSpacePanel(ui, this.store);
    this.bar = new BodyMachinesBar(ui, this.store);
    this.synth = new AmbientSynth();
    this.#initSound();

    this.sm.onUpdate((dt, t) => {
      this.system.update(dt);
      this.markers.update(dt, t);
      stars.userData.update(t); belt.userData.update(t); dust.userData.update(t);
      this.director.update();
    });

    this.#bindEvents();
    const [px, py, pz] = VIEWS.home.position;
    this.sm.camera.position.set(px * 2.2, py * 2.6, pz * 2.2);
    this.sm.controls.target.set(0, 0, 0);
    // Compile every shader before the first frame, in parallel where the GPU
    // driver allows (KHR_parallel_shader_compile) — otherwise the first frame
    // freezes the page while they compile one by one. Capped so a slow
    // driver can never hold the loading screen.
    this.loader.progress(0.97);
    await Promise.race([
      this.sm.renderer.compileAsync(scene, this.sm.camera).catch(() => {}),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
    performance.mark('ct:shaders-ready');
    this.sm.start();
    this.loader.done();
    performance.mark('ct:loader-done');
    requestAnimationFrame(() => requestAnimationFrame(() => performance.mark('ct:first-frame')));

    // deep link: #machine=<id>  or  #view=moon|mars|deepspace
    const hash = new URLSearchParams(location.hash.slice(1));
    if (hash.get('machine') && this.store.get(hash.get('machine'))) bus.emit('machine:select', { id: hash.get('machine'), source: 'link' });
    else if (hash.get('view') === 'deepspace') bus.emit('view:deepspace');
    else if (hash.get('view')) bus.emit('view:body', { id: hash.get('view') });
    else this.goHome({ duration: 3.2 });
    setTimeout(() => { if (this.state === 'home') toast(ui, `${STRINGS.hint}. ${STRINGS.stylisedScale}`, 7000); }, 1800);
    // Background work after the first view is up, one thing at a time so it
    // never competes with what the user is looking at: sharper 2K planet
    // textures → the narration list → the lander/rover models.
    setTimeout(async () => {
      await this.system.upgradeTextures();
      await this.narrator.ready();
      for (const url of ['models/apollo_lm.glb', 'models/mars_rover.glb']) await this.assets.model(url, true).catch(() => {});
    }, 1500);
  }

  #webglOk() {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
  }

  // ------------------------------------------------------------ events
  #bindEvents() {
    bus.on('view:home', () => this.goHome());
    bus.on('view:body', ({ id }) => this.goBody(id));
    bus.on('view:deepspace', () => this.goDeepSpace());
    bus.on('machine:select', ({ id, timelineIndex }) => this.selectMachine(id, { timelineIndex }));
    bus.on('card:close', () => this.#afterCardClose());
    // timeline text + photo sit on the right, so shift the 3D view left: the machine stays in sight
    bus.on('timeline:open', ({ id, index }) => { this.card.hide(); this.#frame(window.innerWidth > 760 ? 0.24 : 0, window.innerWidth > 760 ? 0 : 0.22); this.timeline.open(id, index); this.state = 'timeline'; });
    bus.on('timeline:close', ({ id, toCard }) => {
      if (toCard) { this.#frame(0.2); this.card.open(id); this.state = 'machine'; } else this.#afterCardClose();
    });
    bus.on('sound:toggle', () => this.#setSound(!this.synth.on, true));
    bus.on('card:open', () => this.synth.blip(990));
    bus.on('timeline:event', () => this.synth.blip(660));
    // music dips under the narrator's voice
    bus.on('narration:state', ({ state }) => this.synth.duck(state === 'playing' || state === 'loading' ? APP.narration.duckTo : 1));

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'Escape') {
        if (this.timeline.isOpen || this.gallery.isOpen || this.savedPanel.isOpen) return; // they handle their own Escape
        if (this.card.isOpen) this.card.close();
        else if (this.deepPanel.isOpen) this.deepPanel.close();
        else if (this.state !== 'home') this.goHome();
      }
      if ((e.key === 'h' || e.key === 'H') && !e.ctrlKey && !e.metaKey && !e.target.closest?.('select, textarea, .modal-overlay')) this.goHome();
    });
  }

  #closeOverlays() {
    // the start-up hint should not sit on top of the machine bar
    this.ui.querySelectorAll('.toast').forEach((t) => gsap.to(t, { opacity: 0, duration: 0.3, onComplete: () => t.remove() }));
    if (this.timeline.isOpen) this.timeline.close();
    if (this.card.isOpen) this.card.close({ silent: true });
    this.deepPanel.close();
  }

  #setHash(v) { history.replaceState(null, '', v ? `#${v}` : location.pathname + location.search); }

  /**
   * Shift the 3D view sideways/up (camera view offset) so the focused object
   * is not hidden under the card / timeline panel.
   */
  #frame(shiftX = 0, shiftY = 0) {
    const cam = this.sm.camera;
    const st = (this._frame ||= { x: 0, y: 0 });
    gsap.to(st, {
      x: shiftX, y: shiftY, duration: 1.2, ease: 'power2.inOut',
      onUpdate: () => {
        const w = window.innerWidth, h = window.innerHeight;
        if (Math.abs(st.x) < 1e-3 && Math.abs(st.y) < 1e-3) cam.clearViewOffset();
        else cam.setViewOffset(w, h, st.x * w, st.y * h, w, h);
      },
    });
  }

  /** Slow time down near bodies so planets don't drift out of frame. */
  #timeScale(v) { gsap.to(this.system, { timeScale: v, duration: 1.2 }); }

  // ------------------------------------------------------------ views
  goHome({ duration = 2.4 } = {}) {
    this.#closeOverlays();
    this.sm.setCloseUp(null);
    this.bar.hide();
    this.state = 'home';
    this.system.setFocus(null);
    this.system.setLabelsVisible(true);
    this.markers.setMode('home');
    this.markers.setSelected(null);
    this.header.setActive('home');
    this.#frame(0);
    this.#timeScale(1);
    this.#setHash('');
    this.director.flyTo({
      target: () => new THREE.Vector3(...VIEWS.home.target),
      offset: new THREE.Vector3(...VIEWS.home.position),
      duration, minDistance: 8, maxDistance: 420,
    });
  }

  goBody(id) {
    const body = this.system.get(id);
    if (!body) return;
    this.#closeOverlays();
    this.sm.setCloseUp(null);
    this.state = 'body';
    this.system.setFocus(id);
    this.system.setLabelsVisible(false);
    this.markers.setMode('body', id);
    this.markers.setSelected(null);
    this.header.setActive(id);
    this.#frame(0, 0.05);
    this.#timeScale(0.03);
    this.#setHash(`view=${id}`);
    const machines = this.store.onBody(id);
    this.bar.hide();

    const dir = this.#presentBody(id, machines);
    // a deep zoom: the planet fills most of the screen
    const d = body.radius * (body.cfg.focus || 4) * (machines.length ? 0.8 : 1);
    arrival(this.director.flyTo({
      target: () => this.system.worldPosition(id),
      offset: dir.multiplyScalar(d),
      duration: 2.6, minDistance: body.radius * 1.15, maxDistance: body.radius * 14,
    }), 3.6).then(() => {
      // only once the zoom has finished: offer the machines that live here
      if (this.state === 'body' && this.system.focusedId === id && machines.length) this.bar.show(id, body.cfg.name);
    });
  }

  /**
   * Turn a body so its machines face the camera and are sunlit (stylised —
   * like a planetarium operator nudging the globe). Returns the camera
   * direction (unit vector, world).
   */
  #presentBody(id, machines, focusLon = null) {
    const body = this.system.get(id);
    const pos = this.system.worldPosition(id);
    const toSun = pos.clone().negate().normalize();
    if (id === 'moon') {
      // Put the Moon on the far side of Earth (a gibbous "full-ish" Moon) so
      // its near side — where every Apollo site is — faces both Earth and Sun.
      const earth = this.system.get('earth').anchor.position;
      const cfg = body.cfg;
      const want = Math.atan2(earth.z, earth.x) + 0.55;
      const now = cfg.phase + (this.system.time / cfg.period) * TAU;
      gsap.to(cfg, { phase: cfg.phase + (shortestAngle(now, want) - now), duration: 2.2, ease: 'power2.inOut' });
      const moonDirFromEarth = new THREE.Vector3(Math.cos(want), 0, Math.sin(want));
      return moonDirFromEarth.negate().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.35).add(new THREE.Vector3(0, 0.28, 0)).normalize();
    }
    const dir = toSun.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.5).add(new THREE.Vector3(0, 0.25, 0)).normalize();
    if (body.cfg.spin && !body.cfg.tidallyLocked) {
      const lons = machines.map((m) => this.markers.markers.get(m.id)?.site?.lon).filter((v) => v != null);
      const L = focusLon ?? (lons.length ? lons.reduce((a, b) => a + b, 0) / lons.length : 0);
      // rotation φ about +Y moves longitude L to azimuth L+φ; aim it at the camera
      const psi = Math.atan2(-dir.z, dir.x);
      const target = psi - (L * Math.PI) / 180;
      gsap.to(body, { spinAngle: shortestAngle(body.spinAngle, target), duration: 2.2, ease: 'power2.inOut', onUpdate: () => { body.spin.rotation.y = body.spinAngle; } });
    }
    return dir;
  }

  goDeepSpace() {
    this.#closeOverlays();
    this.sm.setCloseUp(null);
    this.bar.hide();
    this.state = 'deepspace';
    this.system.setFocus(null);
    this.system.setLabelsVisible(true);
    this.markers.setMode('deepspace');
    this.markers.setSelected(null);
    this.header.setActive('deepspace');
    this.#frame(-0.12);
    this.#timeScale(0.25);
    this.#setHash('view=deepspace');
    arrival(this.director.flyTo({
      target: () => new THREE.Vector3(...VIEWS.deepSpace.target),
      offset: new THREE.Vector3(...VIEWS.deepSpace.position).sub(new THREE.Vector3(...VIEWS.deepSpace.target)),
      duration: 2.6, minDistance: 6, maxDistance: 300,
    }), 3.6).then(() => { if (this.state === 'deepspace') this.deepPanel.open(); });
  }

  /**
   * Fly deep into a machine, then — only once the camera has arrived — show
   * its Cosmic Card (or jump straight into its timeline at `timelineIndex`,
   * e.g. from a "timeline moment" search result).
   */
  async selectMachine(id, { timelineIndex = null } = {}) {
    const m = this.store.get(id);
    if (!m) return;
    if (this.timeline.isOpen) this.timeline.close();
    this.deepPanel.close();
    this.state = 'machine';
    this.markers.setSelected(id);
    this.markers.setMode('machine');
    this.#setHash(`machine=${id}`);
    const f = this.markers.focusFor(id);
    const host = f.host;
    this.header.setActive(m.body === 'deep-space' ? 'deepspace' : m.body);
    this.system.setFocus(host);
    this.system.setLabelsVisible(false);
    this.#timeScale(host ? 0.02 : 0.08);
    if (host && this.store.onBody(host).length) this.bar.show(host, this.system.get(host).cfg.name); else this.bar.hide();

    let flight;
    if (host && !this.system.get(host).decorative) {
      // turn the planet first, then recompute the offset along the site normal
      this.#presentBody(host, [m], this.markers.markers.get(id).site.lon);
      flight = new Promise((r) => setTimeout(r, 50)).then(() => {
        const mk = this.markers.markers.get(id);
        const body = this.system.get(host);
        const focus = this.markers.closeUpFor(id);
        // aim at the middle of the machine (not its feet), as close as it stays whole on screen
        const target = focus ? () => focus.center().clone() : () => mk.group.getWorldPosition(new THREE.Vector3());
        return this.director.flyTo({
          target,
          offset: this.#siteOffset(host, mk),
          duration: 2.8, minDistance: mk.size * 1.3, maxDistance: body.radius * 10,
        });
      });
    } else {
      flight = this.director.flyTo({ ...f, duration: 2.4 });
    }
    this.#frame(window.innerWidth > 900 ? 0.2 : 0, window.innerWidth > 900 ? 0 : 0.18);
    // close-up realism: a shadow-casting key light from the Sun's side and a very slow orbit
    this.sm.setCloseUp(host ? this.markers.closeUpFor(id) : null);
    await arrival(flight, 3.8);
    if (this.state !== 'machine' || this.markers.selected !== id) return; // user moved on mid-flight
    if (timelineIndex != null) bus.emit('timeline:open', { id, index: timelineIndex });
    else this.card.open(id);
  }

  /** Camera offset that looks at a surface site from above-and-beside. */
  #siteOffset(host, mk) {
    const body = this.system.get(host);
    // orientation the body will have once the "present" tween ends
    const q = new THREE.Quaternion();
    if (host === 'moon') {
      const earth = this.system.get('earth').anchor.position;
      const want = Math.atan2(earth.z, earth.x) + 0.55;
      const moonPos = new THREE.Vector3(Math.cos(want), 0, Math.sin(want)).multiplyScalar(body.cfg.orbit).add(earth);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-(earth.z - moonPos.z), earth.x - moonPos.x));
    } else {
      const pos = this.system.worldPosition(host);
      const dir = pos.clone().negate().normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.5);
      const psi = Math.atan2(-dir.z, dir.x);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), psi - (mk.site.lon * Math.PI) / 180);
    }
    const n = mk.normal.clone().applyQuaternion(q);
    const side = new THREE.Vector3(0, 1, 0).cross(n);
    if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
    side.normalize();
    // a low, three-quarter "hero" angle (about 30° above the ground), close enough that the machine
    // fills roughly half the screen height while staying fully in view
    const d = mk.size * 3.2;
    return n.multiplyScalar(d * 0.5).addScaledVector(side, d * 0.86);
  }

  #afterCardClose() {
    this.#frame(0);
    this.sm.setCloseUp(null);
    const m = this.store.get(this.markers.selected);
    this.markers.setSelected(null);
    if (m && m.body !== 'deep-space') { this.state = 'body'; this.markers.setMode('body', m.anchor || m.body); this.#setHash(`view=${m.body}`); }
    else if (m) { this.goDeepSpace(); }
  }

  // ------------------------------------------------------------ sound
  #initSound() {
    const saved = localStorage.getItem(APP.storageKeys.sound) === 'on';
    this.header.setSound(false);
    if (saved) {
      // autoplay rules: wait for the first user gesture, then honour the saved choice
      const start = () => { this.#setSound(true, false); window.removeEventListener('pointerdown', start); window.removeEventListener('keydown', start); };
      window.addEventListener('pointerdown', start, { once: true });
      window.addEventListener('keydown', start, { once: true });
    }
  }

  #setSound(on, persist) {
    this.synth.setOn(on).catch(() => {});
    this.header.setSound(on);
    if (persist) localStorage.setItem(APP.storageKeys.sound, on ? 'on' : 'off');
  }
}

new App().start();
