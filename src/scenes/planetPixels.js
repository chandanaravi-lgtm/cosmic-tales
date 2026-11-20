/**
 * Pure maths for the procedural planet textures — no DOM, no three.js — so it
 * can run inside a Web Worker (scene/planetWorker.js) as well as on the page.
 * Noise is sampled on the 3D unit sphere, so maps are seamless at the date
 * line and do not pinch at the poles.
 */

// ---------- small, fast 3D value noise ----------
const P = new Uint8Array(512);
(() => {
  const p = [...Array(256).keys()];
  let s = 1337;
  for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
})();
const fade = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const X = xi & 255, Y = yi & 255, Z = zi & 255;
  const h = (a, b, c) => P[P[P[a] + b] + c] / 255;
  const u = fade(xf), v = fade(yf), w = fade(zf);
  return lerp(
    lerp(lerp(h(X, Y, Z), h(X + 1, Y, Z), u), lerp(h(X, Y + 1, Z), h(X + 1, Y + 1, Z), u), v),
    lerp(lerp(h(X, Y, Z + 1), h(X + 1, Y, Z + 1), u), lerp(h(X, Y + 1, Z + 1), h(X + 1, Y + 1, Z + 1), u), v),
    w,
  );
}
export function fbm(x, y, z, oct = 5, lac = 2.03, gain = 0.5) {
  let a = 0.5, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, z * f); n += a; a *= gain; f *= lac; }
  return s / n;
}
const mix3 = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
export const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export function ramp(stops, t) {
  t = Math.min(0.9999, Math.max(0, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i], [t1, c1] = stops[i + 1];
    if (t >= t0 && t <= t1) return mix3(c0, c1, (t - t0) / (t1 - t0));
  }
  return stops[stops.length - 1][1];
}

// ---------- recipes: (x,y,z on unit sphere, lat in -1..1) -> [r,g,b] ----------
export const RECIPES = {
  mercury: (x, y, z) => {
    const n = fbm(x * 3, y * 3, z * 3, 6);
    const craters = Math.pow(1 - Math.abs(fbm(x * 9 + 5, y * 9, z * 9, 3) * 2 - 1), 8);
    const v = 0.35 + n * 0.45 - craters * 0.12 + Math.pow(fbm(x * 22, y * 22, z * 22, 2), 3) * 0.2;
    return ramp([[0, hex('#3d3a37')], [0.5, hex('#8b857d')], [1, hex('#cfc8bd')]], v);
  },
  venus: (x, y, z) => {
    const swirl = fbm(x * 1.5 + fbm(x * 3, y * 3, z * 3) * 1.6, y * 4, z * 1.5, 5);
    return ramp([[0, hex('#a7713a')], [0.45, hex('#d9b06b')], [0.75, hex('#f1d9a0')], [1, hex('#fff1cf')]], swirl);
  },
  jupiter: (x, y, z) => {
    const turb = fbm(x * 4, y * 4, z * 4, 5) - 0.5;
    const lat = y + turb * 0.09;
    const band = 0.5 + 0.5 * Math.sin(lat * 22.0 + Math.sin(lat * 7) * 1.4);
    const fine = fbm(x * 2, y * 40, z * 2, 3);
    let c = ramp([[0, hex('#8c5a3c')], [0.3, hex('#b98761')], [0.55, hex('#e8d2b0')], [0.8, hex('#f4ead8')], [1, hex('#c9a07a')]], band * 0.8 + fine * 0.2);
    // great storm (oval) in the southern hemisphere
    const lon = Math.atan2(-z, x), dy = (y + 0.36) / 0.07, dl = (lon - 0.9) / 0.22;
    const s = Math.exp(-(dy * dy + dl * dl));
    c = mix3(c, hex('#b4553a'), s * 0.85);
    return c;
  },
  saturn: (x, y, z) => {
    const turb = fbm(x * 3, y * 3, z * 3, 4) - 0.5;
    const lat = y + turb * 0.04;
    const band = 0.5 + 0.5 * Math.sin(lat * 26);
    return ramp([[0, hex('#b08d5b')], [0.4, hex('#d8bf8f')], [0.75, hex('#efe1bd')], [1, hex('#c9aa76')]], band * 0.7 + fbm(x, y * 30, z, 3) * 0.3);
  },
  uranus: (x, y, z) => {
    const b = 0.5 + 0.5 * Math.sin(y * 9 + fbm(x * 2, y * 2, z * 2) * 1.5);
    return ramp([[0, hex('#7fc7d3')], [1, hex('#b5e6ea')]], b * 0.35 + 0.4);
  },
  neptune: (x, y, z) => {
    const b = 0.5 + 0.5 * Math.sin(y * 12 + fbm(x * 3, y * 3, z * 3) * 2.2);
    let c = ramp([[0, hex('#1d3f9a')], [0.6, hex('#3a68d8')], [1, hex('#7fa6f2')]], b * 0.6 + fbm(x * 5, y * 5, z * 5) * 0.4);
    const lon = Math.atan2(-z, x), dy = (y + 0.3) / 0.08, dl = (lon + 1.2) / 0.25;
    c = mix3(c, hex('#0f1f5c'), Math.exp(-(dy * dy + dl * dl)) * 0.8);
    return c;
  },
  eros: (x, y, z) => {
    const v = fbm(x * 5, y * 5, z * 5, 5);
    return ramp([[0, hex('#4a4038')], [0.6, hex('#8a7a66')], [1, hex('#b7a58a')]], v);
  },
};

/**
 * RGBA pixels of an equirectangular map, rows bottom-up (south pole first)
 * so they can go straight into a THREE.DataTexture.
 */
export function planetPixels(recipe, w) {
  const fn = RECIPES[recipe];
  const h = w / 2;
  const data = new Uint8Array(w * h * 4);
  for (let j = 0; j < h; j++) {
    const lat = ((j + 0.5) / h - 0.5) * Math.PI;
    const cl = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i < w; i++) {
      // SphereGeometry UV: u=0 at -X going toward +Z; we only need seamless sampling
      const lon = (i / w) * Math.PI * 2;
      const [r, g, b] = fn(cl * Math.cos(lon), sl, cl * Math.sin(lon));
      const k = (j * w + i) * 4;
      data[k] = r; data[k + 1] = g; data[k + 2] = b; data[k + 3] = 255;
    }
  }
  return data;
}
