/**
 * Celestial bodies — data-driven. Add a body here and it appears in the scene.
 *
 * STYLISED SCALE (why the numbers look "wrong"):
 *   In true scale the Sun is 109× Earth's diameter and Neptune is ~30× farther
 *   than Earth. On a laptop screen that means either a dot-sized Earth or a
 *   Sun bigger than the window. So we use two separate, gentle scales:
 *     - sizes:      roughly log-compressed so small worlds stay visible;
 *     - distances:  evenly spaced orbits so the whole system fits one view.
 *   Moon & Mars are slightly enlarged because they are the stars of the show.
 *   Orbital periods are sped up and compressed (see `period`, in seconds).
 *
 * Fields:
 *   model:     GLB from public/models (user-supplied) — else a procedural sphere
 *   textures:  { low, mid, high } level-of-detail tiers (1K at start-up, 2K once
 *              the scene is up, 4K only when the camera is close). Made from the
 *              8K sources by `npm run textures`; WebP keeps them small.
 *   procedural: recipe name in scene/proceduralTextures.js
 *   parent:    orbit around another body (Moon -> Earth)
 *   tidallyLocked: keep longitude 0 facing the parent (the Moon's near side)
 *   focus:     camera distance (in body radii) used by "fly to"
 */
export const BODIES = [
  {
    id: 'sun', name: 'Sun', kind: 'star', radius: 6, orbit: 0, period: 0, spin: 120,
    model: 'models/sun.glb', textures: { low: 'images/planets/sun_1k.webp' }, focus: 3.2,
  },
  { id: 'mercury', name: 'Mercury', radius: 0.42, orbit: 13, period: 70, spin: 90, procedural: 'mercury', phase: 1.2, focus: 4 },
  { id: 'venus', name: 'Venus', radius: 0.78, orbit: 18.5, period: 110, spin: 260, procedural: 'venus', phase: 4.1, focus: 4 },
  {
    id: 'earth', name: 'Earth', radius: 1.15, orbit: 25, period: 160, spin: 40, phase: 0.4,
    model: 'models/earth.glb', calibration: 'earth',
    textures: { low: 'images/planets/earth_1k.webp', mid: 'images/planets/earth_2k.webp', high: 'images/planets/earth_4k.webp' },
    atmosphere: { color: '#6fb6ff', intensity: 0.8 }, focus: 4,
  },
  {
    id: 'moon', name: 'Moon', parent: 'earth', radius: 0.5, orbit: 3.1, period: 32, phase: 2.0,
    tidallyLocked: true, model: 'models/moon.glb', calibration: 'moon',
    textures: { low: 'images/planets/moon_1k.webp', mid: 'images/planets/moon_2k.webp', high: 'images/planets/moon_4k.webp' },
    bump: 0.012, roughness: 0.96, focus: 3.3, featured: true,
    // display-only position used when a machine has no coordinates in the data
    fallbackSite: { lat: 10, lon: -10 },
  },
  {
    id: 'mars', name: 'Mars', radius: 0.95, orbit: 34, period: 240, spin: 55, phase: 5.3,
    model: 'models/mars.glb', calibration: 'mars',
    textures: { low: 'images/planets/mars_1k.webp', mid: 'images/planets/mars_2k.webp', high: 'images/planets/mars_4k.webp' },
    atmosphere: { color: '#ff9a6b', intensity: 0.3 }, bump: 0.01, roughness: 0.95, focus: 3.3, featured: true,
    // display-only position used when a machine has no coordinates in the data
    fallbackSite: { lat: 8, lon: -18 },
  },
  { id: 'jupiter', name: 'Jupiter', radius: 2.9, orbit: 52, period: 420, spin: 20, procedural: 'jupiter', phase: 2.6, focus: 3.4 },
  { id: 'saturn', name: 'Saturn', radius: 2.45, orbit: 68, period: 560, spin: 22, procedural: 'saturn', rings: true, phase: 0.9, focus: 4.2 },
  { id: 'uranus', name: 'Uranus', radius: 1.7, orbit: 82, period: 700, spin: 30, procedural: 'uranus', tilt: 1.7, phase: 3.7, focus: 4 },
  { id: 'neptune', name: 'Neptune', radius: 1.65, orbit: 95, period: 840, spin: 28, procedural: 'neptune', phase: 5.9, focus: 4 },
];

/** Decorative deep-space anchors (not real orbits — see docs/DATA_GAPS.md). */
export const DEEP_SPACE = {
  eros: { name: 'Eros (asteroid)', orbit: 29.5, period: 200, phase: 3.6, radius: 0.32, inclination: 0.12 },
  /** loose "roaming" path for free-flying machines */
  roam: { radius: 44, height: 7, period: 380 },
  asteroidBelt: { inner: 40, outer: 46 },
};

/** Camera framing for the header filters. */
export const VIEWS = {
  home: { position: [0, 62, 118], target: [0, 0, 0] },
  deepSpace: { position: [62, 30, 70], target: [18, 0, 0] },
};
