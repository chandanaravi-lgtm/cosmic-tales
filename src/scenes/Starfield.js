import * as THREE from 'three';
import { RENDER } from '../config/app.config.js';

/**
 * Background stars on a huge sphere: random colours/sizes, a denser
 * "Milky Way" band, and a gentle GPU twinkle. One draw call.
 */
export function createStarfield(count = RENDER.starCount, radius = 1800) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const palette = [new THREE.Color('#ffffff'), new THREE.Color('#cfe0ff'), new THREE.Color('#ffe9c4'), new THREE.Color('#ffd2b0'), new THREE.Color('#bcd2ff')];
  const bandNormal = new THREE.Vector3(0.3, 1, 0.2).normalize();
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    // ~40% of stars hug a tilted great circle -> Milky Way band
    if (i % 5 < 2) {
      v.randomDirection();
      v.addScaledVector(bandNormal, -v.dot(bandNormal) * (0.86 + Math.random() * 0.14)).normalize();
    } else v.randomDirection();
    v.multiplyScalar(radius * (0.85 + Math.random() * 0.15));
    pos.set([v.x, v.y, v.z], i * 3);
    const c = palette[(Math.random() * palette.length) | 0];
    const b = 0.55 + Math.random() * 0.45;
    col.set([c.r * b, c.g * b, c.b * b], i * 3);
    size[i] = Math.random() < 0.02 ? 3.2 + Math.random() * 2 : 0.8 + Math.pow(Math.random(), 3) * 2.2;
    phase[i] = Math.random() * Math.PI * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('size', new THREE.BufferAttribute(size, 1));
  g.setAttribute('phase', new THREE.BufferAttribute(phase, 1));

  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
    vertexShader: /* glsl */ `
      attribute float size; attribute float phase; varying vec3 vColor; varying float vTw;
      uniform float uTime; uniform float uPixelRatio;
      void main() {
        vColor = color;
        vTw = 0.75 + 0.25 * sin(uTime * (0.6 + fract(phase) * 1.8) + phase * 7.0);
        gl_PointSize = size * uPixelRatio * 1.6;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor; varying float vTw;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vColor * vTw, a * a);
      }`,
    vertexColors: true, transparent: true, depthWrite: false,
  });
  const points = new THREE.Points(g, m);
  points.name = 'starfield';
  points.renderOrder = -10;
  points.frustumCulled = false;
  points.userData.update = (t) => { m.uniforms.uTime.value = t; };
  return points;
}

/** Ring of tiny rocks between Mars and Jupiter (decorative). */
export function createAsteroidBelt(inner, outer, count = RENDER.asteroidBeltCount) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = inner + Math.random() * (outer - inner);
    const a = Math.random() * Math.PI * 2;
    pos.set([Math.cos(a) * r, (Math.random() - 0.5) * 1.4, Math.sin(a) * r], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: '#9c8f80', size: 0.12, sizeAttenuation: true, transparent: true, opacity: 0.7, depthWrite: false });
  const p = new THREE.Points(g, m);
  p.name = 'asteroid-belt';
  p.userData.update = (t) => { p.rotation.y = t * 0.004; };
  return p;
}

/** Slow floating dust motes close to the camera for a sense of depth. */
export function createSpaceDust(count = 500, spread = 160) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) pos.set([(Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread * 0.4, (Math.random() - 0.5) * spread], i * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: '#8fb3ff', size: 0.08, transparent: true, opacity: 0.35, depthWrite: false });
  const p = new THREE.Points(g, m);
  p.name = 'space-dust';
  p.userData.update = (t) => { p.rotation.y = t * 0.002; p.position.y = Math.sin(t * 0.05) * 0.6; };
  return p;
}
