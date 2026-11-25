import * as THREE from 'three';
import { lathe } from './geom.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32, clamp } from './util.js';
import * as L from './layout.js';
import {
  WALKERS, VENDORS as VENDOR_LIFE, PEOPLE, MEM_CAP, MK, periodOf, marketOpen,
  scheduleAct, buildHomes, makeMemory, remember, thoughtOf, greetPlayer, greetOther,
  activityLine, ACT_RU,
} from './life.js';

// Residents: stylised figures in Ming-era dress. Movement stays on the street
// graph and approach paths. Decisions use a baked daily schedule plus a cheap
// utility score, run on a staggered tick so ~20 people do not eat the frame.

const R = mulberry32(8080);
const skin = [0xf1cfae, 0xe8bf98, 0xf5d7b8, 0xdcb08a];
const robes = [
  { robe: 0x2f4a6e, sash: 0xc9a14a, trim: 0xe8e0cf }, { robe: 0x7b2a24, sash: 0x1b1b1b, trim: 0xe3c58a }, { robe: 0x3f7d6a, sash: 0xe8e0cf, trim: 0x203a32 },
  { robe: 0xe6dcc6, sash: 0x2f4a6e, trim: 0x2f4a6e }, { robe: 0x6a4a7a, sash: 0xc9a14a, trim: 0xf0e0f0 }, { robe: 0xb9843a, sash: 0x5a2a1a, trim: 0x3a2a1a },
  { robe: 0x4a5a3a, sash: 0x9e2b22, trim: 0xd8cfb8 }, { robe: 0xd89aa8, sash: 0xf3ead8, trim: 0x7b2a40 }, { robe: 0x22313f, sash: 0x8a6a3a, trim: 0xb8b0a0 },
];

let G = null;
function geoms() {
  if (G) return G;
  const robe = lathe([[0, 1.43], [0.13, 1.42], [0.19, 1.36], [0.2, 1.2], [0.18, 1.0], [0.2, 0.8], [0.26, 0.45], [0.31, 0.12], [0.33, 0.06], [0.0, 0.06]], 14, { name: 'npc robe' });
  const sash = new THREE.CylinderGeometry(0.195, 0.2, 0.09, 14); sash.translate(0, 1.0, 0);
  const collar = new THREE.TorusGeometry(0.11, 0.025, 5, 14); collar.rotateX(Math.PI / 2); collar.translate(0, 1.43, 0.02);
  const head = new THREE.SphereGeometry(0.115, 14, 10); head.scale(1, 1.1, 1);
  const hair = new THREE.SphereGeometry(0.122, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.42); hair.translate(0, 0.012, -0.014);
  const hairBack = new THREE.SphereGeometry(0.121, 8, 6, Math.PI * 0.75, Math.PI * 1.5, 0, Math.PI * 0.68); hairBack.translate(0, 0.004, -0.01); const hairAll = mergeGeometries([hair, hairBack]);
  const bun = new THREE.SphereGeometry(0.065, 10, 8); bun.translate(0, 0.12, -0.05);
  const capHat = new THREE.CylinderGeometry(0.1, 0.12, 0.12, 12); capHat.translate(0, 0.1, 0);
  const straw = new THREE.ConeGeometry(0.34, 0.16, 16, 1, true); straw.translate(0, 0.14, 0);
  const sleeve = new THREE.CylinderGeometry(0.045, 0.11, 0.52, 16); sleeve.translate(0, -0.26, 0);
  const hand = new THREE.SphereGeometry(0.04, 10, 8); hand.translate(0, -0.54, 0);
  const leg = new THREE.CylinderGeometry(0.055, 0.05, 0.5, 6); leg.translate(0, -0.25, 0);
  const shoe = new THREE.BoxGeometry(0.09, 0.06, 0.2); shoe.translate(0, -0.52, 0.04);
  const umb = new THREE.ConeGeometry(0.62, 0.22, 18, 1, true); umb.translate(0, 0.11, 0);
  const umbStick = new THREE.CylinderGeometry(0.012, 0.012, 0.9, 4); umbStick.translate(0, -0.35, 0);
  const cup = new THREE.CylinderGeometry(0.035, 0.025, 0.05, 8);
  // crossed collar (交领) trim on the robe front
  const lapel = mergeGeometries([0.42, -0.42].map((r, k) => { const b = new THREE.BoxGeometry(0.035, 0.36, 0.012); b.rotateZ(r); b.translate(k ? 0.045 : -0.045, 1.28, 0.0); b.rotateX(-0.12); b.translate(0, 0, 0.19 + k * 0.004); return b; }));
  G = { robe, sash, collar, head, hair: hairAll, bun, capHat, straw, sleeve, hand, leg, shoe, umb, umbStick, cup, lapel };
  return G;
}
const faceCache = new Map();
// face features merged into one vertex-coloured mesh per skin tone (eyes, brows, nose, lips, ears)
function faceGeo(skinHex, female) {
  const k = skinHex + ':' + female; if (faceCache.has(k)) return faceCache.get(k);
  const parts = []; const col = (g, hex) => { const c = new THREE.Color(hex); const n = g.attributes.position.count; const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); for (const key of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(key)) g.deleteAttribute(key); parts.push(g); };
  const skinC = new THREE.Color(skinHex);
  for (const s of [-1, 1]) {
    const eye = new THREE.SphereGeometry(0.014, 8, 6); eye.scale(1.25, 0.7, 0.45); eye.translate(s * 0.04, 0.012, 0.106); col(eye, 0x17110e);
    const glint = new THREE.SphereGeometry(0.004, 4, 3); glint.translate(s * 0.036, 0.016, 0.112); col(glint, 0xf4efe6);
    const brow = new THREE.BoxGeometry(0.032, 0.006, 0.006); brow.rotateZ(s * (female ? -0.12 : -0.2)); brow.translate(s * 0.041, 0.036, 0.104); col(brow, 0x1a1412);
    const ear = new THREE.SphereGeometry(0.024, 6, 5); ear.scale(0.45, 1, 0.8); ear.translate(s * 0.113, 0.0, 0.0); col(ear, skinC.clone().multiplyScalar(0.94).getHex());
    if (female) { const blush = new THREE.CircleGeometry(0.016, 8); blush.translate(s * 0.052, -0.025, 0.1); blush.rotateY(s * 0.45); col(blush, 0xe89a90); }
  }
  const nose = new THREE.SphereGeometry(0.016, 6, 5); nose.scale(0.8, 1, 0.9); nose.translate(0, -0.012, 0.112); col(nose, skinC.clone().multiplyScalar(0.96).getHex());
  const lips = new THREE.BoxGeometry(0.03, 0.007, 0.008); lips.translate(0, -0.05, 0.103); col(lips, female ? 0xb4463e : 0x9a5a4e);
  const g = mergeGeometries(parts); faceCache.set(k, g); return g;
}
const matCache = new Map();
function mc(color, opts = {}) { const k = color + JSON.stringify(opts); if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts })); return matCache.get(k); }

function makeFigure(i, style) {
  const g = geoms(); const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const pal = style.monk ? { robe: 0xc8862a, sash: 0x8e2a1e, trim: 0x8e2a1e } : robes[i % robes.length]; const female = style.female;
  const robeMesh = new THREE.Mesh(g.robe, mc(pal.robe, { side: THREE.DoubleSide })); robeMesh.castShadow = true; body.add(robeMesh);
  body.add(new THREE.Mesh(g.sash, mc(pal.sash)));
  const trimG = mergeGeometries([g.collar, g.lapel]);
  body.add(new THREE.Mesh(trimG, mc(pal.trim)));
  const headG = new THREE.Group(); headG.position.y = 1.56; body.add(headG);
  const headM = new THREE.Mesh(g.head, mc(skin[i % skin.length], { roughness: 0.7 })); headM.castShadow = true; headG.add(headM);
  const face = new THREE.Mesh(faceGeo(skin[i % skin.length], !!female), mc(0xffffff, { vertexColors: true, roughness: 0.55 })); headG.add(face);
  if (style.monk) { /* shaved head; prayer beads instead of hair or hat */ const beads = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.012, 5, 18), mc(0x5a2a1a, { roughness: 0.4 })); beads.rotation.x = Math.PI / 2 - 0.5; beads.position.set(0, -0.15, 0.05); headG.add(beads); }
  else headG.add(new THREE.Mesh(g.hair, mc(0x141010, { roughness: 0.6, side: THREE.DoubleSide })));
  if (style.monk) { /* no hat */ }
  else if (female) { headG.add(new THREE.Mesh(g.bun, mc(0x141010, { roughness: 0.6 }))); const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 4), mc(0xc9a14a, { metalness: 0.7 })); pin.position.set(0, 0.17, -0.05); pin.rotation.z = 1.3; headG.add(pin); }
  else if (style.hat === 'straw') { const s = new THREE.Mesh(g.straw, mc(0xcaa86a, { side: THREE.DoubleSide })); s.castShadow = true; headG.add(s); }
  else headG.add(new THREE.Mesh(g.capHat, mc(0x15181c)));
  const arms = [];
  if (style.monk) {
    const robeMat = mc(pal.robe, { side: THREE.DoubleSide });
    const skinMat = mc(skin[i % skin.length], { roughness: 0.7 });
    const tubeBetween = (ax, ay, az, bx, by, bz, rTop, rBot) => {
      const a = new THREE.Vector3(ax, ay, az), b = new THREE.Vector3(bx, by, bz);
      const len = a.distanceTo(b);
      const geom = new THREE.CylinderGeometry(rTop, rBot, len, 12);
      const m = new THREE.Mesh(geom, robeMat);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.clone().sub(b).normalize());
      m.castShadow = true;
      return m;
    };
    const handGeo = new THREE.SphereGeometry(0.056, 8, 6); handGeo.scale(0.32, 1.05, 0.62);
    const drapeGeo = new THREE.CylinderGeometry(0.068, 0.098, 0.28, 12, 1, false);
    const shGeo = new THREE.SphereGeometry(0.054, 8, 6), elGeo = new THREE.SphereGeometry(0.071, 8, 6);
    for (const s of [-1, 1]) {
      const a = new THREE.Group(); body.add(a);
      // rounded shoulder & elbow joints + upper arm: shoulder -> elbow along sides
      const sh = new THREE.Mesh(shGeo, robeMat); sh.position.set(s * 0.165, 1.33, 0.015); a.add(sh);
      const el = new THREE.Mesh(elGeo, robeMat); el.position.set(s * 0.17, 1.08, 0.13); a.add(el);
      a.add(tubeBetween(s * 0.165, 1.33, 0.015, s * 0.17, 1.08, 0.13, 0.052, 0.07));
      // forearm: elbow -> chest center (no crossing)
      a.add(tubeBetween(s * 0.17, 1.08, 0.13, s * 0.04, 1.22, 0.245, 0.066, 0.078));
      // hanging wide Ming sleeve drape under forearm
      const dr = new THREE.Mesh(drapeGeo, robeMat);
      dr.position.set(s * 0.11, 1.01, 0.185); dr.scale.set(0.68, 1, 1.05); dr.rotation.z = s * 0.08; dr.castShadow = true;
      a.add(dr);
      // gassho palm pressed together in front of chest
      const h = new THREE.Mesh(handGeo, skinMat);
      h.position.set(s * 0.013, 1.265, 0.27); h.rotation.set(0.38, s * -0.1, 0);
      a.add(h);
      arms.push(a);
    }
    // subtle prayer beads around joined wrists
    const wristBeads = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.01, 5, 14), mc(0x5a2a1a, { roughness: 0.4 }));
    wristBeads.position.set(0, 1.215, 0.248); wristBeads.rotation.x = Math.PI / 2 - 0.45;
    body.add(wristBeads);
  } else {
    for (const s of [-1, 1]) {
      const a = new THREE.Group(); a.position.set(s * 0.2, 1.36, 0); body.add(a);
      const sl = new THREE.Mesh(g.sleeve, mc(pal.robe)); sl.castShadow = true; a.add(sl);
      a.add(new THREE.Mesh(g.hand, mc(skin[i % skin.length])));
      a.rotation.z = s * 0.12; arms.push(a);
    }
  }
  const legs = [];
  for (const s of [-1, 1]) { const l = new THREE.Group(); l.position.set(s * 0.09, 0.55, 0); root.add(l); l.add(new THREE.Mesh(g.leg, mc(0x2a2420))); l.add(new THREE.Mesh(g.shoe, mc(0x121212))); legs.push(l); }
  let umbrella = null;
  if (style.umbrella) { umbrella = new THREE.Group(); umbrella.position.set(0.18, 2.12, 0.05); const u = new THREE.Mesh(g.umb, mc(style.umbrella, { side: THREE.DoubleSide, roughness: 0.6 })); u.castShadow = true; umbrella.add(u); umbrella.add(new THREE.Mesh(g.umbStick, mc(0x5a3a26))); umbrella.rotation.z = -0.12; root.add(umbrella); }
  const cup = new THREE.Mesh(g.cup, mc(0xe9eef2, { roughness: 0.3 })); cup.position.set(0, -0.56, 0.04); cup.visible = false; arms[1].add(cup);
  const sc = style.scale || 1; root.scale.setScalar(sc);
  const small = [];
  const smallGeo = new Set([g.sash, trimG, g.hand, g.shoe, face.geometry]);
  root.traverse((o) => { if (o.isMesh) { o.userData.npcPart = true; if (o !== cup && (smallGeo.has(o.geometry) || o.geometry.type === 'CylinderGeometry')) small.push(o); } });
  return { small, root, body, headG, arms, legs, umbrella, cup };
}


function nearestNode(nav, x, z) {
  let best = 0, bd = Infinity;
  const N = nav.nodes;
  for (let i = 0; i < N.length; i++) {
    const dx = N[i].x - x, dz = N[i].z - z, d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

const AI_MS_N = 240;

export class Residents {
  constructor(scene, nav, pois, colliders) {
    this.scene = scene; this.nav = nav; this.pois = pois; this.colliders = colliders;
    this.list = []; this.vendors = []; this.paused = false; this.time = 0;
    this.hour = 17.7; this.period = periodOf(this.hour);
    this.playerX = 0; this.playerZ = 0; this.playerOn = false;
    this.urgent = 0; this.aiAcc = 0; this.aiCursor = 0;
    this._aiMs = new Float64Array(AI_MS_N); this._aiMsI = 0; this._aiMsN = 0; this._aiSum = 0;
    this.aiLast = 0; this.aiAvg = 0; this.aiP95 = 0;
    this.greeting = null; this._greetObj = { text: '', x: 0, z: 0, until: 0, id: -1 };
    this.group = new THREE.Group(); this.group.name = 'residents'; scene.add(this.group);
    for (const k of Object.keys(pois)) pois[k].forEach((s) => { s.taken = null; s.kind = k; });
    pois.home = buildHomes(nav);
    const N = nav.nodes;
    this.dist = (a, b) => Math.hypot(N[a].x - N[b].x, N[a].z - N[b].z);
    this._byId = PEOPLE;
    const starts = [0, 6, 9, 14, 18, 22, 27, 31, 36, 40, 45, 50].map((k) => k % N.length);
    for (let i = 0; i < 12; i++) {
      const life = WALKERS[i];
      const female = [1, 2, 5, 7, 10].includes(i);
      const style = { female, hat: i === 6 || i === 11 ? 'straw' : 'cap', umbrella: i === 5 ? 0xd85a6a : i === 2 ? 0x3f7d6a : null, scale: i === 11 ? 0.8 : 0.95 + R() * 0.1 };
      const fig = makeFigure(i, style);
      const n = starts[i]; const node = N[n];
      const r = {
        id: i, fig, name: life.name, life, x: node.x, z: node.z, heading: R() * 6.28,
        speed: 0.95 + R() * 0.45, node: n, path: [], state: 'idle', timer: 0.5 + R() * 3,
        slot: null, act: null, phase: R() * 10, side: 0.42, pose: 'stand', sit: 0, lastDecision: '',
        hidden: false, mem: makeMemory(), hunger: 0.3 + R() * 0.3, tired: R() * 0.3, piety: i === 0 || i === 9 ? 0.6 : R() * 0.3,
        greetT: -99, talkT: -99, lastDone: '', afterLeave: null, _rng: mulberry32(8080 + i * 97),
      };
      fig.root.position.set(r.x, 0, r.z); fig.root.userData.resident = r;
      this.group.add(fig.root); this.list.push(r);
    }
    VENDOR_LIFE.forEach((life, i) => {
      const v = life.post;
      const fig = makeFigure(i + 3, { female: i === 2, hat: i === 4 ? 'cap' : i % 2 ? 'cap' : 'straw', scale: 1, monk: !!v.monk });
      fig.root.position.set(v.x, L.groundY(v.x, v.z), v.z); fig.root.rotation.y = v.face;
      const node = nearestNode(nav, v.x, v.z);
      const r = {
        id: life.id, fig, name: life.name, life, x: v.x, z: v.z, heading: v.face, baseFace: v.face,
        state: v.cook ? 'cook' : v.monk ? 'monk' : 'vendor', phase: R() * 10, vendor: true, pose: 'stand', sit: 0,
        room: v.room || null, path: [], node, speed: 0.9 + R() * 0.25, slot: null, act: v.cook ? 'cook' : v.monk ? 'monk' : 'vendor',
        timer: 0, hidden: false, mem: makeMemory(), hunger: 0, tired: 0, piety: v.monk ? 1 : 0,
        greetT: -99, talkT: -99, lastDone: '', afterLeave: null, post: v, postNode: node,
        _rng: mulberry32(9090 + i * 53),
      };
      fig.root.userData.resident = r;
      this.group.add(fig.root); this.vendors.push(r);
    });
    this._all = this.list.concat(this.vendors);
    this._allN = this._all.length;
  }
  get all() { return this._all; }
  describe(r) { return `${r.name[0]} · ${r.name[1]} — ${activityLine(r)}`; }
  card(r) {
    return {
      cn: r.name[0],
      ru: `${r.name[1]} — ${r.life.roleRu} · ${activityLine(r)}`,
      thought: thoughtOf(r.life, this.hour, r, r.mem, this._byId),
      role: r.life.roleRu,
    };
  }
  stats() { return { last: this.aiLast, avg: this.aiAvg, p95: this.aiP95, n: this._aiMsN, cap: MEM_CAP }; }

  setHour(h) {
    this.hour = h;
    const p = periodOf(h);
    if (p !== this.period) { this.period = p; this.urgent = this._allN; this.aiAcc = 0.25; }
  }

  // Dijkstra over the street graph
  route(from, to) {
    const N = this.nav.nodes; const dist = new Array(N.length).fill(Infinity), prev = new Array(N.length).fill(-1), done = new Array(N.length).fill(false);
    dist[from] = 0;
    for (;;) {
      let u = -1, best = Infinity; for (let i = 0; i < N.length; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
      if (u < 0) break; done[u] = true; if (u === to) break;
      const nu = N[u];
      for (let k = 0; k < nu.adj.length; k++) {
        const v = nu.adj[k], nd = dist[u] + this.dist(u, v);
        if (nd < dist[v]) { dist[v] = nd; prev[v] = u; }
      }
    }
    if (to !== from && prev[to] < 0) return [from, to];
    const out = []; for (let v = to; v >= 0; v = prev[v]) out.push(v);
    out.reverse(); return out;
  }
  waypoints(from, nodes) {
    const N = this.nav.nodes; const out = [];
    for (let i = 1; i < nodes.length; i++) out.push({ x: N[nodes[i]].x, z: N[nodes[i]].z, graph: true, node: nodes[i] });
    return out;
  }

  goSlot(r, kind, slot) {
    const N = this.nav.nodes;
    if (r.slot && r.slot !== slot) r.slot.taken = null;
    slot.taken = r; r.slot = slot; r.act = kind; r.lastDecision = kind; r.afterLeave = null;
    if (r.hidden) this.wake(r);
    const route = this.route(r.node, slot.node);
    r.path = this.waypoints(r.node, route);
    r.path.push({ x: N[slot.node].x, z: N[slot.node].z, graph: true, node: slot.node });
    for (const [x, z] of slot.path) r.path.push({ x, z, approach: true });
    r.state = 'walk'; r.goal = 'slot';
  }
  goWander(r) {
    const N = this.nav.nodes;
    if (r.slot) { r.slot.taken = null; r.slot = null; }
    if (r.hidden) this.wake(r);
    r.lastDecision = 'wander'; r.act = 'wander'; r.goal = 'wander';
    let target = r.node; for (let k = 0; k < 10 && (target === r.node || this.dist(target, r.node) < 12); k++) target = Math.floor(r._rng() * N.length);
    r.path = this.waypoints(r.node, this.route(r.node, target)); r.state = 'walk';
  }
  goHome(r) {
    if (r.hidden) return;
    const home = r.life.home;
    if (typeof home === 'string') {
      // workplace sleep: fade out in place (already indoors or at the shop door)
      this.hide(r);
      return;
    }
    const slot = this.pois.home[home];
    if (!slot) { this.hide(r); return; }
    if (r.slot) { r.slot.taken = null; r.slot = null; }
    r.act = 'home'; r.lastDecision = 'home'; r.goal = 'home'; r.afterLeave = null;
    const N = this.nav.nodes;
    const route = this.route(r.node, slot.node);
    r.path = this.waypoints(r.node, route);
    r.path.push({ x: N[slot.node].x, z: N[slot.node].z, graph: true, node: slot.node });
    const ox = (r.id % 2 ? 0.45 : -0.45);
    for (const [x, z] of slot.path) r.path.push({ x: x + (z === slot.path[slot.path.length - 1][1] ? ox : 0), z, approach: true });
    r.state = 'walk';
  }
  goPost(r) {
    if (!r.vendor || !r.post) return;
    if (r.hidden) this.wake(r);
    if (r.slot) { r.slot.taken = null; r.slot = null; }
    r.act = r.post.cook ? 'cook' : r.post.monk ? 'monk' : 'vendor';
    r.lastDecision = 'work'; r.goal = 'post'; r.afterLeave = null;
    const N = this.nav.nodes;
    const route = this.route(r.node, r.postNode);
    r.path = this.waypoints(r.node, route);
    r.path.push({ x: N[r.postNode].x, z: N[r.postNode].z, graph: true, node: r.postNode });
    r.path.push({ x: r.post.x, z: r.post.z, approach: true });
    r.state = 'walk';
  }
  hide(r) {
    if (r.slot) { r.slot.taken = null; r.slot = null; }
    r.hidden = true; r.state = 'sleep'; r.act = 'sleep'; r.path.length = 0; r.goal = null; r.timer = 0;
    r.fig.root.visible = false; r.fig.cup.visible = false;
  }
  wake(r) {
    r.hidden = false; r.fig.root.visible = true; r.goal = null;
    if (r.vendor && r.post && typeof r.life.home === 'string') {
      r.x = r.post.x; r.z = r.post.z; r.node = r.postNode; r.heading = r.baseFace;
      r.state = r.post.cook ? 'cook' : r.post.monk ? 'monk' : 'vendor';
      r.act = r.state; this.apply(r);
    } else {
      r.state = 'idle'; r.timer = 0.05; r.act = r.vendor ? null : r.act;
    }
  }

  pickAct(r) {
    if (r.vendor) {
      const want = scheduleAct(r.life, this.hour);
      if (want === 'monk') return 'monk';
      if (want === 'work') return 'work';
      return 'home';
    }
    const sched = scheduleAct(r.life, this.hour);
    const night = this.period === 'night';
    const kinds = ['shop', 'tea', 'noodle', 'bench', 'pray', 'wander', 'home'];
    let best = sched, bestS = -999;
    for (let i = 0; i < kinds.length; i++) {
      const k = kinds[i];
      let s = 0;
      if (k === sched) s += 3.2;
      if (k === r.lastDone) s -= 0.8;
      if (k === 'noodle') s += r.hunger * 2.2;
      if (k === 'bench') s += r.tired * 1.3;
      if (k === 'pray') s += r.piety * 1.4;
      if (k === 'home' && night) s += 5;
      if (k !== 'home' && night) s -= 4.5;
      if (k === 'shop' && !marketOpen(this.hour)) s -= 6;
      if (k !== 'wander' && k !== 'home') {
        const slots = this.pois[k];
        let free = 0; if (slots) for (let j = 0; j < slots.length; j++) if (!slots[j].taken || slots[j].taken === r) free++;
        if (!free) s -= 5;
      }
      s += (r._rng() - 0.5) * 0.7;
      if (s > bestS) { bestS = s; best = k; }
    }
    return best;
  }
  beginAct(r, kind) {
    if (kind === 'home') { this.goHome(r); return; }
    if (kind === 'work' || kind === 'monk') { this.goPost(r); return; }
    if (kind === 'wander') { this.goWander(r); return; }
    const slots = this.pois[kind];
    if (!slots) { this.goWander(r); return; }
    // pick a free slot; if none, remember and try something else
    let first = -1, nfree = 0;
    for (let i = 0; i < slots.length; i++) if (!slots[i].taken) { if (first < 0) first = i; nfree++; }
    if (nfree === 0) {
      remember(r.mem, MK.BLOCKED, this.hour, r.x, r.z, -1);
      if (kind !== 'wander') this.goWander(r);
      return;
    }
    let pick = first, skip = Math.floor(r._rng() * nfree), seen = 0;
    for (let i = 0; i < slots.length; i++) if (!slots[i].taken) { if (seen === skip) { pick = i; break; } seen++; }
    this.goSlot(r, kind, slots[pick]);
  }
  think(r) {
    // needs tick (once per think, not per frame)
    if (!r.vendor) {
      r.hunger = Math.min(1, r.hunger + 0.04);
      r.tired = Math.min(1, r.tired + 0.02);
      if (r.act === 'noodle' && r.state === 'activity') r.hunger = Math.max(0, r.hunger - 0.5);
      if (r.act === 'bench' && r.state === 'activity') r.tired = Math.max(0, r.tired - 0.35);
      if (r.act === 'pray' && r.state === 'activity') r.piety = Math.min(1, r.piety + 0.1);
    }
    this.greetCheck(r);
    if (r.hidden) {
      const want = this.pickAct(r);
      if (want !== 'home' && want !== 'sleep') this.wake(r);
      else return;
    }
    const want = this.pickAct(r);
    if (r.vendor) {
      const nearPost = r.post && (r.x - r.post.x) * (r.x - r.post.x) + (r.z - r.post.z) * (r.z - r.post.z) < 1.0;
      const atPost = !r.hidden && nearPost && r.state !== 'walk' && r.state !== 'leave';
      if (want === 'home' && !r.hidden && r.goal !== 'home' && this._canRepath(r)) this.goHome(r);
      else if ((want === 'work' || want === 'monk') && !atPost && r.goal !== 'post' && this._canRepath(r)) this.goPost(r);
      return;
    }
    if (r.state === 'activity') {
      if (this.period === 'night' && want === 'home') { r.timer = 0; r.afterLeave = 'home'; }
      return;
    }
    if (r.state === 'leave') {
      if (want === 'home') r.afterLeave = 'home';
      return;
    }
    if (r.state === 'walk' || r.state === 'pause') {
      // never cut a corner: only switch destination when standing on a graph node
      if (want === 'home' && r.goal !== 'home' && this._canRepath(r)) this.beginAct(r, 'home');
      return;
    }
    this.beginAct(r, want);
  }
  _canRepath(r) {
    if (r.hidden || r.state === 'idle') return true;
    if (r.vendor && (r.state === 'vendor' || r.state === 'cook' || r.state === 'monk')) return true;
    if (r.state === 'activity' || r.state === 'leave') return false;
    if (r.path && r.path[0] && r.path[0].approach) return false;
    const n = this.nav.nodes[r.node];
    if (!n) return false;
    const dx = r.x - n.x, dz = r.z - n.z;
    return dx * dx + dz * dz < 0.16;
  }
  greetCheck(r) {
    if (r.hidden) return;
    const px = this.playerX, pz = this.playerZ;
    if (this.playerOn) {
      const dx = r.x - px, dz = r.z - pz, d2 = dx * dx + dz * dz;
      if (d2 < 12.25 && this.time - r.greetT > 14) {
        r.greetT = this.time;
        const text = greetPlayer(r.life, this.hour, r, r.mem);
        const g = this._greetObj; g.text = text; g.x = r.x; g.z = r.z; g.until = this.time + 4.5; g.id = r.id;
        this.greeting = g;
        remember(r.mem, MK.PLAYER, this.hour, px, pz, -1);
      }
    }
    // NPC–NPC: only the current thinker scans, squared distance, no allocations
    for (let i = 0; i < this._allN; i++) {
      const o = this._all[i];
      if (o === r || o.hidden || o.state === 'sleep') continue;
      const dx = o.x - r.x, dz = o.z - r.z, d2 = dx * dx + dz * dz;
      if (d2 > 3.24 || d2 < 0.04) continue;
      if (this.time - r.talkT < 10 || this.time - o.talkT < 10) continue;
      r.talkT = o.talkT = this.time;
      remember(r.mem, MK.TALK, this.hour, r.x, r.z, o.id);
      remember(o.mem, MK.TALK, this.hour, o.x, o.z, r.id);
      if (this.playerOn) {
        const pdx = r.x - px, pdz = r.z - pz;
        if (pdx * pdx + pdz * pdz < 64) {
          const g = this._greetObj; g.text = greetOther(r.life, o.life); g.x = (r.x + o.x) * 0.5; g.z = (r.z + o.z) * 0.5; g.until = this.time + 3.2; g.id = r.id;
          this.greeting = g;
        }
      }
      break;
    }
  }

  // LOD: tiny parts hidden beyond `far` metres; hidden sleepers stay invisible
  lod(cam, far) {
    for (const r of this._all) {
      const f = r.fig; if (!f || !f.small) continue;
      if (r.hidden) { if (f.root.visible) f.root.visible = false; continue; }
      if (r.room) {
        const near = f.root.position.distanceToSquared(cam.position) < Math.max(far, 16) * Math.max(far, 16);
        if (f.root.visible !== near) f.root.visible = near;
        if (!near) continue;
      }
      const show = f.root.position.distanceToSquared(cam.position) < far * far;
      if (f._show === show) continue; f._show = show;
      for (const m of f.small) m.visible = show;
    }
  }
  update(dt) {
    if (this.paused) return;
    this.time += dt;
    for (const r of this.list) if (!r.hidden) this.step(r, dt, this.time);
    for (const v of this.vendors) {
      if (v.hidden) continue;
      if (v.state === 'walk' || v.state === 'leave' || v.state === 'idle' || v.state === 'pause') this.step(v, dt, this.time);
      else this.animVendor(v, dt, this.time);
    }
    // staggered AI: ~2 NPCs every 0.25 s (≈ 4 Hz of think work), or a short burst after a time-of-day change
    const t0 = performance.now();
    this.aiAcc += dt;
    let quota = 0;
    if (this.urgent > 0) quota = 3;
    else if (this.aiAcc >= 0.25) { quota = 2; this.aiAcc -= 0.25; }
    for (let i = 0; i < quota; i++) {
      const r = this._all[this.aiCursor % this._allN];
      this.aiCursor++;
      this.think(r);
      if (this.urgent > 0) this.urgent--;
    }
    if (this.greeting && this.time > this.greeting.until) this.greeting = null;
    const ms = performance.now() - t0;
    this.aiLast = ms;
    const i = this._aiMsI;
    if (this._aiMsN === AI_MS_N) this._aiSum -= this._aiMs[i];
    this._aiMs[i] = ms; this._aiMsI = (i + 1) % AI_MS_N;
    if (this._aiMsN < AI_MS_N) this._aiMsN++;
    this._aiSum += ms;
    this.aiAvg = this._aiSum / this._aiMsN;
    // p95 of the ring (small N, sort a copy into a reusable buffer once in a while)
    if ((this._aiMsN & 7) === 0) this._refreshP95();
  }
  _refreshP95() {
    const n = this._aiMsN, tmp = this._aiSort || (this._aiSort = new Float64Array(AI_MS_N));
    for (let i = 0; i < n; i++) tmp[i] = this._aiMs[i];
    // insertion-ish: partial select is overkill; n<=240, sort copy
    const arr = Array.from(tmp.subarray(0, n)); arr.sort((a, b) => a - b);
    this.aiP95 = arr[Math.min(n - 1, Math.floor(n * 0.95))];
  }
  step(r, dt, t) {
    const f = r.fig;
    if (r.state === 'idle') {
      r.timer -= dt; r.fig.headG.rotation.y = Math.sin(t * 0.8 + r.phase) * 0.6;
      this.pose(r, dt, 0, 'stand');
      if (r.timer <= 0) { r.fig.headG.rotation.y = 0; /* think() will assign the next act */ }
    } else if (r.state === 'walk') {
      const wp = r.path[0];
      if (!wp) { this.arrive(r); return; }
      const dx = wp.x - r.x, dz = wp.z - r.z, d = Math.hypot(dx, dz);
      let sp = r.speed;
      if (wp.graph) for (const o of this.list) { if (o === r || o.state !== 'walk' || o.hidden) continue; const ox = o.x - r.x, oz = o.z - r.z; const od = Math.hypot(ox, oz); if (od < 1.0 && od > 0.01 && (ox * dx + oz * dz) / (od * (d || 1)) > 0.8) { sp *= 0.25; break; } }
      const stepLen = Math.min(d, sp * dt);
      if (d > 1e-4) { r.x += dx / d * stepLen; r.z += dz / d * stepLen; const want = Math.atan2(dx, dz); r.heading = turn(r.heading, want, dt * 6); }
      if (d - stepLen < 0.02) {
        r.path.shift();
        if (wp.node !== undefined) {
          r.node = wp.node;
          if (r.goal === 'wander' && this.nav.nodes[wp.node].adj.length >= 3 && r._rng() < 0.22 && r.path.length) { r.state = 'pause'; r.timer = 1 + r._rng() * 2.5; }
        }
      }
      this.pose(r, dt, sp, 'walk');
    } else if (r.state === 'pause') {
      r.timer -= dt; r.fig.headG.rotation.y = Math.sin(t * 1.1 + r.phase) * 0.7; this.pose(r, dt, 0, 'stand');
      if (r.timer <= 0) { r.fig.headG.rotation.y = 0; r.state = 'walk'; }
    } else if (r.state === 'activity') {
      r.timer -= dt; r.heading = turn(r.heading, r.slot.face, dt * 4);
      this.pose(r, dt, 0, r.slot.pose === 'sit' ? 'sit' : r.slot.pose === 'pray' ? 'pray' : 'stand');
      this.animActivity(r, t);
      if (r.timer <= 0) {
        const back = [...r.slot.path].reverse().slice(1).map(([x, z]) => ({ x, z, approach: true }));
        const n = this.nav.nodes[r.slot.node]; back.push({ x: n.x, z: n.z, node: r.slot.node, graph: true });
        r.path = back; r.state = 'leave'; r.fig.cup.visible = false; r.fig.headG.rotation.set(0, 0, 0);
        r.lastDone = r.act;
      }
    } else if (r.state === 'leave') {
      if (r.sit > 0.02) { this.pose(r, dt, 0, 'stand'); this.apply(r); return; }
      const wp = r.path[0];
      if (!wp) {
        if (r.slot) { r.slot.taken = null; r.slot = null; }
        const next = r.afterLeave; r.afterLeave = null; r.goal = null;
        if (next) { r.state = 'idle'; r.timer = 0; this.beginAct(r, next); }
        else { r.state = 'idle'; r.timer = 0.3 + r._rng() * 1.5; }
        this.apply(r); return;
      }
      const dx = wp.x - r.x, dz = wp.z - r.z, d = Math.hypot(dx, dz); const stepLen = Math.min(d, r.speed * dt);
      if (d > 1e-4) { r.x += dx / d * stepLen; r.z += dz / d * stepLen; r.heading = turn(r.heading, Math.atan2(dx, dz), dt * 6); }
      if (d - stepLen < 0.02) { r.path.shift(); if (wp.node !== undefined) r.node = wp.node; }
      this.pose(r, dt, r.speed, 'walk');
    }
    this.apply(r);
  }
  arrive(r) {
    if (r.goal === 'home') { this.hide(r); this.apply(r); return; }
    if (r.goal === 'post' && r.post) {
      r.x = r.post.x; r.z = r.post.z; r.heading = r.baseFace; r.node = r.postNode;
      r.state = r.post.cook ? 'cook' : r.post.monk ? 'monk' : 'vendor';
      r.act = r.state; r.path.length = 0; r.goal = null; this.apply(r); return;
    }
    if (r.goal === 'slot' && r.slot) {
      r.state = 'activity';
      const dur = { shop: [6, 12], tea: [16, 30], noodle: [14, 24], bench: [12, 26], pray: [6, 10] }[r.act] || [8, 16];
      r.timer = dur[0] + r._rng() * (dur[1] - dur[0]);
      if (r.act === 'tea') r.fig.cup.visible = true;
      remember(r.mem, MK.ACT, this.hour, r.x, r.z, -1);
    } else { r.state = 'idle'; r.timer = 0.4 + r._rng() * 2.2; }
  }
  pose(r, dt, speed, kind) {
    const f = r.fig; const k = 1 - Math.exp(-dt * 6);
    r.sit += ((kind === 'sit' ? 1 : 0) - r.sit) * k;
    if (kind === 'walk') {
      r.phase += dt * speed * 5.2; const s = Math.sin(r.phase);
      f.legs[0].rotation.x = s * 0.45; f.legs[1].rotation.x = -s * 0.45;
      f.arms[0].rotation.x = -s * 0.4; f.arms[1].rotation.x = s * 0.4;
      f.body.position.y = Math.abs(Math.cos(r.phase)) * 0.035; f.body.rotation.z = s * 0.025; f.body.rotation.x = 0;
    } else {
      for (const l of f.legs) l.rotation.x += ((r.sit > 0.5 ? -1.45 : 0) - l.rotation.x) * k;
      if (kind !== 'pray') for (const a of f.arms) a.rotation.x += ((r.sit > 0.5 ? -0.5 : 0) - a.rotation.x) * k;
      f.body.position.y += (-r.sit * 0.0 - f.body.position.y) * k; f.body.rotation.z *= 0.9;
    }
  }
  animActivity(r, t) {
    const f = r.fig; const ph = t + r.phase;
    if (r.act === 'tea') { const lift = Math.max(0, Math.sin(ph * 0.5)) ** 4; f.arms[1].rotation.x = -0.6 - lift * 1.6; f.headG.rotation.x = lift * -0.2; }
    else if (r.act === 'noodle') { const lift = Math.max(0, Math.sin(ph * 1.6)) ** 2; f.arms[1].rotation.x = -0.7 - lift * 1.1; f.arms[0].rotation.x = -0.8; f.headG.rotation.x = 0.25 - lift * 0.15; }
    else if (r.act === 'shop') { f.headG.rotation.x = 0.3; f.headG.rotation.y = Math.sin(ph * 0.6) * 0.4; f.arms[1].rotation.x = -0.4 - Math.max(0, Math.sin(ph * 0.9)) * 0.7; }
    else if (r.act === 'bench') {
      const other = this.list.find((o) => o !== r && o.state === 'activity' && o.act === 'bench' && Math.hypot(o.x - r.x, o.z - r.z) < 1.2);
      if (other) { f.headG.rotation.y = Math.sign((other.x - r.x) * Math.cos(r.heading) - (other.z - r.z) * Math.sin(r.heading)) * 0.8; f.arms[(Math.floor(ph) % 2)].rotation.x = -0.6 - Math.max(0, Math.sin(ph * 2.2)) * 0.5; r.talking = true; }
      else { f.headG.rotation.y = Math.sin(ph * 0.3) * 0.5; r.talking = false; }
    } else if (r.act === 'pray') { const b = (Math.sin(ph * 0.9) * 0.5 + 0.5); f.body.rotation.x = b * 0.35; for (const a of f.arms) a.rotation.x = -1.1; }
  }
  apply(r) {
    const f = r.fig; if (r.hidden) { f.root.visible = false; return; }
    const y = L.groundY(r.x, r.z);
    const seatY = r.slot && r.slot.pose === 'sit' ? (r.act === 'tea' ? 0.42 + L.TEAHOUSE.terraceY : r.act === 'noodle' ? 0.45 : 0.49) : 0;
    f.root.position.set(r.x, y + (seatY ? -0.55 * r.sit + seatY * r.sit : 0), r.z);
    f.root.rotation.y = r.heading;
    if (f.umbrella) f.umbrella.visible = r.sit < 0.5;
  }
  animVendor(v, dt, t) {
    const f = v.fig; const ph = t + v.phase;
    if (v.state === 'monk') { const sway = Math.sin(ph * 0.6); f.arms[0].position.y = f.arms[1].position.y = sway * 0.008; f.headG.rotation.x = 0.14 + sway * 0.04; f.body.rotation.x = 0.04 + sway * 0.03; return; }
    if (v.state === 'cook') { f.arms[1].rotation.x = -0.9 + Math.sin(ph * 3) * 0.3; f.arms[0].rotation.x = -0.6; f.headG.rotation.x = 0.35; return; }
    const c = this.list.find((r) => !r.hidden && r.state === 'activity' && r.act === 'shop' && Math.hypot(r.x - v.x, r.z - v.z) < 4.6);
    const want = c ? Math.atan2(c.x - v.x, c.z - v.z) : v.baseFace + Math.sin(ph * 0.2) * 0.3;
    v.heading = turn(v.heading, want, dt * 3); f.root.rotation.y = v.heading;
    f.arms[0].rotation.x = c ? -0.5 - Math.max(0, Math.sin(ph * 2.0)) * 0.9 : -0.2;
    f.headG.rotation.y = Math.sin(ph * 0.5) * (c ? 0.15 : 0.5);
    v.dealing = !!c;
  }
  offNetwork(r) {
    if (r.hidden) return 0;
    const N = this.nav.nodes; let best = Infinity;
    const seg = (ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az; const l2 = dx * dx + dz * dz || 1; const tt = clamp(((r.x - ax) * dx + (r.z - az) * dz) / l2, 0, 1); return Math.hypot(r.x - (ax + dx * tt), r.z - (az + dz * tt)); };
    N.forEach((a, i) => { for (const j of a.adj) if (j > i) best = Math.min(best, seg(a.x, a.z, N[j].x, N[j].z)); });
    for (const k of Object.keys(this.pois)) for (const s of this.pois[k]) {
      let px = N[s.node].x, pz = N[s.node].z; for (const [x, z] of s.path) { best = Math.min(best, seg(px, pz, x, z)); px = x; pz = z; }
    }
    if (r.vendor && r.post) best = Math.min(best, Math.hypot(r.x - r.post.x, r.z - r.post.z));
    return best;
  }
  dispose() { this.scene.remove(this.group); matCache.forEach((m) => m.dispose()); matCache.clear(); if (G) Object.values(G).forEach((g) => g.dispose()); G = null; }
}
function turn(a, b, k) { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * Math.min(1, k); }
