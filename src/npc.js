import * as THREE from 'three';
import { mulberry32, clamp } from './util.js';
import * as L from './layout.js';

// Residents: stylised figures in Ming-era dress driven by a finite state machine
// (walk -> pause at crossings -> activity [shop|tea|noodle|bench|pray] -> leave)
// over the street graph. Movement is always along graph edges or along the
// pre-validated approach polylines of an activity slot - never through walls.

const R = mulberry32(8080);
const skin = [0xf1cfae, 0xe8bf98, 0xf5d7b8, 0xdcb08a];
const robes = [
  { robe: 0x2f4a6e, sash: 0xc9a14a, trim: 0xe8e0cf }, { robe: 0x7b2a24, sash: 0x1b1b1b, trim: 0xe3c58a }, { robe: 0x3f7d6a, sash: 0xe8e0cf, trim: 0x203a32 },
  { robe: 0xe6dcc6, sash: 0x2f4a6e, trim: 0x2f4a6e }, { robe: 0x6a4a7a, sash: 0xc9a14a, trim: 0xf0e0f0 }, { robe: 0xb9843a, sash: 0x5a2a1a, trim: 0x3a2a1a },
  { robe: 0x4a5a3a, sash: 0x9e2b22, trim: 0xd8cfb8 }, { robe: 0xd89aa8, sash: 0xf3ead8, trim: 0x7b2a40 }, { robe: 0x22313f, sash: 0x8a6a3a, trim: 0xb8b0a0 },
];
const NAMES = [
  ['李书生', 'Учёный Ли'], ['王婆婆', 'Бабушка Ван'], ['小梅', 'Сяо Мэй'], ['张掌柜', 'Хозяин Чжан'], ['陈先生', 'Господин Чэнь'], ['林姑娘', 'Барышня Линь'],
  ['赵渔夫', 'Рыбак Чжао'], ['周大娘', 'Тётушка Чжоу'], ['吴公子', 'Молодой господин У'], ['孙秀才', 'Сюцай Сунь'], ['刘姐', 'Сестрица Лю'], ['阿福', 'А-Фу'],
];
const VENDORS = [
  { name: ['果贩老黄', 'Торговец фруктами Хуан'], x: -26.7, z: -11.2, face: Math.PI / 2 }, { name: ['陶匠老何', 'Гончар Хэ'], x: -26.7, z: -15.8, face: Math.PI / 2 },
  { name: ['绸缎商许', 'Торговка шёлком Сюй'], x: -13.3, z: -11.2, face: -Math.PI / 2 }, { name: ['灯笼匠郑', 'Мастер фонарей Чжэн'], x: -13.3, z: -15.8, face: -Math.PI / 2 },
  { name: ['面馆厨师', 'Повар лапшичной'], x: -12.9, z: 13.15, face: Math.PI, cook: true },
];
const ACT_RU = { walk: 'гуляет', idle: 'смотрит по сторонам', shop: 'выбирает товар', tea: 'пьёт чай', noodle: 'ест лапшу', bench: 'отдыхает у воды', pray: 'молится', vendor: 'торгует', cook: 'варит лапшу', approach: 'идёт', leave: 'уходит' };

let G = null;
function geoms() {
  if (G) return G;
  const robe = new THREE.LatheGeometry([[0, 1.43], [0.13, 1.42], [0.19, 1.36], [0.2, 1.2], [0.18, 1.0], [0.2, 0.8], [0.26, 0.45], [0.31, 0.12], [0.33, 0.06], [0.0, 0.06]].map(([a, b]) => new THREE.Vector2(a, b)), 14);
  const sash = new THREE.CylinderGeometry(0.195, 0.2, 0.09, 14); sash.translate(0, 1.0, 0);
  const collar = new THREE.TorusGeometry(0.11, 0.025, 5, 14); collar.rotateX(Math.PI / 2); collar.translate(0, 1.43, 0.02);
  const head = new THREE.SphereGeometry(0.115, 14, 10); head.scale(1, 1.1, 1);
  const hair = new THREE.SphereGeometry(0.122, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55); hair.translate(0, 0.012, -0.005);
  const bun = new THREE.SphereGeometry(0.065, 10, 8); bun.translate(0, 0.12, -0.05);
  const capHat = new THREE.CylinderGeometry(0.1, 0.12, 0.12, 12); capHat.translate(0, 0.1, 0);
  const straw = new THREE.ConeGeometry(0.34, 0.16, 16, 1, true); straw.translate(0, 0.14, 0);
  const sleeve = new THREE.CylinderGeometry(0.06, 0.1, 0.52, 8); sleeve.translate(0, -0.26, 0);
  const hand = new THREE.SphereGeometry(0.04, 8, 6); hand.translate(0, -0.54, 0);
  const leg = new THREE.CylinderGeometry(0.055, 0.05, 0.5, 6); leg.translate(0, -0.25, 0);
  const shoe = new THREE.BoxGeometry(0.09, 0.06, 0.2); shoe.translate(0, -0.52, 0.04);
  const umb = new THREE.ConeGeometry(0.62, 0.22, 18, 1, true); umb.translate(0, 0.11, 0);
  const umbStick = new THREE.CylinderGeometry(0.012, 0.012, 0.9, 4); umbStick.translate(0, -0.35, 0);
  const cup = new THREE.CylinderGeometry(0.035, 0.025, 0.05, 8);
  G = { robe, sash, collar, head, hair, bun, capHat, straw, sleeve, hand, leg, shoe, umb, umbStick, cup };
  return G;
}
const matCache = new Map();
function mc(color, opts = {}) { const k = color + JSON.stringify(opts); if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts })); return matCache.get(k); }

function makeFigure(i, style) {
  const g = geoms(); const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const pal = robes[i % robes.length]; const female = style.female;
  const robeMesh = new THREE.Mesh(g.robe, mc(pal.robe, { side: THREE.DoubleSide })); robeMesh.castShadow = true; body.add(robeMesh);
  body.add(new THREE.Mesh(g.sash, mc(pal.sash))); body.add(new THREE.Mesh(g.collar, mc(pal.trim)));
  const headG = new THREE.Group(); headG.position.y = 1.56; body.add(headG);
  const headM = new THREE.Mesh(g.head, mc(skin[i % skin.length], { roughness: 0.7 })); headM.castShadow = true; headG.add(headM);
  headG.add(new THREE.Mesh(g.hair, mc(0x141010, { roughness: 0.6 })));
  if (female) { headG.add(new THREE.Mesh(g.bun, mc(0x141010, { roughness: 0.6 }))); const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 4), mc(0xc9a14a, { metalness: 0.7 })); pin.position.set(0, 0.17, -0.05); pin.rotation.z = 1.3; headG.add(pin); }
  else if (style.hat === 'straw') { const s = new THREE.Mesh(g.straw, mc(0xcaa86a, { side: THREE.DoubleSide })); s.castShadow = true; headG.add(s); }
  else headG.add(new THREE.Mesh(g.capHat, mc(0x15181c)));
  const arms = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(s * 0.2, 1.36, 0); body.add(a);
    const sl = new THREE.Mesh(g.sleeve, mc(pal.robe)); sl.castShadow = true; a.add(sl);
    a.add(new THREE.Mesh(g.hand, mc(skin[i % skin.length])));
    a.rotation.z = s * 0.12; arms.push(a);
  }
  const legs = [];
  for (const s of [-1, 1]) { const l = new THREE.Group(); l.position.set(s * 0.09, 0.55, 0); root.add(l); l.add(new THREE.Mesh(g.leg, mc(0x2a2420))); l.add(new THREE.Mesh(g.shoe, mc(0x121212))); legs.push(l); }
  let umbrella = null;
  if (style.umbrella) { umbrella = new THREE.Group(); umbrella.position.set(0.18, 2.12, 0.05); const u = new THREE.Mesh(g.umb, mc(style.umbrella, { side: THREE.DoubleSide, roughness: 0.6 })); u.castShadow = true; umbrella.add(u); umbrella.add(new THREE.Mesh(g.umbStick, mc(0x5a3a26))); umbrella.rotation.z = -0.12; root.add(umbrella); }
  const cup = new THREE.Mesh(g.cup, mc(0xe9eef2, { roughness: 0.3 })); cup.position.set(0, -0.56, 0.04); cup.visible = false; arms[1].add(cup);
  const sc = style.scale || 1; root.scale.setScalar(sc);
  root.traverse((o) => { if (o.isMesh) o.userData.npcPart = true; });
  return { root, body, headG, arms, legs, umbrella, cup };
}

export class Residents {
  constructor(scene, nav, pois, colliders) {
    this.scene = scene; this.nav = nav; this.pois = pois; this.colliders = colliders;
    this.list = []; this.vendors = []; this.paused = false; this.time = 0;
    this.group = new THREE.Group(); this.group.name = 'residents'; scene.add(this.group);
    for (const k of Object.keys(pois)) pois[k].forEach((s) => { s.taken = null; s.kind = k; });
    // node -> distance cache for path finding
    const N = nav.nodes;
    this.dist = (a, b) => Math.hypot(N[a].x - N[b].x, N[a].z - N[b].z);
    const starts = [0, 6, 9, 14, 18, 22, 27, 31, 36, 40, 45, 50].map((k) => k % N.length);
    for (let i = 0; i < 12; i++) {
      const female = [1, 2, 5, 7, 10].includes(i);
      const style = { female, hat: i === 6 || i === 11 ? 'straw' : 'cap', umbrella: i === 5 ? 0xd85a6a : i === 2 ? 0x3f7d6a : null, scale: i === 11 ? 0.8 : 0.95 + R() * 0.1 };
      const fig = makeFigure(i, style);
      const n = starts[i]; const node = N[n];
      const r = { id: i, fig, name: NAMES[i], x: node.x, z: node.z, heading: R() * 6.28, speed: 0.95 + R() * 0.45, node: n, path: [], state: 'idle', timer: 0.5 + R() * 3, slot: null, act: null, phase: R() * 10, side: 0.42, pose: 'stand', sit: 0, lastDecision: '' };
      fig.root.position.set(r.x, 0, r.z); fig.root.userData.resident = r;
      this.group.add(fig.root); this.list.push(r);
    }
    VENDORS.forEach((v, i) => {
      const fig = makeFigure(i + 3, { female: i === 2, hat: i === 4 ? 'cap' : i % 2 ? 'cap' : 'straw', scale: 1 });
      fig.root.position.set(v.x, 0, v.z); fig.root.rotation.y = v.face;
      const r = { id: 100 + i, fig, name: v.name, x: v.x, z: v.z, heading: v.face, baseFace: v.face, state: v.cook ? 'cook' : 'vendor', phase: R() * 10, vendor: true, pose: 'stand', sit: 0 };
      fig.root.userData.resident = r;
      this.group.add(fig.root); this.vendors.push(r);
    });
  }
  get all() { return [...this.list, ...this.vendors]; }
  describe(r) { return `${r.name[0]} · ${r.name[1]} — ${ACT_RU[r.state] || r.state}`; }

  // Dijkstra over the street graph
  route(from, to) {
    const N = this.nav.nodes; const dist = new Array(N.length).fill(Infinity), prev = new Array(N.length).fill(-1), done = new Array(N.length).fill(false);
    dist[from] = 0;
    for (;;) {
      let u = -1, best = Infinity; for (let i = 0; i < N.length; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
      if (u < 0 || u === to) break; done[u] = true;
      for (const v of N[u].adj) { const d = dist[u] + this.dist(u, v); if (d < dist[v]) { dist[v] = d; prev[v] = u; } }
    }
    const out = []; let c = to; while (c !== -1 && c !== from) { out.unshift(c); c = prev[c]; }
    return out;
  }
  // turn a node route into offset waypoints (keep to the right side of lanes)
  waypoints(fromNode, route) {
    const N = this.nav.nodes; const pts = []; let a = N[fromNode];
    for (const id of route) {
      const b = N[id]; const dx = b.x - a.x, dz = b.z - a.z; const l = Math.hypot(dx, dz) || 1;
      const ox = -dz / l * this.offset, oz = dx / l * this.offset;
      pts.push({ x: a.x + ox + dx / l * 0.01, z: a.z + oz + dz / l * 0.01, graph: true, edge: [a, b], o: [ox, oz] });
      pts.push({ x: b.x + ox, z: b.z + oz, graph: true, node: id, edge: [a, b], o: [ox, oz] });
      a = b;
    }
    return pts;
  }
  decide(r) {
    const N = this.nav.nodes; this.offset = r.side;
    const roll = R();
    const kinds = [['shop', 0.2], ['tea', 0.16], ['noodle', 0.14], ['bench', 0.16], ['pray', 0.06]];
    let acc = 0; let kind = null;
    for (const [k, w] of kinds) { acc += w; if (roll < acc) { kind = k; break; } }
    if (kind && r.lastDecision !== kind) {
      const free = this.pois[kind].filter((s) => !s.taken);
      if (free.length) {
        const slot = free[Math.floor(R() * free.length)]; slot.taken = r; r.slot = slot; r.act = kind; r.lastDecision = kind;
        const route = this.route(r.node, slot.node);
        r.path = this.waypoints(r.node, route);
        r.path.push({ x: N[slot.node].x, z: N[slot.node].z, graph: true, node: slot.node });
        for (const [x, z] of slot.path) r.path.push({ x, z, approach: true });
        r.state = 'walk'; r.goal = 'slot';
        return;
      }
    }
    // wander to a random node
    r.lastDecision = 'wander';
    let target = r.node; for (let k = 0; k < 10 && (target === r.node || this.dist(target, r.node) < 12); k++) target = Math.floor(R() * N.length);
    r.path = this.waypoints(r.node, this.route(r.node, target)); r.state = 'walk'; r.goal = 'wander'; r.act = null;
  }
  update(dt) {
    if (this.paused) return;
    this.time += dt; const t = this.time;
    for (const r of this.list) this.step(r, dt, t);
    for (const v of this.vendors) this.animVendor(v, dt, t);
  }
  step(r, dt, t) {
    const f = r.fig;
    if (r.state === 'idle') {
      r.timer -= dt; r.fig.headG.rotation.y = Math.sin(t * 0.8 + r.phase) * 0.6;
      this.pose(r, dt, 0, 'stand');
      if (r.timer <= 0) { r.fig.headG.rotation.y = 0; this.decide(r); }
    } else if (r.state === 'walk') {
      const wp = r.path[0];
      if (!wp) { this.arrive(r); return; }
      const dx = wp.x - r.x, dz = wp.z - r.z, d = Math.hypot(dx, dz);
      let sp = r.speed;
      // yield to someone directly ahead walking the same way
      if (wp.graph) for (const o of this.list) { if (o === r || o.state !== 'walk') continue; const ox = o.x - r.x, oz = o.z - r.z; const od = Math.hypot(ox, oz); if (od < 1.0 && od > 0.01 && (ox * dx + oz * dz) / (od * (d || 1)) > 0.8) { sp *= 0.25; break; } }
      const stepLen = Math.min(d, sp * dt);
      if (d > 1e-4) { r.x += dx / d * stepLen; r.z += dz / d * stepLen; const want = Math.atan2(dx, dz); r.heading = turn(r.heading, want, dt * 6); }
      if (d - stepLen < 0.02) {
        r.path.shift();
        if (wp.node !== undefined) {
          r.node = wp.node;
          // sometimes pause at a crossing and look around
          if (r.goal === 'wander' && this.nav.nodes[wp.node].adj.length >= 3 && R() < 0.22 && r.path.length) { r.state = 'pause'; r.timer = 1 + R() * 2.5; }
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
        // leave: walk the approach path backwards to the anchor node
        const back = [...r.slot.path].reverse().slice(1).map(([x, z]) => ({ x, z, approach: true }));
        const n = this.nav.nodes[r.slot.node]; back.push({ x: n.x, z: n.z, node: r.slot.node, graph: true });
        r.path = back; r.state = 'leave'; r.fig.cup.visible = false; r.fig.headG.rotation.set(0, 0, 0);
      }
    } else if (r.state === 'leave') {
      if (r.sit > 0.02) { this.pose(r, dt, 0, 'stand'); this.apply(r); return; }
      const wp = r.path[0];
      if (!wp) { r.slot.taken = null; r.slot = null; r.state = 'idle'; r.timer = 0.3 + R() * 1.5; r.goal = null; this.apply(r); return; }
      const dx = wp.x - r.x, dz = wp.z - r.z, d = Math.hypot(dx, dz); const stepLen = Math.min(d, r.speed * dt);
      if (d > 1e-4) { r.x += dx / d * stepLen; r.z += dz / d * stepLen; r.heading = turn(r.heading, Math.atan2(dx, dz), dt * 6); }
      if (d - stepLen < 0.02) { r.path.shift(); if (wp.node !== undefined) r.node = wp.node; }
      this.pose(r, dt, r.speed, 'walk');
    }
    this.apply(r);
  }
  arrive(r) {
    if (r.goal === 'slot' && r.slot) {
      r.state = 'activity';
      const dur = { shop: [6, 12], tea: [16, 30], noodle: [14, 24], bench: [12, 26], pray: [6, 10] }[r.act];
      r.timer = dur[0] + R() * (dur[1] - dur[0]);
      if (r.act === 'tea') r.fig.cup.visible = true;
    } else { r.state = 'idle'; r.timer = 0.4 + R() * 2.2; }
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
      // talk to a neighbour on the same bench if there is one
      const other = this.list.find((o) => o !== r && o.state === 'activity' && o.act === 'bench' && Math.hypot(o.x - r.x, o.z - r.z) < 1.2);
      if (other) { f.headG.rotation.y = Math.sign((other.x - r.x) * Math.cos(r.heading) - (other.z - r.z) * Math.sin(r.heading)) * 0.8; f.arms[(Math.floor(ph) % 2)].rotation.x = -0.6 - Math.max(0, Math.sin(ph * 2.2)) * 0.5; r.talking = true; }
      else { f.headG.rotation.y = Math.sin(ph * 0.3) * 0.5; r.talking = false; }
    } else if (r.act === 'pray') { const b = (Math.sin(ph * 0.9) * 0.5 + 0.5); f.body.rotation.x = b * 0.35; for (const a of f.arms) a.rotation.x = -1.1; }
  }
  apply(r) {
    const f = r.fig; const y = L.groundY(r.x, r.z);
    const seatY = r.slot && r.slot.pose === 'sit' ? (r.act === 'tea' ? 0.42 + L.TEAHOUSE.terraceY : r.act === 'noodle' ? 0.45 : 0.49) : 0;
    f.root.position.set(r.x, y + (seatY ? -0.55 * r.sit + seatY * r.sit : 0), r.z);
    f.root.rotation.y = r.heading;
    if (f.umbrella) f.umbrella.visible = r.sit < 0.5;
  }
  animVendor(v, dt, t) {
    const f = v.fig; const ph = t + v.phase;
    if (v.state === 'cook') { f.arms[1].rotation.x = -0.9 + Math.sin(ph * 3) * 0.3; f.arms[0].rotation.x = -0.6; f.headG.rotation.x = 0.35; return; }
    // turn toward the nearest browsing customer and gesture
    const c = this.list.find((r) => r.state === 'activity' && r.act === 'shop' && Math.hypot(r.x - v.x, r.z - v.z) < 4.6);
    const want = c ? Math.atan2(c.x - v.x, c.z - v.z) : v.baseFace + Math.sin(ph * 0.2) * 0.3;
    v.heading = turn(v.heading, want, dt * 3); f.root.rotation.y = v.heading;
    f.arms[0].rotation.x = c ? -0.5 - Math.max(0, Math.sin(ph * 2.0)) * 0.9 : -0.2;
    f.headG.rotation.y = Math.sin(ph * 0.5) * (c ? 0.15 : 0.5);
    v.dealing = !!c;
  }
  // distance from a point to the allowed walking network (graph edges or approach lines)
  offNetwork(r) {
    const N = this.nav.nodes; let best = Infinity;
    const seg = (ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az; const l2 = dx * dx + dz * dz || 1; const tt = clamp(((r.x - ax) * dx + (r.z - az) * dz) / l2, 0, 1); return Math.hypot(r.x - (ax + dx * tt), r.z - (az + dz * tt)); };
    N.forEach((a, i) => { for (const j of a.adj) if (j > i) best = Math.min(best, seg(a.x, a.z, N[j].x, N[j].z)); });
    for (const k of Object.keys(this.pois)) for (const s of this.pois[k]) {
      let px = N[s.node].x, pz = N[s.node].z; for (const [x, z] of s.path) { best = Math.min(best, seg(px, pz, x, z)); px = x; pz = z; }
    }
    return best;
  }
  dispose() { this.scene.remove(this.group); matCache.forEach((m) => m.dispose()); matCache.clear(); if (G) Object.values(G).forEach((g) => g.dispose()); G = null; }
}
function turn(a, b, k) { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * Math.min(1, k); }
