import * as THREE from 'three';
import { mat, scaleBoxUV } from './builder.js';
import { hipRoof, pyramidRoof, addRoof } from './roofs.js';
import { signTex } from './textures.js';
import { rand, pick, mulberry32 } from './util.js';
import * as L from './layout.js';

// Every builder works in a local frame (front = +z) pushed onto the Builder
// stack and reports lanterns, chimneys, signs and a pick box in world space.
export class TownParts {
  constructor(B) { this.B = B; this.lanterns = []; this.chimneys = []; this.signs = []; this.picks = []; this.steam = []; this.lights = []; this.seats = []; }
  w(x, y, z) { return new THREE.Vector3(x, y, z).applyMatrix4(this.B.top); }
  lantern(x, y, z, size = 1, glow = Math.random() * 0.5) { this.lanterns.push({ p: this.w(x, y, z), size, glow }); }
  pick(name, x0, x1, y0, y1, z0, z1, anchorY) {
    const box = new THREE.Box3(); const corners = [];
    for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) corners.push(this.w(x, y, z));
    box.setFromPoints(corners);
    const c = box.getCenter(new THREE.Vector3()); c.y = anchorY ?? box.max.y;
    this.picks.push({ name, box, anchor: c });
  }
  sign(text, x, y, z, height, opts = {}) {
    const t = signTex(text, opts); const asp = t.userData.aspect;
    const w = opts.vertical ? height * asp : height * asp; const h = height;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, metalness: 0.1, emissive: 0xffc070, emissiveMap: t, emissiveIntensity: 0.0 }));
    m.userData.signGlow = true;
    m.position.copy(this.w(x, y, z));
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().extractRotation(this.B.top));
    if (opts.ry) m.rotateY(opts.ry);
    m.castShadow = false; m.receiveShadow = true;
    this.signs.push(m);
    this.B.box('woodDark', w + 0.12, h + 0.12, 0.06, x, y, z - 0.04 * (opts.back ? -1 : 1), opts.ry || 0);
    return m;
  }
}

function plasterBox(B, mname, w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv;
  const dims = [d, d, w, w, w, w];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setX(k, uv.getX(k) * dims[f] / 4); if (f === 2 || f === 3) uv.setY(k, uv.getY(k) * 0.1); }
  B.add(mname, g, mat(x, y + h / 2, z));
}
function stoneBox(B, m, w, h, d, x, y, z, ry = 0) { const g = scaleBoxUV(new THREE.BoxGeometry(w, h, d), w, h, d, 3); B.add(m, g, mat(x, y, z, ry)); }

// gable end wall that follows the concave roof profile (never pokes through)
function gableWall(B, x, d, b, H, y0) {
  const prof = (u) => Math.pow(1 - u, 1.55);
  const sh = new THREE.Shape(); sh.moveTo(-d / 2, 0);
  for (let i = 0; i <= 24; i++) { const z = -d / 2 + d * i / 24; sh.lineTo(z, Math.max(0.02, H * prof(Math.abs(z) / b) - 0.16)); }
  sh.lineTo(d / 2, 0); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.25, bevelEnabled: false }); g.rotateY(Math.PI / 2); g.translate(x - 0.125, y0, 0);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 4, 0.95);
  B.add('plaster', g);
}
function backWindows(B, w, d, y, n, variant = 1) {
  for (let i = 0; i < n; i++) windowPanel(B, -w / 2 + (i + 0.5) * w / n, y, -d / 2 - 0.01, Math.min(1.1, w / n - 0.6), 0.9, variant, Math.PI);
  for (const s of [-1, 1]) windowPanel(B, s * (w / 2 + 0.01), y, 0, 0.9, 0.9, variant, s * Math.PI / 2);
}

// lattice window with timber frame and sill, on a wall facing +z at z
function windowPanel(B, x, y, z, w, h, variant = 0, ry = 0) {
  B.pushT(x, y, z, ry);
  B.add('lattice' + variant, new THREE.PlaneGeometry(w, h), mat(0, 0, 0.02));
  B.box('woodDark', w + 0.16, 0.1, 0.12, 0, h / 2 + 0.04, 0.04);
  B.box('woodDark', w + 0.3, 0.09, 0.2, 0, -h / 2 - 0.04, 0.07);
  B.box('woodDark', 0.08, h, 0.1, -w / 2 - 0.04, 0, 0.04);
  B.box('woodDark', 0.08, h, 0.1, w / 2 + 0.04, 0, 0.04);
  B.pop();
}
function doorway(B, x, z, w = 1.5, h = 2.3) {
  B.add('door', new THREE.PlaneGeometry(w, h), mat(x, h / 2 + 0.45, z + 0.03));
  stoneBox(B, 'stoneLight', w + 0.5, 0.22, 0.18, x, h + 0.56, z + 0.05);
  stoneBox(B, 'stoneLight', 0.2, h, 0.16, x - w / 2 - 0.12, h / 2 + 0.45, z + 0.05);
  stoneBox(B, 'stoneLight', 0.2, h, 0.16, x + w / 2 + 0.12, h / 2 + 0.45, z + 0.05);
  stoneBox(B, 'stoneDark', w + 0.9, 0.18, 0.7, x, 0.09, z + 0.35);
  stoneBox(B, 'stoneDark', w + 0.7, 0.18, 0.45, x, 0.27, z + 0.22);
}
// small tiled canopy over a door (门罩)
function doorCanopy(B, x, y, z, w) {
  B.pushT(x, y, z + 0.45);
  addRoof(B, hipRoof({ a: w / 2 + 0.35, b: 0.55, r: w / 2 + 0.35, H: 0.35, up: 0.18, gable: true, tileEnds: false }), mat(0, 0, 0));
  B.pop();
  for (let i = 0; i < 4; i++) B.box('woodRed', 0.12, 0.12, 0.5, x - w / 2 + (i + 0.5) * (w / 4), y - 0.1, z + 0.25);
}

// Horse-head (stepped gable) wall, at local x, spanning depth d.
function horseHeadWall(B, x, d, baseH, ridgeH) {
  const steps = d > 9 ? 3 : 2;
  const sw = d / (steps * 2 - 1);
  for (let i = 0; i < steps * 2 - 1; i++) {
    const k = steps - 1 - Math.abs(i - (steps - 1)); // 0..steps-1..0
    const top = baseH + (ridgeH + 0.7) * (k + 1) / steps;
    const z0 = -d / 2 + i * sw;
    plasterBox(B, 'plaster', 0.36, top, sw + 0.02, x, 0, z0 + sw / 2);
    // tile cap on every step, with upturned ends
    B.pushT(x, top, z0 + sw / 2, Math.PI / 2);
    addRoof(B, hipRoof({ a: sw / 2 + 0.12, b: 0.36, r: sw / 2 + 0.12, H: 0.18, up: 0.04, gable: true, tileEnds: false, curls: false, coarse: true }), mat(0, 0, 0));
    B.pop();
    B.box('ink', 0.4, 0.06, sw + 0.04, x, top - 0.03, z0 + sw / 2);
  }
}

export function buildHouse(P, h, idx) {
  const B = P.B; const R = mulberry32(1000 + idx * 7);
  const ry = h.face > 0 ? 0 : Math.PI;
  B.pushT(h.cx, 0, h.cz, ry);
  const { w, d } = h; const f1 = 3.1, f2 = 2.7; const wallH = h.floors === 2 ? f1 + f2 : f1 + 0.5;
  const wooden = !h.hh && h.floors === 2;
  // plinth
  stoneBox(B, 'stoneDark', w + 0.2, 0.45, d + 0.2, 0, 0.22, 0);
  B.pushT(0, 0.45, 0);
  // walls
  if (wooden) {
    plasterBox(B, 'plaster', w, wallH, d - 0.6, 0, 0, -0.3);
    // ground floor timber shopfront
    B.box('woodDark', w - 0.2, f1, 0.18, 0, f1 / 2, d / 2 - 0.4);
    const n = Math.max(3, Math.round(w / 1.25));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + 0.2 + (i + 0.5) * ((w - 0.4) / n);
      if (i === Math.floor(n / 2)) { B.add('door', new THREE.PlaneGeometry((w - 0.4) / n - 0.1, 2.4), mat(x, 1.25, d / 2 - 0.3)); continue; }
      windowPanel(B, x, 1.75, d / 2 - 0.32, (w - 0.4) / n - 0.16, 1.5, idx % 3);
      B.box('woodMid', (w - 0.4) / n - 0.1, 0.9, 0.05, x, 0.5, d / 2 - 0.3);
    }
    // upper floor overhang with lattice row and balcony rail
    B.box('woodDark', w + 0.1, 0.22, 0.6, 0, f1 + 0.1, d / 2 - 0.2);
    B.box('woodMid', w - 0.1, f2 - 0.2, 0.14, 0, f1 + f2 / 2, d / 2 - 0.05);
    const m = Math.max(2, Math.round(w / 1.6));
    for (let i = 0; i < m; i++) { const x = -w / 2 + (i + 0.5) * (w / m); windowPanel(B, x, f1 + 1.35, d / 2 + 0.03, w / m - 0.4, 1.3, (idx + 1) % 3); }
    if (R() < 0.7) {
      B.box('woodRed', w - 0.2, 0.08, 0.08, 0, f1 + 1.0, d / 2 + 0.55);
      B.box('woodRed', w - 0.2, 0.06, 0.06, 0, f1 + 0.55, d / 2 + 0.55);
      for (let x = -w / 2 + 0.2; x <= w / 2 - 0.15; x += 0.45) B.box('woodRed', 0.05, 0.75, 0.05, x, f1 + 0.6, d / 2 + 0.55);
      B.box('woodDark', w, 0.08, 0.7, 0, f1 + 0.22, d / 2 + 0.25);
    }
    for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) B.box('woodDark', 0.24, wallH, 0.24, x, wallH / 2, d / 2 - 0.1);
    P.lantern(-w / 2 + 0.9, f1 - 0.35, d / 2 + 0.25, 0.9); P.lantern(w / 2 - 0.9, f1 - 0.35, d / 2 + 0.25, 0.9);
  } else {
    plasterBox(B, 'plaster', w, wallH, d, 0, 0, 0);
    doorway(B, 0, d / 2, 1.5, 2.3);
    doorCanopy(B, 0, 3.0, d / 2, 2.4);
    for (const x of [-w / 2 + 1.4, w / 2 - 1.4]) if (w > 7) windowPanel(B, x, 2.0, d / 2 + 0.01, 1.0, 0.9, 2);
    if (h.floors === 2) for (const x of [-w / 4, w / 4]) windowPanel(B, x, f1 + 1.2, d / 2 + 0.01, 1.2, 1.0, idx % 2);
    for (const x of [-w / 2 + 1.2, 0, w / 2 - 1.2]) windowPanel(B, x, 2.2, -d / 2 - 0.01, 0.9, 0.8, 1, Math.PI);
    P.lantern(-1.15, 2.75, d / 2 + 0.5, 0.75); P.lantern(1.15, 2.75, d / 2 + 0.5, 0.75);
  }
  // timber band + side windows
  B.box('woodDark', w + 0.04, 0.16, d + 0.04, 0, f1, 0);
  for (const s of [-1, 1]) windowPanel(B, s * (w / 2 + 0.01), 2.1, 0, 0.9, 0.8, 0, s * Math.PI / 2);
  // roof
  const ridgeH = Math.min(3.2, d * 0.3);
  const eaveY = wallH;
  B.pushT(0, eaveY, 0);
  addRoof(B, hipRoof({ a: w / 2 + (h.hh ? 0.05 : 0.55), b: d / 2 + 0.75, r: w / 2, H: ridgeH, up: h.hh ? 0.12 : 0.32, gable: true }), mat(0, 0, 0));
  // brackets under front eave
  for (let x = -w / 2 + 0.5; x < w / 2 - 0.3; x += 1.0) B.box('woodDark', 0.12, 0.18, 0.7, x, -0.2, d / 2 + 0.25);
  B.pop();
  if (h.hh) { for (const s of [-1, 1]) horseHeadWall(B, s * (w / 2 + 0.05), d + 0.3, eaveY, ridgeH); }
  else {
    for (const sx of [-1, 1]) gableWall(B, sx * (w / 2), d, d / 2 + 0.75, ridgeH, eaveY);
  }
  // chimney
  if (R() < 0.65) {
    const cx = (R() - 0.5) * w * 0.5, cz = -d / 4;
    const cy = eaveY + ridgeH * (1 - Math.pow(Math.abs(cz) / (d / 2 + 0.75), 1)) - 0.2;
    plasterBox(B, 'plaster', 0.6, 1.3, 0.6, cx, cy - 0.3, cz);
    stoneBox(B, 'ridge', 0.85, 0.12, 0.85, cx, cy + 1.05, cz);
    P.chimneys.push(P.w(cx, cy + 1.2, cz));
  }
  B.pop();
  // front sign
  if (h.sign) P.sign(h.sign[0], 0, wooden ? 3.45 + 0.45 : 3.65 + 0.45, d / 2 + (wooden ? 0.62 : 0.14), 0.55);
  // pots and plants at the door
  P.decor = P.decor || []; P.decor.push({ type: 'frontage', m: B.top.clone(), w, d, wooden, seed: idx });
  const label = h.sign ? [h.sign[0], h.sign[1]] : [pick(['民居', '人家', '宅院']), 'Жилой дом'];
  P.pick(label, -w / 2, w / 2, 0, wallH + ridgeH + 0.5, -d / 2, d / 2);
  B.pop();
}

export function buildTeahouse(P) {
  const B = P.B; const T = L.TEAHOUSE;
  const cx = (T.x0 + T.x1) / 2, cz = (T.z0 + T.z1) / 2, w = T.x1 - T.x0, d = T.z1 - T.z0;
  B.pushT(cx, 0, cz);
  stoneBox(B, 'stoneDark', w + 0.3, 0.5, d + 0.3, 0, 0.25, 0);
  const f1 = 3.4, f2 = 3.0, y0 = 0.5;
  B.pushT(0, y0, 0);
  plasterBox(B, 'plasterWarm', w - 0.4, f1 + f2, d - 1.2, 0, 0, -0.6);
  B.pushT(0, 0, -0.6); backWindows(B, w - 0.4, d - 1.2, 2.0, 4, 1); backWindows(B, w - 0.4, d - 1.2, f1 + 1.5, 4, 2); B.pop();
  // ground floor: open lattice doors between red columns
  const n = 6;
  for (let i = 0; i <= n; i++) B.cyl('woodRed', 0.17, 0.19, f1 + f2, -w / 2 + 0.3 + i * (w - 0.6) / n, (f1 + f2) / 2, d / 2 - 0.3, 12);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.3 + (i + 0.5) * (w - 0.6) / n;
    if (i === 2 || i === 3) { B.add('door', new THREE.PlaneGeometry(1.5, 2.6), mat(x, 1.3, d / 2 - 0.6)); continue; }
    windowPanel(B, x, 1.7, d / 2 - 0.55, (w - 0.6) / n - 0.35, 2.2, 0);
  }
  // carved lintel (挂落) under the floor beam
  B.box('woodRed', w - 0.4, 0.3, 0.2, 0, f1 - 0.2, d / 2 - 0.3);
  for (let i = 0; i < 28; i++) B.box('gold', 0.05, 0.22, 0.05, -w / 2 + 0.5 + i * (w - 1) / 27, f1 - 0.5, d / 2 - 0.25);
  B.box('woodRed', w - 0.4, 0.06, 0.08, 0, f1 - 0.62, d / 2 - 0.25);
  // skirt roof over ground floor (first eave)
  B.pushT(0, f1 + 0.15, 0);
  addRoof(B, hipRoof({ a: w / 2 + 1.0, b: d / 2 + 1.0, r: w / 2 - 1.4, H: 2.2, up: 0.55, u0: 0.52 }), mat(0, 0, 0));
  B.pop();
  // balcony floor projecting over terrace
  const bd = 2.2;
  B.box('woodDark', w + 0.2, 0.24, bd, 0, f1 + 0.62, d / 2 + bd / 2 - 0.2);
  for (const x of [-w / 2 + 0.3, -w / 6, w / 6, w / 2 - 0.3]) B.cyl('woodRed', 0.14, 0.15, f1 + 0.5, x, (f1 + 0.5) / 2 - 0.25, d / 2 + bd - 0.4, 10);
  // balcony railing (美人靠) with lanterns
  const rz = d / 2 + bd - 0.25;
  B.box('woodRed', w, 0.1, 0.12, 0, f1 + 1.75, rz); B.box('woodRed', w, 0.08, 0.08, 0, f1 + 1.0, rz);
  for (let x = -w / 2 + 0.1; x <= w / 2; x += 0.3) B.box('woodRed', 0.05, 0.75, 0.05, x, f1 + 1.38, rz);
  for (const s of [-1, 1]) { B.box('woodRed', 0.1, 0.1, bd, s * w / 2, f1 + 1.75, d / 2 + bd / 2 - 0.2); }
  // upper floor facade: full lattice
  const m = 6;
  for (let i = 0; i < m; i++) windowPanel(B, -w / 2 + 0.3 + (i + 0.5) * (w - 0.6) / m, f1 + 1.75, d / 2 - 0.55, (w - 0.6) / m - 0.25, 1.9, 2);
  B.box('woodRed', w - 0.4, 2.6, 0.1, 0, f1 + 1.6, d / 2 - 0.62);
  // main hip roof
  B.pushT(0, f1 + f2 + 0.1, 0);
  addRoof(B, hipRoof({ a: w / 2 + 1.1, b: d / 2 + bd * 0.5 + 0.6, r: w / 2 - 1.5, H: 3.0, up: 0.85 }), mat(0, 0, 0.5));
  for (let x = -w / 2; x <= w / 2; x += 0.8) { B.box('woodRed', 0.16, 0.16, 0.5, x, -0.15, d / 2 + bd - 0.2); B.box('jade', 0.14, 0.12, 0.3, x, -0.32, d / 2 + bd - 0.15); }
  B.pop();
  for (let i = 0; i < 5; i++) P.lantern(-w / 2 + 1.2 + i * (w - 2.4) / 4, f1 + f2 - 0.3, d / 2 + bd - 0.1, 1.15, 0.15 + i * 0.03);
  P.lights.push({ p: P.w(0, 2.6, d / 2 + 1.5), color: 0xffa050, intensity: 18, dist: 14 });
  B.pop();
  P.sign('茶楼', 0, y0 + f1 + 2.45, d / 2 + bd - 0.1, 0.75);
  P.sign('茶', -w / 2 - 0.6, 2.4, d / 2 + bd + 1.2, 1.3, { vertical: true, bg: '#e9dfc6', fg: '#1b2a24', border: '#3f7d6a' });
  B.box('woodDark', 0.1, 4.2, 0.1, -w / 2 - 0.6, 2.1, d / 2 + bd + 1.25);
  // terrace deck with steps
  const tr = T.terrace; const tw = tr[1] - tr[0], tdd = tr[3] - tr[2];
  B.box('woodMid', tw, T.terraceY, tdd + 0.05, 0, T.terraceY / 2, d / 2 + tdd / 2);
  B.box('woodDark', tw + 0.1, 0.08, 0.12, 0, T.terraceY - 0.02, d / 2 + tdd);
  for (let k = 0; k < 2; k++) B.box('woodMid', 2.6, 0.12, 0.35, 0, 0.06 + k * 0.12, d / 2 + tdd + 0.35 - k * 0.17);
  for (const tx of [6.6, 10, 13.4]) {
    const lx = tx - cx; const tz = -11.2 - cz;
    furnitureTable(B, lx, T.terraceY, tz, 0.48, 0.78, true);
    stool(B, lx, T.terraceY, -10.35 - cz); stool(B, lx, T.terraceY, -12.05 - cz);
    teaSet(B, lx, T.terraceY + 0.8, tz);
  }
  P.pick(['茶楼', 'Чайная «Нефритовый лист»'], -w / 2, w / 2, 0, f1 + f2 + 4, -d / 2, d / 2 + 4.3);
  B.pop();
}

function furnitureTable(B, x, y, z, r, h, round = false) {
  if (round) B.cyl('woodRed', r, r, 0.07, x, y + h, z, 16); else B.box('woodRed', r * 2, 0.07, r * 1.4, x, y + h, z);
  B.cyl('woodDark', 0.07, 0.1, h, x, y + h / 2, z, 8);
  B.cyl('woodDark', 0.25, 0.28, 0.05, x, y + 0.03, z, 10);
}
function stool(B, x, y, z) { B.cyl('woodRed', 0.2, 0.17, 0.42, x, y + 0.21, z, 10); B.cyl('gold', 0.205, 0.205, 0.03, x, y + 0.42, z, 10); }
function teaSet(B, x, y, z) {
  const pot = new THREE.LatheGeometry([[0, 0], [0.08, 0], [0.1, 0.05], [0.09, 0.1], [0.04, 0.12], [0.03, 0.14], [0, 0.14]].map(([a, b]) => new THREE.Vector2(a, b)), 10);
  B.add('celadon', pot, mat(x, y, z));
  for (let i = 0; i < 3; i++) { const a = i * 2.1; B.cyl('porcelain', 0.035, 0.025, 0.04, x + Math.cos(a) * 0.22, y + 0.02, z + Math.sin(a) * 0.22, 8); }
}

export function buildNoodle(P) {
  const B = P.B; const N = L.NOODLE; const cx = (N.x0 + N.x1) / 2, cz = (N.z0 + N.z1) / 2, w = N.x1 - N.x0, d = N.z1 - N.z0;
  B.pushT(cx, 0, cz, Math.PI); // front faces -z (canal)
  stoneBox(B, 'stoneDark', w + 0.2, 0.4, d + 0.2, 0, 0.2, 0);
  B.pushT(0, 0.4, 0);
  const f1 = 3.3;
  plasterBox(B, 'plaster', w, f1 + 0.6, d - 0.8, 0, 0, -0.4);
  for (let i = 0; i <= 4; i++) B.box('woodDark', 0.24, f1, 0.24, -w / 2 + 0.12 + i * (w - 0.24) / 4, f1 / 2, d / 2 - 0.2);
  B.box('woodDark', w, 0.3, 0.3, 0, f1 - 0.1, d / 2 - 0.2);
  for (let i = 0; i < 28; i++) B.box('woodRed', 0.05, 0.25, 0.05, -w / 2 + 0.4 + i * (w - 0.8) / 27, f1 - 0.42, d / 2 - 0.15);
  // interior back wall shelves with jars
  for (let i = 0; i < 8; i++) { B.cyl(i % 2 ? 'terracotta' : 'celadon', 0.2, 0.16, 0.42, -w / 2 + 1 + i * 0.9, 1.6, -d / 2 + 1.2, 10); }
  B.box('woodDark', w - 1, 0.08, 0.5, 0, 1.38, -d / 2 + 1.2);
  B.pop();
  // roof
  B.pushT(0, f1 + 0.4 + 0.5, 0);
  addRoof(B, hipRoof({ a: w / 2 + 0.6, b: d / 2 + 0.8, r: w / 2, H: 2.6, up: 0.35, gable: true }), mat(0, 0, 0));
  B.pop();
  for (const sx of [-1, 1]) gableWall(B, sx * (w / 2), d, d / 2 + 0.8, 2.6, f1 + 0.9);
  B.pushT(0, 0.4, 0); backWindows(B, w, d - 0.8, 2.2, 4); B.pop();
  B.pop();
  // forecourt in world coords: awning, stove counter, tables, benches
  const az0 = 8.9, az1 = 12.6;
  for (const x of [-15.3, -4.7]) { B.cyl('woodDark', 0.08, 0.09, 2.9, x, 1.45, az0, 8); }
  B.box('woodDark', 10.8, 0.1, 0.1, -10, 2.9, az0);
  const aw = new THREE.PlaneGeometry(11, az1 - az0 + 0.4, 12, 4); const pa = aw.attributes.position;
  for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); pa.setZ(i, -0.18 * Math.sin((y / (az1 - az0 + 0.4) + 0.5) * Math.PI)); }
  aw.computeVertexNormals();
  B.add('clothIndigo', aw, new THREE.Matrix4().makeRotationX(-Math.PI / 2 + 0.16).setPosition(-10, 3.25, (az0 + az1) / 2));
  // scalloped valance
  for (let i = 0; i < 11; i++) B.add('clothIndigo', new THREE.CircleGeometry(0.5, 10, Math.PI, Math.PI), mat(-15 + i + 0.5, 2.95, az0 - 0.05));
  // stove counter with big pots (steam source)
  stoneBox(B, 'stoneLight', 3.8, 1.0, 0.8, -12.9, 0.5, 12.4);
  B.box('woodDark', 3.9, 0.08, 0.9, -12.9, 1.02, 12.4);
  for (const x of [-14.1, -12.9, -11.7]) {
    const pot = new THREE.LatheGeometry([[0, 0], [0.28, 0.02], [0.33, 0.2], [0.32, 0.32], [0.3, 0.34]].map(([a, b]) => new THREE.Vector2(a, b)), 14);
    B.add(x === -12.9 ? 'ink' : 'stoneDark', pot, mat(x, 1.06, 12.4));
    P.steam.push(new THREE.Vector3(x, 1.45, 12.4));
  }
  // bamboo steamer stack
  for (let k = 0; k < 4; k++) B.cyl('basket', 0.3, 0.3, 0.14, -10.7, 1.12 + k * 0.15, 12.35, 14);
  for (const tx of [-12.4, -7.6]) {
    B.box('woodMid', 1.0, 0.07, 0.8, tx, 0.78, 10.8); for (const sx of [-0.42, 0.42]) for (const sz of [-0.32, 0.32]) B.box('woodDark', 0.07, 0.76, 0.07, tx + sx, 0.38, 10.8 + sz);
    for (const sz of [9.95, 11.65]) { B.box('woodMid', 1.3, 0.06, 0.32, tx, 0.45, sz); for (const sx of [-0.55, 0.55]) B.box('woodDark', 0.06, 0.44, 0.28, tx + sx, 0.22, sz); }
    for (const bx of [-0.25, 0.25]) { const bowl = new THREE.LatheGeometry([[0, 0], [0.06, 0], [0.11, 0.06], [0.12, 0.08]].map(([a, b]) => new THREE.Vector2(a, b)), 10); B.add('porcelain', bowl, mat(tx + bx, 0.82, 10.8 + bx * 0.6)); P.steam.push(new THREE.Vector3(tx + bx, 0.95, 10.8 + bx * 0.6)); }
    B.box('woodDark', 0.02, 0.02, 0.24, tx + 0.05, 0.9, 10.8);
  }
  P.lights.push({ p: new THREE.Vector3(-10, 2.6, 10.6), color: 0xffa860, intensity: 14, dist: 12 });
  P.lantern(-15.1, 2.55, 8.75, 1.0, 0.05); P.lantern(-4.9, 2.55, 8.75, 1.0, 0.08);
  B.pushT(cx, 0, cz, Math.PI); P.sign('面馆', 0, 4.4, d / 2 + 0.05, 0.7); B.pop();
  B.pushT(-16.3, 0, 9.0); P.sign('面', 0, 2.1, 0, 1.2, { vertical: true, bg: '#f0e6cf', fg: '#7a1a14', border: '#9e2b22' }); B.pop();
  B.box('woodDark', 0.08, 3.4, 0.08, -16.3, 1.7, 8.95);
  P.pick(['面馆', 'Лапшичная «Тёплая чаша»'], N.x0, N.x1, 0, 7.5, 8.5, N.z1);
}

export function buildInn(P) {
  const B = P.B; const I = L.INN; const cx = (I.x0 + I.x1) / 2, cz = (I.z0 + I.z1) / 2, w = I.x1 - I.x0, d = I.z1 - I.z0;
  B.pushT(cx, 0, cz, Math.PI);
  stoneBox(B, 'stoneDark', w + 0.2, 0.45, d + 0.2, 0, 0.22, 0);
  B.pushT(0, 0.45, 0);
  const f1 = 3.3, f2 = 3.0;
  plasterBox(B, 'plaster', w, f1 + f2, d - 1.4, 0, 0, -0.7);
  for (let i = 0; i <= 6; i++) B.cyl('woodRed', 0.16, 0.18, f1 + f2, -w / 2 + 0.25 + i * (w - 0.5) / 6, (f1 + f2) / 2, d / 2 - 0.25, 10);
  for (let i = 0; i < 6; i++) {
    const x = -w / 2 + 0.25 + (i + 0.5) * (w - 0.5) / 6;
    if (i === 2 || i === 3) B.add('door', new THREE.PlaneGeometry(1.7, 2.6), mat(x, 1.3, d / 2 - 0.7));
    else windowPanel(B, x, 1.8, d / 2 - 0.68, (w - 0.5) / 6 - 0.4, 1.8, 1);
    windowPanel(B, x, f1 + 1.4, d / 2 - 0.68, (w - 0.5) / 6 - 0.35, 1.6, 0);
  }
  B.pushT(0, 0, -0.7); backWindows(B, w, d - 1.4, 2.0, 5, 1); backWindows(B, w, d - 1.4, f1 + 1.4, 5, 0); B.pop();
  B.box('woodDark', w + 0.04, 0.16, d - 1.36, 0, f1, -0.7);
  // gallery
  B.box('woodDark', w, 0.2, 1.2, 0, f1, d / 2 - 0.4);
  B.box('woodRed', w - 0.3, 0.09, 0.1, 0, f1 + 1.0, d / 2 - 0.05);
  for (let x = -w / 2 + 0.2; x < w / 2; x += 0.34) B.box('woodRed', 0.05, 0.85, 0.05, x, f1 + 0.55, d / 2 - 0.05);
  B.pushT(0, f1 + f2, 0);
  addRoof(B, hipRoof({ a: w / 2 + 0.9, b: d / 2 + 0.9, r: w / 2 - 2.5, H: 3.1, up: 0.7 }), mat(0, 0, 0));
  for (let x = -w / 2 + 0.2; x <= w / 2; x += 0.7) B.box('woodRed', 0.14, 0.14, 0.5, x, -0.14, d / 2 - 0.05);
  B.pop();
  for (let i = 0; i < 6; i++) P.lantern(-w / 2 + 1 + i * (w - 2) / 5, f1 + f2 - 0.35, d / 2 + 0.25, 1.0, 0.1 + i * 0.05);
  for (const s of [-1, 1]) P.lantern(s * 1.9, f1 - 0.6, d / 2 + 0.1, 1.2, 0.02);
  B.pop();
  P.sign('悦来客栈', 0, 0.45 + f1 - 0.35 + 0.0, d / 2 + 0.25 - 0.65 + 0.75, 0.6);
  P.lights.push({ p: P.w(0, 2.5, d / 2 + 1.5), color: 0xffa050, intensity: 12, dist: 12 });
  P.pick(['悦来客栈', 'Гостиница «Радость гостя»'], -w / 2, w / 2, 0, f1 + f2 + 4, -d / 2, d / 2);
  B.pop();
}

export function buildTemple(P) {
  const B = P.B; const T = L.TEMPLE; const hl = T.hall;
  // courtyard walls: ochre-red with tile coping
  const wallH = 2.8;
  const wall = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0);
    B.pushT((x0 + x1) / 2, 0, (z0 + z1) / 2, ang - Math.PI / 2);
    stoneBox(B, 'stoneDark', len, 0.5, 0.7, 0, 0.25, 0);
    const g = new THREE.BoxGeometry(len, wallH, 0.5); scaleBoxUV(g, len, wallH, 0.5, 4);
    B.add('templeWall', g, mat(0, 0.5 + wallH / 2, 0));
    B.pushT(0, 0.5 + wallH, 0);
    addRoof(B, hipRoof({ a: len / 2 + 0.1, b: 0.6, r: len / 2 + 0.1, H: 0.35, up: 0.06, gable: true, tileEnds: false, curls: false, coarse: true }), mat(0, 0, 0));
    B.pop(); B.pop();
  };
  wall(T.x0, T.z0, T.x1, T.z0); wall(T.x0, T.z0, T.x0, T.z1); wall(T.x1, T.z0, T.x1, T.z1);
  wall(T.x0, T.z1, -2.2, T.z1); wall(2.2, T.z1, T.x1, T.z1);
  // gatehouse
  B.pushT(0, 0, T.z1);
  for (const s of [-1, 1]) { B.cyl('woodRed', 0.2, 0.22, 3.8, s * 2.0, 1.9, 0, 12); stoneBox(B, 'stoneLight', 0.6, 0.4, 0.6, s * 2.0, 0.2, 0); }
  B.box('woodRed', 4.6, 0.4, 0.5, 0, 3.7, 0); B.box('jade', 4.4, 0.2, 0.55, 0, 3.45, 0);
  B.pushT(0, 4.0, 0); addRoof(B, hipRoof({ a: 3.4, b: 1.6, r: 1.6, H: 1.5, up: 0.55 }), mat(0, 0, 0)); B.pop();
  P.sign('玉河寺', 0, 3.42, 0.32, 0.45, { bg: '#13233a', fg: '#e6c46a' });
  P.sign('玉河寺', 0, 3.42, -0.32, 0.45, { bg: '#13233a', fg: '#e6c46a', ry: Math.PI });
  B.pop();
  // stone lanterns at the gate (inside)
  for (const s of [-1, 1]) stoneLantern(B, P, s * 3.2, T.z1 - 1.2);
  // main hall on platform
  B.pushT(hl.cx, 0, hl.cz);
  const pw = hl.w + 2, pd = hl.d + 1;
  stoneBox(B, 'stoneLight', pw, hl.plat, pd, 0, hl.plat / 2, 0);
  for (let k = 0; k < 3; k++) stoneBox(B, 'stoneLight', 4.2, hl.plat / 3 * (3 - k), 0.35, 0, hl.plat / 6 * (3 - k), pd / 2 + 0.17 + k * 0.35);
  // white balustrade
  for (let x = -pw / 2 + 0.2; x <= pw / 2 - 0.2; x += 1.1) if (Math.abs(x) > 2.4) stoneBox(B, 'porcelain', 0.18, 0.7, 0.18, x, hl.plat + 0.35, pd / 2 - 0.12);
  for (const s of [-1, 1]) stoneBox(B, 'porcelain', pw / 2 - 2.5, 0.12, 0.1, s * (pw / 4 + 1.25), hl.plat + 0.55, pd / 2 - 0.12);
  B.pushT(0, hl.plat, 0);
  const H1 = 4.2;
  plasterBox(B, 'templeWall', hl.w - 1.6, H1 + 2.2, hl.d - 1.8, 0, 0, -0.4);
  for (let i = 0; i < 8; i++) { const x = -hl.w / 2 + 0.6 + i * (hl.w - 1.2) / 7; B.cyl('woodRed', 0.24, 0.26, H1, x, H1 / 2, hl.d / 2 - 0.3, 14); stoneBox(B, 'stoneLight', 0.7, 0.2, 0.7, x, 0.1, hl.d / 2 - 0.3); }
  for (let i = 0; i < 7; i++) { const x = -hl.w / 2 + 0.6 + (i + 0.5) * (hl.w - 1.2) / 7; windowPanel(B, x, 1.9, hl.d / 2 - 1.28, (hl.w - 1.2) / 7 - 0.3, 3.0, i === 3 ? 2 : 0); }
  // painted beams & bracket sets (斗拱)
  B.box('jade', hl.w - 0.4, 0.35, 0.35, 0, H1 - 0.15, hl.d / 2 - 0.3);
  B.box('woodRed', hl.w - 0.4, 0.18, 0.4, 0, H1 + 0.12, hl.d / 2 - 0.3);
  for (let x = -hl.w / 2 + 0.4; x <= hl.w / 2 - 0.3; x += 0.62) {
    B.box('gold', 0.18, 0.16, 0.5, x, H1 + 0.3, hl.d / 2 - 0.2); B.box('jade', 0.36, 0.12, 0.2, x, H1 + 0.44, hl.d / 2 - 0.05); B.box('woodRed', 0.2, 0.16, 0.65, x, H1 + 0.58, hl.d / 2 - 0.1);
  }
  B.pushT(0, H1 + 0.6, 0);
  addRoof(B, hipRoof({ a: hl.w / 2 + 1.3, b: hl.d / 2 + 1.3, r: hl.w / 2 - 2, H: 2.6, up: 0.9, u0: 0.5 }), mat(0, 0, 0), { tile: 'tileGold' });
  B.pop();
  B.pushT(0, H1 + 2.4, -0.4);
  B.box('woodRed', hl.w - 1.6, 0.3, hl.d - 1.8, 0, 0.1, 0);
  for (let x = -hl.w / 2 + 1.1; x <= hl.w / 2 - 1.0; x += 0.6) { B.box('gold', 0.16, 0.14, 0.45, x, 0.32, (hl.d - 1.8) / 2 + 0.1); B.box('jade', 0.3, 0.1, 0.18, x, 0.44, (hl.d - 1.8) / 2 + 0.25); }
  addRoof(B, hipRoof({ a: hl.w / 2 + 0.2, b: hl.d / 2 + 0.2, r: hl.w / 2 - 2.5, H: 3.2, up: 1.0 }), mat(0, 0.5, 0), { tile: 'tileGold' });
  B.pop();
  B.pop();
  P.sign('大雄宝殿', 0, hl.plat + H1 + 1.6, hl.d / 2 - 1.15, 0.7, { bg: '#13233a', fg: '#e6c46a' });
  P.lantern(-2.4, hl.plat + H1 - 0.6, hl.d / 2 + 0.1, 1.3, 0.12); P.lantern(2.4, hl.plat + H1 - 0.6, hl.d / 2 + 0.1, 1.3, 0.12);
  P.lights.push({ p: P.w(0, 3, hl.d / 2 + 3), color: 0xffb060, intensity: 14, dist: 16 });
  P.pick(['大雄宝殿', 'Храм Нефритовой реки — главный зал'], -pw / 2, pw / 2, 0, hl.plat + H1 + 7, -pd / 2, pd / 2);
  B.pop();
  // bronze incense burner
  const [bx, bz] = T.burner;
  B.pushT(bx, 0, bz);
  stoneBox(B, 'stoneLight', 1.6, 0.3, 1.6, 0, 0.15, 0);
  const pot = new THREE.LatheGeometry([[0, 0], [0.45, 0.05], [0.6, 0.35], [0.62, 0.7], [0.5, 0.85], [0.55, 0.9]].map(([a, b]) => new THREE.Vector2(a, b)), 16);
  B.add('bronze', pot, mat(0, 0.6, 0));
  for (let i = 0; i < 3; i++) { const a = i * 2.094; B.cyl('bronze', 0.07, 0.05, 0.4, Math.cos(a) * 0.38, 0.45, Math.sin(a) * 0.38, 6); }
  for (const s of [-1, 1]) B.box('bronze', 0.1, 0.35, 0.3, s * 0.6, 1.6, 0);
  B.pushT(0, 2.1, 0); addRoof(B, pyramidRoof(6, 0.6, 0.55, 0.15), mat(0, 0, 0), { tile: 'bronze', under: 'bronze', ridge: 'bronze' }); B.pop();
  for (let i = 0; i < 6; i++) { const a = i * 1.047; B.cyl('bronze', 0.04, 0.04, 0.6, Math.cos(a) * 0.4, 1.8, Math.sin(a) * 0.4, 5); }
  B.pop();
  P.smokeIncense = new THREE.Vector3(bx, 1.7, bz);
  P.pick(['香炉', 'Бронзовая курильница'], bx - 0.8, bx + 0.8, 0, 2.7, bz - 0.8, bz + 0.8);
}

function stoneLantern(B, P, x, z) {
  B.pushT(x, 0, z);
  stoneBox(B, 'stoneLight', 0.6, 0.2, 0.6, 0, 0.1, 0);
  B.cyl('stoneLight', 0.12, 0.15, 0.9, 0, 0.65, 0, 8);
  stoneBox(B, 'stoneLight', 0.5, 0.12, 0.5, 0, 1.15, 0);
  B.add('paperLamp', new THREE.BoxGeometry(0.36, 0.34, 0.36), mat(0, 1.38, 0));
  B.pushT(0, 1.56, 0); addRoof(B, pyramidRoof(4, 0.48, 0.32, 0.1), mat(0, 0, 0), { tile: 'stoneLight', under: 'stoneLight', ridge: 'stoneLight' }); B.pop();
  B.pop();
  P.paperLamps = P.paperLamps || []; P.paperLamps.push(P.w(x, 1.38, z));
}

export function buildPaifang(P) {
  const B = P.B; const { x, z } = L.PAIFANG;
  B.pushT(x, 0, z);
  const posts = [-4.3, -2.1, 2.1, 4.3];
  for (const px of posts) {
    const h = Math.abs(px) < 3 ? 5.6 : 4.4;
    stoneBox(B, 'stoneLight', 0.5, h, 0.5, px, h / 2, 0);
    stoneBox(B, 'stoneDark', 0.9, 0.5, 1.3, px, 0.25, 0);
    // drum stones
    for (const s of [-1, 1]) { B.cyl('stoneLight', 0.32, 0.32, 0.2, px, 0.85, s * 0.55, 14, 0, Math.PI / 2); }
  }
  stoneBox(B, 'stoneLight', 4.6, 0.5, 0.45, 0, 4.9, 0); stoneBox(B, 'stoneLight', 4.4, 0.3, 0.4, 0, 4.0, 0);
  for (const s of [-1, 1]) { stoneBox(B, 'stoneLight', 2.6, 0.4, 0.4, s * 3.2, 3.8, 0); }
  B.add('jade', new THREE.BoxGeometry(4.2, 0.12, 0.47), mat(0, 4.68, 0));
  // three tiled roofs
  const roofs = [[0, 5.75, 3.0, 1.2], [-3.2, 4.25, 1.7, 0.75], [3.2, 4.25, 1.7, 0.75]];
  for (const [rx, ry, a, H] of roofs) {
    stoneBox(B, 'woodRed', a * 1.6, 0.2, 0.5, rx, ry - 0.08, 0);
    for (let k = -a * 0.75; k <= a * 0.75; k += 0.35) { B.box('gold', 0.12, 0.14, 0.55, rx + k, ry - 0.22, 0); }
    B.pushT(rx, ry, 0); addRoof(B, hipRoof({ a, b: 1.0, r: a * 0.4, H, up: 0.45 }), mat(0, 0, 0)); B.pop();
  }
  P.sign('玉河镇', 0, 4.45, 0.24, 0.6, { bg: '#13233a', fg: '#e6c46a' });
  P.sign('玉河镇', 0, 4.45, -0.24, 0.6, { bg: '#13233a', fg: '#e6c46a', ry: Math.PI });
  P.pick(['牌坊', 'Церемониальные ворота «Нефритовая река»'], -4.6, 4.6, 0, 7.2, -0.6, 0.6);
  B.pop();
}

export function buildPavilion(P) {
  const B = P.B; const [x, z] = L.GARDEN.pavilion;
  B.pushT(x, 0, z);
  const cyl6 = new THREE.CylinderGeometry(1.9, 2.0, 0.45, 6); cyl6.rotateY(Math.PI / 6);
  B.add('stoneLight', cyl6, mat(0, 0.22, 0));
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + Math.PI / 6, px = Math.cos(a) * 1.6, pz = Math.sin(a) * 1.6;
    B.cyl('woodRed', 0.1, 0.11, 2.7, px, 0.45 + 1.35, pz, 10);
    const a2 = a + Math.PI / 6 * 2 / 2 * 1; void a2;
    const nx = Math.cos(a + Math.PI / 3) * 1.6, nz = Math.sin(a + Math.PI / 3) * 1.6;
    const mx = (px + nx) / 2, mz = (pz + nz) / 2, len = Math.hypot(nx - px, nz - pz), ang = Math.atan2(nx - px, nz - pz);
    if (i !== 4) { B.box('woodRed', 0.12, 0.08, len, mx, 0.95, mz, ang); B.box('woodMid', 0.36, 0.06, len, mx * 0.93, 0.85, mz * 0.93, ang); }
    B.box('woodRed', 0.14, 0.2, len, mx, 2.95, mz, ang);
    B.box('gold', 0.06, 0.22, len - 0.2, mx * 1.01, 2.72, mz * 1.01, ang);
  }
  B.pushT(0, 3.05, 0); addRoof(B, pyramidRoof(6, 2.55, 1.9, 0.75), mat(0, 0, 0)); B.pop();
  P.lantern(0, 2.5, 0, 1.1, 0.25);
  P.pick(['湖心亭', 'Беседка у пруда'], -2, 2, 0, 5.2, -2, 2);
  B.pop();
}

export function buildGardenWalls(P) {
  const B = P.B; const G = L.GARDEN; const h = 2.3;
  const seg = (x0, z0, x1, z1, leak = 0) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
    B.pushT((x0 + x1) / 2, 0, (z0 + z1) / 2, ang);
    plasterBox(B, 'plaster', len, h, 0.32, 0, 0, 0);
    B.pushT(0, h, 0); addRoof(B, hipRoof({ a: len / 2 + 0.05, b: 0.45, r: len / 2 + 0.05, H: 0.28, up: 0.05, gable: true, tileEnds: false, curls: false, coarse: true }), mat(0, 0, 0)); B.pop();
    for (let i = 0; i < leak; i++) { const lx = -len / 2 + (i + 0.5) * len / leak; for (const s of [1, -1]) windowPanel(B, lx, 1.45, s * 0.17, 0.75, 0.75, 1, s > 0 ? 0 : Math.PI); }
    B.pop();
  };
  seg(G.x0, G.z0, G.x1, G.z0, 5); seg(G.x0, G.z1, G.x1, G.z1, 0); seg(G.x0, G.z0, G.x0, G.z1, 0);
  seg(G.x1, G.z0, G.x1, G.moonGate - 1.6, 0); seg(G.x1, G.moonGate + 1.6, G.x1, G.z1, 0);
  // moon gate: wall panel with circular opening
  B.pushT(G.x1, 0, G.moonGate, Math.PI / 2);
  const sh = new THREE.Shape(); sh.moveTo(-1.6, 0); sh.lineTo(1.6, 0); sh.lineTo(1.6, h); sh.lineTo(-1.6, h); sh.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 1.15, 1.05, 0, Math.PI * 2, true); sh.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.32, bevelEnabled: false, curveSegments: 32 }); g.translate(0, 0, -0.16);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 4, uv.getY(i) / h * 0.95);
  B.add('plaster', g);
  const ring = new THREE.TorusGeometry(1.08, 0.07, 8, 40); B.add('stoneLight', ring, mat(0, 1.15, 0.17)); B.add('stoneLight', ring, mat(0, 1.15, -0.17));
  B.pushT(0, h, 0); addRoof(B, hipRoof({ a: 1.7, b: 0.45, r: 1.7, H: 0.28, up: 0.05, gable: true, tileEnds: false, curls: false, coarse: true }), mat(0, 0, 0)); B.pop();
  P.sign('怡园', 0, 2.0, 0.19, 0.32, { bg: '#e9e2d2', fg: '#1d2a24', border: '#5b6b62' });
  P.pick(['怡园', 'Сад Радости — пруд с карпами'], -1.6, 1.6, 0, 2.6, -0.3, 0.3);
  B.pop();
}
