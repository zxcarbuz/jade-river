import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { clamp, damp } from './util.js';
import * as L from './layout.js';
import { PAD } from './collide.js';

export const START_VIEW = { pos: new THREE.Vector3(-30, 24, 46), target: new THREE.Vector3(2, 2, -6) };

// cinematic fly-through: [camera position, look target]
const SHOTS = [
  [[-58, 9, 2.5], [0, 2.5, 0]],
  [[-22, 4.5, 0.5], [0, 3, 0]],
  [[-8, 2.2, 2.0], [10, 3, -10]],
  [[4, 6, -4.5], [10, 4, -16]],
  [[-8, 12.5, -6], [-20, 2, -16]],
  [[-14, 13, -24.5], [0, 4, -48]],
  [[0, 3.5, -27], [0, 5, -50]],
  [[2, 12.5, -31], [0, 4, -50]],
  [[18, 18, -40], [0, 2, -10]],
  [[36, 7, -4], [34, 2, 4]],
  [[44, 4.5, 2.5], [0, 3, 0]],
  [[16, 8.5, 0], [-10, 2, 11]],
  [[-24, 6, 9], [-40, 0, 15]],
  [[-34, 3.2, 21.8], [-40, 0, 13]],
  [[-56, 22, 28], [0, 0, -5]],
];

export class CameraRig {
  constructor(camera, dom, collision) {
    this.camera = camera; this.dom = dom; this.col = collision; this.colliders = collision.rects;
    this.mode = 'orbit';
    this.orbit = new OrbitControls(camera, dom);
    Object.assign(this.orbit, { enableDamping: true, dampingFactor: 0.07, minDistance: 2.5, maxDistance: 170, maxPolarAngle: Math.PI * 0.47, screenSpacePanning: false, zoomSpeed: 0.9, rotateSpeed: 0.6, panSpeed: 0.9 });
    this.orbit.target.copy(START_VIEW.target); camera.position.copy(START_VIEW.pos); this.orbit.update();
    // walk state
    this.walk = { pos: new THREE.Vector3(0, 0, 13), feet: 0, vel: new THREE.Vector3(), yaw: 0, pitch: -0.05, tYaw: 0, tPitch: -0.05, bob: 0, minClear: Infinity };
    this.keys = new Set(); this.joy = { x: 0, y: 0, active: false };
    this.cine = { t: 0, speed: 1 / 95 };
    const curveP = SHOTS.map(([p]) => new THREE.Vector3(...p)), curveT = SHOTS.map(([, t]) => new THREE.Vector3(...t));
    this.cineP = new THREE.CatmullRomCurve3(curveP, true, 'centripetal'); this.cineT = new THREE.CatmullRomCurve3(curveT, true, 'centripetal');
    this.transition = null;
    this._bind();
  }
  _bind() {
    const d = this.dom;
    this._kd = (e) => { if ((e.code === 'Space' || e.code === 'Enter') && e.target.closest && e.target.closest('button')) return; this.keys.add(e.code); };
    this._ku = (e) => this.keys.delete(e.code);
    window.addEventListener('keydown', this._kd); window.addEventListener('keyup', this._ku);
    let look = null;
    this._pd = (e) => {
      if (this.mode !== 'walk') return;
      if (e.pointerType === 'touch' && this.joyZone && e.clientX < window.innerWidth * 0.45 && e.clientY > window.innerHeight * 0.45) return; // joystick side
      look = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { d.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
    };
    this._pm = (e) => {
      if (!look || e.pointerId !== look.id) return;
      const s = e.pointerType === 'touch' ? 0.006 : 0.0035;
      this.walk.tYaw -= (e.clientX - look.x) * s; this.walk.tPitch = clamp(this.walk.tPitch - (e.clientY - look.y) * s, -1.2, 1.1);
      look.x = e.clientX; look.y = e.clientY;
    };
    this._pu = (e) => { if (look && e.pointerId === look.id) look = null; };
    d.addEventListener('pointerdown', this._pd); window.addEventListener('pointermove', this._pm); window.addEventListener('pointerup', this._pu); window.addEventListener('pointercancel', this._pu);
  }
  setJoystick(x, y, active) { this.joy.x = x; this.joy.y = y; this.joy.active = active; }
  setMode(mode, { instant = false } = {}) {
    if (mode === this.mode && !instant) return;
    const from = { pos: this.camera.position.clone(), quat: this.camera.quaternion.clone() };
    this.mode = mode;
    this.orbit.enabled = mode === 'orbit';
    if (mode === 'walk') {
      // drop in on the street closest to where we are looking
      const W = this.walk; W.vel.set(0, 0, 0);
      const cand = [[0, 13, 0], [-20, -6.75, -Math.PI / 2], [10, -6.75, Math.PI / 2], [0, -24.5, 0], [-24, 16, Math.PI / 2], [30, 6.75, Math.PI / 2]];
      const tgt = this.orbit.target; let best = cand[0], bd = Infinity;
      for (const c of cand) { const dd = Math.hypot(c[0] - tgt.x, c[1] - tgt.z); if (dd < bd) { bd = dd; best = c; } }
      W.pos.set(best[0], 0, best[1]); W.feet = 0; W.yaw = W.tYaw = best[2]; W.pitch = W.tPitch = -0.04; this.unstick();
    }
    if (mode === 'orbit') { this.orbit.target.copy(this._lookPoint()); }
    if (mode === 'cinematic') this.cine.t = this._nearestCine();
    if (!instant) this.transition = { t: 0, dur: 1.4, from };
  }
  _lookPoint() { const dir = new THREE.Vector3(); this.camera.getWorldDirection(dir); const p = this.camera.position.clone(); const t = p.y > 1 && dir.y < -0.05 ? -p.y / dir.y : 25; return p.add(dir.multiplyScalar(clamp(t, 6, 60))).setY(1.5); }
  _nearestCine() { let best = 0, bd = Infinity; for (let i = 0; i < 60; i++) { const d = this.cineP.getPointAt(i / 60).distanceTo(this.camera.position); if (d < bd) { bd = d; best = i / 60; } } return best; }
  reset() {
    this.setMode('orbit');
    this.transition = { t: 0, dur: 1.6, from: { pos: this.camera.position.clone(), quat: this.camera.quaternion.clone() }, resetTarget: true };
    this.orbit.target.copy(START_VIEW.target); this._resetPos = START_VIEW.pos.clone();
  }
  // put the walker at (x,z) facing yaw with a smooth camera flight; optional scripted walk targets
  placeWalker(x, z, yaw, { dur = 1.5, auto = null, y = 0.6 } = {}) {
    const from = { pos: this.camera.position.clone(), quat: this.camera.quaternion.clone() };
    this.mode = 'walk'; this.orbit.enabled = false;
    const W = this.walk; W.vel.set(0, 0, 0); W.feet = L.groundY(x, z, y); W.pos.set(x, W.feet, z); W.yaw = W.tYaw = yaw; W.pitch = W.tPitch = -0.08;
    W.auto = auto ? auto.map(([ax, az]) => ({ x: ax, z: az })) : null; W.stuck = 0;
    this.transition = { t: 0, dur, from };
  }
  blocked(x, z, feet = this.walk.feet) { return !!this.col.blocked(x, z, feet); }
  // if something moved into the walker (a door leaf swinging, a resident), step out to the nearest free spot
  unstick() {
    const W = this.walk; if (!this.col.blocked(W.pos.x, W.pos.z, W.feet)) return false;
    for (let r = 0.08; r <= 1.2; r += 0.08) for (let a = 0; a < 16; a++) {
      const x = W.pos.x + Math.cos(a / 16 * Math.PI * 2) * r, z = W.pos.z + Math.sin(a / 16 * Math.PI * 2) * r;
      const f = L.groundY(x, z, W.feet); if (Math.abs(f - W.feet) > L.STEP) continue;
      if (!this.col.blocked(x, z, f)) { W.pos.x = x; W.pos.z = z; W.feet = f; return true; }
    }
    return false;
  }
  update(dt) {
    const cam = this.camera; this.settling = !!this.transition; // camera still on a scripted flight this frame
    if (this.mode === 'orbit') {
      if (this._resetPos && this.transition) cam.position.lerp(this._resetPos, 1 - Math.exp(-dt * 3));
      else this._resetPos = null;
      this.orbit.update();
      // keep the orbit camera above ground & roofs reasonably
      if (cam.position.y < 1.2) cam.position.y = 1.2;
    } else if (this.mode === 'walk') {
      const W = this.walk; const k = this.keys;
      let fx = 0, fz = 0;
      if (k.has('KeyW') || k.has('ArrowUp')) fz += 1; if (k.has('KeyS') || k.has('ArrowDown')) fz -= 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) fx -= 1; if (k.has('KeyD') || k.has('ArrowRight')) fx += 1;
      if (k.has('KeyQ')) W.tYaw += dt * 1.6; if (k.has('KeyE')) W.tYaw -= dt * 1.6;
      if (this.joy.active) { fx += this.joy.x; fz += -this.joy.y; }
      const run = k.has('ShiftLeft') || k.has('ShiftRight') ? 2.0 : 1;
      const len = Math.hypot(fx, fz); if (len > 1) { fx /= len; fz /= len; }
      W.yaw = damp(W.yaw, W.tYaw, 12, dt); W.pitch = damp(W.pitch, W.tPitch, 12, dt);
      const fwd = new THREE.Vector3(-Math.sin(W.yaw), 0, -Math.cos(W.yaw)), right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const want = fwd.multiplyScalar(fz).add(right.multiplyScalar(fx)).multiplyScalar(3.2 * run);
      // scripted walk (entering / leaving a building) once the camera flight is done
      if (W.auto && W.auto.length && !this.transition) {
        if (len > 0.1) W.auto = null; else {
          const tg = W.auto[0]; const dx = tg.x - W.pos.x, dz = tg.z - W.pos.z, dl = Math.hypot(dx, dz);
          if (dl < 0.15) { W.auto.shift(); W.stuck = 0; } else { want.set(dx / dl * 2.0, 0, dz / dl * 2.0); }
        }
      }
      W.vel.x = damp(W.vel.x, want.x, 6, dt); W.vel.z = damp(W.vel.z, want.z, 6, dt);
      // collide per axis so we slide along walls
      const ox = W.pos.x, oz = W.pos.z;
      // sub-steps so a fast step can never tunnel through a thin rail or a door leaf
      const steps = Math.max(1, Math.ceil(Math.hypot(W.vel.x, W.vel.z) * dt / 0.08));
      for (let i = 0; i < steps; i++) {
        const sx = W.vel.x * dt / steps, sz = W.vel.z * dt / steps;
        // a person in the way: side-step around them instead of stopping dead
        if (this.col.blocked(W.pos.x + sx, W.pos.z + sz, W.feet) === 'npc') {
          let moved = false;
          for (const a of [0.6, -0.6, 1.1, -1.1]) { const c = Math.cos(a), s2 = Math.sin(a), ax = sx * c - sz * s2, az = sx * s2 + sz * c;
            if (!this.blocked(W.pos.x + ax, W.pos.z + az)) { W.pos.x += ax; W.pos.z += az; moved = true; break; } }
          if (moved) { W.feet = L.groundY(W.pos.x, W.pos.z, W.feet); continue; }
        }
        const nx = W.pos.x + sx; if (!this.blocked(nx, W.pos.z)) W.pos.x = nx; else W.vel.x = 0;
        const nz = W.pos.z + sz; if (!this.blocked(W.pos.x, nz)) W.pos.z = nz; else W.vel.z = 0;
        W.feet = L.groundY(W.pos.x, W.pos.z, W.feet);
      }
      this.unstick();
      if (W.auto && W.auto.length && !this.transition) {
        if (Math.hypot(W.pos.x - ox, W.pos.z - oz) < dt * 0.2) W.stuck += dt; else W.stuck = 0;
        if (W.stuck > 0.5) { const tg = W.auto.shift(); W.feet = L.groundY(tg.x, tg.z, W.feet); W.pos.set(tg.x, W.feet, tg.z); W.stuck = 0; this.unstick(); } // hop past furniture
      }
      const sp = Math.hypot(W.vel.x, W.vel.z); W.bob += sp * dt * 2.2;
      W.feet = L.groundY(W.pos.x, W.pos.z, W.feet);
      W.pos.y = damp(W.pos.y, W.feet, 14, dt); if (W.pos.y < W.feet - 0.12) W.pos.y = W.feet - 0.12;
      const eye = new THREE.Vector3(W.pos.x, W.pos.y + 1.65 + Math.sin(W.bob * 2) * 0.03 * Math.min(1, sp / 3), W.pos.z);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(W.pitch, W.yaw, 0, 'YXZ'));
      this._apply(eye, q, dt);
    } else if (this.mode === 'cinematic') {
      this.cine.t = (this.cine.t + dt * this.cine.speed) % 1;
      const p = this.cineP.getPointAt(this.cine.t), t = this.cineT.getPointAt(this.cine.t);
      const m = new THREE.Matrix4().lookAt(p, t, new THREE.Vector3(0, 1, 0));
      const q = new THREE.Quaternion().setFromRotationMatrix(m);
      this._apply(p, q, dt);
    }
    if (this.transition) { this.transition.t += dt; if (this.transition.t >= this.transition.dur) this.transition = null; }
  }
  _apply(pos, quat, dt) {
    const cam = this.camera;
    if (this.transition) {
      const tr = this.transition; const s = Math.min(1, tr.t / tr.dur); const e = s * s * (3 - 2 * s);
      cam.position.lerpVectors(tr.from.pos, pos, e); cam.quaternion.slerpQuaternions(tr.from.quat, quat, e);
    } else { cam.position.copy(pos); cam.quaternion.copy(quat); }
  }
  dispose() {
    this.orbit.dispose();
    window.removeEventListener('keydown', this._kd); window.removeEventListener('keyup', this._ku);
    this.dom.removeEventListener('pointerdown', this._pd); window.removeEventListener('pointermove', this._pm); window.removeEventListener('pointerup', this._pu); window.removeEventListener('pointercancel', this._pu);
  }
}
