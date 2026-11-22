import * as THREE from 'three';
import * as T from './textures.js';

export const shared = {
  uTime: { value: 0 },
  uWind: { value: 1 },
  uNight: { value: 0 }, // 0 day .. 1 full night (lanterns/windows glow)
};

const mats = new Map();
export function allMaterials() { return [...mats.values()]; }

// Adds gentle wind sway to foliage. mode 'up': sway grows with local height,
// 'down': grows with distance below the local origin (hanging willow strands).
export function addWind(mat, strength = 0.01, mode = 'abs') {
  // displacement is computed in object space after instancing so instance
  // scale does not squash it. mode: 'abs' (grows with height above ground),
  // 'down' (grows with distance below the instance origin: hanging strands)
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.uTime; sh.uniforms.uWind = shared.uWind;
    sh.vertexShader = 'uniform float uTime;\nuniform float uWind;\n' + sh.vertexShader.replace('#include <project_vertex>', `
      vec4 mvPosition = vec4( transformed, 1.0 );
      float baseY = 0.0;
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
        baseY = instanceMatrix[3].y;
      #endif
      {
        float h = ${mode === 'down' ? 'max(baseY - mvPosition.y, 0.0)' : 'max(mvPosition.y, 0.0)'};
        float k = h * h * ${strength.toFixed(4)} * uWind;
        vec4 wp0 = modelMatrix * mvPosition;
        float ph = uTime * 1.3 + wp0.x * 0.21 + wp0.z * 0.17;
        mvPosition.x += (sin(ph) * 0.7 + sin(ph * 2.3 + 1.7) * 0.3) * k;
        mvPosition.z += (cos(ph * 0.8 + 0.4) * 0.6 + sin(ph * 3.1) * 0.15) * k;
      }
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;
    `);
  };
  mat.customProgramCacheKey = () => 'wind' + strength + mode;
  return mat;
}

function std(name, opts) { const m = new THREE.MeshStandardMaterial(opts); m.name = name; mats.set(name, m); return m; }

export function initMaterials() {
  const plaster = T.plasterTex();
  std('plaster', { map: plaster, color: 0xffffff, roughness: 0.95 });
  std('plasterWarm', { map: plaster, color: 0xf3e3cf, roughness: 0.95 });
  const sb = T.stoneBlockTex();
  std('stone', { map: sb, color: 0xd8dcd2, roughness: 0.92 });
  std('stoneDark', { map: sb, color: 0x8f938a, roughness: 0.95 });
  std('stoneLight', { color: 0xc9c6ba, roughness: 0.8 });
  std('paving', { map: T.pavingTex(), color: 0xe8e6dc, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const wood = T.woodTex();
  std('woodDark', { map: wood, color: 0x8a6a55, roughness: 0.8 });
  std('woodMid', { map: wood, color: 0xb08a68, roughness: 0.8 });
  std('woodRed', { map: wood, color: 0xb04a36, roughness: 0.55 });
  std('lacquer', { color: 0x1a1210, roughness: 0.35 });
  std('tile', { map: T.tileTex(), color: 0x9da2a8, roughness: 0.72, metalness: 0.05, side: THREE.DoubleSide });
  std('tileUnder', { map: wood, color: 0x6b5242, roughness: 0.9, side: THREE.DoubleSide });
  std('tileGold', { map: T.tileTex(), color: 0x6d7f7a, roughness: 0.45, metalness: 0.15, side: THREE.DoubleSide });
  std('templeWall', { map: plaster, color: 0xd9a86a, roughness: 0.9 });
  std('bronze', { color: 0x6a5a3a, roughness: 0.4, metalness: 0.8 });
  std('ridge', { color: 0x3a3d42, roughness: 0.7 });
  for (let v = 0; v < 3; v++) {
    const lt = T.latticeTex(v);
    std('lattice' + v, { map: lt.map, emissiveMap: lt.emissive, emissive: 0xffa04a, emissiveIntensity: 0, roughness: 0.85 });
  }
  std('door', { map: T.doorTex(), roughness: 0.7 });
  // interiors
  std('floorWood', { map: wood, color: 0x7a5a46, roughness: 0.7 });
  std('plasterIn', { map: T.agedPlasterTex(), color: 0xffffff, roughness: 0.92 });
  std('templeIn', { map: T.agedPlasterTex(), color: 0xe9b77a, roughness: 0.9 });
  const ao = T.aoTextures();
  std('aoStrip', { map: ao.strip, color: 0x000000, transparent: true, opacity: 1, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  std('aoBlob', { map: ao.blob, color: 0x000000, transparent: true, opacity: 1, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  std('lampLit', { color: 0xf6dcb0, roughness: 0.8, emissive: 0xffa64a, emissiveIntensity: 0.5, side: THREE.DoubleSide });
  std('fire', { color: 0xff8a2a, emissive: 0xff5a10, emissiveIntensity: 2.2, roughness: 1 });
  std('brick', { map: sb, color: 0x8a5a48, roughness: 0.95 });
  std('noodle', { color: 0xf1e2b8, roughness: 0.8 });
  std('tea', { color: 0x6b3d14, roughness: 0.08, metalness: 0.1 });
  std('broth', { color: 0xc0823a, roughness: 0.12, metalness: 0.05 });
  std('water', { color: 0x3f5a5c, roughness: 0.04, metalness: 0.2 });
  std('ash', { color: 0x8a8478, roughness: 1 });
  std('scallion', { color: 0x5f9a3a, roughness: 0.6 });
  std('paper', { color: 0xefe6d2, roughness: 0.9, side: THREE.DoubleSide });
  std('gold', { color: 0xc9a14a, roughness: 0.35, metalness: 0.75 });
  std('jade', { color: 0x3f8f78, roughness: 0.35, metalness: 0.1 });
  std('grass', { map: T.grassTex(), color: 0xffffff, roughness: 1 });
  std('canalBed', { map: sb, color: 0x55634a, roughness: 1 });
  std('dirt', { color: 0x7a6a52, roughness: 1 });
  std('terracotta', { color: 0xa55a3a, roughness: 0.75 });
  std('celadon', { color: 0x8fb8a2, roughness: 0.3 });
  std('porcelain', { color: 0xe9eef2, roughness: 0.25 });
  std('basket', { map: wood, color: 0xd9b27a, roughness: 0.95 });
  std('bark', { map: wood, color: 0x6a5446, roughness: 1 });
  std('bambooStem', { color: 0x7f9e46, roughness: 0.6 });
  std('rope', { color: 0x2c2420, roughness: 1 });
  std('ink', { color: 0x15181c, roughness: 0.6 });
  std('rock', { color: 0x8d8f86, roughness: 0.95, flatShading: true });
  std('lotusPad', { color: 0x4f7a32, roughness: 0.6, side: THREE.DoubleSide });
  std('lotusFlower', { color: 0xf5b5c8, roughness: 0.5, emissive: 0x3a1018, emissiveIntensity: 0.4, side: THREE.DoubleSide });
  const cloths = { clothIndigo: ['#2f4a6e', '#e7e0cf'], clothOchre: ['#b9843a', null], clothRed: ['#9e2b22', '#c9a14a'], clothCream: ['#e2d6b8', '#7d9c86'], clothJade: ['#3f7d6a', null] };
  for (const [k, [b, s]] of Object.entries(cloths)) std(k, { map: T.clothTex(b, s), roughness: 0.95, side: THREE.DoubleSide });
  // lanterns: emissive driven per-instance by aGlow attribute times uNight
  const lan = std('lantern', { color: 0xc23a26, roughness: 0.6, emissive: 0xff3a12, emissiveIntensity: 1 });
  lan.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = shared.uNight;
    sh.vertexShader = 'attribute float aGlow;\nvarying float vGlow;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
    sh.fragmentShader = 'uniform float uNight;\nvarying float vGlow;\n' + sh.fragmentShader.replace('vec3 totalEmissiveRadiance = emissive;', 'float gl = clamp((uNight - vGlow) * 6.0, 0.0, 1.0);\nvec3 totalEmissiveRadiance = emissive * (0.04 + gl * 1.25);');
  };
  lan.customProgramCacheKey = () => 'lantern';
  std('lanternTassel', { color: 0xc9302a, roughness: 0.8 });
  std('lanternPlain', { color: 0xc23a26, roughness: 0.6, emissive: 0xff5a22, emissiveIntensity: 0.05 });
  std('paperLamp', { color: 0xf3e2b8, roughness: 0.8, emissive: 0xffb055, emissiveIntensity: 0.05 });
  // foliage
  addWind(std('willow', { map: T.leafCardTex('willow'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 }), 0.016, 'down');
  addWind(std('willowTop', { map: T.leafCardTex('tree'), color: 0xc8e08a, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 }), 0.0022);
  addWind(std('bambooLeaf', { map: T.leafCardTex('bamboo'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 }), 0.0028);
  addWind(std('leaves', { map: T.leafCardTex('tree'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 }), 0.0022);
  addWind(std('blossom', { map: T.blossomTex(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7, emissive: 0x401820, emissiveIntensity: 0.35 }), 0.003);
  addWind(std('blossomCore', { color: 0x7a3040, roughness: 0.95, emissive: 0x2a0810, emissiveIntensity: 0.2 }), 0.002);
  addWind(std('leafCore', { color: 0x2a4a1c, roughness: 0.95 }), 0.002);
  addWind(std('bambooStemSway', { color: 0x86a44c, roughness: 0.55 }), 0.0028);
  return mats;
}
export function addMaterial(name, m) { m.name = name; mats.set(name, m); return m; }
export const M = (name) => { const m = mats.get(name); if (!m) throw new Error('no material ' + name); return m; };
