import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M } from './materials.js';

// Collects static geometry per material and merges it into a handful of meshes.
export class Builder {
  constructor() { this.buckets = new Map(); this.stack = [new THREE.Matrix4()]; }
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
    if (!this.buckets.has(matName)) this.buckets.set(matName, []);
    this.buckets.get(matName).push(g);
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
  build(group, { castShadow = true, receiveShadow = true, noShadow = [] } = {}) {
    const meshes = [];
    for (const [name, list] of this.buckets) {
      // split in chunks to keep merged geometry sizes sane
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, M(name));
      mesh.castShadow = castShadow && !noShadow.includes(name);
      mesh.receiveShadow = receiveShadow;
      mesh.name = 'static:' + name;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      group.add(mesh); meshes.push(mesh);
    }
    this.buckets.clear();
    return meshes;
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
