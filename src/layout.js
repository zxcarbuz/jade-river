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
  for (const h of HOUSES) rect(h.cx - h.w / 2, h.cx + h.w / 2, h.cz - h.d / 2, h.cz + h.d / 2);
  rect(TEAHOUSE.x0, TEAHOUSE.x1, TEAHOUSE.z0, TEAHOUSE.z1);
  rect(NOODLE.x0, NOODLE.x1, NOODLE.z0, NOODLE.z1);
  rect(INN.x0, INN.x1, INN.z0, INN.z1);
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

export function inRect(x, z, r, pad = 0) { return x > r[0] - pad && x < r[1] + pad && z > r[2] - pad && z < r[3] + pad; }
export function inPond(x, z, pad = 0) { const p = GARDEN.pond; const dx = (x - p.cx) / (p.rx + pad), dz = (z - p.cz) / (p.rz + pad); return dx * dx + dz * dz < 1; }
export function onBridge(x, z, pad = 0) { for (const b of BRIDGES) if (Math.abs(x - b.x) < b.w / 2 - pad && Math.abs(z) < b.half + 0.2) return b; return null; }
export function inCanal(x, z) { return Math.abs(z) < CANAL.half + 0.15 && !onBridge(x, z, 0.25); }

export function groundY(x, z) {
  const b = onBridge(x, z, -0.05);
  if (b) return deckY(b, z);
  const t = TEAHOUSE.terrace;
  if (x > t[0] && x < t[1] && z > t[2] && z < t[3]) return TEAHOUSE.terraceY;
  return 0;
}
