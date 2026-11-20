import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { DEEP_SPACE } from '../config/bodies.js';
import { STRINGS } from '../config/app.config.js';
import { latLonToCanonical, angularDistance, hash01 } from './geo.js';
import { makeMarkerShape } from './markerShapes.js';
import { glowTexture } from './proceduralTextures.js';
import { bus } from '../core/EventBus.js';

const MODEL_URLS = { apollo_lm: 'models/apollo_lm.glb', mars_rover: 'models/mars_rover.glb' };
const COLORS = { moon: '#9fd8ff', mars: '#ffb27a', 'deep-space': '#c6a8ff' };
/** Machines are drawn hugely enlarged (a real lander would be invisible at planet scale). */
const SURFACE_SIZE = 0.055; // machine height as a fraction of the host body radius
const MIN_SEPARATION_DEG = 7; // markers closer than this get nudged apart (display only)

const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _c = new THREE.Vector3();

/**
 * One clickable marker per machine (data-driven: reads DataStore only).
 * A marker = 3D model (supplied GLB or stylised shape) + glowing beacon
 * sprite + an accessible HTML label button. Hover = glow + label + pointer.
 */
export class MachineMarkers {
  constructor({ scene, camera, renderer, dom, system, loader, store }) {
    Object.assign(this, { scene, camera, renderer, dom, system, loader, store });
    this.markers = new Map();
    this.hitTargets = [];
    this.hovered = null;
    this.selected = null;
    this.mode = { view: 'home', body: null };
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(9, 9);
    this.pointerDirty = false;
    this.roamRoot = new THREE.Group();
    scene.add(this.roamRoot);
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; // reflections for metal parts only
    this.beaconTex = glowTexture('rgba(255,255,255,1)');
    this.#bindPointer();
  }

  build() {
    const placed = { moon: [], mars: [] };
    for (const m of this.store.all()) {
      const host = m.anchor || (m.body === 'deep-space' ? null : m.body);
      const marker = { machine: m, host, group: new THREE.Group(), color: new THREE.Color(COLORS[m.body] || '#ffffff') };
      marker.group.name = `machine-${m.id}`;
      marker.group.userData.machineId = m.id;

      if (host && this.system.get(host)) {
        const body = this.system.get(host);
        let site = m.location?.lat != null ? { lat: m.location.lat, lon: m.location.lon } : null;
        marker.approximate = !site;
        if (!site) site = body.cfg.fallbackSite || { lat: 20 + hash01(m.id) * 20, lon: -60 + hash01(m.id, 3) * 120 };
        site = this.#declutter(site, placed[host] ||= []);
        placed[host].push(site);
        marker.site = site;
        const normal = latLonToCanonical(site.lat, site.lon);
        marker.normal = normal.clone();
        marker.group.position.copy(normal).multiplyScalar(body.radius);
        marker.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
        marker.size = body.radius * (body.decorative ? 0.35 : SURFACE_SIZE);
        body.surface.add(marker.group);
      } else {
        // free-roaming deep-space machine: decorative drifting path
        marker.roam = { phase: hash01(m.id) * Math.PI * 2, r: DEEP_SPACE.roam.radius * (0.9 + hash01(m.id, 7) * 0.25) };
        marker.size = 0.9;
        this.roamRoot.add(marker.group);
      }

      this.#addVisual(marker);
      this.#addBeacon(marker);
      this.#addLabel(marker);
      if (m.orbiter && host) this.#addOrbiter(marker);
      this.markers.set(m.id, marker);
    }
    this.#refreshVisibility();
  }

  /** Nudge a site away from already-placed ones so markers stay clickable. */
  #declutter(site, others) {
    let s = { ...site };
    for (let iter = 0; iter < 12; iter++) {
      const close = others.find((o) => angularDistance(o, s) < MIN_SEPARATION_DEG);
      if (!close) break;
      const dLat = s.lat - close.lat, dLon = s.lon - close.lon;
      const len = Math.hypot(dLat, dLon) || 1;
      const ux = len < 0.5 ? 0 : dLon / len, uy = len < 0.5 ? 1 : dLat / len;
      s = { lat: s.lat + uy * MIN_SEPARATION_DEG * 0.6, lon: s.lon + ux * MIN_SEPARATION_DEG * 0.6 };
    }
    return s;
  }

  #addVisual(marker) {
    const holder = new THREE.Group();
    holder.scale.setScalar(marker.size);
    marker.group.add(holder);
    marker.visual = holder;
    const m = marker.machine;
    const placeholder = makeMarkerShape(m.markerShape);
    this.#prepMaterials(placeholder);
    holder.add(placeholder);
    if (m.model && MODEL_URLS[m.model]) {
      // lazy: the heavy GLB replaces the stand-in once it arrives
      marker.loadModel = () => {
        if (marker.modelRequested) return;
        marker.modelRequested = true;
        this.loader.model(MODEL_URLS[m.model], true).then((gltf) => {
          const obj = gltf.scene.clone(true);
          this.#prepMaterials(obj);
          obj.rotation.y = hash01(m.id, 11) * Math.PI * 2;
          placeholder.removeFromParent();
          holder.add(obj);
        }).catch((e) => console.warn(`[markers] model for ${m.id} failed, keeping stand-in`, e));
      };
    }
    // generous invisible hit-sphere so small machines are easy to click
    const hit = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.5;
    hit.userData.machineId = m.id;
    holder.add(hit);
    this.hitTargets.push(hit);
  }

  #prepMaterials(obj) {
    obj.traverse((o) => {
      if (!o.isMesh) return;
      // the close-up key light (SceneManager.setCloseUp) casts the machine's soft shadow onto the ground
      // (models do not receive shadows themselves: self-shadowing at this tiny scale only adds speckles)
      o.castShadow = true;
      for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
        if (mat.isMeshStandardMaterial) { mat.envMap = this.envMap; mat.envMapIntensity = 1.1; mat.needsUpdate = true; }
      }
    });
  }

  /** What the close-up camera and key light aim at: the middle of the machine, its "up", its size. */
  closeUpFor(id) {
    const mk = this.markers.get(id);
    if (!mk?.host || !mk.visual) return null;
    const c = new THREE.Vector3(), q = new THREE.Quaternion();
    return {
      center: () => mk.visual.localToWorld(c.set(0, 0.55, 0)),
      normal: () => new THREE.Vector3(0, 1, 0).applyQuaternion(mk.visual.getWorldQuaternion(q)),
      size: mk.size,
    };
  }

  #addBeacon(marker) {
    const mat = new THREE.SpriteMaterial({ map: this.beaconTex, color: marker.color.clone().multiplyScalar(0.75), transparent: true, opacity: 0.85, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, sizeAttenuation: false });
    const s = new THREE.Sprite(mat);
    s.scale.setScalar(0.022);
    s.position.y = marker.host ? 1.6 * marker.size : 0;
    s.userData.machineId = marker.machine.id;
    s.renderOrder = 5;
    marker.group.add(s);
    marker.beacon = s;
    this.hitTargets.push(s);
  }

  #addLabel(marker) {
    const m = marker.machine;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `machine-label body-${m.body}`;
    el.innerHTML = `<span class="dot" aria-hidden="true"></span><span class="txt"></span>`;
    el.querySelector('.txt').textContent = m.shortName || m.name;
    el.setAttribute('aria-label', `${m.name} — open Cosmic Card${marker.approximate ? '. ' + STRINGS.approxPosition : ''}`);
    if (marker.approximate) el.title = STRINGS.approxPosition;
    el.addEventListener('click', (e) => { e.stopPropagation(); bus.emit('machine:select', { id: m.id, source: 'marker' }); });
    el.addEventListener('pointerenter', () => this.#setHover(m.id));
    el.addEventListener('pointerleave', () => this.#setHover(null));
    const obj = new CSS2DObject(el);
    obj.center.set(0.5, 1.25);
    obj.position.y = marker.host ? 1.7 * marker.size : 0.6;
    marker.group.add(obj);
    marker.label = obj;
    marker.labelEl = el;
  }

  /** Viking-style orbiter: a second marker circling the planet (same machine). */
  #addOrbiter(marker) {
    const body = this.system.get(marker.host);
    const pivot = new THREE.Group();
    pivot.rotation.z = 0.35;
    const ship = makeMarkerShape('orbiter');
    this.#prepMaterials(ship);
    ship.scale.setScalar(body.radius * 0.07);
    ship.position.x = body.radius * 1.6;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.beaconTex, color: marker.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false }));
    s.scale.setScalar(0.014);
    s.position.copy(ship.position);
    s.userData.machineId = marker.machine.id;
    pivot.add(ship, s);
    body.anchor.add(pivot);
    this.hitTargets.push(s);
    marker.orbiter = { pivot, sprite: s };
  }

  // ------------------------------------------------------------ interaction
  #bindPointer() {
    const el = this.dom;
    let down = null;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.pointerDirty = true;
    });
    el.addEventListener('pointerleave', () => { this.pointer.set(9, 9); this.pointerDirty = true; });
    el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return; // was a drag
      const id = this.#pick();
      if (id) bus.emit('machine:select', { id, source: 'marker' });
      else {
        // clicking a planet itself (not only its name chip) flies to it
        const body = this.#pickBody();
        if (body) bus.emit('view:body', { id: body });
      }
      down = null;
    });
  }

  #pick() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.hitTargets.filter((o) => this.#isPickable(o)), false);
    return hits[0]?.object.userData.machineId || null;
  }

  /** Planet under the pointer (not the Sun, not the one already in focus). */
  #pickBody() {
    if (this.mode?.view === 'machine') return null;
    const meshes = [];
    for (const b of this.system.bodies.values()) if (b.cfg.id !== 'sun' && b.cfg.id !== this.mode?.body && b.mesh) meshes.push(b.mesh);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObjects(meshes, false)[0]?.object.userData.bodyId || null;
  }

  #isPickable(o) {
    const marker = this.markers.get(o.userData.machineId);
    return marker && marker.group.visible && !marker.hiddenBehind;
  }

  #setHover(id) {
    if (this.hovered === id) return;
    this.hovered = id;
    this.dom.style.cursor = id ? 'pointer' : '';
    bus.emit('machine:hover', { id });
    this.#refreshVisibility();
  }

  // ------------------------------------------------------------ view state
  setMode(view, body = null) {
    this.mode = { view, body };
    for (const mk of this.markers.values()) {
      const near = (view === 'body' && (mk.host === body || mk.machine.body === body)) || (view === 'deepspace' && mk.machine.body === 'deep-space');
      if (near && mk.loadModel) mk.loadModel();
    }
    this.#refreshVisibility();
  }

  setSelected(id) {
    this.selected = id;
    const mk = this.markers.get(id);
    mk?.loadModel?.();
    this.#refreshVisibility();
  }

  #labelWanted(mk) {
    const { view, body } = this.mode;
    if (mk.machine.id === this.hovered || mk.machine.id === this.selected) return true;
    if (view === 'body') return mk.host === body;
    if (view === 'deepspace') return mk.machine.body === 'deep-space';
    if (view === 'machine') return mk.host && mk.host === this.markers.get(this.selected)?.host;
    return false;
  }

  #refreshVisibility() {
    for (const mk of this.markers.values()) {
      mk.labelWanted = this.#labelWanted(mk);
      mk.labelEl.classList.toggle('is-hover', mk.machine.id === this.hovered);
      mk.labelEl.classList.toggle('is-selected', mk.machine.id === this.selected);
    }
  }

  /** Where the camera should go to look at a machine. */
  focusFor(id) {
    const mk = this.markers.get(id);
    if (!mk) return null;
    const target = () => mk.group.getWorldPosition(new THREE.Vector3());
    if (mk.host) {
      const body = this.system.get(mk.host);
      let worldNormal = mk.normal.clone().applyQuaternion(body.surface.getWorldQuaternion(new THREE.Quaternion()));
      // small decorative bodies: always look from the sunlit side
      if (body.decorative) worldNormal = body.anchor.getWorldPosition(new THREE.Vector3()).negate().normalize().lerp(worldNormal, 0.25).normalize();
      const side = new THREE.Vector3(0, 1, 0).cross(worldNormal).normalize();
      if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
      const d = body.decorative ? body.radius * 6 : body.radius * 1.15;
      const offset = worldNormal.multiplyScalar(d).addScaledVector(side, d * 0.55).add(new THREE.Vector3(0, d * 0.25, 0));
      return { target, offset, minDistance: body.radius * 0.12, maxDistance: body.radius * 8, host: mk.host };
    }
    return { target, offset: new THREE.Vector3(2.2, 1.1, 2.6), minDistance: 0.6, maxDistance: 40, host: null };
  }

  // ------------------------------------------------------------ per frame
  update(dt, t) {
    const roam = DEEP_SPACE.roam;
    for (const mk of this.markers.values()) {
      if (mk.roam) {
        const a = mk.roam.phase + (t / roam.period) * Math.PI * 2;
        mk.group.position.set(Math.cos(a) * mk.roam.r, Math.sin(a * 2.3) * roam.height, Math.sin(a) * mk.roam.r);
        mk.visual.rotation.y = t * 0.15;
        mk.visual.rotation.z = Math.sin(t * 0.3) * 0.2;
      }
      if (mk.orbiter) mk.orbiter.pivot.rotation.y = t * 0.35;

      // hide markers on the far side of their planet
      mk.hiddenBehind = false;
      if (mk.host) {
        mk.group.getWorldPosition(_v);
        const body = this.system.get(mk.host);
        body.anchor.getWorldPosition(_c);
        _n.subVectors(_v, _c).normalize();
        const toCam = this.camera.position.clone().sub(_v).normalize();
        mk.hiddenBehind = _n.dot(toCam) < 0.05;
      }
      const pulse = 1 + Math.sin(t * 3 + mk.machine.id.length) * 0.18;
      const hot = mk.machine.id === this.hovered || mk.machine.id === this.selected;
      mk.beacon.scale.setScalar((hot ? 0.032 : 0.017) * pulse);
      mk.beacon.visible = !mk.hiddenBehind;
      mk.label.visible = mk.labelWanted && !mk.hiddenBehind;
    }
    if (this.pointerDirty) {
      this.pointerDirty = false;
      const id = this.#pick();
      this.#setHover(id);
      if (!id) this.dom.style.cursor = this.#pickBody() ? 'pointer' : '';
    }
  }
}
