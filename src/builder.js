import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M } from './materials.js';

// Collects static geometry per material and merges it into a handful of meshes.
export class Builder {
  constructor({ chunk = 32, chunkTris = 16000 } = {}) { this.buckets = new Map(); this.stack = [new THREE.Matrix4()]; this.tag = 'all'; this.chunk = chunk; this.chunkTris = chunkTris; this.solids = []; this.noSolid = false; }
  // LOD tag for everything added next: 'all' (always), 'near' / 'far' (distance-swapped), 'detail' (hidden when far)
  setTag(t) { const prev = this.tag; this.tag = t; return prev; }
  get top() { return this.stack[this.stack.length - 1]; }
  push(m) { this.stack.push(this.top.clone().multiply(m)); return this; }
  pushT(x = 0, y = 0, z = 0, ry = 0, s = 1) { return this.push(mat(x, y, z, ry, s)); }
  pop() { this.stack.pop(); return this; }
  add(matName, geom, local) {
    let g = geom.index ? geom.clone() : geom.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.index) { const n = g.attributes.position.count; const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n); for (let i = 0; i < n; i++) idx[i] = i; g.setIndex(new THREE.BufferAttribute(idx, 1)); }
    g.morphAttributes = {};
    g.clearGroups();
    const m = local ? this.top.clone().multiply(local) : this.top;
    g.applyMatrix4(m);
    // world-space box of every piece: the walker's prop colliders are derived from these
    if (!this.noSolid && this.tag !== 'far') { g.computeBoundingBox(); const b = g.boundingBox; this.solids.push([b.min.x, b.max.x, b.min.z, b.max.z, b.min.y, b.max.y, matName]); }
    const key = matName + '|' + this.tag;
    if (!this.buckets.has(key)) this.buckets.set(key, []);
    this.buckets.get(key).push(g);
    return this;
  }
  // convenience: box centred at (x,y,z) in current frame
  box(matName, w, h, d, x, y, z, ry = 0, uvScale = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (uvScale) scaleBoxUV(g, w, h, d, uvScale);
    return this.add(matName, g, mat(x, y, z, ry));
  }
  cyl(matName, rt, rb, h, x, y, z, seg = 10, rx = 0, rz = 0) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(1, 1, 1));
    return this.add(matName, g, m);
  }
  // Merge per material. Heavy buckets and all LOD-tagged buckets are split into
  // spatial chunks (chunk x chunk metres) so frustum culling and LOD work per area.
  build(group, { castShadow = true, receiveShadow = true, noShadow = [], noChunk = false } = {}) {
    const meshes = []; const C = this.chunk;
    // note: chunk key uses geometry bbox centre
    for (const [key, list] of this.buckets) {
      const [name, tag] = key.split('|');
      const tris = list.reduce((a, g) => a + g.index.count / 3, 0);
      let groups;
      if (!noChunk && (tag !== 'all' || tris > this.chunkTris)) {
        groups = new Map(); const bb = new THREE.Box3(), c = new THREE.Vector3();
        for (const g of list) {
          bb.setFromBufferAttribute(g.attributes.position); bb.getCenter(c);
          const k = Math.floor(c.x / C) + ',' + Math.floor(c.z / C);
          if (!groups.has(k)) groups.set(k, []); groups.get(k).push(g);
        }
        groups = [...groups.values()];
      } else groups = [list];
      // far LOD: one unchunked proxy for the shadow + reflection passes
      if (tag === 'far') {
        const proxy = new THREE.Mesh(mergeGeometries(list, false), M(name));
        proxy.geometry.computeBoundingSphere(); proxy.castShadow = castShadow && !noShadow.includes(name); proxy.receiveShadow = false;
        proxy.name = 'static:' + name + ':proxy'; proxy.userData.lod = 'proxy'; proxy.layers.mask = 4;
        proxy.matrixAutoUpdate = false; proxy.updateMatrix(); group.add(proxy); meshes.push(proxy);
      }
      for (const part of groups) {
        const merged = mergeGeometries(part, false);
        merged.computeBoundingSphere(); merged.computeBoundingBox();
        const mesh = new THREE.Mesh(merged, M(name));
        mesh.castShadow = castShadow && !noShadow.includes(name);
        mesh.receiveShadow = receiveShadow;
        mesh.name = 'static:' + name + (tag !== 'all' ? ':' + tag : '');
        mesh.userData.lod = tag;
        mesh.matrixAutoUpdate = false; mesh.updateMatrix();
        group.add(mesh); meshes.push(mesh);
      }
      list.forEach((g) => g.dispose());
    }
    this.buckets.clear();
    return meshes;
  }
}

// Distance-based LOD over chunk meshes: 'near' shown inside nearDist, 'far' outside,
// 'detail' shown inside detailDist. Distances come from the quality tier.
export class ChunkLOD {
  constructor(meshes) { this.meshes = meshes.filter((m) => m.userData.lod && m.userData.lod !== 'all');
    for (const m of this.meshes) { if (m.userData.lod === 'detail') m.castShadow = false; if (m.userData.lod !== 'proxy') m.layers.mask = 2; } this.near = 40; this.detail = 45; this._p = new THREE.Vector3(); }
  set(near, detail, proxyOnly = false) { this.near = near; this.detail = detail; this.proxyOnly = proxyOnly; }
  // proxyOnly (low tier): roofs drawn from the single far proxy per material (fewest draw calls); camera must see layer 2
  // Layers: 0 = always, 1 = main-view LOD content, 2 = shadow/reflection proxies (far LOD, always on)
  update(cam) {
    const p = this._p.copy(cam.position);
    let nNear = 0, nDetail = 0;
    for (const m of this.meshes) {
      const lod = m.userData.lod;
      if (lod === 'proxy') continue;
      const d = m.geometry.boundingBox.distanceToPoint(p);
      m.layers.mask = 2;
      m.visible = this.proxyOnly && lod !== 'detail' ? false : lod === 'near' ? d < this.near : lod === 'far' ? d >= this.near : d < this.detail;
      if (m.visible && lod === 'near') nNear++; if (m.visible && lod === 'detail') nDetail++;
    }
    this.stats = { near: nNear, detail: nDetail, total: this.meshes.length };
  }
}

export function mat(x = 0, y = 0, z = 0, ry = 0, s = 1) {
  const m = new THREE.Matrix4().makeRotationY(ry);
  if (s !== 1) m.scale(new THREE.Vector3(s, s, s));
  m.setPosition(x, y, z);
  return m;
}

// scale box UVs so textures tile in world units (uvScale = metres per texture)
export function scaleBoxUV(g, w, h, d, s) {
  const uv = g.attributes.uv; const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / s, uv.getY(k) * dims[f][1] / s);
  }
  return g;
}
