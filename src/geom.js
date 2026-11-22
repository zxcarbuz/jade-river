import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Shared lathe helpers. Every lathe in the scene goes through here so the
// tests can audit that none of them is an open, single-sided shell.
export const LATHES = [];
const V = (pts) => pts.map(([a, b]) => new THREE.Vector2(a, b));

// solid of revolution; the profile must start and end on the axis (r = 0)
// unless the caller marks it doubleSide (thin cloth / petals).
export function lathe(pts, seg = 16, { name = 'lathe', doubleSide = false } = {}) {
  const closed = pts[0][0] === 0 && pts[pts.length - 1][0] === 0;
  LATHES.push({ name, closed, doubleSide, kind: 'lathe' });
  return new THREE.LatheGeometry(V(pts), seg);
}

// Thick-walled open vessel (bowl, cup, wok, pot, basin, burner).
// outer: [r, y] from the foot up to the rim. The wall is offset inward along
// the profile normal, the rim is rounded, and the inner surface runs back down
// to the axis, so the mesh is closed and has a visible inside.
export function vessel(outer, { wall = 0.008, seg = 10, name = 'vessel', foot = true } = {}) {
  // cap segments and downsample the profile so thick-walled bowls stay cheap on the low tier
  // (they are tagged 'all' and always drawn) while remaining closed with a visible inside.
  seg = Math.min(seg, 10);
  let src = outer.map(([r, y]) => new THREE.Vector2(r, y));
  if (src.length > 5) {
    const keep = [src[0]];
    for (let i = 1; i < 4; i++) keep.push(src[Math.round(i * (src.length - 1) / 4)]);
    keep.push(src[src.length - 1]); src = keep;
  }
  const P = src; const n = P.length; const height = Math.max(0.01, P[n - 1].y - P[0].y);
  // a visibly thick bottom (not a paper-thin disc at y≈0) so looking in from above shows a floor
  const floorY = P[0].y + Math.min(height * 0.35, Math.max(wall * 4, height * 0.22));
  const inner = [];
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
    const tx = b.x - a.x, ty = b.y - a.y; const l = Math.hypot(tx, ty) || 1;
    // inward normal of an upward-running profile is (-ty, tx)
    const ix = P[i].x - (ty / l) * wall, iy = Math.max(floorY, P[i].y + (tx / l) * wall);
    inner.push(new THREE.Vector2(Math.max(0.0005, ix), iy));
  }
  inner[0].y = floorY;
  const rim = P[n - 1], rimIn = inner[n - 1];
  const prof = [new THREE.Vector2(0, P[0].y)];
  if (foot && P[0].x > 0.02) prof.push(new THREE.Vector2(P[0].x * 0.82, P[0].y + wall * 0.5));
  prof.push(...P);
  prof.push(new THREE.Vector2((rim.x + rimIn.x) / 2 + wall * 0.15, rim.y + wall * 0.55)); // rounded lip
  for (let i = n - 1; i >= 0; i--) prof.push(inner[i]);
  prof.push(new THREE.Vector2(0, inner[0].y));
  LATHES.push({ name, closed: true, doubleSide: false, kind: 'vessel', capped: true });
  // the last lathe segment (inward along the inner floor) winds so its normals point down;
  // merge an upward disc slightly above it so looking into the pot shows a solid bottom, not the floor
  const cap = new THREE.CircleGeometry(Math.max(0.01, inner[0].x), seg);
  cap.rotateX(-Math.PI / 2);
  cap.translate(0, inner[0].y + 0.0006, 0);
  return mergeGeometries([new THREE.LatheGeometry(prof, seg), cap]) || new THREE.LatheGeometry(prof, seg);
}

// inner radius of a vessel profile at height y (for placing contents)
export function vesselRadiusAt(outer, y, wall = 0.008) {
  for (let i = 1; i < outer.length; i++) {
    const [r0, y0] = outer[i - 1], [r1, y1] = outer[i];
    if (y >= y0 && y <= y1) return r0 + (r1 - r0) * ((y - y0) / Math.max(1e-6, y1 - y0)) - wall * 1.2;
  }
  return outer[outer.length - 1][0] - wall;
}
// flat liquid / contents disc at height y inside the vessel
export function fillDisc(outer, y, wall = 0.008, seg = 10) {
  const g = new THREE.CircleGeometry(vesselRadiusAt(outer, y, wall), Math.min(seg, 10)); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g;
}
