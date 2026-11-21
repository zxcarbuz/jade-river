import * as THREE from 'three';
import { mat, scaleBoxUV } from './builder.js';
import { M, shared } from './materials.js';
import { instanced } from './vegetation.js';
import { mulberry32 } from './util.js';
import * as L from './layout.js';

const R = mulberry32(4242);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- lanterns
// All red lanterns are 3 instanced meshes. Each lantern swings around its
// hanging point; aGlow sets the evening moment at which it lights up.
export function buildLanterns(group, list) {
  const n = list.length;
  const prof = []; for (let i = 0; i <= 8; i++) { const t = i / 8; const y = -0.5 + t; const r = Math.sin(t * Math.PI) * 0.36 + 0.06; prof.push(new THREE.Vector2(r * (1 + 0.04 * Math.cos(t * 40)), y * 0.62)); }
  const bodyG = new THREE.LatheGeometry(prof, 12);
  // vertical ribs
  const bp = bodyG.attributes.position; for (let i = 0; i < bp.count; i++) { const x = bp.getX(i), z = bp.getZ(i); const a = Math.atan2(z, x); const k = 1 + 0.035 * Math.cos(a * 12); bp.setX(i, x * k); bp.setZ(i, z * k); }
  bodyG.computeVertexNormals(); bodyG.translate(0, -0.42, 0);
  const capG = new THREE.CylinderGeometry(0.16, 0.16, 0.08, 10); const cap2 = capG.clone();
  capG.translate(0, -0.08, 0); cap2.translate(0, -0.76, 0);
  const caps = mergeSimple([capG, cap2, cordG()]);
  const tasselG = new THREE.ConeGeometry(0.06, 0.32, 6); tasselG.rotateX(Math.PI); tasselG.translate(0, -0.95, 0);
  const body = new THREE.InstancedMesh(bodyG, M('lantern'), n);
  const capM = new THREE.InstancedMesh(caps, M('gold'), n);
  const tas = new THREE.InstancedMesh(tasselG, M('lanternTassel'), n);
  const glow = new Float32Array(n); list.forEach((l, i) => { glow[i] = l.glow; });
  bodyG.setAttribute('aGlow', new THREE.InstancedBufferAttribute(glow, 1));
  body.castShadow = false; capM.castShadow = false; tas.castShadow = false;
  body.name = 'lanterns'; capM.name = 'lanternCaps'; tas.name = 'lanternTassels';
  group.add(body, capM, tas);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
  const phases = list.map(() => R() * 6.28);
  const update = (time, wind) => {
    for (let i = 0; i < n; i++) {
      const l = list[i];
      e.set(Math.sin(time * 1.4 + phases[i]) * 0.06 * wind, phases[i], Math.cos(time * 1.1 + phases[i] * 1.3) * 0.08 * wind);
      q.setFromEuler(e); s.setScalar(l.size); m4.compose(l.p, q, s);
      body.setMatrixAt(i, m4); capM.setMatrixAt(i, m4); tas.setMatrixAt(i, m4);
    }
    body.instanceMatrix.needsUpdate = capM.instanceMatrix.needsUpdate = tas.instanceMatrix.needsUpdate = true;
  };
  update(0, 1);
  body.computeBoundingSphere(); capM.computeBoundingSphere(); tas.computeBoundingSphere();
  body.frustumCulled = capM.frustumCulled = tas.frustumCulled = false;
  return { update, glow, count: n };
}
function cordG() { const g = new THREE.CylinderGeometry(0.012, 0.012, 0.25, 4); g.translate(0, 0.08, 0); return g; }
function mergeSimple(list) {
  // tiny merge helper for non-indexed/indexed mixed primitive lists
  const pos = [], nor = [], idx = []; let off = 0;
  for (const g of list) {
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); }
    if (g.index) for (const k of g.index.array) idx.push(k + off); else for (let i = 0; i < p.count; i++) idx.push(i + off);
    off += p.count;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx); return g;
}

// strings of lanterns across lanes (catenary ropes)
export function lanternStrings(B, P) {
  const spans = [
    [V(-24, 4.4, -9.3), V(-16, 4.4, -9.3)], [V(-25, 4.2, -22.6), V(-15, 4.2, -22.6)],
    [V(-2.6, 4.6, -12), V(3.6, 5.0, -12)], [V(-2.8, 4.4, -20), V(3.6, 4.4, -20)],
    [V(-3.9, 4.0, 14), V(3.8, 4.2, 14)], [V(-3.6, 4.0, 20), V(3.6, 4.0, 20)],
    [V(-46, 4.3, -9.6), V(-46, 4.3, -4.8)], [V(-58, 4.4, -9.6), V(-34, 4.4, -9.6)],
    [V(18.6, 4.0, -9.6), V(28, 4.0, -9.6)], [V(33, 4.6, -9.6), V(54.8, 4.6, -9.6)],
    [V(26.5, 4.4, 9.9), V(57.5, 4.4, 9.9)], [V(-2.3, 4.2, 28.6), V(2.3, 4.2, 28.6)],
    [V(-1.9, 3.6, -26.4), V(-1.9, 3.6, -32.5)], [V(1.9, 3.6, -26.4), V(1.9, 3.6, -32.5)],
  ];
  for (const [a, b] of spans) {
    const len = a.distanceTo(b); const sag = 0.35 + len * 0.025; const pts = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; const p = a.clone().lerp(b, t); p.y -= sag * 4 * t * (1 - t); pts.push(p); }
    B.add('rope', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.015, 4, false));
    const n = Math.max(2, Math.round(len / 1.6));
    for (let i = 1; i < n; i++) { const t = i / n; const p = a.clone().lerp(b, t); p.y -= sag * 4 * t * (1 - t); P.lanterns.push({ p: p.add(V(0, -0.05, 0)), size: 0.55, glow: 0.05 + R() * 0.75 }); }
  }
}

// ---------------------------------------------------------------- market
function lathe(pts, seg = 12) { return new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg); }
const potShapes = [
  lathe([[0, 0], [0.14, 0], [0.2, 0.12], [0.22, 0.25], [0.12, 0.42], [0.09, 0.5], [0.12, 0.54]]),
  lathe([[0, 0], [0.1, 0], [0.18, 0.2], [0.12, 0.5], [0.06, 0.62], [0.09, 0.7]]),
  lathe([[0, 0], [0.2, 0], [0.26, 0.15], [0.25, 0.3], [0.2, 0.36]]),
];
const basketG = lathe([[0, 0.01], [0.22, 0.02], [0.32, 0.18], [0.34, 0.2], [0.31, 0.2], [0.3, 0.19], [0.2, 0.04], [0, 0.04]], 14);
const fruitG = new THREE.SphereGeometry(1, 8, 6);
export function buildMarket(group, B, P) {
  const fruits = [];
  const fruitCol = { fruit: [0xf08a24, 0xd83a2a, 0xe8c040, 0x9ab83a], veg: [0x5a9a3a, 0x86b84a, 0xe8e0c8, 0xc83a20] };
  const clothNames = ['clothIndigo', 'clothOchre', 'clothRed', 'clothCream', 'clothJade', 'clothIndigo'];
  L.MARKET.stalls.forEach((s, i) => {
    B.pushT(s.x, 0, s.z, s.face > 0 ? Math.PI / 2 : -Math.PI / 2); // local +z faces the aisle
    // counter
    B.box('woodMid', 3.0, 0.08, 1.2, 0, 0.85, 0.15); B.box('woodDark', 3.0, 0.8, 0.08, 0, 0.42, 0.72);
    for (const x of [-1.45, 1.45]) for (const z of [-0.45, 0.72]) B.box('woodDark', 0.08, 0.85, 0.08, x, 0.42, z);
    // posts + sloped cloth awning
    for (const x of [-1.6, 1.6]) { B.cyl('woodDark', 0.05, 0.06, 2.75, x, 1.37, 1.05, 6); B.cyl('woodDark', 0.05, 0.06, 2.4, x, 1.2 + 0.85, -0.85, 6); }
    const aw = new THREE.PlaneGeometry(3.6, 2.5, 8, 4); const ap = aw.attributes.position;
    for (let k = 0; k < ap.count; k++) ap.setZ(k, -0.12 * Math.sin((ap.getX(k) / 3.6 + 0.5) * Math.PI * 4) * 0.3 - 0.1 * Math.sin((ap.getY(k) / 2.5 + 0.5) * Math.PI));
    aw.computeVertexNormals();
    B.add(clothNames[i], aw, new THREE.Matrix4().makeRotationX(-Math.PI / 2 - 0.32).setPosition(0, 2.95, 0.1));
    for (let k = 0; k < 6; k++) B.add(clothNames[i], new THREE.CircleGeometry(0.3, 8, Math.PI, Math.PI), mat(-1.5 + k * 0.6, 2.62, 1.3));
    // goods
    const top = 0.89;
    if (s.goods === 'fruit' || s.goods === 'veg') {
      for (let b = 0; b < 4; b++) {
        const bx = -1.05 + b * 0.7, bz = 0.15 + (b % 2) * 0.2; B.add('basket', basketG, mat(bx, top, bz));
        const cols = fruitCol[s.goods]; const c = new THREE.Color(cols[b % cols.length]);
        for (let k = 0; k < 14; k++) { const a = R() * 6.28, rr = Math.sqrt(R()) * 0.22; const w = P.B.top.clone().multiply(mat(bx + Math.cos(a) * rr, top + 0.14 + R() * 0.08, bz + Math.sin(a) * rr)); const p = V(0, 0, 0).applyMatrix4(w); const sz = s.goods === 'veg' && b % 2 === 0 ? 0.09 : 0.06; fruits.push({ x: p.x, y: p.y, z: p.z, s: sz, c: c.clone().offsetHSL(0, 0, (R() - 0.5) * 0.08) }); }
      }
      // crates of extra produce under the counter
      for (const x of [-1.0, 0.6]) { crate(B, x, 0, -0.9, 0.55); }
    } else if (s.goods === 'pottery') {
      for (let k = 0; k < 7; k++) B.add(['celadon', 'porcelain', 'terracotta'][k % 3], potShapes[k % 3], mat(-1.25 + k * 0.42, top, 0.1 + (k % 2) * 0.3));
      for (let k = 0; k < 4; k++) B.add('terracotta', potShapes[2], mat(-1.2 + k * 0.8, 0, 1.15, 0, 1.6));
    } else if (s.goods === 'silk') {
      const silks = ['clothRed', 'clothJade', 'clothCream', 'clothOchre', 'clothIndigo'];
      for (let k = 0; k < 5; k++) { const g = new THREE.CylinderGeometry(0.11, 0.11, 0.9, 10); g.rotateZ(Math.PI / 2); B.add(silks[k], g, mat(-0.2, top + 0.11 + (k > 2 ? 0.22 : 0), -0.1 + (k % 3) * 0.24 + (k > 2 ? 0.12 : 0))); }
      for (let k = 0; k < 3; k++) B.add(silks[k + 1], new THREE.PlaneGeometry(0.7, 1.4), mat(-1.0 + k * 1.0, 1.9, -0.75));
      B.box('woodDark', 3.0, 0.05, 0.05, 0, 2.62, -0.75);
    } else if (s.goods === 'lantern') {
      for (let k = 0; k < 5; k++) P.lanterns.push({ p: P.w(-1.3 + k * 0.65, 2.45, 0.9), size: 0.45, glow: 0.02 + k * 0.05 });
      for (let k = 0; k < 6; k++) B.add('paperLamp', new THREE.CylinderGeometry(0.12, 0.12, 0.3, 8), mat(-1.2 + k * 0.48, top + 0.15, 0.2));
    }
    // small vendor flag
    B.cyl('woodDark', 0.025, 0.025, 1.2, 1.55, 3.4, 1.05, 4);
    B.pop();
    P.pick([['水果摊', 'Фруктовый прилавок'], ['陶器摊', 'Гончарная лавка'], ['菜摊', 'Овощной прилавок'], ['丝绸摊', 'Шёлковый прилавок'], ['灯笼摊', 'Фонарная лавка'], ['水果摊', 'Фруктовый прилавок']][i], s.x - 1.2, s.x + 1.2, 0, 3, s.z - 1.8, s.z + 1.8);
  });
  const sz = fruits.map((f) => ({ ...f, sx: f.s, sy: f.s * 0.9, sz: f.s }));
  instanced(group, fruitG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 }), sz, { name: 'fruit' });
}

export function crate(B, x, y, z, s = 0.6, ry = 0) {
  B.pushT(x, y, z, ry);
  B.box('woodMid', s, s * 0.8, s, 0, s * 0.4, 0);
  for (const yy of [0.06, s * 0.74]) B.box('woodDark', s + 0.03, 0.06, s + 0.03, 0, yy, 0);
  B.pop();
}
export function barrel(B, x, y, z, s = 1) {
  B.pushT(x, y, z);
  B.add('woodMid', lathe([[0, 0], [0.26, 0], [0.31, 0.2], [0.33, 0.4], [0.31, 0.6], [0.26, 0.8], [0, 0.8]], 14), mat(0, 0, 0, 0, s));
  for (const yy of [0.12, 0.68]) B.add('ink', new THREE.TorusGeometry(0.3 * s, 0.02, 4, 16), new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0, yy * s, 0));
  B.pop();
}
function jar(B, x, z, s, m = 'terracotta') { B.add(m, potShapes[s % 3], mat(x, 0, z, R() * 6, 1.2 + R() * 0.6)); }

// ---------------------------------------------------------------- benches, frontage, docks
export function buildStreetProps(group, B, P) {
  for (const b of L.BENCHES) {
    B.pushT(b.x, 0, b.z, b.face > 0 ? 0 : Math.PI);
    B.box('stoneLight', 1.7, 0.1, 0.45, 0, 0.44, -0.3); for (const x of [-0.6, 0.6]) B.box('stoneDark', 0.14, 0.4, 0.38, x, 0.2, -0.3);
    B.pop();
    P.pick(['石凳', 'Скамья у канала'], b.x - 0.9, b.x + 0.9, 0, 0.8, b.z - 0.5, b.z + 0.1);
  }
  // garden bench + pavilion seat are part of the pavilion; garden bench:
  B.pushT(-35.6, 0, 19.35, Math.PI); B.box('stoneLight', 1.7, 0.1, 0.45, 0, 0.44, 0); for (const x of [-0.6, 0.6]) B.box('stoneDark', 0.14, 0.4, 0.38, x, 0.2, 0); B.pop();
  // frontage decor for houses: pots with plants, stacked crates, barrels, laundry
  const plants = [];
  for (const d of P.decor || []) {
    B.push(d.m);
    const f = d.d / 2 + 0.6; const RR = mulberry32(d.seed * 31 + 7);
    for (const s of [-1, 1]) {
      const x = s * (d.wooden ? d.w / 2 - 0.5 : 1.9);
      B.add(['terracotta', 'celadon', 'stoneLight'][d.seed % 3], potShapes[2], mat(x, 0, f - 0.1, 0, 1.3));
      const p = V(x, 0.45, f - 0.1).applyMatrix4(B.top); plants.push({ x: p.x, y: p.y, z: p.z, s: 0.45 + RR() * 0.25, ry: RR() * 6 });
    }
    if (RR() < 0.55) barrel(B, -d.w / 2 + 0.45, 0, f - 0.35);
    if (RR() < 0.5) { crate(B, d.w / 2 - 0.55, 0, f - 0.4, 0.55, 0.2); crate(B, d.w / 2 - 0.6, 0.44, f - 0.4, 0.45, -0.3); }
    B.pop();
  }
  const plantG = new THREE.IcosahedronGeometry(1, 0); plantG.scale(1, 0.85, 1);
  instanced(group, plantG, new THREE.MeshStandardMaterial({ color: 0x4f7a34, roughness: 0.9, flatShading: true }), plants, { name: 'pottedPlants' });
  // stacked goods outside teahouse / inn / noodle shop
  barrel(B, 3.2, 0, -10.0); barrel(B, 3.3, 0, -10.8, 0.9); crate(B, 17.0, 0, -12.8, 0.6);
  barrel(B, -4.0, 0, 9.6); jar(B, -15.9, 12.2, 0); jar(B, -15.6, 11.6, 1, 'stoneDark');
  barrel(B, 17.6, 0, 10.0); crate(B, 3.0, 0, 10.0, 0.6, 0.4); crate(B, 3.0, 0.48, 10.0, 0.5, 0.1);
  // laundry poles with drying cloth (south lanes)
  for (const [x, z, len] of [[-30, 28.4, 4], [14, 28.4, 3.6], [44, 9.4, 3]]) {
    B.cyl('bambooStem', 0.03, 0.03, len, x, 2.2, z, 6, 0, Math.PI / 2);
    for (const s of [-1, 1]) B.cyl('woodDark', 0.04, 0.04, 2.3, x + s * len / 2, 1.15, z, 5);
    ['clothIndigo', 'clothCream', 'clothJade', 'clothRed'].slice(0, Math.floor(len)).forEach((c, k) => B.add(c, new THREE.PlaneGeometry(0.7, 1.0), mat(x - len / 2 + 0.6 + k * 0.85, 1.68, z)));
  }
}

// ---------------------------------------------------------------- boats
export function buildBoats(group) {
  const hullG = new THREE.BoxGeometry(1.5, 0.6, 6.4, 6, 3, 18); const hp = hullG.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    let x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i); const t = Math.abs(z) / 3.2;
    x *= 1 - t * t * 0.78; if (y < 0) x *= 0.7 + 0.3 * (1 - t);
    y += t * t * 0.42 + (y < 0 ? t * 0.2 : 0);
    hp.setXYZ(i, x, y, z);
  }
  hullG.computeVertexNormals();
  const awn = new THREE.CylinderGeometry(0.72, 0.72, 2.2, 14, 1, true, -Math.PI / 2, Math.PI); awn.rotateX(Math.PI / 2);
  const boats = [];
  const make = (moving) => {
    const g = new THREE.Group(); g.name = 'boat';
    const hull = new THREE.Mesh(hullG, M('woodDark')); hull.position.y = 0.05; hull.castShadow = true; g.add(hull);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.06, 5.0), M('woodRed')); rim.position.y = 0.36; g.add(rim);
    const a1 = new THREE.Mesh(awn, M('ink')); a1.position.set(0, 0.36, 0.3); a1.castShadow = true; g.add(a1);
    const a2 = new THREE.Mesh(awn, M('ink')); a2.scale.set(0.92, 0.92, 0.5); a2.position.set(0, 0.36, -1.2); g.add(a2);
    const oar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.2, 5), M('woodMid')); oar.position.set(0.25, 0.9, -2.9); oar.rotation.x = 0.9; g.add(oar);
    g.userData.oar = oar; group.add(g); return g;
  };
  const b1 = make(true); const b2 = make(false); b2.position.set(-30, L.CANAL.waterY + 0.05, 3.4); b2.rotation.y = Math.PI / 2 + 0.06;
  const b3 = make(false); b3.position.set(46, L.CANAL.waterY + 0.05, -3.5); b3.rotation.y = Math.PI / 2 - 0.05;
  boats.push({ g: b1, x: -60, dir: 1, turn: 0, sp: 1.25, z: -1.5 });
  return { boats, moving: b1, update(dt, t) {
    const b = boats[0];
    b.x += b.dir * b.sp * dt;
    if (b.x > 92 && b.dir > 0) { b.dir = -1; b.z = 1.6; } else if (b.x < -92 && b.dir < 0) { b.dir = 1; b.z = -1.6; }
    b.g.position.set(b.x, L.CANAL.waterY + 0.05 + Math.sin(t * 1.3) * 0.03, b.g.position.z + (b.z - b.g.position.z) * Math.min(1, dt * 0.5));
    const target = b.dir > 0 ? Math.PI / 2 : -Math.PI / 2; b.g.rotation.y += (target - b.g.rotation.y) * Math.min(1, dt * 0.4);
    b.g.rotation.z = Math.sin(t * 0.9) * 0.02; b.g.userData.oar.rotation.z = Math.sin(t * 1.6) * 0.25;
    for (const s of boats.slice(1)) { s.g.rotation.z = Math.sin(t * 0.8 + 1) * 0.015; }
  }, extra: [b2, b3] };
}
