import * as THREE from 'three';
import { lathe } from './geom.js';

// Procedural Chinese roofs: concave slopes, upturned eave corners, real tile
// corrugation (cover/pan tile channels) and eave tile-ends.
const TILE_P = 0.32;   // tile channel pitch, m
const prof = (u) => Math.pow(1 - u, 1.55);

function grid(nu, nv, fn, { corrugate = null, amp = 0.05, flip = false, yOff = 0, uvFn }) {
  const pos = new Float32Array((nu + 1) * (nv + 1) * 3), uv = new Float32Array((nu + 1) * (nv + 1) * 2);
  const p = new THREE.Vector3();
  let k = 0;
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
    const u = i / nu, v = j / nv * 2 - 1;
    fn(u, v, p);
    if (corrugate) {
      const c = corrugate === 'x' ? p.x : p.z;
      const s = Math.abs(Math.sin(Math.PI * c / TILE_P));
      p.y += amp * Math.sqrt(s) * (0.35 + 0.65 * Math.min(1, (1 - u) * 6 + 0.25));
    }
    p.y += yOff;
    pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
    const [a, b] = uvFn ? uvFn(u, v, p) : [p.x / 4, u * 1.4];
    uv[k * 2] = a; uv[k * 2 + 1] = b; k++;
  }
  const idx = [];
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = i * (nv + 1) + j, b = a + 1, c = a + nv + 1, d = c + 1;
    if (!flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/**
 * Hip or gable roof. Eave line at y=0, centred at origin, long axis = x.
 * a,b: half extents of eave rectangle; r: ridge half length (r=a -> gable);
 * H: ridge height; up: corner upturn height; u0: start of slope (skirt roofs).
 * Returns { tiles:[geoms], under:[geoms], ridges:[geoms], ends:[geoms] }
 */
export function hipRoof(opts) { return { kind: 'hip', opts }; }
export function pyramidRoof(n, R, H, up = 0.7) { return { kind: 'pyr', opts: { n, R, H, up } }; }

// level: 'near' (full detail: dense tile channels, rafters, tile ends, drip tiles,
// ridge beasts), 'far' (light silhouette), or opts.coarse for tiny wall caps.
function hipRoofGeo({ a, b, r, H, up = 0.6, u0 = 0, gable = false, tileEnds = true, curls = true, coarse = false }, level = 'near') {
  const out = { tiles: [], under: [], ridges: [], ends: [] };
  const far = level === 'far' && !coarse; const near = !far && !coarse;
  const span = Math.hypot(b, H);
  const nu = coarse ? 3 : far ? 4 : Math.max(10, Math.round(span * (1 - u0) / 0.3));
  const dens = coarse ? 0.6 : far ? 1.1 : TILE_P / 4;
  const lift = (u, c) => up * Math.pow(u, 2.4) * Math.pow(c, 4) + up * 0.18 * u * u * c * c;
  // front/back faces
  for (const s of [1, -1]) {
    const nv = Math.max(coarse ? 2 : 16, Math.round((2 * a) / dens));
    const fn = (uu, v, p) => {
      const u = u0 + (1 - u0) * uu;
      const ex = gable ? a : r + (a - r) * u;
      const c = Math.abs(v);
      const L = lift(u, c);
      p.set(v * ex * (1 + 0.03 * L), H * prof(u) + L, s * (u * b + L * 0.35 * c));
      return p;
    };
    const uvFn = (uu, v, p) => [p.x / 4, (u0 + (1 - u0) * uu) * span / 4];
    let g = grid(nu, far ? Math.max(8, nv) : nv, fn, { corrugate: near ? 'x' : null, flip: s < 0, uvFn });
    out.tiles.push(g);
    if (near) { out.under.push(grid(Math.ceil(nu / 2), 16, fn, { flip: s > 0, yOff: -0.14 })); out.under.push(strip((t, p) => fn(1, t, p), 64, 0.16, s < 0)); rafters(out, fn, a, gable ? a : r, s, 'z'); }
    else if (far) out.under.push(strip((t, p) => fn(1, t, p), 10, 0.16, s < 0));
    if (tileEnds && near) {
      const ex = gable ? a : a; const n = Math.floor((2 * ex) / TILE_P);
      for (let i = 0; i < n; i++) {
        const v = ((i + 0.5) * TILE_P - ex) / ex; const p = new THREE.Vector3(); fn(1, v, p);
        if (Math.sin(Math.PI * p.x / TILE_P) ** 2 < 0.2) continue;
        const cap = new THREE.CylinderGeometry(0.075, 0.075, 0.05, 10, 1); cap.rotateX(Math.PI / 2);
        cap.translate(p.x, p.y + 0.02, p.z + s * 0.02);
        out.ends.push(cap);
        // drip tile (滴水) between cover tiles
        const q = new THREE.Vector3(); fn(1, v + (TILE_P / 2) / ex, q);
        // half-round tongue hanging down (was an upward triangle: read as a jagged saw edge)
        const drip = new THREE.CylinderGeometry(0.1, 0.1, 0.035, 8, 1, false, -Math.PI / 2, Math.PI); drip.rotateX(Math.PI / 2); drip.translate(q.x, q.y + 0.0, q.z + s * 0.015);
        out.ends.push(drip);
      }
    }
  }
  if (!gable) {
    for (const s of [1, -1]) {
      const nv = Math.max(10, Math.round((2 * b) / dens));
      const fn = (uu, w, p) => {
        const u = u0 + (1 - u0) * uu;
        const c = Math.abs(w); const L = lift(u, c);
        p.set(s * (r + (a - r) * u + L * 0.35 * c), H * prof(u) + L, w * u * b * (1 + 0.03 * L));
        return p;
      };
      const uvFn = (uu, w, p) => [p.z / 4, (u0 + (1 - u0) * uu) * span / 4];
      out.tiles.push(grid(nu, far ? 8 : nv, fn, { corrugate: near ? 'z' : null, flip: s > 0, uvFn }));
      if (!far) { out.under.push(grid(Math.ceil(nu / 2), 10, fn, { flip: s < 0, yOff: -0.14 })); rafters(out, fn, b, 0, s, 'x'); }
      out.under.push(strip((t, p) => fn(1, t, p), far ? 8 : 32, 0.16, s > 0));
      // hip ridges following the corner curve, upturned at the tip
      for (const w of [1, -1]) {
        const pts = [];
        const ns = far ? 6 : 14;
        for (let i = 0; i <= ns; i++) { const p = new THREE.Vector3(); fn(i / ns, w, p); p.y += 0.12; pts.push(p); }
        const tip = pts[pts.length - 1].clone(); const dir = tip.clone().sub(pts[pts.length - 2]).normalize();
        const kk = Math.min(1, Math.max(0.4, b / 4));
        pts.push(tip.clone().add(dir.multiplyScalar(0.22 * kk)).add(new THREE.Vector3(0, 0.26 * kk, 0)));
        const curve = new THREE.CatmullRomCurve3(pts);
        out.ridges.push(new THREE.TubeGeometry(curve, far ? 8 : 24, 0.11 * Math.sqrt(kk), far ? 4 : 8, false));
        if (near && b > 2.5) {
          // ridge beasts (脊兽): a small row of seated figures near the upturned tip
          for (let k = 0; k < 3; k++) {
            const t = 0.66 + k * 0.08; const p = curve.getPointAt(t);
            const fig = new THREE.SphereGeometry(0.075 * kk + 0.03, 7, 5); fig.scale(1, 1.4, 1); fig.translate(p.x, p.y + 0.15, p.z); out.ridges.push(fig);
            const hd = new THREE.SphereGeometry(0.05 * kk + 0.02, 6, 4); hd.translate(p.x, p.y + 0.29, p.z); out.ridges.push(hd);
          }
        }
      }
    }
  }
  if (u0 === 0) {
    // main ridge with curling ends
    const rl = gable ? a + 0.05 : r;
    const rg = new THREE.BoxGeometry(2 * rl, 0.32, 0.3); rg.translate(0, H + 0.12, 0); out.ridges.push(rg);
    const rg2 = new THREE.BoxGeometry(2 * rl - 0.2, 0.08, 0.42); rg2.translate(0, H + 0.02, 0); out.ridges.push(rg2);
    if (near && rl > 2) {
      // openwork ridge: a row of small quatrefoil tiles along the crest
      const rg3 = new THREE.BoxGeometry(2 * rl - 0.4, 0.06, 0.24); rg3.translate(0, H + 0.31, 0); out.ridges.push(rg3);
      for (let x = -rl + 0.5; x <= rl - 0.5; x += 0.42) { const o = new THREE.TorusGeometry(0.07, 0.022, 4, 8); o.translate(x, H + 0.4, 0); out.ridges.push(o); }
    }
    if (!curls || far) { for (const s of [1, -1]) { const e = new THREE.BoxGeometry(0.16, 0.34, 0.34); e.translate(s * (rl - 0.02), H + 0.24, 0); out.ridges.push(e); } }
    else for (const s of [1, -1]) {
      const k = Math.min(1, Math.max(0.45, rl / 4.5));
      const c = new THREE.CatmullRomCurve3([
        new THREE.Vector3(s * (rl - 0.35 * k), H + 0.18, 0), new THREE.Vector3(s * (rl + 0.05 * k), H + 0.18 + 0.12 * k, 0),
        new THREE.Vector3(s * (rl + 0.3 * k), H + 0.18 + 0.44 * k, 0), new THREE.Vector3(s * (rl + 0.18 * k), H + 0.18 + 0.72 * k, 0)]);
      out.ridges.push(new THREE.TubeGeometry(c, 10, 0.13 * Math.sqrt(k), 6, false));
      const ball = new THREE.SphereGeometry(0.11 * k, 8, 6); ball.translate(s * (rl + 0.16 * k), H + 0.2 + 0.74 * k, 0); out.ridges.push(ball);
    }
  }
  return out;
}

// round rafter ends (椽子) under an eave edge
function rafters(out, fn, ext, flat, s, axis) {
  const p = new THREE.Vector3(), q = new THREE.Vector3();
  const n = Math.floor((2 * ext) / 0.32);
  for (let i = 1; i < n; i++) {
    const v = (i * 0.32 - ext) / ext; if (Math.abs(v) > 0.86) continue;
    fn(1, v, p); fn(0.8, v, q);
    const len = p.distanceTo(q) + 0.12; const g = new THREE.CylinderGeometry(0.045, 0.045, len, 6, 1, true);
    g.translate(0, len / 2, 0);
    const dir = p.clone().sub(q).normalize(); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    g.translate(q.x, q.y - 0.2, q.z);
    out.under.push(g);
  }
  void flat; void s; void axis;
}

function strip(fn, n, h, flip) {
  const pos = [], idx = [], uv = [];
  const p = new THREE.Vector3();
  for (let j = 0; j <= n; j++) { fn(j / n * 2 - 1, p); pos.push(p.x, p.y + 0.02, p.z, p.x, p.y - h, p.z); uv.push(j / n * 4, 0, j / n * 4, 0.1); }
  for (let j = 0; j < n; j++) { const a = j * 2; if (flip) idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); else idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}

// n-sided pavilion roof with a finial. R = eave radius, H = apex height.
function pyramidRoofGeo({ n, R, H, up = 0.7 }, level = 'near') {
  const far = level === 'far';
  const out = { tiles: [], under: [], ridges: [], ends: [] };
  const corner = (i) => { const a = i / n * Math.PI * 2 + Math.PI / n; return new THREE.Vector2(Math.cos(a) * R, Math.sin(a) * R); };
  for (let i = 0; i < n; i++) {
    const c0 = corner(i), c1 = corner(i + 1);
    const mid = c0.clone().add(c1).multiplyScalar(0.5); const nrm = mid.clone().normalize();
    const fn = (u, v, p) => {
      const t = (v + 1) / 2; const e = c0.clone().lerp(c1, t);
      const c = Math.abs(v); const L = up * Math.pow(u, 2.4) * Math.pow(c, 4) + up * 0.15 * u * u * c * c;
      const out2 = e.clone().multiplyScalar(u).add(e.clone().normalize().multiplyScalar(L * 0.35 * c));
      p.set(out2.x, H * prof(u) + L, out2.y);
      return p;
    };
    // corrugate along local tangent: approximate by using rotated coordinate
    const g = far ? grid(4, 6, fn, { flip: false }) : gridLocal(fn, nrm, R, H);
    out.tiles.push(g);
    if (!far) out.under.push(grid(5, 8, fn, { flip: true, yOff: -0.12 }));
    out.under.push(strip((t, p) => fn(1, t, p), far ? 6 : 24, 0.14, false));
    const pts = []; for (let k = 0; k <= 12; k++) { const p = new THREE.Vector3(); fn(k / 12, 1, p); p.y += 0.1; pts.push(p); }
    const tip = pts[pts.length - 1].clone(), dir = tip.clone().sub(pts[pts.length - 2]).normalize();
    pts.push(tip.clone().add(dir.multiplyScalar(0.25)).add(new THREE.Vector3(0, 0.3, 0)));
    out.ridges.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), far ? 8 : 20, 0.09, far ? 4 : 6, false));
  }
  const fin = lathe([[0, 0], [0.22, 0.05], [0.26, 0.2], [0.12, 0.35], [0.2, 0.5], [0.08, 0.75], [0.0, 0.9]], 10, { name: 'ridge finial' });
  fin.translate(0, H - 0.05, 0); out.ridges.push(fin);
  return out;
}
function gridLocal(fn, nrm, R, H) {
  const tan = new THREE.Vector2(-nrm.y, nrm.x);
  const nu = 9, nv = Math.round((R * 1.2) / (TILE_P / 3));
  const pos = [], idx = [], uv = [];
  const p = new THREE.Vector3();
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
    const u = i / nu, v = j / nv * 2 - 1; fn(u, v, p);
    const c = p.x * tan.x + p.z * tan.y;
    p.y += 0.045 * Math.sqrt(Math.abs(Math.sin(Math.PI * c / TILE_P))) * Math.min(1, u * 4);
    pos.push(p.x, p.y, p.z); uv.push(c / 4, u * 1.2);
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + 1, c = a + nv + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}

// add a roof result to a Builder at the current frame + local matrix
// builds a near and a far LOD variant (or one coarse variant for tiny caps)
export function addRoof(B, spec, m, { tile = 'tile', under = 'tileUnder', ridge = 'ridge' } = {}) {
  const gen = (lvl) => (spec.kind === 'hip' ? hipRoofGeo(spec.opts, lvl) : pyramidRoofGeo(spec.opts, lvl));
  const put = (roof) => {
    roof.tiles.forEach((g) => B.add(tile, g, m));
    roof.under.forEach((g) => B.add(under, g, m));
    roof.ridges.forEach((g) => B.add(ridge, g, m));
    roof.ends.forEach((g) => B.add(ridge, g, m));
  };
  if (spec.opts.coarse || B.tag !== 'all') { put(gen('coarse')); return; }
  B.setTag('near'); put(gen('near'));
  B.setTag('far'); put(gen('far'));
  B.setTag('all');
}
