import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { planetPixels, fbm, hex, ramp } from './planetPixels.js';

/**
 * Procedural planet textures for the bodies we have no supplied model for
 * (Hard Rule #2: only Moon, Mars, Earth use the user's models).
 *
 * Generating a 1024px map takes ~0.1-0.8 s of pure maths per planet, which used
 * to freeze the loading screen. Now each texture starts as a tiny preview
 * (computed instantly) and the full-size pixels are made in a Web Worker,
 * then swapped into the same texture — the scene never waits for them.
 */
const PREVIEW = 64;
let worker = null;
const pending = new Map(); // recipe -> texture waiting for full-size pixels

function getWorker() {
  if (worker !== null) return worker;
  try {
    worker = new Worker(new URL('./planetWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data: { recipe, width, pixels } }) => fill(pending.get(recipe), pixels, width);
    worker.onerror = (e) => { console.warn('[textures] worker failed, generating on the page', e); worker = false; flushOnPage(); };
  } catch { worker = false; }
  return worker;
}

/** No worker support: generate on the page, one planet per idle slot. */
function flushOnPage() {
  const next = [...pending.entries()].find(([, t]) => !t.userData.full);
  if (!next) return;
  setTimeout(() => {
    const [recipe, tex] = next;
    fill(tex, planetPixels(recipe, tex.userData.width), tex.userData.width);
    flushOnPage();
  }, 60);
}

function fill(tex, pixels, width) {
  if (!tex) return;
  tex.dispose(); // GPU storage is fixed-size: free it so the bigger image re-allocates
  tex.image = { data: pixels, width, height: width / 2 };
  tex.userData.full = true;
  tex.needsUpdate = true;
}

const cache = new Map();

/** Equirectangular texture for a recipe (preview now, full size shortly after). */
export function proceduralPlanetTexture(recipe, width = 512) {
  if (cache.has(recipe)) return cache.get(recipe);
  const tex = new THREE.DataTexture(planetPixels(recipe, PREVIEW), PREVIEW, PREVIEW / 2, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.userData = { width, full: false };
  tex.needsUpdate = true;
  cache.set(recipe, tex);
  pending.set(recipe, tex);
  const w = getWorker();
  if (w) w.postMessage({ recipe, width });
  else flushOnPage();
  return tex;
}

/** Radial ring texture for Saturn (alpha = ring density). */
export function ringTexture() {
  const w = 1024, canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = 4;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, 4);
  for (let i = 0; i < w; i++) {
    const t = i / w;
    let a = 0.25 + 0.75 * fbm(t * 60, 1.3, 2.1, 4);
    if (t > 0.58 && t < 0.63) a *= 0.08; // a dark gap
    if (t < 0.05 || t > 0.97) a *= 0.2;
    const c = ramp([[0, hex('#8c7a5e')], [0.5, hex('#e3d2ad')], [1, hex('#b9a27a')]], fbm(t * 20, 4, 4, 3));
    for (let j = 0; j < 4; j++) {
      const k = (j * w + i) * 4;
      img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = a * 235;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Bumpy, potato-shaped asteroid geometry (used for Eros). */
export function asteroidGeometry(radius = 1, seed = 1) {
  // indexed + merged so normals are smooth (no faceted look)
  let g = new THREE.IcosahedronGeometry(1, 6);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const pos = g.attributes.position, v = new THREE.Vector3();
  const colors = new Float32Array(pos.count * 3);
  const stretch = new THREE.Vector3(1.7, 0.8, 0.85); // Eros-like elongated shape
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const n = fbm(v.x * 1.6 + seed, v.y * 1.6, v.z * 1.6, 5);
    const pits = Math.pow(Math.max(0, fbm(v.x * 4 + seed, v.y * 4, v.z * 4, 3) - 0.5) * 2, 2) * 0.12;
    const waist = 1 - 0.16 * Math.exp(-(v.x * v.x) * 9); // saddle in the middle
    const r = radius * (0.82 + n * 0.32 - pits) * waist;
    const c = ramp([[0, hex('#4f453b')], [0.6, hex('#8d7d68')], [1, hex('#b9a88e')]], fbm(v.x * 6, v.y * 6, v.z * 6, 3) * 0.8 + n * 0.2);
    colors.set([c[0] / 255, c[1] / 255, c[2] / 255], i * 3);
    v.multiplyScalar(r).multiply(stretch);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

/** Soft round glow sprite texture. */
export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.55)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
