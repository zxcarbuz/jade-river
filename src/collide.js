import * as L from './layout.js';

// Walker collision: layout rects (walls, stalls, furniture; optional y range),
// prop boxes harvested from the static builders (tables, jars, barrels, rails...),
// open door leaves and residents. Everything is tested against the walker's body,
// a vertical column of radius PAD from knee height to just above the eyes.
export const PAD = 0.3;          // body radius
export const KNEE = 0.3, HEAD = 1.95, EYE = 1.65;
const CELL = 2;

export class Collision {
  constructor(colliders) {
    this.rects = colliders; this.grid = new Map(); this.solids = []; this.dynamic = []; this.npcs = [];
  }
  // keep only boxes that stand in the way of a walker: not floor/steps, not overhead
  addSolids(list, { maxArea = 40 } = {}) {
    let n = 0;
    for (const b of list) {
      const [x0, x1, z0, z1, y0, y1] = b;
      if ((x1 - x0) * (z1 - z0) > maxArea) continue;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const g = L.groundY(cx, cz, y1 - 0.05);
      if (y1 < g + 0.25) continue;                  // rugs, thresholds, floors, stair treads
      if (y1 - y0 < 0.02 && (x1 - x0) * (z1 - z0) > 1) continue; // flat decals
      const s = [x0, x1, z0, z1, y0, y1]; const i = this.solids.length; this.solids.push(s); n++;
      for (let gx = Math.floor((x0 - PAD) / CELL); gx <= Math.floor((x1 + PAD) / CELL); gx++) for (let gz = Math.floor((z0 - PAD) / CELL); gz <= Math.floor((z1 + PAD) / CELL); gz++) {
        const k = gx * 4096 + gz; let c = this.grid.get(k); if (!c) this.grid.set(k, c = []); c.push(i);
      }
    }
    return n;
  }
  // true when a body standing with feet at height `feet` at (x,z) would intersect something
  blocked(x, z, feet, pad = PAD) {
    if (Math.abs(x) > 66 || z < -62 || z > 52) return 'bounds';
    if (feet < 0.3) { if (L.inCanal(x, z) && !L.onBridge(x, z, 0.35)) return 'canal'; if (L.inPond(x, z, 0.5)) return 'pond'; }
    const lo = feet + KNEE, hi = feet + HEAD;
    for (const r of this.rects) {
      if (x < r[0] - pad || x > r[1] + pad || z < r[2] - pad || z > r[3] + pad) continue;
      if (r.length > 4 && (r[5] < lo || r[4] > hi)) continue;
      return 'rect';
    }
    const c = this.grid.get(Math.floor(x / CELL) * 4096 + Math.floor(z / CELL));
    if (c) for (const i of c) { const r = this.solids[i]; if (x > r[0] - pad && x < r[1] + pad && z > r[2] - pad && z < r[3] + pad && r[5] > lo && r[4] < hi) return 'prop'; }
    for (const sgm of this.dynamic) { if (sgm[5] < lo || sgm[4] > hi) continue; if (segDist(x, z, sgm) < pad + 0.04) return 'door'; }
    for (const n of this.npcs) if (Math.abs(n.y - feet) < 1.2 && Math.hypot(n.x - x, n.z - z) < pad + 0.22) return 'npc';
    const g = L.groundY(x, z, feet); if (g - feet > L.STEP) return 'ledge';
    return null;
  }
  // smallest distance from a point (the eye) to any obstacle, metres (tests / pushback)
  clearance(p) {
    let best = Infinity; const box = (r, y0, y1) => { const dx = Math.max(r[0] - p.x, 0, p.x - r[1]), dz = Math.max(r[2] - p.z, 0, p.z - r[3]), dy = Math.max(y0 - p.y, 0, p.y - y1); return Math.hypot(dx, dy, dz); };
    for (const r of this.rects) { const d = box(r, r.length > 4 ? r[4] : -5, r.length > 4 ? r[5] : 99); if (d < best) best = d; }
    for (let gx = Math.floor(p.x / CELL) - 1; gx <= Math.floor(p.x / CELL) + 1; gx++) for (let gz = Math.floor(p.z / CELL) - 1; gz <= Math.floor(p.z / CELL) + 1; gz++) {
      const c = this.grid.get(gx * 4096 + gz); if (c) for (const i of c) { const r = this.solids[i]; const d = box(r, r[4], r[5]); if (d < best) best = d; }
    }
    for (const s of this.dynamic) if (p.y > s[4] && p.y < s[5]) best = Math.min(best, segDist(p.x, p.z, s));
    for (const n of this.npcs) if (p.y > n.y && p.y < n.y + 1.9) best = Math.min(best, Math.max(0, Math.hypot(n.x - p.x, n.z - p.z) - 0.22));
    return best;
  }
}
function segDist(x, z, s) {
  const [ax, az, bx, bz] = s; const dx = bx - ax, dz = bz - az; const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)); return Math.hypot(x - (ax + t * dx), z - (az + t * dz));
}
