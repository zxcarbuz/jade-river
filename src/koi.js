import * as THREE from 'three';
import { shared } from './materials.js';
import { mulberry32 } from './util.js';
import * as L from './layout.js';

// Detailed koi: tapered, curved body with dorsal, pectoral, pelvic and forked
// tail fins; swimming undulation is a travelling sine wave in the vertex shader;
// Kohaku / Showa / Ogon / Sanke patterns are procedural in the fragment shader.
// Motion is a light boids-style wander + schooling inside the pond ellipse.

export const VARIETIES = [
  ['红白', 'Кохаку'], ['昭和', 'Сёва'], ['黄金', 'Огон'], ['三色', 'Сансё'],
];

// half-length 0.33 m; head at +z, tail at -z
const NOSE = 0.3, PED = -0.2, TAIL = -0.4;
function profile(s) { // s 0 nose -> 1 peduncle: half-width
  if (s < 0.28) return 0.082 * Math.pow(Math.sin((s / 0.28) * Math.PI / 2), 0.7);
  return 0.082 * (1 - 0.78 * Math.pow((s - 0.28) / 0.72, 1.6));
}

function koiGeometry() {
  const pos = [], nrm = [], part = [], idx = [];
  const push = (x, y, z, nx, ny, nz, p) => { pos.push(x, y, z); nrm.push(nx, ny, nz); part.push(p); return pos.length / 3 - 1; };
  // body: elliptic cross-sections, flat belly, slight dorsal hump
  const NS = 30, NR = 16; const base = pos.length / 3;
  for (let i = 0; i <= NS; i++) {
    const s = i / NS; const z = NOSE + (PED - NOSE) * s;
    const w = Math.max(0.004, profile(s)); const h = w * (0.92 + 0.18 * Math.sin(Math.PI * Math.min(1, s * 1.6)));
    for (let j = 0; j <= NR; j++) {
      const a = (j / NR) * Math.PI * 2; const c = Math.cos(a), sn = Math.sin(a);
      const y = sn > 0 ? sn * h : sn * h * 0.78; const x = c * w;
      const n = new THREE.Vector3(c / w, (sn > 0 ? sn / h : sn / (h * 0.78)), 0).normalize();
      push(x, y, z, n.x, n.y, n.z, 0);
    }
  }
  for (let i = 0; i < NS; i++) for (let j = 0; j < NR; j++) { const a = base + i * (NR + 1) + j, b = a + NR + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  // nose cap
  const tip = push(0, 0.002, NOSE + 0.012, 0, 0, 1, 0);
  for (let j = 0; j < NR; j++) idx.push(tip, base + j + 1, base + j);
  // fin helper: grid in a plane spanned by (origin, u-edge, v-span function)
  const fin = (nu, nv, fn, p = 1) => {
    const b0 = pos.length / 3; const P = new THREE.Vector3();
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { fn(i / nu, j / nv, P); push(P.x, P.y, P.z, 0, 1, 0, p); }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = b0 + i * (nv + 1) + j, b = a + nv + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  };
  // dorsal fin along the back, s 0.3..0.78
  fin(12, 3, (u, v, P) => { const s = 0.3 + u * 0.48; const z = NOSE + (PED - NOSE) * s; const w = profile(s); const hh = 0.045 * Math.sin(Math.PI * Math.pow(u, 0.7)) * (1 - 0.3 * u); P.set(0, w * 1.02 + v * hh, z - v * 0.025); });
  // tail: forked fan from the peduncle
  const TILT = 0.95; // radians from vertical: koi tails read best from above
  fin(8, 12, (u, v, P) => { const z = PED + 0.015 + (TAIL - PED) * u; const sp = 0.014 + 0.125 * Math.pow(u, 0.75); const t = (v * 2 - 1) * sp; const fork = 0.085 * u * (1 - Math.pow(Math.abs(v * 2 - 1), 1.4)); P.set(t * Math.sin(TILT), t * Math.cos(TILT) * 0.6, z + fork); });
  // pectoral fins (pair) and pelvic fins (pair), drooping fans
  for (const sx of [-1, 1]) {
    // pectoral: broad rounded fan spreading sideways and back, slightly drooping
    fin(5, 7, (u, v, P) => { const a = 0.15 + v * 1.25; const r = (0.02 + u * 0.12) * (1 - 0.25 * Math.pow(Math.abs(v - 0.5) * 2, 2)); P.set(sx * (0.055 + Math.cos(a) * r), -0.03 - r * 0.25, 0.16 - Math.sin(a) * r); });
    fin(3, 5, (u, v, P) => { const a = 0.4 + v * 1.0; const r = 0.012 + u * 0.065; P.set(sx * (0.035 + Math.cos(a) * r), -0.045 - r * 0.25, -0.02 - Math.sin(a) * r); });
    // eye
    const eb = pos.length / 3; const eg = new THREE.SphereGeometry(0.011, 8, 6); eg.translate(sx * 0.047, 0.018, 0.255);
    const ep = eg.attributes.position, en = eg.attributes.normal;
    for (let i = 0; i < ep.count; i++) push(ep.getX(i), ep.getY(i), ep.getZ(i), en.getX(i), en.getY(i), en.getZ(i), 2);
    const ei = eg.index.array; for (let i = 0; i < ei.length; i++) idx.push(eb + ei[i]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  g.setIndex(idx);
  // fins get proper normals; body normals were analytic
  const fn2 = g.clone(); fn2.computeVertexNormals();
  const N = g.attributes.normal; for (let i = 0; i < part.length; i++) if (part[i] === 1) N.setXYZ(i, fn2.attributes.normal.getX(i), fn2.attributes.normal.getY(i), fn2.attributes.normal.getZ(i));
  fn2.dispose();
  return g;
}

function koiMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.05, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aPart; attribute vec4 aKoi; attribute float aKind;
        varying vec3 vLocal; varying float vPart; varying float vKind; varying float vSeed;`)
      .replace('#include <begin_vertex>', `
        vec3 transformed = position;
        float s = clamp((${NOSE.toFixed(2)} - position.z) / ${(NOSE - TAIL).toFixed(2)}, 0.0, 1.0);
        // travelling body wave: amplitude grows toward the tail; aKoi = (phase, amp, turn, seed)
        float wave = sin(aKoi.x - s * 7.5);
        transformed.x += aKoi.y * (0.004 + 0.085 * pow(s, 1.7)) * wave;
        transformed.x += aKoi.z * 0.11 * s * s;
        // pectoral / pelvic fins paddle
        if (aPart > 0.5 && aPart < 1.5 && abs(position.x) > 0.045) transformed.y += sin(aKoi.x * 0.5 + position.x * 30.0) * 0.012 * (abs(position.x) - 0.04) * 20.0;
        vLocal = position; vPart = aPart; vKind = aKind; vSeed = aKoi.w;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vLocal; varying float vPart; varying float vKind; varying float vSeed;
        float kh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float kn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(kh(i), kh(i+vec2(1,0)), f.x), mix(kh(i+vec2(0,1)), kh(i+vec2(1,1)), f.x), f.y); }
        float kf(vec2 p){ return kn(p) * 0.6 + kn(p * 2.3 + 7.0) * 0.3 + kn(p * 5.1 + 3.0) * 0.1; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 q = vec2(vLocal.z * 9.0, atan(vLocal.y, vLocal.x) * 0.9) + vSeed * 13.0;
        float top = smoothstep(-0.02, 0.025, vLocal.y);
        float red = smoothstep(0.52, 0.6, kf(q * 1.1)) * top;
        float blk = smoothstep(0.6, 0.66, kf(q * 1.7 + 31.0));
        vec3 white = vec3(0.96, 0.95, 0.9), scarlet = vec3(0.86, 0.17, 0.06), ink = vec3(0.04, 0.045, 0.05), gold = vec3(1.0, 0.7, 0.22);
        vec3 c = white;
        if (vKind < 0.5) { c = mix(white, scarlet, red); }                                   // Kohaku
        else if (vKind < 1.5) { c = mix(ink, white, smoothstep(0.45, 0.5, kf(q * 0.9 + 11.0)) * 0.9); c = mix(c, scarlet, red * 0.95); c = mix(c, ink, 1.0 - top * 0.85); } // Showa
        else if (vKind < 2.5) { c = gold * (0.85 + 0.25 * kf(q * 2.0)); }                     // Ogon
        else { c = mix(white, scarlet, red); c = mix(c, ink, blk * top * 0.95); }            // Sanke
        // scale shimmer
        c *= 0.93 + 0.1 * smoothstep(0.3, 1.0, sin(vLocal.z * 210.0) * sin(atan(vLocal.y, vLocal.x) * 22.0 + vLocal.z * 105.0));
        if (vPart > 0.5 && vPart < 1.5) { c = mix(c, vec3(0.97, 0.95, 0.9), 0.55); if (vKind > 0.5 && vKind < 1.5) c = mix(c, ink, 0.45); if (vKind > 1.5 && vKind < 2.5) c = gold; c *= 0.8 + 0.2 * sin(vLocal.z * 300.0 + vLocal.x * 200.0); }
        if (vPart > 1.5) c = vec3(0.02);
        diffuseColor.rgb = c;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = vKind > 1.5 && vKind < 2.5 ? 0.28 : (vPart > 1.5 ? 0.1 : 0.42);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = vKind > 1.5 && vKind < 2.5 ? 0.65 : 0.05;`);
  };
  m.customProgramCacheKey = () => 'koi-v2';
  return m;
}

export function buildKoi(scene, count = 14) {
  const G = L.GARDEN.pond; const R = mulberry32(8128);
  const geo = koiGeometry();
  const aKoi = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4); aKoi.setUsage(THREE.DynamicDrawUsage);
  const aKind = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  geo.setAttribute('aKoi', aKoi); geo.setAttribute('aKind', aKind);
  const mesh = new THREE.InstancedMesh(geo, koiMaterial(), count);
  mesh.name = 'koi'; mesh.castShadow = false; mesh.receiveShadow = true; mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);
  const fish = [];
  for (let i = 0; i < count; i++) {
    const a = R() * Math.PI * 2, r = Math.sqrt(R()) * 0.7;
    const kind = i % 7 === 6 ? 3 : i % 3 === 2 ? 2 : i % 2;
    aKind.setX(i, kind);
    fish.push({ i, kind, x: G.cx + Math.cos(a) * G.rx * r, z: G.cz + Math.sin(a) * G.rz * r, h: R() * Math.PI * 2, v: 0.12 + R() * 0.1, base: 0.1 + R() * 0.08, boost: 0, phase: R() * 10, turn: 0, y: -0.45 - R() * 0.15, yt: -0.45, seed: R(), scale: 0.75 + R() * 0.55, wander: R() * 100, dist: 0 });
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  const inside = (x, z, pad = 0) => { const dx = (x - G.cx) / (G.rx - pad), dz = (z - G.cz) / (G.rz - pad); return dx * dx + dz * dz; };
  let time = 0;
  const update = (dt) => {
    time += dt;
    for (const f of fish) {
      // desired heading: wander + schooling (align/cohere) + separation + stay in pond
      let sx = Math.cos(f.h), sz = Math.sin(f.h);
      f.wander += dt * 0.35; const wa = Math.sin(f.wander * 1.7 + f.seed * 9) * 0.9 + Math.sin(f.wander * 0.63) * 0.6;
      sx += Math.cos(f.h + wa) * 0.6; sz += Math.sin(f.h + wa) * 0.6;
      let ax = 0, az = 0, cx = 0, cz = 0, n = 0;
      for (const o of fish) {
        if (o === f) continue; const dx = o.x - f.x, dz = o.z - f.z; const d2 = dx * dx + dz * dz;
        if (d2 < 0.16) { const d = Math.sqrt(d2) + 1e-3; sx -= dx / d * (0.4 - d) * 4; sz -= dz / d * (0.4 - d) * 4; }
        if (d2 < 1.8) { ax += Math.cos(o.h); az += Math.sin(o.h); cx += o.x; cz += o.z; n++; }
      }
      if (n) { sx += ax / n * 0.45; sz += az / n * 0.45; sx += (cx / n - f.x) * 0.25; sz += (cz / n - f.z) * 0.25; }
      const ev = inside(f.x + Math.cos(f.h) * 0.6, f.z + Math.sin(f.h) * 0.6, 0.35);
      if (ev > 0.75) { const k = (ev - 0.75) * 6; sx += (G.cx - f.x) * k * 0.4; sz += (G.cz - f.z) / G.rz * G.rx * k * 0.4; }
      if (f.flee) { sx += f.flee[0] * f.boost * 3; sz += f.flee[1] * f.boost * 3; }
      let dh = Math.atan2(sz, sx) - f.h; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
      const maxTurn = (1.4 + f.boost * 4) * dt; const turn = Math.max(-maxTurn, Math.min(maxTurn, dh * dt * 2.2));
      f.h += turn; f.turn += ((turn / Math.max(dt, 1e-4)) * 0.35 - f.turn) * Math.min(1, dt * 4);
      f.boost = Math.max(0, f.boost - dt * 0.45);
      const speed = f.base * (1 + 0.3 * Math.sin(time * 0.4 + f.seed * 20)) + f.boost * 0.9;
      f.v += (speed - f.v) * Math.min(1, dt * 2);
      let nx = f.x + Math.cos(f.h) * f.v * dt, nz = f.z + Math.sin(f.h) * f.v * dt;
      if (inside(nx, nz, 0.25) > 1) { nx = f.x; nz = f.z; f.h += dt * 2.5; }
      f.dist += Math.hypot(nx - f.x, nz - f.z); f.x = nx; f.z = nz;
      if (R() < dt * 0.08) f.yt = -0.4 - R() * 0.25; f.y += (f.yt - f.y) * dt * 0.5;
      f.phase += dt * (5 + f.v * 26);
      // heading h is in xz with x=cos, z=sin; the model faces +z
      e.set(0, Math.atan2(Math.cos(f.h), Math.sin(f.h)), 0); q.setFromEuler(e);
      m4.compose(p.set(f.x, f.y, f.z), q, sc.setScalar(f.scale)); mesh.setMatrixAt(f.i, m4);
      aKoi.setXYZW(f.i, f.phase, 0.7 + f.v * 1.6 + f.boost * 0.6, Math.max(-1, Math.min(1, -f.turn)), f.seed);
    }
    mesh.instanceMatrix.needsUpdate = true; aKoi.needsUpdate = true;
  };
  const scatter = (x, z) => {
    let hit = 0;
    for (const f of fish) { const dx = f.x - x, dz = f.z - z; const d = Math.hypot(dx, dz); if (d < 3.2) { f.flee = [dx / (d + 1e-3), dz / (d + 1e-3)]; f.boost = 1; hit++; } }
    return hit;
  };
  const nearest = (x, z, maxD = 0.6) => { let best = null, bd = maxD; for (const f of fish) { const d = Math.hypot(f.x - x, f.z - z); if (d < bd) { bd = d; best = f; } } return best; };
  update(0.016);
  return { mesh, fish, update, scatter, nearest, varieties: VARIETIES, tris: geo.index.count / 3 };
}
