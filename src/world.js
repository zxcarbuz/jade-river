import * as THREE from 'three';
import { mat, scaleBoxUV } from './builder.js';
import { hipRoof, pyramidRoof, addRoof } from './roofs.js';
import { M } from './materials.js';
import { fbm2, smoothstep, mulberry32 } from './util.js';
import * as L from './layout.js';

// ---------------------------------------------------------------- terrain
export function terrainHeight(x, z) {
  const r = Math.pow(Math.pow(x / 74, 4) + Math.pow(z / 62, 4), 0.25);
  const n = fbm2(x * 0.012 + 3, z * 0.012 - 7, 5), n2 = fbm2(x * 0.004 - 11, z * 0.004 + 5, 4);
  let h = smoothstep(1.0, 1.35, r) * (2 + 10 * n) + smoothstep(1.25, 2.6, r) * (8 + 38 * n * n2 * 2) + smoothstep(2.4, 5.0, r) * (40 + 110 * n2 * n2);
  // river valley along the canal axis
  const valley = smoothstep(5.5, 9, Math.abs(z));
  h *= 0.15 + 0.85 * smoothstep(5, 50, Math.abs(z));
  h = h * valley + (1 - valley) * L.CANAL.bedY;
  if (r < 0.985) h = Math.min(h, -1.2);
  return h;
}

export function buildTerrain(group) {
  const S = 760, N = 210;
  const g = new THREE.PlaneGeometry(S, S, N, N); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position; const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color(), low = new THREE.Color('#6f8f45'), field = new THREE.Color('#9aa456'), forest = new THREE.Color('#3b5d2e'), high = new THREE.Color('#5f7d63'), bank = new THREE.Color('#6b6a4c');
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i); const h = terrainHeight(x, z); pos.setY(i, h);
    const n = fbm2(x * 0.05, z * 0.05, 3);
    c.copy(low).lerp(field, smoothstep(0.45, 0.7, fbm2(x * 0.02 + 40, z * 0.02, 3)) * (h < 6 ? 1 : 0));
    c.lerp(forest, smoothstep(3, 14, h) * (0.7 + 0.3 * n));
    c.lerp(high, smoothstep(45, 120, h));
    if (h < -0.3) c.copy(bank);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    uv.setXY(i, x / 6, z / 6);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: M('grass').map, roughness: 1 });
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.name = 'terrain';
  group.add(mesh);
  // far mountain silhouettes
  const ring = new THREE.CylinderGeometry(560, 560, 1, 160, 12, true);
  const rp = ring.attributes.position; const rc = new Float32Array(rp.count * 3);
  for (let i = 0; i < rp.count; i++) {
    const x = rp.getX(i), z = rp.getZ(i), y = rp.getY(i) + 0.5; const a = Math.atan2(z, x);
    const hh = 90 + 160 * fbm2(Math.cos(a) * 3 + 10, Math.sin(a) * 3 + 10, 5) * fbm2(a * 2, 1, 2) * 2;
    rp.setY(i, -10 + y * hh); const k = 0.85 + 0.15 * y;
    rc[i * 3] = 0.33 * k; rc[i * 3 + 1] = 0.45 * k; rc[i * 3 + 2] = 0.42 * k;
  }
  ring.setAttribute('color', new THREE.BufferAttribute(rc, 3)); ring.computeVertexNormals();
  const far = new THREE.Mesh(ring, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.BackSide }));
  far.name = 'farMountains'; group.add(far);
  return mesh;
}

function await_merge(list) {
  const pos = [], nor = [], idx = []; let off = 0;
  for (const g of list) { const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); } for (const k of g.index.array) idx.push(k + off); off += p.count; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx); return g;
}
export function buildForest(group) {
  const R = mulberry32(99);
  const crowns = [], pines = [];
  for (let i = 0; i < 12000 && crowns.length < 2000; i++) {
    const x = (R() - 0.5) * 520, z = (R() - 0.5) * 520;
    const r = Math.pow(Math.pow(x / 74, 4) + Math.pow(z / 62, 4), 0.25);
    if (r < 1.45 || Math.abs(z) < 9) continue;
    const h = terrainHeight(x, z); if (h < 0.5) continue;
    if (fbm2(x * 0.03, z * 0.03, 3) < 0.42 - (h > 10 ? 0.12 : 0)) continue;
    (R() < 0.18 ? pines : crowns).push([x, h, z, 1.4 + R() * 2.0 + Math.min(2, h * 0.03)]);
  }
  const cg = new THREE.IcosahedronGeometry(1, 1); const cp = cg.attributes.position;
  for (let i = 0; i < cp.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(cp, i); v.multiplyScalar(0.7 + 0.6 * fbm2(v.x * 4 + 5, v.z * 4 + v.y * 3, 3)); v.y *= 0.8; cp.setXYZ(i, v.x, v.y, v.z); }
  cg.computeVertexNormals();
  const cm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  const inst = new THREE.InstancedMesh(cg, cm, crowns.length);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  crowns.forEach(([x, h, z, s], i) => {
    m4.compose(new THREE.Vector3(x, h + s * 0.55, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 6, 0)), new THREE.Vector3(s, s * (0.9 + R() * 0.4), s));
    inst.setMatrixAt(i, m4); col.setHSL(0.22 + R() * 0.1, 0.35 + R() * 0.2, 0.07 + R() * 0.07); inst.setColorAt(i, col);
  });
  inst.castShadow = false; inst.receiveShadow = false; inst.name = 'forest'; group.add(inst);
  const tiers = [0, 1, 2].map((k) => { const c = new THREE.ConeGeometry(1 - k * 0.25, 1.6, 8); c.translate(0, 1.1 + k * 0.9, 0); return c; });
  const pg = (await_merge(tiers));
  const pin = new THREE.InstancedMesh(pg, cm, pines.length);
  pines.forEach(([x, h, z, s], i) => { m4.compose(new THREE.Vector3(x, h - 0.3, z), new THREE.Quaternion(), new THREE.Vector3(s * 0.55, s * (0.9 + R() * 0.4), s * 0.55)); pin.setMatrixAt(i, m4); col.setHSL(0.33 + R() * 0.05, 0.3, 0.08 + R() * 0.05); pin.setColorAt(i, col); });
  pin.name = 'pines'; group.add(pin);
}

export function buildPagoda(B, P) {
  const x = -118, z = -168; const y = terrainHeight(x, z) - 1;
  B.pushT(x, y, z);
  let yy = 0;
  B.add('stoneLight', new THREE.CylinderGeometry(5.5, 6, 2, 8), mat(0, 1, 0)); yy = 2;
  for (let t = 0; t < 7; t++) {
    const r = 3.8 - t * 0.33, h = t === 0 ? 4.5 : 3.0;
    const wall = new THREE.CylinderGeometry(r, r + 0.1, h, 8); B.add('plaster', wall, mat(0, yy + h / 2, 0));
    B.add('woodRed', new THREE.CylinderGeometry(r + 0.05, r + 0.05, 0.35, 8), mat(0, yy + h - 0.2, 0));
    B.pushT(0, yy + h, 0); addRoof(B, pyramidRoof(8, r + 1.5, 1.2, 0.6), mat(0, 0, 0)); B.pop();
    yy += h + 0.4;
  }
  B.add('gold', new THREE.CylinderGeometry(0.05, 0.25, 4, 6), mat(0, yy + 1.6, 0));
  for (let k = 0; k < 4; k++) B.add('gold', new THREE.SphereGeometry(0.35 - k * 0.05, 8, 6), mat(0, yy + 0.6 + k * 0.8, 0));
  P.pick(['文峰塔', 'Пагода Вэньфэн на холме'], -5, 5, 0, yy + 4, -5, 5);
  P.pagodaTop = P.w(0, yy, 0);
  B.pop();
}

// ---------------------------------------------------------------- town ground & streets
export function buildGround(group) {
  const G = L.GARDEN.pond;
  const mk = (z0, z1, holes) => {
    const sh = new THREE.Shape(); sh.moveTo(-82, z0); sh.lineTo(82, z0); sh.lineTo(82, z1); sh.lineTo(-82, z1); sh.closePath();
    for (const hpath of holes) sh.holes.push(hpath);
    const g = new THREE.ShapeGeometry(sh, 48); g.rotateX(Math.PI / 2);
    const uv = g.attributes.uv; const p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 6, p.getZ(i) / 6);
    return g;
  };
  // Shape is in XY; after rotateX(+90deg) y->z so pass z directly
  const pond = new THREE.Path(); pond.absellipse(G.cx, G.cz, G.rx + 0.6, G.rz + 0.6, 0, Math.PI * 2, true);
  const north = mk(-74, -L.CANAL.half - 0.3, []), south = mk(L.CANAL.half + 0.3, 64, [pond]);
  for (const g of [north, south]) { const m = new THREE.Mesh(g, M('grass')); m.position.y = -0.03; m.receiveShadow = true; m.name = 'ground'; group.add(m); flipIfNeeded(g); }
}
function flipIfNeeded(g) { const n = g.attributes.normal; if (n.getY(0) < 0) { for (let i = 0; i < n.count; i++) n.setY(i, -n.getY(i)); const idx = g.index.array; for (let i = 0; i < idx.length; i += 3) { const t = idx[i]; idx[i] = idx[i + 2]; idx[i + 2] = t; } } }

export function buildStreets(B) {
  L.STREETS.forEach(([x0, x1, z0, z1], i) => {
    const w = x1 - x0, d = z1 - z0;
    const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv; const p = g.attributes.position;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, (p.getX(k) + x0 + w / 2) / 3.2, (p.getZ(k) + z0 + d / 2) / 3.2);
    B.add('paving', g, mat((x0 + x1) / 2, 0.012 + i * 0.0015, (z0 + z1) / 2));
  });
  // granite kerbs on the lane edges away from the canal
  for (const z of [-8.55, 8.55]) for (let x = -63; x < 63; x += 3) B.box('stoneLight', 2.96, 0.08, 0.22, x + 1.5, 0.04, z);
}

// ---------------------------------------------------------------- canal banks
export function buildEmbankment(B, P) {
  const C = L.CANAL; const len = 132; const h = 0.1 - C.bedY;
  for (const s of [-1, 1]) {
    const g = scaleBoxUV(new THREE.BoxGeometry(len, h, 0.7), len, h, 0.7, 3.5);
    B.add('stone', g, mat(0, C.bedY + h / 2, s * (C.half + 0.35)));
    for (let x = -len / 2; x < len / 2; x += 1.6) { const gg = scaleBoxUV(new THREE.BoxGeometry(1.56, 0.16, 0.9), 1.56, 0.16, 0.9, 2); B.add('stoneLight', gg, mat(x + 0.8, 0.08, s * (C.half + 0.38))); }
    // river steps (河埠头) leading down to the water
    const xs = s < 0 ? [-44, -18.5, 14, 44] : [-40, -12, 28.5, 52];
    for (const x of xs) {
      for (let k = 0; k < 5; k++) {
        const yTop = -0.05 - k * 0.22; const depth = 0.38;
        const gg = scaleBoxUV(new THREE.BoxGeometry(2.6, yTop - C.bedY, depth), 2.6, 1, depth, 2);
        B.add('stoneLight', gg, mat(x, C.bedY + (yTop - C.bedY) / 2, s * (C.half - 0.19 - k * depth)));
      }
      B.cyl('stoneDark', 0.18, 0.2, 0.5, x + 1.7, 0.25, s * (C.half + 0.2), 8);
    }
    // mooring posts & stone rings
    for (let x = -58; x < 60; x += 13) B.add('stoneDark', new THREE.TorusGeometry(0.16, 0.04, 6, 12), mat(x + 3, -0.35, s * (C.half - 0.02)));
  }
  // canal bed (seen through clear water)
  const bed = new THREE.PlaneGeometry(600, 11, 1, 1); bed.rotateX(-Math.PI / 2);
  const uv = bed.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 150, uv.getY(i) * 3);
  B.add('canalBed', bed, mat(0, C.bedY + 0.02, 0));
}

// ---------------------------------------------------------------- bridges
export function buildBridge(B, P, b) {
  const C = L.CANAL; const R = b.half * 0.56, yc = -1.1;
  const sh = new THREE.Shape();
  const N = 40;
  sh.moveTo(-b.half - 0.2, -0.4);
  for (let i = 0; i <= N; i++) { const z = -b.half + (2 * b.half) * i / N; sh.lineTo(z, L.deckY(b, z) - 0.05); }
  sh.lineTo(b.half + 0.2, -0.4); sh.lineTo(C.half, -0.4); sh.lineTo(C.half, C.bedY); sh.lineTo(R, C.bedY);
  for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI; sh.lineTo(Math.cos(a) * R, yc + Math.sin(a) * R); }
  sh.lineTo(-R, C.bedY); sh.lineTo(-C.half, C.bedY); sh.lineTo(-C.half, -0.4); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: b.w - 0.3, bevelEnabled: false, curveSegments: 8 });
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 3.5, uv.getY(i) / 3.5);
  g.rotateY(Math.PI / 2); g.translate(-(b.w - 0.3) / 2, 0, 0);
  B.pushT(b.x, 0, 0);
  B.add('stone', g);
  // arch ring stones (voussoirs), proud of both faces
  for (const s of [-1, 1]) {
    for (let i = 0; i < 19; i++) {
      const a0 = i / 19 * Math.PI, a1 = (i + 1) / 19 * Math.PI, am = (a0 + a1) / 2;
      const vs = new THREE.BoxGeometry(0.16, 0.55, R * (a1 - a0) - 0.03);
      const m = new THREE.Matrix4().makeRotationX(-(am - Math.PI / 2) + 0);
      const rr = R + 0.27; m.setPosition(s * ((b.w - 0.3) / 2 + 0.06), yc + Math.sin(am) * rr, Math.cos(am) * rr);
      B.add('stoneLight', vs, new THREE.Matrix4().compose(new THREE.Vector3(s * ((b.w - 0.3) / 2 + 0.06), yc + Math.sin(am) * rr, Math.cos(am) * rr), new THREE.Quaternion().setFromEuler(new THREE.Euler(-(am + Math.PI / 2), 0, 0)), new THREE.Vector3(1, 1, 1)));
      void m;
    }
    // inscription plaque on the face
    B.box('stoneLight', 0.08, 0.5, 1.4, s * ((b.w - 0.3) / 2 + 0.03), b.H - 0.75, 0);
  }
  // stepped treads
  const step = 0.36;
  for (let z = -b.half; z < b.half - 0.01; z += step) {
    const zm = z + step / 2; const y = L.deckY(b, zm);
    const gg = scaleBoxUV(new THREE.BoxGeometry(b.w - 0.5, 0.25, step + 0.02), b.w, 0.25, step, 2.5);
    B.add('stoneLight', gg, mat(0, y - 0.1, zm));
  }
  // parapets: posts with lotus caps and slab panels following the curve
  const posts = []; const pz = []; for (let z = -b.half; z <= b.half + 0.01; z += b.half / 5) pz.push(z);
  for (const s of [-1, 1]) {
    const x = s * (b.w / 2 - 0.2);
    let prev = null;
    for (const z of pz) {
      const y = L.deckY(b, z);
      B.box('stoneLight', 0.22, 1.0, 0.22, x, y + 0.45, z);
      B.add('stoneLight', new THREE.SphereGeometry(0.15, 8, 6), mat(x, y + 1.02, z));
      if (prev) {
        const [pzv, pyv] = prev; const len = Math.hypot(z - pzv, y - pyv); const ang = Math.atan2(y - pyv, z - pzv);
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-ang, 0, 0));
        B.add('stoneLight', new THREE.BoxGeometry(0.12, 0.55, len - 0.2), new THREE.Matrix4().compose(new THREE.Vector3(x, (y + pyv) / 2 + 0.38, (z + pzv) / 2), q, new THREE.Vector3(1, 1, 1)));
        B.add('stoneLight', new THREE.BoxGeometry(0.18, 0.08, len - 0.1), new THREE.Matrix4().compose(new THREE.Vector3(x, (y + pyv) / 2 + 0.7, (z + pzv) / 2), q, new THREE.Vector3(1, 1, 1)));
      }
      prev = [z, y]; posts.push([x, y, z]);
    }
    // drum-shaped end stones
    for (const e of [-1, 1]) B.cyl('stoneLight', 0.45, 0.45, 0.24, x, 0.45, e * (b.half + 0.35), 14, 0, Math.PI / 2);
  }
  B.pop();
  B.cyl('woodDark', 0.04, 0.04, 1.1, b.x - (b.w / 2 - 0.2), b.H + 1.55, 0, 6);
  B.cyl('woodDark', 0.04, 0.04, 1.1, b.x + (b.w / 2 - 0.2), b.H + 1.55, 0, 6);
  B.box('woodDark', 0.04, 0.04, 0.4, b.x - (b.w / 2 - 0.2), b.H + 2.05, 0.15);
  P.lantern(b.x + (b.w / 2 - 0.2), b.H + 1.75, 0.3, 0.8, 0.32);
  P.lantern(b.x - (b.w / 2 - 0.2), b.H + 1.75, 0.3, 0.8, 0.31);
  P.lights.push({ p: new THREE.Vector3(b.x, b.H + 1.7, 0.3), color: 0xff9a50, intensity: 4, dist: 9 });
  P.pick(b.name, b.x - b.w / 2, b.x + b.w / 2, -1.5, b.H + 1.2, -b.half, b.half, b.H + 1.3);
}
