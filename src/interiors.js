import * as THREE from 'three';
import { Builder, mat, scaleBoxUV } from './builder.js';
import { M } from './materials.js';
import { signTex } from './textures.js';
import { furnitureTable, stool, teaSet, windowPanel } from './buildings.js';
import * as L from './layout.js';

// Enterable interiors. Shells (walls with door gaps) are part of the town; the
// furnished rooms are built lazily the first time the camera comes close and are
// hidden again when it moves away. Doors are animated leaves that fold open.

import { lathe, vessel, fillDisc } from './geom.js';
// ---- vessels: thick walls, rounded rim, visible inside, plausible contents
const CUP = [[0.022, 0], [0.03, 0.02], [0.034, 0.045]];
const BOWL = [[0.045, 0], [0.085, 0.025], [0.112, 0.06], [0.122, 0.082]];
const WOK = [[0.06, -0.2], [0.18, -0.17], [0.28, -0.09], [0.34, 0.02]];
function cup(B, x, y, z, full = true, m = 'porcelain') {
  B.add(m, vessel(CUP, { wall: 0.004, seg: 14, name: 'tea cup' }), mat(x, y, z));
  if (full) B.add('tea', fillDisc(CUP, 0.032, 0.004, 14), mat(x, y, z));
}
export function bowl(B, x, y, z, fill = 'noodles', m = 'porcelain') {
  B.add(m, vessel(BOWL, { wall: 0.006, seg: 20, name: 'bowl' }), mat(x, y, z));
  if (!fill) return;
  B.add('broth', fillDisc(BOWL, 0.058, 0.006, 20), mat(x, y, z));
  if (fill === 'noodles') {
    // a nest of noodles rising out of the broth, scallion bits on top
    for (let i = 0; i < 7; i++) { const a = i * 0.9; const t = new THREE.TorusGeometry(0.035 + (i % 3) * 0.012, 0.0045, 4, 14); t.rotateX(Math.PI / 2 + 0.25 * Math.sin(i)); t.rotateY(a); B.add('noodle', t, mat(x + Math.cos(a) * 0.012, y + 0.062 + (i % 2) * 0.004, z + Math.sin(a) * 0.012)); }
    for (let i = 0; i < 6; i++) { const a = i * 1.7; B.add('scallion', new THREE.CylinderGeometry(0.007, 0.007, 0.004, 6), mat(x + Math.cos(a) * 0.05, y + 0.07, z + Math.sin(a) * 0.05)); }
  }
}
const LANTERN = lathe([[0, -0.32], [0.08, -0.31], [0.2, -0.24], [0.27, -0.1], [0.28, 0.02], [0.25, 0.15], [0.16, 0.26], [0.08, 0.29], [0, 0.3]], 18, { name: 'paper lantern' });

function box(B, m, x0, x1, y0, y1, z0, z1, uv = 0) {
  const w = x1 - x0, h = y1 - y0, d = z1 - z0; const g = new THREE.BoxGeometry(w, h, d); if (uv) scaleBoxUV(g, w, h, d, uv);
  B.add(m, g, mat((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
}
function hangLantern(B, x, y, z, s = 1) {
  B.add('lampLit', LANTERN.clone().scale(s, s, s), mat(x, y, z));
  B.cyl('woodRed', 0.1 * s, 0.1 * s, 0.05, x, y + 0.31 * s, z, 12); B.cyl('woodRed', 0.1 * s, 0.1 * s, 0.05, x, y - 0.33 * s, z, 12);
  B.cyl('rope', 0.008, 0.008, 0.6, x, y + 0.6 * s, z, 4);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; B.cyl('lanternTassel', 0.008, 0.008, 0.22, x + Math.cos(a) * 0.05, y - 0.47 * s, z + Math.sin(a) * 0.05, 3); }
}
function teapot(B, x, y, z, m = 'celadon') {
  B.add(m, lathe([[0, 0], [0.07, 0], [0.105, 0.04], [0.11, 0.08], [0.09, 0.12], [0.05, 0.135], [0.045, 0.15], [0, 0.15]], 24), mat(x, y, z));
  B.add(m, lathe([[0, 0], [0.025, 0], [0.03, 0.02], [0.012, 0.035], [0, 0.04]], 12), mat(x, y + 0.15, z));
  const spout = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.09, 0.05, 0), new THREE.Vector3(0.15, 0.09, 0), new THREE.Vector3(0.19, 0.14, 0)]), 8, 0.014, 6);
  B.add(m, spout, mat(x, y, z));
  const handle = new THREE.TorusGeometry(0.05, 0.011, 6, 14, Math.PI * 1.2); handle.rotateZ(-Math.PI * 0.6);
  B.add(m, handle, mat(x - 0.11, y + 0.08, z));
  for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.6; cup(B, x + Math.cos(a) * 0.25, y, z + Math.sin(a) * 0.25, i % 2 === 0); }
}
function jar(B, x, y, z, s = 1, m = 'terracotta') { B.add(m, lathe([[0, 0], [0.12, 0], [0.19, 0.12], [0.2, 0.24], [0.13, 0.36], [0.1, 0.4], [0.11, 0.43], [0, 0.43]], 16).scale(s, s, s), mat(x, y, z)); B.cyl('clothRed', 0.12 * s, 0.11 * s, 0.03, x, y + 0.44 * s, z, 12); }
function shelf(B, x0, x1, z0, z1, y0, h, rows = 4, fill = 'jar') {
  for (const x of [x0, x1]) for (const z of [z0, z1]) box(B, 'woodDark', x - 0.03, x + 0.03, y0, y0 + h, z - 0.03, z + 0.03);
  for (let r = 0; r < rows; r++) {
    const y = y0 + 0.15 + r * (h - 0.2) / (rows - 1 || 1);
    box(B, 'woodMid', x0, x1, y, y + 0.03, z0, z1);
    if (r === rows - 1) continue;
    const along = Math.abs(x1 - x0) > Math.abs(z1 - z0); const len = along ? x1 - x0 : z1 - z0; const n = Math.max(2, Math.floor(len / 0.32));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n; const px = along ? x0 + t * (x1 - x0) : (x0 + x1) / 2, pz = along ? (z0 + z1) / 2 : z0 + t * (z1 - z0);
      if (fill === 'books') { const hh = 0.18 + ((i * 37) % 7) * 0.012; box(B, ['clothIndigo', 'clothOchre', 'clothJade', 'clothCream'][i % 4], px - (along ? 0.05 : 0.1), px + (along ? 0.05 : 0.1), y + 0.03, y + 0.03 + hh, pz - (along ? 0.1 : 0.05), pz + (along ? 0.1 : 0.05)); }
      else if (i % 3 === 2) B.add('porcelain', lathe([[0, 0], [0.05, 0], [0.07, 0.08], [0.03, 0.16], [0.04, 0.2], [0, 0.2]], 12), mat(px, y + 0.03, pz));
      else jar(B, px, y + 0.03, pz, 0.45, i % 2 ? 'celadon' : 'terracotta');
    }
  }
}
function screen(B, x, z, len, axis = 'z', panels = 6, h = 1.8, y0 = 0) {
  const pw = len / panels;
  for (let i = 0; i < panels; i++) {
    const t = -len / 2 + (i + 0.5) * pw; const zig = (i % 2 ? 1 : -1) * 0.08;
    const px = axis === 'z' ? x + zig : x + t, pz = axis === 'z' ? z + t : z + zig; const ry = axis === 'z' ? Math.PI / 2 : 0;
    B.push(mat(px, y0, pz, ry));
    box(B, 'lacquer', -pw / 2, pw / 2, 0.05, 0.12, -0.025, 0.025); box(B, 'lacquer', -pw / 2, pw / 2, h - 0.07, h, -0.025, 0.025);
    box(B, 'lacquer', -pw / 2, -pw / 2 + 0.05, 0, h, -0.025, 0.025);
    B.add(i % 2 ? 'clothCream' : 'paper', new THREE.PlaneGeometry(pw - 0.06, h - 0.22), mat(0, h / 2 + 0.02, 0));
    B.pop();
  }
}
function plaque(group, text, x, y, z, ry, height, opts) {
  const t = signTex(text, opts); const w = height * t.userData.aspect;
  const lift = 0.05; // off the wall along the plaque's facing direction (local +z)
  const dx = Math.sin(ry) * lift, dz = Math.cos(ry) * lift;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, height), new THREE.MeshStandardMaterial({
    map: t, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }));
  m.position.set(x + dx, y, z + dz); m.rotation.y = ry;
  m.castShadow = false; m.receiveShadow = false;
  const back = lift - 0.03;
  const board = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, height + 0.14, 0.05), new THREE.MeshStandardMaterial({ color: 0x5a3a28, roughness: 0.8 }));
  board.position.set(x + Math.sin(ry) * back, y, z + Math.cos(ry) * back);
  board.rotation.y = ry; board.castShadow = false; board.receiveShadow = true;
  group.add(board); group.add(m);
}
// rect minus a hole -> up to four rects
function minusHole(r, h) {
  if (!h || h[1] <= r[0] || h[0] >= r[1] || h[3] <= r[2] || h[2] >= r[3]) return [r];
  const out = [[r[0], r[1], r[2], Math.max(r[2], h[2])], [r[0], r[1], Math.min(r[3], h[3]), r[3]], [r[0], Math.max(r[0], h[0]), Math.max(r[2], h[2]), Math.min(r[3], h[3])], [Math.min(r[1], h[1]), r[1], Math.max(r[2], h[2]), Math.min(r[3], h[3])]];
  return out.filter((q) => q[1] - q[0] > 0.01 && q[3] - q[2] > 0.01);
}
// soft contact darkening on the floor under a piece of furniture
function aoBlob(B, x, z, y, sx, sz) { const prev = B.noSolid; B.noSolid = true; B.add('aoBlob', new THREE.PlaneGeometry(sx, sz).rotateX(-Math.PI / 2), mat(x, y + 0.012, z)); B.noSolid = prev; }
// AO strip along a wall: dark at the floor (or ceiling) fading over `h` metres
function aoStrip(B, x0, z0, x1, z1, y, h, nx, nz, down = false) {
  const prev = B.noSolid; B.noSolid = true;
  const len = Math.hypot(x1 - x0, z1 - z0); const g = new THREE.PlaneGeometry(len, h);
  if (down) g.rotateZ(Math.PI); // dark edge at the top
  g.rotateY(Math.atan2(nx, nz)); g.translate((x0 + x1) / 2 + nx * 0.05, down ? y - h / 2 : y + h / 2, (z0 + z1) / 2 + nz * 0.05);
  B.add('aoStrip', g); B.noSolid = prev;
}
// floor, ceiling with beams, wainscot, timber frame, plaster panels and AO for one storey
function roomShell(B, d, floorMat = 'floorWood', { level = 0, hole = null, wall = 'plasterIn' } = {}) {
  const U = d.upper; const lv = level === 1;
  const [x0, x1, z0, z1] = lv ? U.room : d.room; const y = lv ? U.floorY : d.floorY; const cy = lv ? U.ceilY : d.ceilY;
  for (const r of minusHole([x0, x1, z0, z1], lv ? U.hole : null)) box(B, floorMat, r[0], r[1], y - 0.06, y + 0.015, r[2], r[3], 1.6);
  for (const r of minusHole([x0, x1, z0, z1], hole)) box(B, 'woodMid', r[0], r[1], cy, cy + 0.08, r[2], r[3], 2);
  const inHole = (a, b) => hole && b > hole[0] && a < hole[1];
  for (let x = x0 + 1.4; x < x1 - 0.5; x += 1.9) if (!inHole(x - 0.1, x + 0.1)) box(B, 'woodDark', x - 0.1, x + 0.1, cy - 0.2, cy, z0, z1);
  for (const r of minusHole([x0, x1, (z0 + z1) / 2 - 0.12, (z0 + z1) / 2 + 0.12], hole)) box(B, 'woodDark', r[0], r[1], cy - 0.24, cy, r[2], r[3]);
  // stairwell lining between this ceiling and the floor above
  if (hole) { const top = U.floorY; box(B, 'woodDark', hole[0] - 0.04, hole[0], cy, top, hole[2], hole[3]); box(B, 'woodDark', hole[0], hole[1], cy, top, hole[2] - 0.04, hole[2]); box(B, 'woodDark', hole[0], hole[1], cy, top, hole[3], hole[3] + 0.04); }
  const front = d.front === 'z1' ? z1 : z0, back = d.front === 'z1' ? z0 : z1, s = d.front === 'z1' ? 1 : -1;
  const gap = lv ? U.door : d.gap;
  // wainscot + chair rail
  box(B, 'woodDark', x0, x1, y, y + 0.9, back - (s < 0 ? 0.04 : 0), back + (s > 0 ? 0.04 : 0));
  for (const x of [x0, x1]) box(B, 'woodDark', x - (x === x1 ? 0.04 : 0), x + (x === x0 ? 0.04 : 0), y, y + 0.9, z0, z1);
  for (const [a, b] of [[x0, gap[0]], [gap[1], x1]]) box(B, 'woodDark', a, b, y, y + 0.9, front - (s > 0 ? 0.04 : 0), front + (s < 0 ? 0.04 : 0));
  box(B, 'woodRed', x0, x1, y + 0.9, y + 0.96, s > 0 ? back : back - 0.06, s > 0 ? back + 0.06 : back);
  for (const x of [x0, x1]) box(B, 'woodRed', x - (x === x1 ? 0.06 : 0), x + (x === x0 ? 0.06 : 0), y + 0.9, y + 0.96, z0, z1);
  // plaster panels framed by posts and a head beam (back and side walls)
  const ph0 = y + 0.96, ph1 = cy - 0.2;
  const panelRun = (a0, a1, fixed, axis, inward) => {
    const n = Math.max(1, Math.round((a1 - a0) / 1.9)); const step = (a1 - a0) / n;
    for (let i = 0; i <= n; i++) { const a = a0 + i * step; if (axis === 'x') box(B, 'woodDark', a - 0.07, a + 0.07, y, cy, fixed - (inward > 0 ? 0 : 0.07), fixed + (inward > 0 ? 0.07 : 0)); else box(B, 'woodDark', fixed - (inward > 0 ? 0 : 0.07), fixed + (inward > 0 ? 0.07 : 0), y, cy, a - 0.07, a + 0.07); }
    for (let i = 0; i < n; i++) { const a = a0 + (i + 0.5) * step, w = step - 0.14; const g = new THREE.BoxGeometry(axis === 'x' ? w : 0.02, ph1 - ph0, axis === 'x' ? 0.02 : w); scaleBoxUV(g, axis === 'x' ? w : 0.02, ph1 - ph0, axis === 'x' ? 0.02 : w, 2.2); B.add(wall, g, mat(axis === 'x' ? a : fixed + inward * 0.02, (ph0 + ph1) / 2, axis === 'x' ? fixed + inward * 0.02 : a)); }
    if (axis === 'x') box(B, 'woodDark', a0, a1, ph1, cy, fixed - (inward > 0 ? 0 : 0.08), fixed + (inward > 0 ? 0.08 : 0)); else box(B, 'woodDark', fixed - (inward > 0 ? 0 : 0.08), fixed + (inward > 0 ? 0.08 : 0), ph1, cy, a0, a1);
  };
  panelRun(x0, x1, back, 'x', s); panelRun(z0, z1, x0, 'z', 1); panelRun(z0, z1, x1, 'z', -1);
  // ambient occlusion: floor-wall and ceiling-wall junctions
  aoStrip(B, x0, back, x1, back, y + 0.015, 0.55, 0, s); aoStrip(B, x0, z0, x0, z1, y + 0.015, 0.55, 1, 0); aoStrip(B, x1, z0, x1, z1, y + 0.015, 0.55, -1, 0);
  for (const [a, b] of [[x0, gap[0]], [gap[1], x1]]) aoStrip(B, a, front, b, front, y + 0.015, 0.45, 0, -s);
  aoStrip(B, x0, back, x1, back, cy - 0.2, 0.6, 0, s, true); aoStrip(B, x0, z0, x0, z1, cy - 0.2, 0.6, 1, 0, true); aoStrip(B, x1, z0, x1, z1, cy - 0.2, 0.6, -1, 0, true);
}
// stairs from the ground floor to the upper floor: solid treads + risers, handrail on the open side
function stairs(B, d) {
  const S = d.upper.stairs, y = d.floorY;
  for (const [sx0, sx1, sz0, sz1, top] of S.steps) { box(B, 'woodMid', sx0, sx1, top - 0.05, top, sz0, sz1); box(B, 'woodDark', sx0 + 0.02, sx1 - 0.02, y, top - 0.05, sz0, sz1); }
  const xr = S.x0 + 0.02, st = S.steps;
  for (let k = 0; k < st.length; k += 3) B.cyl('woodRed', 0.022, 0.022, 0.9, xr, st[k][4] + 0.45, (st[k][2] + st[k][3]) / 2, 6);
  const a = st[0], b = st[st.length - 1];
  B.add('woodRed', new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(xr, a[4] + 0.9, (a[2] + a[3]) / 2), new THREE.Vector3(xr, b[4] + 0.9, (b[2] + b[3]) / 2)), 4, 0.03, 6));
}
// railing around the stairwell on the upper floor (open toward the stair top)
function wellRail(B, d) {
  const U = d.upper, [hx0, hx1, hz0, hz1] = U.hole, y = U.floorY; const lowEnd = U.stairs.z1 > U.stairs.z0 ? hz0 : hz1;
  const post = (x, z) => { B.cyl('woodRed', 0.03, 0.03, 0.95, x, y + 0.475, z, 6); B.add('gold', new THREE.SphereGeometry(0.04, 8, 6), mat(x, y + 0.97, z)); };
  for (let z = hz0; z <= hz1 + 0.01; z += (hz1 - hz0) / Math.max(1, Math.round((hz1 - hz0) / 0.6))) post(hx0 - 0.04, z);
  for (let x = hx0; x <= hx1 + 0.01; x += (hx1 - hx0) / 2) post(x, lowEnd);
  box(B, 'woodRed', hx0 - 0.08, hx0, y + 0.88, y + 0.94, hz0, hz1); box(B, 'woodRed', hx0 - 0.08, hx1, y + 0.88, y + 0.94, lowEnd - 0.04, lowEnd + 0.04);
  box(B, 'woodRed', hx0 - 0.07, hx0 - 0.01, y + 0.4, y + 0.44, hz0, hz1); box(B, 'woodRed', hx0 - 0.07, hx1, y + 0.4, y + 0.44, lowEnd - 0.03, lowEnd + 0.03);
}
function bed(B, bx0, bx1, bz0, bz1, y, open = 'z1') {
  box(B, 'woodRed', bx0, bx1, y, y + 0.5, bz0, bz1);
  B.add('clothRed', new THREE.BoxGeometry(bx1 - bx0 - 0.15, 0.14, bz1 - bz0 - 0.15), mat((bx0 + bx1) / 2, y + 0.58, (bz0 + bz1) / 2));
  B.add('clothCream', new THREE.CylinderGeometry(0.12, 0.12, 0.6, 12).rotateZ(Math.PI / 2), mat((bx0 + bx1) / 2, y + 0.72, open === 'z1' ? bz0 + 0.3 : bz1 - 0.3));
  for (const x of [bx0 + 0.05, bx1 - 0.05]) for (const z of [bz0 + 0.05, bz1 - 0.05]) box(B, 'woodRed', x - 0.05, x + 0.05, y, y + 2.3, z - 0.05, z + 0.05);
  box(B, 'woodRed', bx0, bx1, y + 2.2, y + 2.32, bz0, bz1);
  const zf = open === 'z1' ? bz1 : bz0;
  box(B, 'woodDark', bx0 + 0.05, bx1 - 0.05, y + 1.95, y + 2.2, zf - 0.05, zf - 0.01 + (open === 'z1' ? 0 : 0.06));
  for (const sd of [0, 1]) { const curtain = new THREE.PlaneGeometry(0.55, 1.5, 6, 1); const pp = curtain.attributes.position; for (let i = 0; i < pp.count; i++) pp.setZ(i, Math.sin(pp.getX(i) * 22) * 0.04); curtain.computeVertexNormals(); B.add('clothCream', curtain, mat(sd ? bx1 - 0.32 : bx0 + 0.32, y + 1.2, zf + (open === 'z1' ? -0.02 : 0.02))); }
  aoBlob(B, (bx0 + bx1) / 2, (bz0 + bz1) / 2, y, bx1 - bx0 + 0.5, bz1 - bz0 + 0.5);
}
function cushion(B, x, y, z, m = 'clothOchre') { B.cyl(m, 0.24, 0.26, 0.1, x, y + 0.05, z, 16); B.cyl('gold', 0.06, 0.06, 0.012, x, y + 0.106, z, 8); }
function lowTable(B, x, y, z, w = 0.9, dd = 0.6) { box(B, 'woodRed', x - w / 2, x + w / 2, y + 0.31, y + 0.36, z - dd / 2, z + dd / 2); for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(B, 'woodDark', x + sx * (w / 2 - 0.06) - 0.03, x + sx * (w / 2 - 0.06) + 0.03, y, y + 0.30, z + sz * (dd / 2 - 0.06) - 0.03, z + sz * (dd / 2 - 0.06) + 0.03); aoBlob(B, x, z, y, w + 0.3, dd + 0.3); }
function innerWindows(B, d, xs, y = 1.9) {
  const back = d.front === 'z1' ? d.room[2] : d.room[3]; const ry = d.front === 'z1' ? 0 : Math.PI;
  for (const x of xs) windowPanel(B, x, d.floorY + y, back + (d.front === 'z1' ? 0.02 : -0.02), 0.9, 0.8, 1, ry);
}

// ---------------------------------------------------------------- the four rooms
const ROOMS = {
  teahouse(B, g, d) {
    roomShell(B, d, 'floorWood', { hole: d.upper.hole }); const y = d.floorY;
    stairs(B, d);
    innerWindows(B, d, [5.8, 14.2]);
    for (const [tx, tz] of [[7, -17.2], [13, -17.2]]) {
      furnitureTable(B, tx, y, tz, 0.45, 0.78, false); aoBlob(B, tx, tz, y, 1.9, 1.9);
      for (const [sx, sz] of [[0, 0.75], [0, -0.75], [0.75, 0], [-0.75, 0]]) stool(B, tx + sx, y, tz + sz);
      teapot(B, tx, y + 0.815, tz);
      B.add('basket', vessel([[0.11, 0], [0.15, 0.035], [0.16, 0.06]], { wall: 0.01, seg: 18, name: 'tea tray' }), mat(tx + 0.25, y + 0.815, tz - 0.2));
      for (let k = 0; k < 3; k++) B.add('terracotta', new THREE.SphereGeometry(0.03, 8, 6).scale(1, 0.6, 1), mat(tx + 0.2 + k * 0.05, y + 0.84, tz - 0.2 + (k % 2) * 0.04));
    }
    // counter with kettle on a brazier, tea caddies
    box(B, 'woodRed', 8.2, 11.8, y, y + 1.0, -20.4, -19.6); box(B, 'woodDark', 8.1, 11.9, y + 1.0, y + 1.06, -20.45, -19.5);
    for (let i = 0; i < 5; i++) box(B, 'gold', 8.4 + i * 0.75, 8.45 + i * 0.75, y + 0.1, y + 0.9, -19.59, -19.57);
    B.add('bronze', lathe([[0, 0], [0.16, 0], [0.18, 0.12], [0.12, 0.16], [0, 0.16]], 14), mat(11.2, y + 1.06, -20.0));
    B.add('fire', new THREE.CylinderGeometry(0.1, 0.1, 0.02, 10), mat(11.2, y + 1.2, -20.0));
    teapot(B, 11.2, y + 1.22, -20.0, 'ink');
    for (let i = 0; i < 4; i++) jar(B, 8.6 + i * 0.5, y + 1.06, -20.1, 0.5, i % 2 ? 'celadon' : 'porcelain');
    shelf(B, 8.4, 11.6, -20.74, -20.5, y + 1.2, 1.8, 4);
    shelf(B, 4.47, 4.97, -20.7, -18.45, y, 2.2, 5);
    shelf(B, 12.35, 14.25, -20.74, -20.48, y, 2.2, 5, 'books');
    screen(B, 5.0, -16.65, 1.5, 'z', 3, 1.7, y);
    aoBlob(B, 10, -20.0, y, 4.2, 1.4);
    // ---- upper floor: 雅座 tea room with low tables, a guqin and scrolls; balcony door to the canal
    const U = d.upper, yu = U.floorY;
    roomShell(B, d, 'floorWood', { level: 1 }); wellRail(B, d);
    for (const [tx, tz] of [[6.6, -18.4], [10.2, -18.4]]) { lowTable(B, tx, yu, tz); for (const [cx, cz] of [[-0.45, -0.55], [0.45, -0.55], [-0.45, 0.55], [0.45, 0.55]]) cushion(B, tx + cx, yu, tz + cz, cx < 0 ? 'clothOchre' : 'clothJade'); teapot(B, tx, yu + 0.35, tz, 'porcelain'); }
    // guqin on its table
    box(B, 'woodRed', 5.3, 6.9, yu + 0.62, yu + 0.66, -15.55, -15.15); for (const lx of [5.4, 6.8]) for (const lz of [-15.5, -15.2]) box(B, 'woodDark', lx - 0.025, lx + 0.025, yu, yu + 0.62, lz - 0.025, lz + 0.025);
    B.add('lacquer', new THREE.BoxGeometry(1.25, 0.05, 0.19), mat(6.1, yu + 0.69, -15.35)); for (let k = 0; k < 7; k++) box(B, 'gold', 5.5, 6.7, yu + 0.716, yu + 0.72, -15.43 + k * 0.025, -15.425 + k * 0.025);
    cushion(B, 6.1, yu, -14.75, 'clothIndigo'); aoBlob(B, 6.1, -15.35, yu, 1.9, 0.8);
    // scroll paintings on the back wall and a tall vase with plum branches
    for (const [sx, txt] of [[7.2, '山高水长'], [12.6, '听雨']]) { box(B, 'woodDark', sx - 0.42, sx + 0.42, yu + 1.95, yu + 1.99, -20.7, -20.66); plaque(g, txt, sx, yu + 1.35, -20.68, 0, 1.1, { vertical: true, bg: '#efe6d2', fg: '#1b2a24', border: '#8c6a2c' }); }
    jar(B, 13.9, yu, -15.6, 1.0, 'celadon'); B.add('blossom', new THREE.IcosahedronGeometry(0.32, 1), mat(13.9, yu + 0.75, -15.6));
    shelf(B, 4.47, 4.97, -20.7, -19.0, yu, 1.8, 4);
    screen(B, 12.9, -17.6, 1.6, 'z', 3, 1.6, yu);
    for (const [lx, ly, lz] of U.lamps) hangLantern(B, lx, ly, lz, 0.9);
    plaque(g, '雅座', 4.47, yu + 1.6, -17.6, Math.PI / 2, 0.3, { bg: '#13233a', fg: '#e6c46a' });
    // balcony: low tea table by the railing, looking over the canal
    lowTable(B, 6.0, yu, -12.3, 0.8, 0.5); cushion(B, 6.0, yu, -12.95, 'clothOchre'); for (let i = 0; i < 2; i++) cup(B, 5.85 + i * 0.3, yu + 0.35, -12.3, true);
    for (const [lx, ly, lz] of d.lamps) hangLantern(B, lx, ly, lz, 1.1);
    hangLantern(B, 10, 3.0, -15.6, 0.9);
    jar(B, 4.9, y, -15.0, 1.2, 'celadon'); B.add('leaves', new THREE.IcosahedronGeometry(0.35, 1), mat(4.9, y + 0.8, -15.0));
    plaque(g, '茶禅一味', 10, y + 2.75, -20.72, 0, 0.5, { bg: '#13233a', fg: '#e6c46a' });
    plaque(g, '松风', 4.47, y + 2.6, -16.5, Math.PI / 2, 0.45, { bg: '#efe6d2', fg: '#1b2a24' });
  },
  noodle(B, g, d) {
    roomShell(B, d, 'stone'); const y = d.floorY;
    innerWindows(B, d, [-6.5, -9.5]);
    // brick stove with two woks, fire mouths and a flue
    box(B, 'brick', -15.26, -12.2, y, y + 0.95, 19.2, 20.76, 1);
    box(B, 'stoneLight', -15.3, -12.15, y + 0.95, y + 1.02, 19.15, 20.76);
    for (const wx of [-14.45, -13.0]) {
      B.add('ink', vessel(WOK, { wall: 0.012, seg: 28, name: 'wok' }), mat(wx, y + 1.18, 19.95));
      for (const s of [-1, 1]) B.add('ink', new THREE.TorusGeometry(0.045, 0.01, 6, 12, Math.PI), mat(wx + s * 0.36, y + 1.2, 19.95, s > 0 ? 0 : Math.PI));
      B.add(wx < -14 ? 'broth' : 'noodle', fillDisc(WOK, -0.08, 0.012, 28), mat(wx, y + 1.18, 19.95));
      if (wx > -14) for (let i = 0; i < 9; i++) { const a = i * 0.7; const t = new THREE.TorusGeometry(0.09 + (i % 4) * 0.03, 0.007, 4, 18); t.rotateX(Math.PI / 2 + 0.15 * Math.sin(i * 2)); B.add('noodle', t, mat(wx + Math.cos(a) * 0.03, y + 1.11, 19.95 + Math.sin(a) * 0.03)); }
      box(B, 'fire', wx - 0.18, wx + 0.18, y + 0.15, y + 0.42, 19.17, 19.19);
      box(B, 'ink', wx - 0.24, wx + 0.24, y + 0.1, y + 0.47, 19.16, 19.18);
    }
    box(B, 'brick', -15.0, -14.3, y + 1.02, d.ceilY, 20.2, 20.76, 1);
    // prep table: dough, cleaver, bowls stacked
    box(B, 'woodMid', -11.4, -9.4, y + 0.85, y + 0.92, 19.8, 20.7);
    for (const [lx, lz] of [[-11.3, 19.85], [-9.5, 19.85], [-11.3, 20.65], [-9.5, 20.65]]) box(B, 'woodDark', lx - 0.04, lx + 0.04, y, y + 0.85, lz - 0.04, lz + 0.04);
    B.add('noodle', new THREE.SphereGeometry(0.22, 14, 8).scale(1.3, 0.45, 1), mat(-10.8, y + 0.98, 20.2));
    box(B, 'ink', -10.1, -9.85, y + 0.93, y + 0.95, 20.1, 20.35);
    for (let k = 0; k < 5; k++) bowl(B, -9.7, y + 0.92 + k * 0.03, 20.4, null);
    // drying rack of noodles
    for (const rz of [19.3, 19.9]) {
      box(B, 'woodDark', -9.0, -6.0, y + 2.5, y + 2.55, rz - 0.025, rz + 0.025);
      for (let x = -8.9; x < -6.05; x += 0.07) box(B, 'noodle', x - 0.006, x + 0.006, y + 1.75 + Math.sin(x * 7) * 0.08, y + 2.5, rz - 0.006, rz + 0.006);
    }
    for (const x of [-9.05, -5.95]) box(B, 'woodDark', x - 0.04, x + 0.04, y, y + 2.6, 19.25, 19.95);
    // customer table with two benches
    furnitureTable(B, -6.8, y, 16.2, 0.45, 0.76, false);
    for (const bz of [15.45, 16.95]) { box(B, 'woodMid', -7.5, -6.1, y + 0.42, y + 0.47, bz - 0.15, bz + 0.15); for (const bx of [-7.4, -6.2]) box(B, 'woodDark', bx - 0.04, bx + 0.04, y, y + 0.42, bz - 0.12, bz + 0.12); }
    for (const [bx, bz] of [[-7.05, 15.95], [-6.55, 16.45]]) { bowl(B, bx, y + 0.795, bz, 'noodles'); box(B, 'woodDark', bx + 0.14, bx + 0.15, y + 0.8, y + 0.81, bz - 0.11, bz + 0.11); box(B, 'woodDark', bx + 0.165, bx + 0.175, y + 0.8, y + 0.81, bz - 0.11, bz + 0.11); }
    // shelves with jars and sacks; chili & garlic strings
    shelf(B, -15.23, -14.73, 14.25, 17.95, y, 2.0, 4);
    for (let i = 0; i < 3; i++) B.add('basket', new THREE.SphereGeometry(0.28, 10, 8).scale(1, 1.3, 1), mat(-11.6 + i * 0.6, y + 0.35, 20.45));
    for (let i = 0; i < 3; i++) for (let k = 0; k < 9; k++) B.add(i === 1 ? 'porcelain' : 'clothRed', new THREE.SphereGeometry(0.035, 6, 4).scale(1, 1.8, 1), mat(-4.8, y + 2.4 - k * 0.09, 18.0 + i * 0.5));
    for (const [lx, ly, lz] of d.lamps) hangLantern(B, lx, ly, lz, 1.0);
    plaque(g, '一碗暖心', -10.5, y + 2.6, 20.74, Math.PI, 0.45, { bg: '#7a1a14', fg: '#f0d48a' });
  },
  house(B, g, d) {
    roomShell(B, d); const y = d.floorY;
    innerWindows(B, d, [20.4, 25.6]);
    // canopy bed (架子床)
    const bx0 = 19.0, bx1 = 21.2, bz0 = -20.26, bz1 = -18.2;
    box(B, 'woodRed', bx0, bx1, y, y + 0.5, bz0, bz1);
    B.add('clothRed', new THREE.BoxGeometry(2.05, 0.14, 1.9), mat((bx0 + bx1) / 2, y + 0.58, (bz0 + bz1) / 2));
    B.add('clothCream', new THREE.CylinderGeometry(0.12, 0.12, 0.6, 12).rotateZ(Math.PI / 2), mat((bx0 + bx1) / 2, y + 0.72, bz0 + 0.3));
    for (const x of [bx0 + 0.05, bx1 - 0.05]) for (const z of [bz0 + 0.05, bz1 - 0.05]) box(B, 'woodRed', x - 0.05, x + 0.05, y, y + 2.3, z - 0.05, z + 0.05);
    box(B, 'woodRed', bx0, bx1, y + 2.2, y + 2.32, bz0, bz1);
    box(B, 'woodDark', bx0 + 0.05, bx1 - 0.05, y + 1.95, y + 2.2, bz1 - 0.07, bz1 - 0.03);
    for (let x = bx0 + 0.2; x < bx1 - 0.1; x += 0.18) box(B, 'gold', x - 0.012, x + 0.012, y + 1.97, y + 2.18, bz1 - 0.08, bz1 - 0.02);
    for (const s of [0, 1]) { const curtain = new THREE.PlaneGeometry(0.55, 1.5, 6, 1); const p = curtain.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 22) * 0.04); curtain.computeVertexNormals(); B.add('clothCream', curtain, mat(s ? bx1 - 0.32 : bx0 + 0.32, y + 1.2, bz1 - 0.02)); }
    windowPanel(B, bx1 - 0.02, y + 1.2, (bz0 + bz1) / 2, 1.6, 1.0, 2, Math.PI / 2);
    // ancestor altar (供桌) with tablet, candles, incense, fruit; painting above
    box(B, 'woodRed', 22.0, 24.0, y + 0.95, y + 1.02, -20.24, -19.62);
    for (const x of [22.08, 23.92]) for (const z of [-20.18, -19.68]) box(B, 'woodRed', x - 0.04, x + 0.04, y, y + 0.95, z - 0.04, z + 0.04);
    box(B, 'lacquer', 22.82, 23.18, y + 1.02, y + 1.52, -20.12, -20.02); box(B, 'gold', 22.86, 23.14, y + 1.1, y + 1.44, -20.019, -20.017);
    for (const x of [22.35, 23.65]) { B.cyl('clothRed', 0.03, 0.03, 0.22, x, y + 1.13, -19.85, 10); B.add('fire', new THREE.SphereGeometry(0.02, 6, 4).scale(1, 1.8, 1), mat(x, y + 1.27, -19.85)); }
    B.add('bronze', vessel([[0.06, 0], [0.09, 0.05], [0.082, 0.095], [0.092, 0.11]], { wall: 0.007, seg: 18, name: 'incense burner' }), mat(23, y + 1.02, -19.78));
    B.add('ash', fillDisc([[0.06, 0], [0.09, 0.05], [0.082, 0.095], [0.092, 0.11]], 0.085, 0.007, 18), mat(23, y + 1.02, -19.78));
    for (let i = 0; i < 3; i++) B.cyl('clothRed', 0.004, 0.004, 0.25, 22.98 + i * 0.02, y + 1.24, -19.78, 3);
    for (let i = 0; i < 5; i++) B.add('terracotta', new THREE.SphereGeometry(0.045, 8, 6), mat(22.5 + (i % 3) * 0.06, y + 1.07 + Math.floor(i / 3) * 0.06, -19.8));
    box(B, 'paper', 22.4, 23.6, y + 1.7, y + 3.1, -20.255, -20.25);
    plaque(g, '福寿安康', 23, y + 2.4, -20.245, 0, 0.36, { bg: '#efe6d2', fg: '#7a1a14' });
    // round table with stools; bookshelf; folding screen; chest; basin stand; rug
    furnitureTable(B, 26.0, y, -16.0, 0.42, 0.76, true);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; stool(B, 26.0 + Math.cos(a) * 0.7, y, -16.0 + Math.sin(a) * 0.7); }
    teapot(B, 26.0, y + 0.795, -16.0, 'porcelain');
    shelf(B, 26.55, 26.98, -19.45, -16.85, y, 2.1, 5, 'books');
    screen(B, 21.0, -16.3, 2.6, 'z', 6, 1.8, y);
    box(B, 'woodRed', 24.6, 25.8, y, y + 0.55, -20.24, -19.7); box(B, 'gold', 25.15, 25.25, y + 0.3, y + 0.42, -19.7, -19.69);
    B.add('bronze', vessel([[0.12, 0], [0.2, 0.06], [0.24, 0.1]], { wall: 0.008, seg: 24, name: 'wash basin' }), mat(19.6, y + 0.85, -12.0));
    B.add('water', fillDisc([[0.12, 0], [0.2, 0.06], [0.24, 0.1]], 0.07, 0.008, 24), mat(19.6, y + 0.85, -12.0)); B.cyl('woodDark', 0.03, 0.03, 0.85, 19.6, y + 0.42, -12.0, 6);
    B.add('clothRed', new THREE.PlaneGeometry(2.6, 1.7).rotateX(-Math.PI / 2), mat(23.6, y + 0.02, -15.6));
    for (const [lx, ly, lz] of d.lamps) hangLantern(B, lx, ly, lz, 1.0);
  },
  inn(B, g, d) {
    roomShell(B, d, 'floorWood', { hole: d.upper.hole }); const y = d.floorY;
    stairs(B, d);
    innerWindows(B, d, [6.0, 13.5]);
    // reception counter with abacus, ledger, brush; wine jars and key board behind
    box(B, 'woodRed', 5.8, 9.2, y, y + 1.05, 19.75, 20.55); box(B, 'woodDark', 5.7, 9.3, y + 1.05, y + 1.11, 19.7, 20.6);
    for (let i = 0; i < 4; i++) box(B, 'gold', 6.1 + i * 0.9, 6.15 + i * 0.9, y + 0.1, y + 0.95, 19.73, 19.74);
    // abacus
    B.push(mat(6.7, y + 1.12, 20.0, 0.1));
    box(B, 'woodDark', -0.3, 0.3, 0, 0.02, -0.12, 0.12); box(B, 'woodDark', -0.3, 0.3, 0.02, 0.05, -0.12, -0.1); box(B, 'woodDark', -0.3, 0.3, 0.02, 0.05, 0.1, 0.12);
    for (let r = 0; r < 9; r++) { const x = -0.26 + r * 0.065; box(B, 'woodDark', x - 0.003, x + 0.003, 0.035, 0.04, -0.11, 0.11); for (let k = 0; k < 6; k++) B.add('lacquer', new THREE.SphereGeometry(0.014, 6, 4).scale(1, 0.7, 1), mat(x, 0.04, -0.09 + k * 0.03 + (k > 1 ? 0.03 : 0))); }
    B.pop();
    box(B, 'paper', 7.6, 8.0, y + 1.11, y + 1.14, 19.9, 20.2); box(B, 'clothIndigo', 7.55, 7.6, y + 1.11, y + 1.15, 19.9, 20.2);
    B.cyl('ink', 0.006, 0.006, 0.22, 8.2, y + 1.13, 20.05, 4, 0, Math.PI / 2);
    for (let i = 0; i < 5; i++) jar(B, 5.0 + (i % 3) * 0.55, y + (i > 2 ? 0.78 : 0), 21.3, i > 2 ? 0.8 : 1.0, i % 2 ? 'terracotta' : 'ink');
    box(B, 'woodMid', 7.0, 9.0, y + 1.5, y + 2.4, 21.72, 21.76);
    for (let i = 0; i < 12; i++) { const kx = 7.2 + (i % 6) * 0.32, ky = y + 2.25 - Math.floor(i / 6) * 0.45; B.cyl('gold', 0.01, 0.01, 0.04, kx, ky, 21.7, 4, Math.PI / 2); box(B, 'woodRed', kx - 0.05, kx + 0.05, ky - 0.25, ky - 0.05, 21.69, 21.7); }
    plaque(g, '宾至如归', 7.0, y + 2.85, 21.74, Math.PI, 0.5, { bg: '#13233a', fg: '#e6c46a' });
    // waiting benches with a low tea table
    for (const bz of [14.65, 17.65]) { const bx1 = bz < 16 ? 15.6 : 15.0; box(B, 'woodMid', 12.0, bx1, y + 0.42, y + 0.48, bz - 0.25, bz + 0.25); box(B, 'woodMid', 12.0, bx1, y + 0.48, y + 0.95, bz + (bz < 16 ? -0.25 : 0.2), bz + (bz < 16 ? -0.2 : 0.25)); for (const bx of [12.1, (12 + bx1) / 2, bx1 - 0.1]) box(B, 'woodDark', bx - 0.04, bx + 0.04, y, y + 0.42, bz - 0.22, bz + 0.22); aoBlob(B, (12 + bx1) / 2, bz, y, bx1 - 11.6, 0.9); }
    box(B, 'woodRed', 13.2, 14.4, y + 0.4, y + 0.46, 15.85, 16.45); for (const bx of [13.25, 14.35]) for (const bz of [15.9, 16.4]) box(B, 'woodDark', bx - 0.03, bx + 0.03, y, y + 0.4, bz - 0.03, bz + 0.03);
    teapot(B, 13.8, y + 0.46, 16.15, 'celadon');
    aoBlob(B, 7.5, 20.15, y, 3.9, 1.3);
    screen(B, 6.0, 13.2, 2.4, 'x', 4, 1.8, y);
    jar(B, 4.7, y, 12.0, 1.3, 'celadon'); B.add('leaves', new THREE.IcosahedronGeometry(0.4, 1), mat(4.7, y + 0.95, 12.0));
    for (const [lx, ly, lz] of d.lamps) hangLantern(B, lx, ly, lz, 1.15);
    hangLantern(B, 13.8, 2.9, 16.15, 0.9);
    // ---- upper floor: guest room with two canopy beds, table, screens; gallery door to the street and canal
    const U = d.upper, yu = U.floorY;
    roomShell(B, d, 'floorWood', { level: 1 }); wellRail(B, d);
    bed(B, 4.5, 6.6, 19.6, 21.7, yu, 'z0'); bed(B, 4.5, 6.6, 15.2, 17.3, yu, 'z1');
    screen(B, 7.3, 18.45, 2.0, 'z', 4, 1.7, yu);
    furnitureTable(B, 10.0, yu, 18.6, 0.4, 0.76, true); for (let i = 0; i < 3; i++) { const a = i * 2.09 + 0.5; stool(B, 10.0 + Math.cos(a) * 0.65, yu, 18.6 + Math.sin(a) * 0.65); } teapot(B, 10.0, yu + 0.795, 18.6, 'celadon'); aoBlob(B, 10.0, 18.6, yu, 1.9, 1.9);
    box(B, 'woodRed', 4.5, 5.6, yu, yu + 0.6, 12.25, 12.85); box(B, 'gold', 4.95, 5.15, yu + 0.35, yu + 0.45, 12.85, 12.86); aoBlob(B, 5.05, 12.55, yu, 1.5, 1.0);
    B.cyl('woodDark', 0.03, 0.03, 0.85, 12.6, yu + 0.42, 12.6, 6); B.add('bronze', vessel([[0.12, 0], [0.2, 0.06], [0.24, 0.1]], { wall: 0.008, seg: 24, name: 'wash basin' }), mat(12.6, yu + 0.85, 12.6)); B.add('water', fillDisc([[0.12, 0], [0.2, 0.06], [0.24, 0.1]], 0.07, 0.008, 24), mat(12.6, yu + 0.85, 12.6));
    shelf(B, 12.2, 14.0, 21.5, 21.74, yu, 1.9, 4, 'books');
    for (const [lx, ly, lz] of U.lamps) hangLantern(B, lx, ly, lz, 0.95);
    plaque(g, '天字号', 10.5, yu + 2.45, 11.33, 0, 0.26, { bg: '#13233a', fg: '#e6c46a' });
  },
  temple(B, g, d) {
    roomShell(B, d, 'stone', { wall: 'templeIn' }); const y = d.floorY; const cy = d.ceilY;
    // coffered ceiling (藻井) grid
    for (let x = -5.5; x <= 5.5; x += 1.1) box(B, 'jade', x - 0.05, x + 0.05, cy - 0.32, cy - 0.2, d.room[2], d.room[3]);
    for (let z = d.room[2] + 0.55; z < d.room[3]; z += 1.1) box(B, 'gold', d.room[0], d.room[1], cy - 0.34, cy - 0.24, z - 0.04, z + 0.04);
    // four inner columns on stone bases
    for (const [cx, cz] of [[-3.7, -51.5], [3.7, -51.5], [-3.7, -48.0], [3.7, -48.0]]) { B.cyl('woodRed', 0.22, 0.24, cy - y, cx, (y + cy) / 2, cz, 16); B.cyl('stoneLight', 0.32, 0.34, 0.18, cx, y + 0.09, cz, 16); aoBlob(B, cx, cz, y, 1.1, 1.1); }
    plaque(g, '佛光普照', -3.7, y + 2.3, -47.77, 0, 1.5, { vertical: true, bg: '#13233a', fg: '#e6c46a' });
    plaque(g, '法轮常转', 3.7, y + 2.3, -47.77, 0, 1.5, { vertical: true, bg: '#13233a', fg: '#e6c46a' });
    // dais, lotus throne and the seated Buddha with a flame halo
    box(B, 'stoneLight', -1.9, 1.9, y, y + 0.9, -52.76, -50.3); box(B, 'gold', -1.92, 1.92, y + 0.90, y + 0.94, -52.78, -50.28); box(B, 'woodRed', -1.7, 1.7, y + 0.1, y + 0.78, -50.32, -50.29);
    const ty = y + 0.9, tz = -51.55;
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const pt = new THREE.SphereGeometry(0.26, 10, 8).scale(0.7, 0.42, 1).translate(0, 0, 0.55); pt.rotateX(-0.35); pt.rotateY(a); B.add('gold', pt, mat(0, ty + 0.2, tz)); }
    B.add('gold', lathe([[0, 0], [0.75, 0], [0.82, 0.12], [0.7, 0.28], [0.55, 0.32], [0, 0.32]], 28, { name: 'lotus throne' }), mat(0, ty, tz));
    B.add('gold', lathe([[0, 0], [0.70, 0], [0.76, 0.10], [0.68, 0.24], [0.50, 0.34], [0.46, 0.52], [0.40, 0.85], [0.45, 1.08], [0.34, 1.22], [0.16, 1.28], [0.11, 1.33], [0, 1.33]], 28, { name: 'buddha body' }), mat(0, ty + 0.32, tz));
    B.cyl('gold', 0.11, 0.13, 0.14, 0, ty + 1.70, tz, 12);
    B.add('gold', new THREE.SphereGeometry(0.24, 20, 16).scale(1, 1.10, 1.06), mat(0, ty + 1.90, tz + 0.03));
    B.add('gold', new THREE.SphereGeometry(0.10, 12, 10), mat(0, ty + 2.18, tz + 0.03));
    for (const sx of [-1, 1]) {
      B.add('gold', new THREE.SphereGeometry(0.06, 8, 8).scale(0.45, 1.7, 0.7), mat(sx * 0.23, ty + 1.86, tz + 0.02));
      B.add('gold', new THREE.CylinderGeometry(0.10, 0.13, 0.62, 12).rotateZ(sx * 0.35).rotateX(-0.35), mat(sx * 0.38, ty + 1.18, tz + 0.14));
      B.add('ink', new THREE.SphereGeometry(0.022, 8, 6), mat(sx * 0.08, ty + 1.91, tz + 0.245));
    }
    B.add('gold', new THREE.SphereGeometry(0.10, 12, 10), mat(-0.08, ty + 0.78, tz + 0.40));
    B.add('gold', new THREE.SphereGeometry(0.10, 12, 10), mat(0.08, ty + 0.78, tz + 0.40));
    B.add('ink', new THREE.SphereGeometry(0.028, 6, 4), mat(0, ty + 1.98, tz + 0.26));
    const halo = new THREE.CircleGeometry(0.78, 32); B.add('jade', halo, mat(0, ty + 1.75, tz - 0.42)); B.add('gold', new THREE.TorusGeometry(0.78, 0.05, 8, 40), mat(0, ty + 1.75, tz - 0.41));
    const mand = new THREE.CircleGeometry(1.3, 40); mand.scale(0.85, 1.25, 1); B.add('woodRed', mand, mat(0, ty + 1.25, tz - 0.48)); B.add('gold', new THREE.TorusGeometry(1.3, 0.04, 6, 48).scale(0.85, 1.25, 1), mat(0, ty + 1.25, tz - 0.47));
    plaque(g, '大雄宝殿', 0, y + 3.75, -52.7, 0, 0.5, { bg: '#13233a', fg: '#e6c46a' });
    // offering altar: candles, fruit, incense burner (smoke comes from the effects system)
    box(B, 'woodRed', -1.6, 1.6, y + 0.82, y + 0.90, -50.25, -49.45); box(B, 'woodRed', -1.55, 1.55, y, y + 0.81, -50.2, -49.50);
    B.add('clothRed', new THREE.BoxGeometry(2.85, 0.72, 0.04), mat(0, y + 0.44, -49.42)); box(B, 'gold', -1.4, 1.4, y + 0.70, y + 0.75, -49.40, -49.38);
    for (const x of [-1.2, 1.2]) { B.cyl('bronze', 0.06, 0.08, 0.06, x, y + 0.93, -49.85, 10); B.cyl('clothRed', 0.035, 0.035, 0.3, x, y + 1.11, -49.85, 10); B.add('fire', new THREE.SphereGeometry(0.025, 8, 6).scale(1, 2, 1), mat(x, y + 1.31, -49.85)); }
    const PL = [[0.06, 0], [0.14, 0.02], [0.17, 0.04]];
    for (const x of [-0.6, 0.6]) { B.add('porcelain', vessel(PL, { wall: 0.006, seg: 18, name: 'offering plate' }), mat(x, y + 0.9, -49.8)); for (let i = 0; i < 4; i++) B.add(x < 0 ? 'terracotta' : 'gold', new THREE.SphereGeometry(0.045, 8, 6), mat(x + (i % 2 - 0.5) * 0.09, y + 0.95 + (i > 1 ? 0.06 : 0), -49.8 + (i % 2 ? 0.04 : -0.04))); }
    const IB = [[0.1, 0], [0.16, 0.05], [0.17, 0.13], [0.15, 0.17], [0.18, 0.19]];
    B.add('bronze', vessel(IB, { wall: 0.01, seg: 24, name: 'altar incense burner' }), mat(0, y + 0.9, -49.85)); B.add('ash', fillDisc(IB, 0.15, 0.01, 24), mat(0, y + 0.9, -49.85));
    for (const s of [-1, 1]) B.add('bronze', new THREE.TorusGeometry(0.035, 0.01, 6, 10), mat(s * 0.18, y + 1.08, -49.85, Math.PI / 2));
    for (let i = 0; i < 3; i++) B.cyl('clothRed', 0.004, 0.004, 0.3, -0.03 + i * 0.03, y + 1.2, -49.85, 4);
    for (const x of [-0.8, 0, 0.8]) cushion(B, x, y, -48.75, 'clothOchre');
    aoBlob(B, 0, -49.85, y, 3.6, 1.3); aoBlob(B, 0, -51.5, y, 4.6, 3.0);
    // drum (left) and bronze bell (right) on stands
    for (const sx of [-1, 1]) { const x = sx * 5.05; box(B, 'woodDark', x - 0.5, x - 0.42, y, y + 1.9, -51.1, -51.0); box(B, 'woodDark', x + 0.42, x + 0.5, y, y + 1.9, -51.1, -51.0); box(B, 'woodDark', x - 0.5, x + 0.5, y + 1.82, y + 1.92, -51.1, -51.0); aoBlob(B, x, -51.05, y, 1.4, 0.8); }
    B.add('clothRed', new THREE.CylinderGeometry(0.38, 0.38, 0.45, 20).rotateX(Math.PI / 2), mat(-5.05, y + 1.05, -51.05)); for (const dz of [-0.23, 0.23]) B.add('paper', new THREE.CircleGeometry(0.36, 20), mat(-5.05, y + 1.05, -51.05 + dz, dz > 0 ? 0 : Math.PI));
    B.add('bronze', lathe([[0, 0], [0.32, 0], [0.3, 0.1], [0.26, 0.5], [0.2, 0.7], [0.08, 0.75], [0, 0.75]], 24, { name: 'temple bell' }), mat(5.05, y + 0.9, -51.05)); B.cyl('rope', 0.012, 0.012, 0.2, 5.05, y + 1.75, -51.05, 4);
    // hanging banners (幡)
    for (const [bx, m] of [[-2.6, 'clothRed'], [2.6, 'clothOchre'], [-5.0, 'clothOchre'], [5.0, 'clothRed']]) { const bn = new THREE.PlaneGeometry(0.45, 2.0, 1, 6); const bp = bn.attributes.position; for (let i = 0; i < bp.count; i++) bp.setZ(i, Math.sin(bp.getY(i) * 3) * 0.02); bn.computeVertexNormals(); B.add(m, bn, mat(bx, cy - 1.2, -49.0)); box(B, 'gold', bx - 0.27, bx + 0.27, cy - 0.24, cy - 0.2, -49.02, -48.98); }
    for (const [lx, ly, lz] of d.lamps) hangLantern(B, lx, ly, lz, 1.2);
    // murals on the side walls
    for (const sx of [-1, 1]) plaque(g, '诸行无常', sx * 5.93, y + 2.2, -49.4, -sx * Math.PI / 2, 0.9, { bg: '#e9dcc0', fg: '#5a2a1a', border: '#8c6a2c' });
  },
};

export const INTERIOR_PICKS = [
  ['teahouse', ['茶台', 'Чайная стойка — заваривают улун'], 8.2, 11.8, 0.5, 1.6, -20.6, -19.5],
  ['teahouse', ['茶桌', 'Чайный столик'], 6.4, 7.6, 0.5, 1.4, -17.8, -16.6],
  ['noodle', ['灶台', 'Очаг с двумя воками'], -15.26, -12.2, 0.4, 1.6, 19.1, 20.76],
  ['noodle', ['面架', 'Сушилка для лапши'], -9.1, -5.9, 2.0, 3.0, 19.2, 20.0],
  ['house', ['祖先供桌', 'Алтарь предков'], 22.0, 24.0, 0.45, 2.0, -20.26, -19.6],
  ['house', ['架子床', 'Кровать с балдахином'], 19.0, 21.2, 0.45, 2.8, -20.26, -18.2],
  ['house', ['屏风', 'Складная ширма'], 20.8, 21.2, 0.45, 2.3, -17.6, -15.0],
  ['inn', ['柜台', 'Стойка хозяина — счёты и книга постояльцев'], 5.8, 9.2, 0.45, 1.6, 19.7, 20.6],
  ['inn', ['楼梯', 'Лестница на второй этаж — гостевые комнаты'], 15.3, 16.76, 0.45, 3.8, 17.0, 20.8],
  ['teahouse', ['楼梯', 'Лестница на второй этаж — 雅座 и балкон'], 14.4, 15.56, 0.5, 4.6, -19.6, -15.2],
  ['temple', ['释迦牟尼佛', 'Статуя Будды Шакьямуни на лотосовом троне'], -1.9, 1.9, 1.0, 4.3, -52.76, -50.3],
  ['temple', ['香炉', 'Алтарная курильница — тлеют благовония'], -1.6, 1.6, 1.0, 2.2, -50.25, -49.45],
  ['temple', ['钟', 'Бронзовый колокол'], 4.5, 5.6, 1.0, 2.9, -51.6, -50.5],
  ['temple', ['鼓', 'Храмовый барабан'], -5.6, -4.5, 1.0, 2.9, -51.6, -50.5],
];

export class Interiors {
  constructor(scene, camera, { onBuild = null } = {}) {
    this.scene = scene; this.camera = camera; this.defs = L.INTERIORS; this.onBuild = onBuild; this.level = 0;
    this.group = new THREE.Group(); this.group.name = 'interiors'; scene.add(this.group);
    this.rooms = new Map(); this.buildCount = 0;
    // two warm lights that follow the nearest interior (constant light count = no shader recompiles)
    this.lights = [0, 1].map(() => { const l = new THREE.PointLight(0xffb06a, 0, 11, 2); l.castShadow = false; this.scene.add(l); return l; });
    this.doors = this.defs.map((d) => this._door(d));
    this.inside = null; this.insideF = 0; this.forceOpen = null;
  }
  _door(d) {
    const g = new THREE.Group(); g.name = 'door:' + d.id; this.scene.add(g);
    const h = d.id === 'house' ? 2.75 : 2.6; const half = d.door.w / 2; const n = half > 1.2 ? 2 : 1; const lw = half / n;
    const leafG = new THREE.BoxGeometry(lw - 0.02, h, 0.06); leafG.translate(lw / 2, h / 2, 0);
    const sides = [];
    for (const s of [-1, 1]) {
      const hinge = new THREE.Group(); hinge.position.set(d.door.x + s * half, d.floorY, d.door.z); g.add(hinge);
      let parent = hinge; const leaves = [];
      for (let k = 0; k < n; k++) {
        const pivot = new THREE.Group(); if (k > 0) pivot.position.x = lw; parent.add(pivot);
        const leaf = new THREE.Mesh(leafG, M('door')); leaf.castShadow = false; leaf.receiveShadow = true; leaf.layers.mask = 2; pivot.add(leaf);
        leaves.push(pivot); parent = pivot;
      }
      hinge.rotation.y = s < 0 ? 0 : Math.PI; // leaves extend toward the door centre
      sides.push({ s, hinge, leaves });
    }
    return { d, g, sides, open: 0 };
  }
  ensure(d) {
    if (this.rooms.has(d.id)) return this.rooms.get(d.id);
    const B = new Builder(); const g = new THREE.Group(); g.name = 'interior:' + d.id;
    ROOMS[d.id](B, g, d);
    const solids = B.solids;
    B.build(g, { noChunk: true, noShadow: ['aoStrip', 'aoBlob'] });
    g.traverse((o) => { if (o.isMesh) { o.receiveShadow = !/ao(Strip|Blob)/.test(o.name); if (/ao(Strip|Blob)/.test(o.name)) o.renderOrder = 1; } });
    if (this.onBuild) this.onBuild(solids);
    this.group.add(g); this.rooms.set(d.id, g); this.buildCount++;
    return g;
  }
  // per-frame: lazy build / hide rooms, door animation, interior lights
  update(dt, { player, mode, residents }) {
    const cam = this.camera.position;
    let nearest = null, nd = Infinity;
    for (const d of this.defs) {
      const cx = (d.room[0] + d.room[1]) / 2, cz = (d.room[2] + d.room[3]) / 2;
      const dist = Math.max(0, Math.hypot(cam.x - cx, cam.z - cz) - Math.max(d.room[1] - d.room[0], d.room[3] - d.room[2]) / 2);
      const want = dist < 22 || this.inside === d;
      if (want) this.ensure(d);
      const room = this.rooms.get(d.id); if (room) room.visible = want;
      if (dist < nd) { nd = dist; nearest = d; }
    }
    { const d = L.interiorAt(cam.x, cam.z); const top = d ? (d.upper ? d.upper.ceilY : d.ceilY + 0.4) : 0; this.inside = d && cam.y < top && cam.y > d.floorY ? d : null; this.level = this.inside ? L.levelAt(this.inside, cam.y - 1.65) : 0; }
    this.insideF += ((this.inside ? 1 : 0) - this.insideF) * Math.min(1, dt * 3);
    // doors: open when the walker, a resident or a scripted entry is near
    for (const D of this.doors) {
      const { d } = D; let want = this.forceOpen === d.id;
      if (mode === 'walk' && player && Math.hypot(player.x - d.door.x, player.z - d.door.z) < 3.4) want = true;
      if (residents) for (const r of residents) if (!r.hidden && Math.abs(r.x - d.door.x) < 2.2 && Math.abs(r.z - d.door.z) < 1.8) { want = true; break; }
      D.open += ((want ? 1 : 0) - D.open) * Math.min(1, dt * 3.2);
      const a = D.open * Math.PI / 2 * 0.98;
      for (const S of D.sides) {
        // swing inward (away from the street side); the second leaf folds back flat
        const inward = -d.door.out;
        S.leaves[0].rotation.y = S.s * inward * a;
        if (S.leaves[1]) S.leaves[1].rotation.y = -S.leaves[0].rotation.y * 1.9;
      }
    }
    // lights follow the nearest room
    const f = nearest ? Math.max(0, 1 - nd / 16) : 0;
    this.lights.forEach((l, i) => {
      if (!nearest) { l.intensity = 0; return; }
      const lamps = this.inside === nearest && this.level === 1 ? nearest.upper.lamps : nearest.lamps;
      const p = lamps[i] || lamps[0]; l.position.set(p[0], p[1] - 0.75, p[2]);
      l.intensity = f * (4 + 7 * this.insideF);
    });
    this.nearest = nearest;
  }
  doorOpen(id) { return this.doors.find((D) => D.d.id === id).open; }
  // door leaves as 2D segments [ax, az, bx, bz, y0, y1] for the walker's collision
  leafSegments() {
    const out = []; const a = new THREE.Vector3(), b = new THREE.Vector3();
    for (const D of this.doors) for (const S of D.sides) for (const pv of S.leaves) {
      const leaf = pv.children.find((c) => c.isMesh); if (!leaf) continue; const lw = leaf.geometry.parameters.width + 0.02;
      pv.updateWorldMatrix(true, false); a.set(0, 0, 0).applyMatrix4(pv.matrixWorld); b.set(lw, 0, 0).applyMatrix4(pv.matrixWorld);
      out.push([a.x, a.z, b.x, b.z, D.d.floorY, D.d.floorY + (D.d.id === 'house' ? 2.75 : 2.6)]);
    }
    return out;
  }
  dispose() { this.lights.forEach((l) => l.dispose?.()); }
}
