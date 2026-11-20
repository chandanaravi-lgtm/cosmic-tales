import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { BODIES, DEEP_SPACE } from '../config/bodies.js';
import { calibrationQuaternion } from './geo.js';
import { proceduralPlanetTexture, ringTexture, asteroidGeometry, glowTexture } from './proceduralTextures.js';
import { bus } from '../core/EventBus.js';
import { RENDER } from '../config/app.config.js';

const TAU = Math.PI * 2;

/**
 * Copy a loaded mesh's geometry with its node transform baked in.
 * Compressed GLBs (gltfpack/meshopt) store quantised integer vertices plus a
 * node scale/offset to decode them; baking keeps every body a clean unit
 * sphere in its own lat/lon frame no matter how the file was packed.
 */
function bakedGeometry(mesh) {
  mesh.updateWorldMatrix(true, false);
  if (mesh.matrixWorld.equals(new THREE.Matrix4())) return mesh.geometry;
  const g = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(mesh.geometry.attributes)) {
    const f = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent(i, c);
    g.setAttribute(name, new THREE.BufferAttribute(f, a.itemSize));
  }
  g.setIndex(mesh.geometry.index);
  g.applyMatrix4(mesh.matrixWorld);
  mesh.geometry.dispose();
  return g;
}

/** Fresnel rim glow used for Earth's and Mars' thin atmospheres. */
function atmosphereMaterial(color, intensity) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uIntensity: { value: intensity } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uIntensity; varying vec3 vN; varying vec3 vV;
      void main() {
        float f = pow(1.0 - max(dot(vN, vV), 0.0), 3.0);
        gl_FragColor = vec4(uColor * uIntensity, f * uIntensity);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
  });
}

/**
 * Builds and animates the Sun, planets, Moon and the decorative deep-space
 * anchors. Each body:
 *   anchor (world position)  ->  spin (rotation / tidal lock)  ->  mesh
 *                                       └ surface (machine markers live here,
 *                                          in the canonical lat/lon frame)
 */
export class SolarSystem {
  constructor(scene, loader) {
    this.scene = scene;
    this.loader = loader;
    this.root = new THREE.Group();
    this.root.name = 'solar-system';
    scene.add(this.root);
    this.bodies = new Map();
    this.focusedId = null;
    this.time = 0;
    this.timeScale = 1;
    this._releaseTimers = new Map();
  }

  /** Loads the essential (low-res) assets. Returns when the system is visible. */
  async build() {
    const jobs = BODIES.map((cfg) => this.#buildBody(cfg));
    this.#buildDeepSpaceAnchors();
    await Promise.all(jobs);
    this.update(0);
  }

  async #buildBody(cfg) {
    const anchor = new THREE.Group();
    anchor.name = `${cfg.id}-anchor`;
    const spin = new THREE.Group();
    const surface = new THREE.Group(); // canonical frame, radius = cfg.radius
    surface.name = `${cfg.id}-surface`;
    spin.add(surface);
    anchor.add(spin);
    this.root.add(anchor);

    let mesh;
    if (cfg.model) {
      const gltf = await this.loader.model(cfg.model);
      const src = gltf.scene.getObjectByProperty('type', 'Mesh');
      const flip = false; // textures on GLB UVs
      const map = await this.loader.texture(cfg.textures.low, { flipY: flip });
      let mat;
      if (cfg.kind === 'star') {
        mat = new THREE.MeshBasicMaterial({ map, color: new THREE.Color(1.6, 1.25, 0.9) });
      } else {
        mat = new THREE.MeshStandardMaterial({
          map, roughness: cfg.roughness ?? 0.85, metalness: 0,
          bumpMap: cfg.bump ? map : null, bumpScale: cfg.bump ? cfg.bump * 60 : 0,
        });
      }
      mesh = new THREE.Mesh(bakedGeometry(src), mat);
      // align the model's texture with the canonical lat/lon frame
      if (cfg.calibration) mesh.quaternion.copy(calibrationQuaternion(cfg.calibration));
    } else {
      const geo = new THREE.SphereGeometry(1, 96, 64);
      const map = proceduralPlanetTexture(cfg.procedural, cfg.procedural === 'jupiter' || cfg.procedural === 'saturn' ? 1024 : 512);
      mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0 }));
    }
    mesh.scale.setScalar(cfg.radius);
    // the worlds machines stand on catch the close-up shadows
    mesh.receiveShadow = cfg.id === 'moon' || cfg.id === 'mars';
    mesh.name = cfg.id;
    mesh.userData.bodyId = cfg.id;
    spin.add(mesh);
    if (cfg.tilt) spin.rotation.z = cfg.tilt;

    if (cfg.kind === 'star') this.#decorateSun(anchor, cfg);
    if (cfg.atmosphere) {
      const atm = new THREE.Mesh(new THREE.SphereGeometry(cfg.radius * 1.035, 64, 48), atmosphereMaterial(cfg.atmosphere.color, cfg.atmosphere.intensity));
      anchor.add(atm);
    } else if (cfg.kind !== 'star' && RENDER.rimGlow) {
      // airless worlds get only a faint rim so their outline never vanishes into space
      const rim = new THREE.Mesh(new THREE.SphereGeometry(cfg.radius * 1.012, 48, 32), atmosphereMaterial(RENDER.rimGlow.color, RENDER.rimGlow.intensity));
      anchor.add(rim);
    }
    if (cfg.rings) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(cfg.radius * 1.3, cfg.radius * 2.3, 128, 1),
        new THREE.MeshBasicMaterial({ map: ringTexture(), color: '#cfc6b4', transparent: true, side: THREE.DoubleSide, depthWrite: false }),
      );
      // remap UVs radially so the 1D ring texture works
      const uv = ring.geometry.attributes.uv, p = ring.geometry.attributes.position;
      for (let i = 0; i < uv.count; i++) {
        const r = Math.hypot(p.getX(i), p.getY(i));
        uv.setXY(i, (r - cfg.radius * 1.3) / (cfg.radius * 1.0), 0.5);
      }
      ring.rotation.x = -Math.PI / 2 + 0.45;
      anchor.add(ring);
    }
    if (cfg.orbit) this.#orbitLine(cfg);
    this.#label(anchor, cfg);

    this.bodies.set(cfg.id, { cfg, anchor, spin, surface, mesh, radius: cfg.radius, spinAngle: Math.random() * TAU, level: 'low', want: 'low' });
  }

  #decorateSun(anchor, cfg) {
    const light = new THREE.PointLight('#fff4e0', 2.7, 0, 0);
    anchor.add(light);
    const glow = (scale, opacity, color) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(color), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.scale.setScalar(cfg.radius * scale);
      anchor.add(s);
      return s;
    };
    this.sunGlows = [glow(3.4, 0.85, 'rgba(255,190,90,1)'), glow(6.5, 0.16, 'rgba(255,140,60,1)')];
  }

  #orbitLine(cfg) {
    const pts = [];
    for (let i = 0; i <= 256; i++) { const a = (i / 256) * TAU; pts.push(new THREE.Vector3(Math.cos(a) * cfg.orbit, 0, Math.sin(a) * cfg.orbit)); }
    const line = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: cfg.featured ? '#ffb27a' : '#7d93c9', transparent: true, opacity: cfg.featured ? 0.32 : 0.16, depthWrite: false }),
    );
    line.name = `${cfg.id}-orbit`;
    if (cfg.parent) line.userData.parent = cfg.parent;
    this.root.add(line);
    (this.orbitLines ||= []).push(line);
  }

  #label(anchor, cfg) {
    const el = document.createElement('button');
    el.className = `body-label${cfg.featured ? ' is-featured' : ''}`;
    el.type = 'button';
    el.textContent = cfg.name;
    el.setAttribute('aria-label', `Fly to ${cfg.name}`);
    el.addEventListener('click', (e) => { e.stopPropagation(); bus.emit('view:body', { id: cfg.id }); });
    const obj = new CSS2DObject(el);
    obj.position.set(0, cfg.radius * 1.25 + 0.3, 0);
    obj.center.set(0.5, 1);
    anchor.add(obj);
    anchor.userData.label = obj;
  }

  #buildDeepSpaceAnchors() {
    // Eros: procedurally generated asteroid where NEAR Shoemaker landed
    const e = DEEP_SPACE.eros;
    const anchor = new THREE.Group();
    const spin = new THREE.Group();
    const surface = new THREE.Group();
    const mesh = new THREE.Mesh(
      asteroidGeometry(e.radius, 3),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }),
    );
    mesh.userData.bodyId = 'eros';
    spin.add(mesh, surface);
    anchor.add(spin);
    this.root.add(anchor);
    const cfg = { id: 'eros', name: e.name, radius: e.radius, orbit: e.orbit, period: e.period, phase: e.phase, spin: 18, focus: 6, inclination: e.inclination };
    this.#label(anchor, cfg);
    this.bodies.set('eros', { cfg, anchor, spin, surface, mesh, radius: e.radius, spinAngle: 0, decorative: true });
  }

  get(id) { return this.bodies.get(id); }

  worldPosition(id, target = new THREE.Vector3()) {
    return this.bodies.get(id).anchor.getWorldPosition(target);
  }

  /** Freeze spin of the focused body so markers stay put under the camera. */
  setFocus(id) {
    const prev = this.focusedId;
    this.focusedId = id;
    // orbit lines would slice across a planet seen up close
    for (const l of this.orbitLines || []) l.visible = !id;
    if (prev && prev !== id) this.#scheduleRelease(prev);
    if (id) this.setDetail(id, true);
  }

  /**
   * Texture level of detail (see config/bodies.js `textures`):
   *   low  1K — at start-up, so the first view appears fast
   *   mid  2K — swapped in quietly once the scene is visible (upgradeTextures)
   *   high 4K — only while the camera is close to that body
   */
  async setLevel(id, level) {
    const b = this.bodies.get(id);
    const url = b?.cfg.textures?.[level];
    if (!url) return;
    b.want = level;
    if (b.level === level) return;
    try {
      const tex = await this.loader.texture(url, { background: true, flipY: false });
      if (b.want !== level) return; // changed while loading
      const prev = b.level;
      b.mesh.material.map = tex;
      if (b.mesh.material.bumpMap) b.mesh.material.bumpMap = tex;
      b.mesh.material.needsUpdate = true;
      b.level = level;
      // free what we no longer show (the 1K stays tiny; drop 4K when leaving)
      if (prev === 'high') this.loader.releaseTexture(b.cfg.textures.high, false);
    } catch (e) {
      console.warn(`[lod] could not load ${url}`, e);
    }
  }

  /** Close-up (4K) on/off for one body. Off falls back to the 2K tier. */
  setDetail(id, high) {
    const b = this.bodies.get(id);
    if (!b?.cfg.textures) return;
    clearTimeout(this._releaseTimers.get(id));
    return this.setLevel(id, high ? 'high' : (b.cfg.textures.mid ? 'mid' : 'low'));
  }

  /** After the first frame: upgrade every body to its 2K tier, one at a time. */
  async upgradeTextures() {
    for (const [id, b] of this.bodies) {
      if (b.cfg.textures?.mid && b.want === 'low') await this.setLevel(id, 'mid');
    }
  }

  /** Free the 4K texture once the user has been away from a body for a while. */
  #scheduleRelease(id) {
    clearTimeout(this._releaseTimers.get(id));
    this._releaseTimers.set(id, setTimeout(() => this.focusedId !== id && this.setDetail(id, false), RENDER.hiResReleaseDelay * 1000));
  }

  update(dt) {
    this.time += dt * this.timeScale;
    const t = this.time;
    const tmp = new THREE.Vector3();
    for (const b of this.bodies.values()) {
      const c = b.cfg;
      if (c.orbit) {
        const a = c.phase + (t / c.period) * TAU;
        const parentPos = c.parent ? this.bodies.get(c.parent).anchor.position : tmp.set(0, 0, 0);
        b.anchor.position.set(parentPos.x + Math.cos(a) * c.orbit, parentPos.y + Math.sin(a * 1.0) * (c.inclination || 0) * c.orbit, parentPos.z + Math.sin(a) * c.orbit);
      }
      if (c.tidallyLocked && c.parent) {
        // keep longitude 0 (the Moon's near side) facing its planet
        const p = this.bodies.get(c.parent).anchor.position;
        b.spin.rotation.y = Math.atan2(-(p.z - b.anchor.position.z), p.x - b.anchor.position.x);
      } else if (c.spin && this.focusedId !== c.id) {
        b.spinAngle += (dt * this.timeScale * TAU) / c.spin;
        b.spin.rotation.y = b.spinAngle;
      }
    }
    for (const l of this.orbitLines || []) if (l.userData.parent) l.position.copy(this.bodies.get(l.userData.parent).anchor.position);
    if (this.sunGlows) {
      const s = 1 + Math.sin(t * 1.3) * 0.03;
      this.sunGlows[0].scale.setScalar(6 * 3.4 * s);
      this.bodies.get('sun').mesh.rotation.y = t * 0.02;
    }
  }

  /** Show/hide planet name chips (e.g. hide while a card is open). */
  setLabelsVisible(v) {
    for (const b of this.bodies.values()) if (b.anchor.userData.label) b.anchor.userData.label.visible = v;
  }
}
