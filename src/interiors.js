import * as THREE from 'three';
import { Builder, mat, scaleBoxUV } from './builder.js';
import { M } from './materials.js';
import { signTex } from './textures.js';
import { furnitureTable, stool, teaSet, windowPanel } from './buildings.js';
import * as L from './layout.js';

// Enterable interiors. Shells (walls with door gaps) are part of the town; the
// furnished rooms are built lazily the first time the camera comes close and are
// hidden again when it moves away. Doors are animated leaves that fold open.

const lathe = (pts, seg = 16) => new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg);
const LANTERN = lathe([[0, -0.32], [0.08, -0.31], [0.2, -0.24], [0.27, -0.1], [0.28, 0.02], [0.25, 0.15], [0.16, 0.26], [0.08, 0.29], [0, 0.3]], 18);

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
  for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.6; B.add('porcelain', lathe([[0, 0], [0.022, 0], [0.032, 0.035], [0.034, 0.045]], 12), mat(x + Math.cos(a) * 0.25, y, z + Math.sin(a) * 0.25)); }
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
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, height), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
  m.position.set(x, y, z); m.rotation.y = ry; group.add(m);
}
function roomShell(B, d, floorMat = 'floorWood') {
  const [x0, x1, z0, z1] = d.room; const y = d.floorY;
  box(B, floorMat, x0, x1, y - 0.06, y + 0.015, z0, z1, 1.6);
  box(B, 'woodMid', x0, x1, d.ceilY, d.ceilY + 0.08, z0, z1, 2);
  for (let x = x0 + 1.4; x < x1 - 0.5; x += 1.9) box(B, 'woodDark', x - 0.1, x + 0.1, d.ceilY - 0.2, d.ceilY, z0, z1);
  box(B, 'woodDark', x0, x1, d.ceilY - 0.24, d.ceilY, (z0 + z1) / 2 - 0.12, (z0 + z1) / 2 + 0.12);
  // wainscot + skirting along the walls (skip the door gap)
  const back = d.front === 'z1' ? z0 : z1, front = d.front === 'z1' ? z1 : z0, s = d.front === 'z1' ? 1 : -1;
  box(B, 'woodDark', x0, x1, y, y + 0.9, back - (s < 0 ? 0.04 : 0), back + (s > 0 ? 0.04 : 0));
  for (const x of [x0, x1]) box(B, 'woodDark', x - (x === x1 ? 0.04 : 0), x + (x === x0 ? 0.04 : 0), y, y + 0.9, z0, z1);
  for (const [a, b] of [[x0, d.gap[0]], [d.gap[1], x1]]) box(B, 'woodDark', a, b, y, y + 0.9, front - (s > 0 ? 0.04 : 0), front + (s < 0 ? 0.04 : 0));
  box(B, 'woodRed', x0, x1, y + 0.9, y + 0.96, s > 0 ? back : back - 0.06, s > 0 ? back + 0.06 : back);
}
function innerWindows(B, d, xs, y = 1.9) {
  const back = d.front === 'z1' ? d.room[2] : d.room[3]; const ry = d.front === 'z1' ? 0 : Math.PI;
  for (const x of xs) windowPanel(B, x, d.floorY + y, back + (d.front === 'z1' ? 0.02 : -0.02), 0.9, 0.8, 1, ry);
}

// ---------------------------------------------------------------- the four rooms
const ROOMS = {
  teahouse(B, g, d) {
    roomShell(B, d); const y = d.floorY;
    innerWindows(B, d, [5.8, 14.2]);
    for (const [tx, tz] of [[7, -17.2], [13, -17.2]]) {
      furnitureTable(B, tx, y, tz, 0.45, 0.78, false);
      for (const [sx, sz] of [[0, 0.75], [0, -0.75], [0.75, 0], [-0.75, 0]]) stool(B, tx + sx, y, tz + sz);
      teapot(B, tx, y + 0.815, tz);
      B.add('basket', lathe([[0, 0], [0.12, 0], [0.16, 0.05], [0.16, 0.06]], 14), mat(tx + 0.25, y + 0.815, tz - 0.2));
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
    shelf(B, 15.03, 15.53, -20.7, -18.45, y, 2.2, 5, 'books');
    screen(B, 15.2, -16.2, 2.2, 'z', 4, 1.7, y);
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
      B.add('ink', lathe([[0, -0.2], [0.18, -0.17], [0.3, -0.06], [0.34, 0.02]], 20), mat(wx, y + 1.18, 19.95));
      B.add('noodle', new THREE.CylinderGeometry(0.27, 0.27, 0.02, 18), mat(wx, y + 1.1, 19.95));
      box(B, 'fire', wx - 0.18, wx + 0.18, y + 0.15, y + 0.42, 19.17, 19.19);
      box(B, 'ink', wx - 0.24, wx + 0.24, y + 0.1, y + 0.47, 19.16, 19.18);
    }
    box(B, 'brick', -15.0, -14.3, y + 1.02, d.ceilY, 20.2, 20.76, 1);
    // prep table: dough, cleaver, bowls stacked
    box(B, 'woodMid', -11.4, -9.4, y + 0.85, y + 0.92, 19.8, 20.7);
    for (const [lx, lz] of [[-11.3, 19.85], [-9.5, 19.85], [-11.3, 20.65], [-9.5, 20.65]]) box(B, 'woodDark', lx - 0.04, lx + 0.04, y, y + 0.85, lz - 0.04, lz + 0.04);
    B.add('noodle', new THREE.SphereGeometry(0.22, 14, 8).scale(1.3, 0.45, 1), mat(-10.8, y + 0.98, 20.2));
    box(B, 'ink', -10.1, -9.85, y + 0.93, y + 0.95, 20.1, 20.35);
    for (let k = 0; k < 5; k++) B.add('porcelain', lathe([[0, 0], [0.06, 0], [0.11, 0.06], [0.12, 0.08]], 14), mat(-9.7, y + 0.92 + k * 0.045, 20.4));
    // drying rack of noodles
    for (const rz of [19.3, 19.9]) {
      box(B, 'woodDark', -9.0, -6.0, y + 2.5, y + 2.55, rz - 0.025, rz + 0.025);
      for (let x = -8.9; x < -6.05; x += 0.07) box(B, 'noodle', x - 0.006, x + 0.006, y + 1.75 + Math.sin(x * 7) * 0.08, y + 2.5, rz - 0.006, rz + 0.006);
    }
    for (const x of [-9.05, -5.95]) box(B, 'woodDark', x - 0.04, x + 0.04, y, y + 2.6, 19.25, 19.95);
    // customer table with two benches
    furnitureTable(B, -6.8, y, 16.2, 0.45, 0.76, false);
    for (const bz of [15.45, 16.95]) { box(B, 'woodMid', -7.5, -6.1, y + 0.42, y + 0.47, bz - 0.15, bz + 0.15); for (const bx of [-7.4, -6.2]) box(B, 'woodDark', bx - 0.04, bx + 0.04, y, y + 0.42, bz - 0.12, bz + 0.12); }
    for (const bx of [-7.0, -6.6]) B.add('porcelain', lathe([[0, 0], [0.06, 0], [0.11, 0.06], [0.12, 0.08]], 14), mat(bx, y + 0.795, 16.2));
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
    B.add('clothRed', new THREE.BoxGeometry(2.05, 0.16, 1.9), mat((bx0 + bx1) / 2, y + 0.58, (bz0 + bz1) / 2));
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
    B.add('bronze', lathe([[0, 0], [0.07, 0], [0.09, 0.06], [0.08, 0.1], [0.09, 0.11]], 14), mat(23, y + 1.02, -19.78));
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
    B.add('bronze', lathe([[0, 0], [0.15, 0.0], [0.22, 0.08], [0.24, 0.1]], 16), mat(19.6, y + 0.85, -12.0)); B.cyl('woodDark', 0.03, 0.03, 0.85, 19.6, y + 0.42, -12.0, 6);
    B.add('clothRed', new THREE.PlaneGeometry(2.6, 1.7).rotateX(-Math.PI / 2), mat(23.6, y + 0.02, -15.6));
    for (const [lx, ly, lz] of d.lamps) hangLantern(B, lx, ly, lz, 1.0);
  },
  inn(B, g, d) {
    roomShell(B, d); const y = d.floorY;
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
    for (const bz of [14.65, 17.65]) { box(B, 'woodMid', 12.0, 15.6, y + 0.42, y + 0.48, bz - 0.25, bz + 0.25); box(B, 'woodMid', 12.0, 15.6, y + 0.48, y + 0.95, bz + (bz < 16 ? -0.25 : 0.2), bz + (bz < 16 ? -0.2 : 0.25)); for (const bx of [12.1, 13.8, 15.5]) box(B, 'woodDark', bx - 0.04, bx + 0.04, y, y + 0.42, bz - 0.22, bz + 0.22); }
    box(B, 'woodRed', 13.2, 14.4, y + 0.4, y + 0.46, 15.85, 16.45); for (const bx of [13.25, 14.35]) for (const bz of [15.9, 16.4]) box(B, 'woodDark', bx - 0.03, bx + 0.03, y, y + 0.4, bz - 0.03, bz + 0.03);
    teapot(B, 13.8, y + 0.46, 16.15, 'celadon');
    // staircase to the gallery along the right wall
    for (let k = 0; k < 13; k++) { const z0 = 18.05 + k * 0.29; const top = y + 0.24 + k * 0.255; box(B, 'woodMid', 15.35, 16.74, top - 0.06, top, z0, z0 + 0.3); box(B, 'woodDark', 15.35, 16.74, y, top - 0.06, z0 + 0.26, z0 + 0.3); }
    for (let k = 0; k <= 12; k += 2) { const z = 18.1 + k * 0.29; B.cyl('woodRed', 0.025, 0.025, 0.9, 15.38, y + 0.7 + k * 0.255, z, 6); }
    const rail = new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(15.38, y + 1.15, 18.0), new THREE.Vector3(15.38, y + 4.25, 21.7)), 4, 0.035, 6);
    B.add('woodRed', rail);
    screen(B, 6.0, 13.2, 2.4, 'x', 4, 1.8, y);
    jar(B, 4.7, y, 12.0, 1.3, 'celadon'); B.add('leaves', new THREE.IcosahedronGeometry(0.4, 1), mat(4.7, y + 0.95, 12.0));
    for (const [lx, ly, lz] of d.lamps) hangLantern(B, lx, ly, lz, 1.15);
    hangLantern(B, 13.8, 2.9, 16.15, 0.9);
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
  ['inn', ['楼梯', 'Лестница на галерею'], 15.3, 16.76, 0.45, 4.0, 18.0, 21.76],
];

export class Interiors {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera; this.defs = L.INTERIORS;
    this.group = new THREE.Group(); this.group.name = 'interiors'; scene.add(this.group);
    this.rooms = new Map(); this.buildCount = 0;
    // two warm lights that follow the nearest interior (constant light count = no shader recompiles)
    this.lights = [0, 1].map(() => { const l = new THREE.PointLight(0xffb26a, 0, 9, 1.7); l.castShadow = false; this.scene.add(l); return l; });
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
    B.build(g, { noChunk: true });
    g.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; } });
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
    this.inside = L.interiorAt(cam.x, cam.z) && cam.y < 4.2 ? L.interiorAt(cam.x, cam.z) : null;
    this.insideF += ((this.inside ? 1 : 0) - this.insideF) * Math.min(1, dt * 3);
    // doors: open when the walker, a resident or a scripted entry is near
    for (const D of this.doors) {
      const { d } = D; let want = this.forceOpen === d.id;
      if (mode === 'walk' && player && Math.hypot(player.x - d.door.x, player.z - d.door.z) < 3.4) want = true;
      if (residents) for (const r of residents) if (Math.abs(r.x - d.door.x) < 2.2 && Math.abs(r.z - d.door.z) < 1.8) { want = true; break; }
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
      const p = nearest.lamps[i] || nearest.lamps[0]; l.position.set(p[0], p[1] - 0.7, p[2]);
      l.intensity = f * (3 + 4 * this.insideF);
    });
    this.nearest = nearest;
  }
  doorOpen(id) { return this.doors.find((D) => D.d.id === id).open; }
  dispose() { this.lights.forEach((l) => l.dispose?.()); }
}
