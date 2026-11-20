import * as THREE from 'three';
import gsap from 'gsap';

const _v = new THREE.Vector3();

/**
 * Smooth "fly-to" camera moves that work with MOVING targets (planets orbit
 * the Sun while we fly). A move interpolates from the start pose toward a
 * goal that is re-evaluated every frame; when the move ends the camera keeps
 * following the target so it stays centred.
 */
export class CameraDirector {
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;
    this.goalFn = null;      // () => Vector3 world position to look at
    this.offset = new THREE.Vector3();
    this.lastGoal = new THREE.Vector3();
    this.flying = false;
    this.tween = null;
  }

  /**
   * @param {object} o
   * @param {() => THREE.Vector3} o.target   function returning the look-at point
   * @param {THREE.Vector3} o.offset         camera offset from the target (world)
   * @param {number} [o.duration]
   * @param {number} [o.minDistance]  [o.maxDistance] OrbitControls limits after arrival
   */
  flyTo({ target, offset, duration = 2.2, minDistance, maxDistance, ease = 'power3.inOut' }) {
    this.tween?.kill();
    const startPos = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    this.goalFn = target;
    this.offset.copy(offset);
    this.flying = true;
    this.controls.enabled = false;
    // keep zoom limits loose during flight, tighten on arrival
    this.controls.minDistance = 0.01;
    this.controls.maxDistance = 5000;
    const p = { t: 0 };
    return new Promise((resolve) => {
      this.tween = gsap.to(p, {
        t: 1, duration, ease,
        onUpdate: () => {
          const goal = this.goalFn();
          // arc slightly upward mid-flight for a cinematic swoop
          const lift = Math.sin(p.t * Math.PI) * startPos.distanceTo(goal) * 0.12;
          this.camera.position.lerpVectors(startPos, _v.copy(goal).add(this.offset), p.t).y += lift;
          this.controls.target.lerpVectors(startTarget, goal, Math.min(1, p.t * 1.25));
        },
        onComplete: () => {
          this.flying = false;
          this.controls.enabled = true;
          if (minDistance != null) this.controls.minDistance = minDistance;
          if (maxDistance != null) this.controls.maxDistance = maxDistance;
          this.lastGoal.copy(this.goalFn());
          resolve();
        },
      });
    });
  }

  /** Call every frame: keep following the target after arrival. */
  update() {
    if (this.flying || !this.goalFn) return;
    const goal = this.goalFn();
    _v.subVectors(goal, this.lastGoal);
    if (_v.lengthSq() > 0) {
      this.camera.position.add(_v);
      this.controls.target.add(_v);
      this.lastGoal.copy(goal);
    }
  }

  stopFollowing() { this.goalFn = null; }
}
