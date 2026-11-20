import * as THREE from 'three';
import gsap from 'gsap';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RENDER } from '../config/app.config.js';

/**
 * Owns the renderer, camera, controls, post-processing and the frame loop.
 * Also watches the frame rate and degrades gracefully (lower pixel ratio,
 * then no bloom) on slower machines.
 */
export class SceneManager {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.pixelRatio = Math.min(window.devicePixelRatio, RENDER.maxPixelRatio);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    // soft shadows, used only for the machine close-up (see setCloseUp)
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label', 'Interactive 3D solar system');

    this.labels = new CSS2DRenderer();
    this.labels.setSize(window.innerWidth, window.innerHeight);
    this.labels.domElement.className = 'label-layer';
    container.appendChild(this.labels.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#03040a');
    // Lighting: the Sun (a point light in SolarSystem) does the real work. Two
    // gentle helpers keep every planet readable from any angle without making
    // it look flat: a cool ambient fill, and a weak "headlight" that rides on
    // the camera so the side you look at is never pitch black — like the
    // earthshine / scattered light in real space photos. (Rim glow per body:
    // SolarSystem.js.)
    this.scene.add(new THREE.AmbientLight('#8592bd', RENDER.ambient));
    // a soft sky/ground fill: lighter from above, faintly warm from below — no side is ever pitch black
    this.scene.add(new THREE.HemisphereLight('#c9d6ff', '#3a2c26', RENDER.hemi));

    // Close-up "key" light: when a machine is selected it lights the model from
    // the Sun's side (a little from above) and casts soft shadows onto the model
    // and the ground under it. It always exists (so shaders are compiled once at
    // start-up) but is dark, and its shadow map is not re-rendered, until needed.
    this.keyLight = new THREE.DirectionalLight('#fff3e0', 0);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.bias = -0.0004;
    this.keyLight.shadow.radius = 3;
    this.scene.add(this.keyLight, this.keyLight.target);
    this.closeUp = null;

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.005, 6000);
    this.headlight = new THREE.DirectionalLight('#d6deff', RENDER.headlight);
    this.headlight.position.set(0, 0, 0);
    this.headlight.target.position.set(0, 0, -1);
    this.camera.add(this.headlight, this.headlight.target);
    this.scene.add(this.camera); // the camera must be in the scene for its child light to count
    this.controls = new OrbitControls(this.camera, this.labels.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.rotateSpeed = 0.55;
    this.controls.zoomSpeed = 0.9;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 420;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const b = RENDER.bloom;
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), b.strength, b.radius, b.threshold);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.clock = new THREE.Clock();
    this.updaters = new Set();
    this.#fps = { frames: 0, time: 0, level: 0 };
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.clock.getDelta(); });
  }

  #fps;

  onUpdate(fn) { this.updaters.add(fn); return () => this.updaters.delete(fn); }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.labels.setSize(w, h);
  }

  start() {
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.1);
      const t = this.clock.elapsedTime;
      for (const fn of this.updaters) fn(dt, t);
      this.#updateCloseUp(dt);
      this.controls.update();
      if (this.bloomEnabled !== false) this.composer.render(); else this.renderer.render(this.scene, this.camera);
      this.labels.render(this.scene, this.camera);
      this.#watchPerformance(dt);
    };
    loop();
  }

  /**
   * Machine close-up: aim the shadow-casting key light at `focus` and orbit
   * the camera very slowly (stops while the user drags, resumes after a pause).
   * focus = { center(): Vector3, normal(): Vector3, size } or null to switch off.
   */
  setCloseUp(focus) {
    this.closeUp = focus;
    gsap.to(this.keyLight, { intensity: focus ? RENDER.keyLight : 0, duration: 1.2, ease: 'power2.out' });
    // in a close-up the key light models the machine; the flat camera headlight steps back so it does not wash it out
    gsap.to(this.headlight, { intensity: focus ? RENDER.headlight * RENDER.closeUpHeadlight : RENDER.headlight, duration: 1.2, ease: 'power2.out' });
    this.controls.autoRotate = false;
    clearTimeout(this.autoTimer);
    if (focus) this.autoTimer = setTimeout(() => { if (this.closeUp === focus) this.#autoRotate(true); }, 2600);
    if (!this.onUserMove) {
      this.onUserMove = () => {
        this.controls.autoRotate = false;
        clearTimeout(this.autoTimer);
        if (this.closeUp) this.autoTimer = setTimeout(() => this.#autoRotate(true), 7000);
      };
      this.controls.addEventListener('start', this.onUserMove);
    }
  }

  #autoRotate(on) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.controls.autoRotate = on;
    this.controls.autoRotateSpeed = RENDER.closeUpOrbitSpeed;
  }

  #updateCloseUp() {
    const f = this.closeUp;
    const L = this.keyLight;
    this.renderer.shadowMap.autoUpdate = L.intensity > 0.01;
    if (!f) return;
    const c = f.center();
    const n = f.normal();
    // from the Sun (at the origin) and from above the ground, so the shadow falls beside the machine
    const toSun = c.clone().negate().normalize();
    const dir = n.clone().multiplyScalar(0.75).addScaledVector(toSun, 0.55).normalize();
    const r = f.size * 4;
    L.position.copy(c).addScaledVector(dir, r * 2.5);
    L.target.position.copy(c);
    const cam = L.shadow.camera;
    cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r; cam.near = r * 0.2; cam.far = r * 5;
    cam.updateProjectionMatrix();
    // bias in world units, scaled to one shadow-map texel at this size (no acne, no floating shadow)
    L.shadow.normalBias = ((2 * r) / L.shadow.mapSize.x) * 1.5;
  }

  /** Graceful fallback: if we cannot hold ~40 fps, trade sharpness for speed. */
  #watchPerformance(dt) {
    const f = this.#fps;
    f.frames++; f.time += dt;
    if (f.time < 3) return;
    const fps = f.frames / f.time;
    f.frames = 0; f.time = 0;
    if (fps < 38 && f.level < 2) {
      f.level++;
      if (f.level === 1) { this.pixelRatio = Math.max(1, this.pixelRatio * 0.7); this.renderer.setPixelRatio(this.pixelRatio); this.composer.setPixelRatio(this.pixelRatio); }
      if (f.level === 2) { this.bloomEnabled = false; this.keyLight.shadow.mapSize.set(512, 512); this.keyLight.shadow.map?.dispose(); this.keyLight.shadow.map = null; }
      console.info(`[perf] ~${fps.toFixed(0)} fps -> quality level ${f.level}`);
    }
  }
}
