import * as THREE from 'three';

/**
 * Stylised stand-in shapes for machines that have no supplied 3D model.
 * They are deliberately simple "toy" versions (clearly not replicas):
 * a gold-foil body, solar panels, antenna dish. Unit height ≈ 1.
 */
const gold = () => new THREE.MeshStandardMaterial({ color: '#d4a043', metalness: 0.85, roughness: 0.35 });
const silver = () => new THREE.MeshStandardMaterial({ color: '#c9ced8', metalness: 0.9, roughness: 0.3 });
const panel = () => new THREE.MeshStandardMaterial({ color: '#1d3b8f', metalness: 0.4, roughness: 0.35, emissive: '#0a1a4a', emissiveIntensity: 0.4 });
const dark = () => new THREE.MeshStandardMaterial({ color: '#2a2d36', metalness: 0.6, roughness: 0.5 });

function dish(r = 0.22) {
  const g = new THREE.SphereGeometry(r, 24, 8, 0, Math.PI * 2, 0, Math.PI / 3.2);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#eef1f6', metalness: 0.3, roughness: 0.4, side: THREE.DoubleSide }));
  return m;
}

function lander() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.32, 3), gold());
  body.position.y = 0.48;
  g.add(body);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.62), silver());
    leg.position.set(Math.cos(a) * 0.34, 0.26, Math.sin(a) * 0.34);
    leg.lookAt(Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62);
    leg.rotateX(Math.PI / 2);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.03, 12), silver());
    foot.position.set(Math.cos(a) * 0.55, 0.015, Math.sin(a) * 0.55);
    g.add(leg, foot);
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.45), silver());
  mast.position.y = 0.85;
  const d = dish(0.2);
  d.position.set(0.05, 1.06, 0);
  d.rotation.z = -0.9;
  const sp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.28), panel());
  sp.position.set(-0.18, 0.98, 0);
  sp.rotation.z = 0.5;
  g.add(mast, d, sp);
  return g;
}

function probe() {
  const g = new THREE.Group();
  const bus = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), gold());
  bus.position.y = 0.5;
  g.add(bus);
  for (const s of [-1, 1]) {
    for (const k of [0, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.5), panel());
      p.position.set(s * (0.42 + k * 0.38), 0.5, 0);
      g.add(p);
    }
  }
  const d = dish(0.24);
  d.position.set(0, 0.74, 0);
  g.add(d);
  return g;
}

function telescope() {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.75, 32, 1, true), silver());
  tube.material.side = THREE.DoubleSide;
  tube.position.y = 0.62;
  const cap = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), dark());
  cap.rotation.x = -Math.PI / 2; cap.position.y = 0.25;
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.35, 32, 1, true, 0, Math.PI), silver());
  shade.material.side = THREE.DoubleSide;
  shade.position.y = 1.12;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.2, 6), gold());
  base.position.y = 0.15;
  const sp = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.6, 0.5), panel());
  sp.position.set(-0.27, 0.6, 0);
  g.add(tube, cap, shade, base, sp);
  return g;
}

function orbiter() {
  const g = probe();
  g.scale.setScalar(0.8);
  return g;
}

function rover() {
  const g = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.4), panel());
  deck.position.y = 0.35;
  g.add(deck);
  for (const x of [-0.25, 0, 0.25]) for (const z of [-0.24, 0.24]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 16), dark());
    w.rotation.x = Math.PI / 2; w.position.set(x, 0.09, z);
    g.add(w);
  }
  return g;
}

const SHAPES = { lander, probe, telescope, orbiter, rover };

export function makeMarkerShape(kind = 'probe') {
  const g = (SHAPES[kind] || probe)();
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}
