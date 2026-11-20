import * as THREE from 'three';
import calibration from '../config/model-calibration.json';

const D2R = Math.PI / 180;

/**
 * Canonical body frame used everywhere in the app:
 *   +Y = north pole, +X = (lat 0, lon 0), longitude grows toward -Z (east).
 * MUST match canonical() in scripts/blender_convert.py.
 */
export function latLonToCanonical(lat, lon, target = new THREE.Vector3()) {
  const la = lat * D2R, lo = lon * D2R;
  return target.set(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo));
}

/**
 * The supplied planet models each have their own orientation. The Blender
 * pipeline measured (from the texture UVs) the rotation R that maps the
 * canonical frame into the model's frame. Applying R^T to the model makes its
 * texture line up with the canonical frame, so latitude/longitude from the
 * data land on the right spot of the real map.
 */
export function calibrationQuaternion(key) {
  const R = calibration[key]?.latLonRotation;
  if (!R) return new THREE.Quaternion();
  const m = new THREE.Matrix4().set(
    R[0][0], R[1][0], R[2][0], 0, // transpose (R^T)
    R[0][1], R[1][1], R[2][1], 0,
    R[0][2], R[1][2], R[2][2], 0,
    0, 0, 0, 1,
  );
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

/** Great-circle distance in degrees. */
export function angularDistance(a, b) {
  const va = latLonToCanonical(a.lat, a.lon), vb = latLonToCanonical(b.lat, b.lon);
  return Math.acos(THREE.MathUtils.clamp(va.dot(vb), -1, 1)) / D2R;
}

/** Deterministic 0..1 hash for decorative randomness (stable between reloads). */
export function hash01(str, salt = 0) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}
