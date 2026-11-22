import * as THREE from 'three';
import { M } from './materials.js';
import { lathe } from './geom.js';
import { mulberry32, fbm2 } from './util.js';
import * as L from './layout.js';

const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3();
export function instanced(group, geom, matName, list, { cast = true, receive = true, name = '' } = {}) {
  if (!list.length) return null;
  const im = new THREE.InstancedMesh(geom, typeof matName === 'string' ? M(matName) : matName, list.length);
  list.forEach((t, i) => {
    tmpE.set(t.rx || 0, t.ry || 0, t.rz || 0); tmpQ.setFromEuler(tmpE);
    const s = t.s ?? 1; tmpS.set(t.sx ?? s, t.sy ?? s, t.sz ?? s);
    tmpM.compose(tmpV.set(t.x, t.y, t.z), tmpQ, tmpS); im.setMatrixAt(i, tmpM);
    if (t.c) im.setColorAt(i, t.c);
  });
  im.castShadow = cast; im.receiveShadow = receive; im.name = name || 'inst:' + matName;
  im.computeBoundingSphere();
  group.add(im); return im;
}

function tubeAlong(B, matName, pts, r0, r1, seg = 8) {
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curve, Math.max(4, pts.length * 3), 1, seg, false);
  // taper the tube radius
  const p = g.attributes.position, n = g.attributes.normal; const rings = g.parameters.tubularSegments + 1;
  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1); const r = r0 + (r1 - r0) * t; const c = curve.getPointAt(t);
    for (let j = 0; j <= seg; j++) { const k = i * (seg + 1) + j; tmpV.fromBufferAttribute(p, k).sub(c).multiplyScalar(r).add(c); p.setXYZ(k, tmpV.x, tmpV.y, tmpV.z); }
  }
  void n; g.computeVertexNormals();
  B.add(matName, g);
}

export function buildVegetation(group, B) {
  const R = mulberry32(555);
  // ---------------- weeping willows along the banks
  const strands = [], willowTops = [];
  for (const [x, z] of L.WILLOWS) {
    const lean = Math.sign(-z) * 0.9; // lean over the water
    const top = new THREE.Vector3(x + R() - 0.5, 5.6 + R(), z + lean);
    tubeAlong(B, 'bark', [new THREE.Vector3(x, -0.1, z), new THREE.Vector3(x + 0.1, 2.0, z + lean * 0.3), new THREE.Vector3(x - 0.15, 3.8, z + lean * 0.7), top], 0.32, 0.12);
    for (let b = 0; b < 5; b++) {
      const a = b / 5 * Math.PI * 2 + R();
      const end = top.clone().add(new THREE.Vector3(Math.cos(a) * 2.0, 0.5 + R() * 0.4, Math.sin(a) * 2.0));
      tubeAlong(B, 'bark', [top.clone().add(new THREE.Vector3(0, -0.6, 0)), top.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.3, 0)), end], 0.1, 0.04, 6);
    }
    for (let i = 0; i < 120; i++) {
      const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * 3.1;
      const len = 1.8 + R() * 2.6 * (0.4 + rr / 3.1);
      const y = top.y + 1.5 - (rr / 3.1) * (rr / 3.1) * 1.7 + R() * 0.3;
      strands.push({ x: top.x + Math.cos(a) * rr, y, z: top.z + Math.sin(a) * rr, ry: a + Math.PI / 2 + (R() - 0.5) * 0.6, sy: len / 3.6, sx: 0.8 + R() * 0.5, sz: 1 });
    }
    for (let i = 0; i < 26; i++) {
      const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * 2.6;
      willowTops.push({ x: top.x + Math.cos(a) * rr, y: top.y + 1.45 - (rr / 3) * (rr / 3) * 1.4, z: top.z + Math.sin(a) * rr, rx: -Math.PI / 2 + (R() - 0.5) * 0.8, ry: R() * 6, rz: (R() - 0.5) * 0.8, s: 1.6 + R() * 0.8 });
    }
  }
  instanced(group, new THREE.PlaneGeometry(1.4, 1.4), 'willowTop', willowTops, { name: 'willowTops' });
  const sg = new THREE.PlaneGeometry(0.9, 3.6); sg.translate(0, -1.8, 0);
  instanced(group, sg, 'willow', strands, { name: 'willows' });

  // ---------------- blooming plum trees
  const blossoms = [], blossomCores = [];
  const branch = (p, dir, len, r, depth) => {
    const end = p.clone().add(dir.clone().multiplyScalar(len));
    const mid = p.clone().lerp(end, 0.5).add(new THREE.Vector3((R() - 0.5) * len * 0.3, 0, (R() - 0.5) * len * 0.3));
    tubeAlong(B, 'bark', [p, mid, end], r, r * 0.6, 6);
    if (depth === 0) {
      const mid = p.clone().lerp(end, 0.65);
      blossomCores.push({ x: mid.x, y: mid.y, z: mid.z, rx: R() * 3, ry: R() * 3, rz: R() * 3, s: 0.42 + R() * 0.22 });
      for (let k = 0; k < 9; k++) { const q = p.clone().lerp(end, 0.3 + R() * 0.7); blossoms.push({ x: q.x + (R() - 0.5) * 0.6, y: q.y + (R() - 0.5) * 0.5, z: q.z + (R() - 0.5) * 0.6, rx: R() * 3, ry: R() * 3, rz: R() * 3, s: 0.6 + R() * 0.5 }); }
      return;
    }
    const n = depth > 1 ? 3 : 2 + Math.floor(R() * 2);
    for (let i = 0; i < n; i++) {
      const nd = dir.clone().add(new THREE.Vector3((R() - 0.5) * 1.4, R() * 0.6 - 0.05, (R() - 0.5) * 1.4)).normalize();
      branch(end, nd, len * (0.62 + R() * 0.15), r * 0.6, depth - 1);
    }
  };
  for (const [x, z] of L.PLUMS) {
    const base = new THREE.Vector3(x, -0.05, z);
    branch(base, new THREE.Vector3((R() - 0.5) * 0.4, 1, (R() - 0.5) * 0.4).normalize(), 1.7, 0.17, 3);
  }
  const bg = new THREE.PlaneGeometry(1, 1);
  instanced(group, bg, 'blossom', blossoms, { name: 'blossoms' });
  instanced(group, new THREE.IcosahedronGeometry(0.7, 0), 'blossomCore', blossomCores, { name: 'blossomCores', receive: false });

  // ---------------- bamboo groves
  const stems = [], leaves = [];
  const grove = (cx, cz, rx, rz, n) => {
    for (let i = 0; i < n; i++) {
      const x = cx + (R() - 0.5) * 2 * rx, z = cz + (R() - 0.5) * 2 * rz;
      const h = 5.5 + R() * 4.5, r = 0.045 + R() * 0.035, lean = (R() - 0.5) * 0.12;
      stems.push({ x, y: 0, z, sx: r, sz: r, sy: h, rz: lean, rx: (R() - 0.5) * 0.12 });
      for (let k = 0; k < 9; k++) {
        const t = 0.45 + R() * 0.55; const yy = h * t;
        leaves.push({ x: x + Math.sin(lean) * -yy + (R() - 0.5) * 1.1, y: yy, z: z + (R() - 0.5) * 1.1, rx: (R() - 0.5) * 0.8, ry: R() * 6, rz: (R() - 0.5) * 0.8, s: 1.1 + R() * 0.7 });
      }
    }
  };
  grove(0, -64, 40, 4.5, 150); grove(-50, -46, 10, 6, 60); grove(50, -46, 10, 6, 60);
  grove(0, 50, 44, 4, 150); grove(-63, -20, 3, 12, 40); grove(64, -22, 3, 12, 40); grove(-63, 26, 3, 12, 40); grove(64, 28, 3, 12, 40);
  grove(-50.5, 20.5, 1.2, 1.2, 12); grove(-28, 21, 1.0, 0.8, 8); grove(12.5, -55.5, 0.8, 0.6, 6);
  const stemG = new THREE.CylinderGeometry(1, 1, 1, 6, 1); stemG.translate(0, 0.5, 0);
  instanced(group, stemG, 'bambooStemSway', stems, { name: 'bambooStems' });
  const lg = new THREE.PlaneGeometry(1.4, 1.4); lg.rotateX(-Math.PI / 2 + 0.5);
  const bl = instanced(group, lg, 'bambooLeaf', leaves, { name: 'bambooLeaves' });
  if (bl) bl.castShadow = true;

  // ---------------- large camphor trees around the edges
  const crowns = [], leafCores = [];
  const trees = [[-62, -40], [62, -40], [-62, 44], [62, 44], [-20, -46], [22, -46], [-46, 44], [46, 42], [9, -60], [-30, -60], [58, 4.5 + 6], [-60, 12]];
  for (const [x, z] of trees) {
    const h = 5 + R() * 2;
    tubeAlong(B, 'bark', [new THREE.Vector3(x, -0.1, z), new THREE.Vector3(x + 0.3, h * 0.5, z - 0.2), new THREE.Vector3(x - 0.2, h, z + 0.3)], 0.42, 0.2);
    for (let i = 0; i < 140; i++) {
      const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * 4.2, yy = h + (R() - 0.3) * 3.4 * (1 - rr / 6);
      crowns.push({ x: x + Math.cos(a) * rr, y: yy, z: z + Math.sin(a) * rr, rx: R() * 3, ry: R() * 3, rz: R() * 3, s: 1.6 + R() * 1.0 });
    }
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2 + R() * 0.2, rr = 0.6 + (i % 3) * 1.1, yy = h + 0.8 + (i % 4) * 0.55;
      leafCores.push({ x: x + Math.cos(a) * rr, y: yy, z: z + Math.sin(a) * rr, rx: R(), ry: R(), rz: R(), s: 1.3 + R() * 0.5 });
    }
  }
  instanced(group, new THREE.PlaneGeometry(1.4, 1.4), 'leaves', crowns, { name: 'treeCrowns' });
  instanced(group, new THREE.IcosahedronGeometry(0.9, 0), 'leafCore', leafCores, { name: 'leafCores', receive: false });

  // ---------------- garden: rocks, lotus, koi pond rim, grass tufts
  const G = L.GARDEN.pond;
  const rocks = [];
  for (let i = 0; i < 70; i++) {
    const a = i / 70 * Math.PI * 2 + R() * 0.05; const k = 1.0 + R() * 0.08;
    rocks.push({ x: G.cx + Math.cos(a) * (G.rx + 0.5) * k, y: -0.15 + R() * 0.15, z: G.cz + Math.sin(a) * (G.rz + 0.5) * k, ry: R() * 6, sx: 0.5 + R() * 0.5, sy: 0.3 + R() * 0.35, sz: 0.45 + R() * 0.4 });
  }
  const rockG = new THREE.IcosahedronGeometry(1, 1); const rp = rockG.attributes.position;
  for (let i = 0; i < rp.count; i++) { tmpV.fromBufferAttribute(rp, i); tmpV.multiplyScalar(0.75 + 0.5 * fbm2(tmpV.x * 2 + 9, tmpV.y * 2 + tmpV.z, 2)); rp.setXYZ(i, tmpV.x, tmpV.y, tmpV.z); }
  rockG.computeVertexNormals();
  instanced(group, rockG, 'rock', rocks, { name: 'pondRocks' });
  // tall Taihu scholar rocks
  const taihu = [];
  for (const [x, z, s] of [[-31, 18.8, 1.3], [-44.5, 11.2, 1.0], [-50.8, 16, 0.9], [-12.5, -45.5, 0.8], [12.5, -45.5, 0.8]]) taihu.push({ x, y: s * 0.9, z, ry: R() * 6, sx: s * 0.5, sy: s * 1.4, sz: s * 0.45 });
  instanced(group, rockG, 'rock', taihu, { name: 'taihuRocks' });
  // lotus pads and flowers
  const pads = [], flowers = [];
  for (let i = 0; i < 46; i++) {
    const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * 0.85;
    const x = G.cx + Math.cos(a) * G.rx * rr, z = G.cz + Math.sin(a) * G.rz * rr;
    if (Math.abs(x - G.cx) < 2.2 && Math.abs(z - G.cz) < 1.2) continue;
    pads.push({ x, y: -0.255 + R() * 0.01, z, ry: R() * 6, s: 0.35 + R() * 0.3 });
    if (R() < 0.2) flowers.push({ x, y: -0.2, z, ry: R() * 6, s: 0.8 + R() * 0.4 });
  }
  const padG = new THREE.CircleGeometry(1, 18, 0.25, Math.PI * 2 - 0.5); padG.rotateX(-Math.PI / 2);
  instanced(group, padG, 'lotusPad', pads, { cast: false, name: 'lotusPads' });
  const petal = lathe([[0, 0], [0.12, 0.05], [0.16, 0.15], [0.12, 0.24], [0.02, 0.3]], 7, { name: 'lotus petal', doubleSide: true });
  instanced(group, petal, 'lotusFlower', flowers, { cast: false, name: 'lotusFlowers' });
  // ground tufts & flowers around the town
  const tufts = [];
  for (let i = 0; i < 1600; i++) {
    const x = (R() - 0.5) * 150, z = (R() - 0.5) * 120;
    if (Math.abs(z) < 9.2 && Math.abs(x) < 70) continue;
    if (L.STREETS.some((r) => L.inRect(x, z, r, 0.2))) continue;
    if (buildingsAt(x, z)) continue;
    if (L.inPond(x, z, 0.9)) continue;
    tufts.push({ x, y: 0, z, ry: R() * 6, s: 0.3 + R() * 0.5 });
  }
  const tuftG = new THREE.ConeGeometry(0.25, 0.55, 5, 1, true); tuftG.translate(0, 0.27, 0);
  const tuftM = new THREE.MeshStandardMaterial({ color: 0x5f7f36, roughness: 1, side: THREE.DoubleSide });
  instanced(group, tuftG, tuftM, tufts, { cast: false, name: 'tufts' });
}
let colliderCache = null;
function buildingsAt(x, z) { colliderCache = colliderCache || [...L.buildColliders(), ...L.buildingRects()]; return colliderCache.some((r) => L.inRect(x, z, r, 0.4)); }
