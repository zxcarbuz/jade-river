// Town plan for 玉河镇 JADE RIVER. Units: metres. x = east, z = south.
// Everything that needs to agree (buildings, streets, nav graph, colliders)
// is derived from the data in this file.

export const CANAL = { half: 5, waterY: -0.85, bedY: -2.2 };
export const BRIDGES = [
  { id: 'bridge', x: 0, w: 3.6, half: 6.0, H: 3.0, name: ['玉带桥', 'Мост Нефритового пояса'] },
  { id: 'bridge2', x: 34, w: 3.0, half: 5.8, H: 2.5, name: ['望月桥', 'Мост Созерцания луны'] },
];
export const deckY = (b, z) => { const t = Math.min(1, Math.abs(z) / b.half); return b.H * Math.pow(1 - t * t, 0.85); };

// paved streets [x0, x1, z0, z1]
export const STREETS = [
  [-64, 64, -8.5, -5], [-64, 64, 5, 8.5],
  [-46, 46, -26, -23], [-46, 46, 24, 27],
  [-1.75, 1.75, -33, -8.5], [-1.75, 1.75, 8.5, 44],
  [-31.5, -28.5, -23, -8.5], [28.5, 31.5, -23, -8.5],
  [-25.5, -22.5, 8.5, 24], [22.5, 25.5, 8.5, 24],
  [-28.5, -12, -23, -8.5], // market square
  [-15.5, -4.5, 8.5, 12.5], // noodle shop forecourt
  [-13.6, 13.6, -56.6, -33.4], // temple courtyard
  [3.5, 17.5, 8.5, 10.5], // inn forecourt
];

// houses: cx, cz, w (x), d (z), floors, facing (+1 = front faces +z), variant flags
export const HOUSES = [
  { cx: -52.5, cz: -15.5, w: 10, d: 11, floors: 2, face: 1, hh: false, sign: null },
  { cx: -39, cz: -15.5, w: 11, d: 11, floors: 2, face: 1, hh: true, sign: ['绸缎庄', 'Шёлковая лавка'] },
  { cx: -7, cz: -15.5, w: 7.5, d: 10, floors: 2, face: 1, hh: false, sign: ['药铺', 'Аптека'] },
  { cx: 23, cz: -15.5, w: 8.5, d: 10, floors: 1, face: 1, hh: true },
  { cx: 37.5, cz: -15.5, w: 8.5, d: 10, floors: 2, face: 1, hh: false, sign: ['书斋', 'Книжная лавка'] },
  { cx: 49.5, cz: -15.5, w: 10, d: 10, floors: 1, face: 1, hh: true },
  { cx: -39, cz: -33.5, w: 9, d: 10, floors: 1, face: 1, hh: true },
  { cx: -24, cz: -33.5, w: 10, d: 10, floors: 2, face: 1, hh: true },
  { cx: 23, cz: -33.5, w: 10, d: 10, floors: 1, face: 1, hh: false },
  { cx: 39, cz: -33.5, w: 9, d: 10, floors: 2, face: 1, hh: true },
  { cx: -19, cz: 16, w: 5.2, d: 9, floors: 2, face: -1, hh: false },
  { cx: 31, cz: 15.5, w: 9, d: 10, floors: 2, face: -1, hh: false, sign: ['酒坊', 'Винная лавка'] },
  { cx: 42, cz: 15.5, w: 9, d: 10, floors: 1, face: -1, hh: true },
  { cx: 53, cz: 15.5, w: 9, d: 10, floors: 2, face: -1, hh: true },
  { cx: -35, cz: 34, w: 10, d: 10, floors: 1, face: -1, hh: true },
  { cx: -21, cz: 34, w: 10, d: 10, floors: 2, face: -1, hh: false },
  { cx: -8, cz: 34, w: 8.5, d: 10, floors: 1, face: -1, hh: true },
  { cx: 8, cz: 34, w: 8.5, d: 10, floors: 2, face: -1, hh: false },
  { cx: 21, cz: 34, w: 10, d: 10, floors: 1, face: -1, hh: true },
  { cx: 35, cz: 34, w: 10, d: 10, floors: 2, face: -1, hh: false },
];

export const TEAHOUSE = { x0: 4, x1: 16, z0: -21, z1: -13.5, terrace: [4, 16, -13.5, -9.2], terraceY: 0.35 };
export const NOODLE = { x0: -15.5, x1: -4.5, z0: 12.5, z1: 21 };
export const INN = { x0: 4, x1: 17, z0: 10.5, z1: 22 };
export const TEMPLE = { x0: -14, x1: 14, z0: -57, z1: -33, hall: { cx: 0, cz: -49, w: 14, d: 9, plat: 1.0 }, burner: [0, -39.5] };
export const PAIFANG = { x: 0, z: -29.5 };
export const GARDEN = { x0: -52.5, x1: -26.2, z0: 9.6, z1: 22.5, pond: { cx: -38, cz: 13.6, rx: 7.2, rz: 3.4 }, pavilion: [-47, 18.6], moonGate: 16 };
export const MARKET = {
  stalls: [
    { x: -25.4, z: -11.2, face: 1, goods: 'fruit' }, { x: -25.4, z: -15.8, face: 1, goods: 'pottery' }, { x: -25.4, z: -20.4, face: 1, goods: 'veg' },
    { x: -14.6, z: -11.2, face: -1, goods: 'silk' }, { x: -14.6, z: -15.8, face: -1, goods: 'lantern' }, { x: -14.6, z: -20.4, face: -1, goods: 'fruit' },
  ],
};
export const BENCHES = [
  { x: -46, z: -5.65, face: 1 }, { x: -24, z: -5.65, face: 1 }, { x: 21, z: -5.65, face: 1 }, { x: 46, z: -5.65, face: 1 },
  { x: -34, z: 5.65, face: -1 }, { x: -17, z: 5.65, face: -1 }, { x: 16, z: 5.65, face: -1 }, { x: 46, z: 5.65, face: -1 },
];
export const WILLOWS = [[-56, -5.45], [-35, -5.45], [-13, -5.45], [13, -5.45], [27, -5.45], [53, -5.45], [-51, 5.45], [-27, 5.45], [-6, 5.45], [24, 5.45], [40, 5.45], [58, 5.45]];
export const PLUMS = [[-8, -37], [8, -37], [-30.5, 12], [-50, 12.5], [17.2, -11.2], [-2.8, 22.5], [-44, 21], [27.2, 10.2]];

// ---------------------------------------------------------------- enterable interiors (world coords)
// outer: wall outer faces [x0,x1,z0,z1]; front: which z side has the door; gap: door opening along x;
// room: walkable inner rect; floorY: interior floor; spawn/exit: [x, z, yaw] (yaw 0 looks toward -z)
export const INTERIORS = [
  { id: 'teahouse', name: ['茶楼 · 大堂', 'Чайная — зал'], outer: [4.2, 15.8, -21.0, -14.11], front: 'z1', gap: [8.1, 11.9], floorY: 0.5, ceilY: 3.85,
    spawn: [9.05, -15.2, 0], exit: [9.05, -12.7, Math.PI], cols: [[4.3, -13.8], [6.2, -13.8], [8.1, -13.8], [10, -13.8], [11.9, -13.8], [13.8, -13.8], [15.7, -13.8]], lamps: [[7, 2.9, -17.3], [13, 2.9, -17.3]] },
  { id: 'noodle', name: ['面馆 · 厨房', 'Лапшичная — кухня'], outer: [-15.5, -4.5, 13.3, 21.0], front: 'z0', gap: [-12, -8], floorY: 0.4, ceilY: 3.6,
    spawn: [-9.0, 14.4, Math.PI], exit: [-9.0, 12.0, 0], cols: [[-15.38, 12.7], [-12.69, 12.7], [-10, 12.7], [-7.31, 12.7], [-4.62, 12.7]], lamps: [[-12.5, 2.8, 18.5], [-7, 2.8, 16.3]] },
  { id: 'house', name: ['民居 · 正房', 'Жилой дом — комнаты'], outer: [18.75, 27.25, -20.5, -10.5], front: 'z1', gap: [22.25, 23.75], floorY: 0.45, ceilY: 3.6,
    spawn: [23, -11.6, 0], exit: [23, -9.3, Math.PI], cols: [], lamps: [[23, 2.9, -15.5], [20.5, 2.6, -18.5]] },
  { id: 'inn', name: ['客栈 · 前堂', 'Гостиница — приёмный зал'], outer: [4.0, 17.0, 11.25, 22.0], front: 'z0', gap: [8.6, 12.4], floorY: 0.45, ceilY: 3.7,
    spawn: [9.46, 12.4, Math.PI], exit: [9.46, 9.9, 0], cols: [[4.25, 10.75], [6.33, 10.75], [8.42, 10.75], [10.5, 10.75], [12.58, 10.75], [14.67, 10.75], [16.75, 10.75]], lamps: [[10.5, 2.9, 15.5], [6.5, 2.9, 19.5]] },
];
INTERIORS.forEach((d) => {
  const t = 0.24, [x0, x1, z0, z1] = d.outer;
  d.room = [x0 + t, x1 - t, z0 + t, z1 - t];
  d.door = { x: (d.gap[0] + d.gap[1]) / 2, z: d.front === 'z1' ? z1 - t / 2 : z0 + t / 2, w: d.gap[1] - d.gap[0], out: d.front === 'z1' ? 1 : -1 };
});
export const HOUSE_ENTER = 3; // HOUSES index of the enterable residence
export function interiorAt(x, z, pad = 0) { for (const d of INTERIORS) if (x > d.room[0] - pad && x < d.room[1] + pad && z > d.room[2] - pad && z < d.room[3] + pad) return d; return null; }

// ---------------------------------------------------------------- nav graph
const H_LINES = [
  [-6.75, [-58, -46, -39, -30, -24, -20, -10, 0, 10, 21, 30, 34, 37.5, 46, 55]],
  [6.75, [-58, -50, -34, -24, -17, -10, 0, 10, 16, 24, 34, 46, 55]],
  [-24.5, [-44, -39, -30, -24, -20, -10, 0, 10, 23, 30, 39, 44]],
  [25.5, [-44, -35, -24, -21, -8, 0, 8, 21, 24, 35, 44]],
];
const V_LINES = [
  [0, [-6.75, -15, -24.5, -29.5, -33.5]], [0, [6.75, 16, 25.5, 33, 40]],
  [-30, [-6.75, -15, -24.5]], [30, [-6.75, -15, -24.5]],
  [-24, [6.75, 16, 25.5]], [24, [6.75, 16, 25.5]],
  [-20, [-6.75, -11.2, -15.8, -20.4, -24.5]],
  [0, [-6.75, 0, 6.75]], [34, [-6.75, 0, 6.75]],
];
const EXTRA = [
  [[0, -33.5], [0, -35.5]], [[0, -35.5], [-4, -38.5]], [[0, -35.5], [4, -38.5]], [[-4, -38.5], [0, -42]], [[4, -38.5], [0, -42]],
  [[-24, 16], [-28, 16]], [[-28, 16], [-31.5, 20.2]], [[-31.5, 20.2], [-40, 20.6]],
];
export function buildNav() {
  const nodes = []; const key = (x, z) => x.toFixed(2) + ',' + z.toFixed(2); const map = new Map();
  const node = (x, z) => { const k = key(x, z); if (!map.has(k)) { map.set(k, nodes.length); nodes.push({ x, z, adj: [] }); } return map.get(k); };
  const link = (a, b) => { if (a === b) return; if (!nodes[a].adj.includes(b)) nodes[a].adj.push(b); if (!nodes[b].adj.includes(a)) nodes[b].adj.push(a); };
  for (const [z, xs] of H_LINES) for (let i = 1; i < xs.length; i++) link(node(xs[i - 1], z), node(xs[i], z));
  for (const [x, zs] of V_LINES) for (let i = 1; i < zs.length; i++) link(node(x, zs[i - 1]), node(x, zs[i]));
  for (const [[ax, az], [bx, bz]] of EXTRA) link(node(ax, az), node(bx, bz));
  return { nodes, find: (x, z) => map.get(key(x, z)) };
}

// ---------------------------------------------------------------- activities
// Each slot: where the resident stands/sits, its facing, the nav node it is
// reached from and an approach polyline (all verified clear of colliders).
export function buildPOIs(nav) {
  const P = { shop: [], tea: [], noodle: [], bench: [], pray: [] };
  const n = (x, z) => { const i = nav.find(x, z); if (i === undefined) throw new Error('no nav node ' + x + ',' + z); return i; };
  for (const s of MARKET.stalls) {
    const cx = s.face > 0 ? s.x + 2.0 : s.x - 2.0;
    for (const dz of [-0.6, 0.6]) P.shop.push({ node: n(-20, s.z), path: [[cx, s.z + dz]], face: s.face > 0 ? -Math.PI / 2 : Math.PI / 2, pose: 'stand' });
  }
  const tz = TEAHOUSE;
  for (const tx of [6.6, 10, 13.4]) {
    P.tea.push({ node: n(10, -6.75), path: [[10, -8.9], [tx, -9.75], [tx, -10.35]], face: Math.PI, pose: 'sit', table: [tx, -11.2] });
    P.tea.push({ node: n(10, -6.75), path: [[10, -8.9], [tx + 1.05, -9.75], [tx + 1.05, -12.05], [tx, -12.05]], face: 0, pose: 'sit', table: [tx, -11.2] });
  }
  // inside the teahouse hall (through the left door leaf)
  const tin = [[10, -8.9], [8.3, -9.75], [8.3, -12.6], [9.05, -13.5], [9.05, -15.3]];
  P.tea.push({ node: n(10, -6.75), path: [...tin, [7.0, -15.7], [7.0, -16.45]], face: Math.PI, pose: 'sit', table: [7.0, -17.2], inside: 'teahouse' });
  P.tea.push({ node: n(10, -6.75), path: [...tin, [12.5, -15.5], [13.0, -15.7], [13.0, -16.45]], face: Math.PI, pose: 'sit', table: [13.0, -17.2], inside: 'teahouse' });
  P.tea.push({ node: n(10, -6.75), path: [...tin, [5.5, -15.5], [5.5, -17.2], [6.25, -17.2]], face: Math.PI / 2, pose: 'sit', table: [7.0, -17.2], inside: 'teahouse' });
  // inside the noodle shop
  const nin = [[-10, 8.8], [-9.2, 9.6], [-9.2, 12.3], [-9.0, 13.0], [-9.0, 14.6]];
  P.noodle.push({ node: n(-10, 6.75), path: [...nin, [-6.8, 14.7], [-6.8, 15.45]], face: 0, pose: 'sit', table: [-6.8, 16.2], inside: 'noodle' });
  P.noodle.push({ node: n(-10, 6.75), path: [...nin, [-5.6, 14.7], [-5.6, 16.95], [-6.8, 16.95]], face: Math.PI, pose: 'sit', table: [-6.8, 16.2], inside: 'noodle' });
  for (const tx of [-12.4, -7.6]) {
    P.noodle.push({ node: n(-10, 6.75), path: [[-10, 8.8], [tx, 9.3], [tx, 9.95]], face: 0, pose: 'sit', table: [tx, 10.8] });
    P.noodle.push({ node: n(-10, 6.75), path: [[-10, 8.8], [tx + (tx < -10 ? -1.15 : 1.15), 9.3], [tx + (tx < -10 ? -1.15 : 1.15), 11.65], [tx, 11.65]], face: Math.PI, pose: 'sit', table: [tx, 10.8] });
  }
  for (const b of BENCHES) for (const dx of [-0.45, 0.45]) {
    P.bench.push({ node: n(b.x, b.z < 0 ? -6.75 : 6.75), path: [[b.x + dx, b.z < 0 ? -6.2 : 6.2], [b.x + dx, b.z < 0 ? -5.95 : 5.95]], face: b.z < 0 ? 0 : Math.PI, pose: 'sit', bench: true });
  }
  for (const dx of [-0.45, 0.45]) P.bench.push({ node: n(-31.5, 20.2), path: [[-35.6 + dx, 20.3], [-35.6 + dx, 19.6]], face: Math.PI, pose: 'sit', bench: true });
  P.bench.push({ node: n(-40, 20.6), path: [[-43.6, 20.2], [-45.4, 19.4]], face: Math.PI * 0.75, pose: 'sit', bench: true });
  for (const dx of [-1.2, 1.2]) P.pray.push({ node: n(0, -42), path: [[dx, -42.5]], face: Math.PI, pose: 'pray' });
  return P;
}

// ---------------------------------------------------------------- colliders
export function buildColliders() {
  const R = []; // axis-aligned rects [x0,x1,z0,z1]
  const rect = (x0, x1, z0, z1) => R.push([Math.min(x0, x1), Math.max(x0, x1), Math.min(z0, z1), Math.max(z0, z1)]);
  HOUSES.forEach((h, i) => { if (i !== HOUSE_ENTER) rect(h.cx - h.w / 2, h.cx + h.w / 2, h.cz - h.d / 2, h.cz + h.d / 2); });
  // enterable buildings: thin walls with a door gap, plus porch columns and interior furniture
  for (const d of INTERIORS) {
    const t = 0.24, [x0, x1, z0, z1] = d.outer;
    rect(x0, x1, d.front === 'z1' ? z0 : z1 - t, d.front === 'z1' ? z0 + t : z1); // back
    rect(x0, x0 + t, z0, z1); rect(x1 - t, x1, z0, z1);                          // sides
    const fz0 = d.front === 'z1' ? z1 - t : z0, fz1 = fz0 + t;
    rect(x0, d.gap[0], fz0, fz1); rect(d.gap[1], x1, fz0, fz1);                  // front, split by the door
    for (const [cx, cz] of d.cols) rect(cx - 0.2, cx + 0.2, cz - 0.2, cz + 0.2);
  }
  for (const f of INTERIOR_FURNITURE) rect(...f);
  // teahouse terrace railings (open at the steps)
  rect(4.0, 7.6, -9.26, -9.22); rect(12.4, 16.0, -9.26, -9.22); rect(4.0, 4.1, -13.5, -9.22); rect(15.9, 16.0, -13.5, -9.22);
  const T = TEMPLE, hl = T.hall;
  rect(hl.cx - hl.w / 2 - 1, hl.cx + hl.w / 2 + 1, hl.cz - hl.d / 2 - 0.5, -42.9);
  rect(T.x0 - 0.3, T.x0 + 0.3, T.z0, T.z1); rect(T.x1 - 0.3, T.x1 + 0.3, T.z0, T.z1); rect(T.x0, T.x1, T.z0 - 0.3, T.z0 + 0.3);
  rect(T.x0, -2.2, T.z1 - 0.3, T.z1 + 0.3); rect(2.2, T.x1, T.z1 - 0.3, T.z1 + 0.3);
  rect(T.burner[0] - 0.9, T.burner[0] + 0.9, T.burner[1] - 0.9, T.burner[1] + 0.9);
  for (const px of [-4.3, -2.1, 2.1, 4.3]) rect(px - 0.3, px + 0.3, PAIFANG.z - 0.3, PAIFANG.z + 0.3);
  const G = GARDEN;
  rect(G.x0, G.x1, G.z0 - 0.2, G.z0 + 0.2); rect(G.x0, G.x1, G.z1 - 0.2, G.z1 + 0.2); rect(G.x0 - 0.2, G.x0 + 0.2, G.z0, G.z1);
  rect(G.x1 - 0.2, G.x1 + 0.2, G.z0, G.moonGate - 1.1); rect(G.x1 - 0.2, G.x1 + 0.2, G.moonGate + 1.1, G.z1);
  rect(G.pavilion[0] - 1.2, G.pavilion[0] + 1.2, G.pavilion[1] - 1.2, G.pavilion[1] + 1.2);
  for (const s of MARKET.stalls) rect(s.x - 1.0, s.x + 1.0, s.z - 1.6, s.z + 1.6);
  for (const tx of [6.6, 10, 13.4]) rect(tx - 0.45, tx + 0.45, -11.65, -10.75);
  for (const tx of [-12.4, -7.6]) rect(tx - 0.5, tx + 0.5, 10.4, 11.2);
  for (const [x, z] of [...WILLOWS, ...PLUMS]) rect(x - 0.3, x + 0.3, z - 0.3, z + 0.3);
  rect(-14.8, -11.0, 12.0, 12.8); // noodle stove counter
  return R;
}

// furniture blocking the player / NPC paths inside interiors [x0,x1,z0,z1]
export const INTERIOR_FURNITURE = [
  // teahouse: two tables, counter, shelves
  [6.55, 7.45, -17.65, -16.75], [12.55, 13.45, -17.65, -16.75], [8.2, 11.8, -20.76, -19.6], [4.44, 5.0, -20.76, -18.4], [15.0, 15.56, -20.76, -18.4],
  // noodle: stove block, prep table, table, shelves
  [-15.26, -12.2, 19.2, 20.76], [-11.4, -9.4, 19.8, 20.76], [-7.25, -6.35, 15.85, 16.55], [-15.26, -14.7, 14.2, 18.0],
  // house: bed, altar, table, shelf, screen
  [19.0, 21.2, -20.26, -18.2], [22.0, 24.0, -20.26, -19.6], [25.6, 26.4, -16.4, -15.6], [26.5, 27.01, -19.5, -16.8], [20.9, 21.1, -17.6, -15.0],
  // inn: counter, benches, stairs
  [5.8, 9.2, 19.7, 20.6], [12.0, 15.6, 14.4, 14.9], [12.0, 15.6, 17.4, 17.9], [15.3, 16.76, 18.0, 21.76], [13.2, 14.4, 15.85, 16.45],
];

// full building footprints (used by tests: camera paths must stay out of them)
export function buildingRects() {
  const R = HOUSES.map((h) => [h.cx - h.w / 2, h.cx + h.w / 2, h.cz - h.d / 2, h.cz + h.d / 2]);
  for (const b of [TEAHOUSE, NOODLE, INN]) R.push([b.x0, b.x1, b.z0, b.z1]);
  return R;
}

export function inRect(x, z, r, pad = 0) { return x > r[0] - pad && x < r[1] + pad && z > r[2] - pad && z < r[3] + pad; }
export function inPond(x, z, pad = 0) { const p = GARDEN.pond; const dx = (x - p.cx) / (p.rx + pad), dz = (z - p.cz) / (p.rz + pad); return dx * dx + dz * dz < 1; }
export function onBridge(x, z, pad = 0) { for (const b of BRIDGES) if (Math.abs(x - b.x) < b.w / 2 - pad && Math.abs(z) < b.half + 0.2) return b; return null; }
export function inCanal(x, z) { return Math.abs(z) < CANAL.half + 0.15 && !onBridge(x, z, 0.25); }

export function groundY(x, z) {
  const b = onBridge(x, z, -0.05);
  if (b) return deckY(b, z);
  const d = interiorAt(x, z, 0.3);
  if (d) return d.floorY;
  const t = TEAHOUSE.terrace;
  if (x > t[0] && x < t[1] && z > t[2] && z < t[3]) return TEAHOUSE.terraceY;
  return 0;
}
