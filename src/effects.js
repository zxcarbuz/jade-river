import * as THREE from 'three';
import { shared } from './materials.js';
import { mulberry32 } from './util.js';
import * as L from './layout.js';

const R = mulberry32(777);
export const fx = { uScale: { value: 600 } };

// GPU particle emitter set: every particle's state is a pure function of time,
// so nothing accumulates and all motion follows the frame delta through uTime.
function particles({ origins, perOrigin, life, rise, wind, spread, size, grow, color, opacity, blending = THREE.NormalBlending, petal = false, fall = 0, sway = 0, wisp = true }) {
  const n = origins.length * perOrigin;
  const pos = new Float32Array(n * 3), seed = new Float32Array(n * 4);
  let k = 0;
  for (const o of origins) for (let i = 0; i < perOrigin; i++) {
    pos[k * 3] = o.x; pos[k * 3 + 1] = o.y; pos[k * 3 + 2] = o.z;
    seed[k * 4] = (i + R() * 0.5) / perOrigin; seed[k * 4 + 1] = R() * 2 - 1; seed[k * 4 + 2] = R() * 2 - 1; seed[k * 4 + 3] = R(); k++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2000);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uLife: { value: life }, uRise: { value: rise }, uWind: { value: wind }, uSpread: { value: spread }, uSize: { value: size }, uGrow: { value: grow }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uFall: { value: fall }, uSway: { value: sway } }]),
    vertexShader: `
      uniform float uTime, uLife, uSpread, uSize, uGrow, uScale, uFall, uWindAmt, uSway; uniform vec3 uRise, uWind;
      attribute vec4 aSeed; varying float vA; varying float vRot; varying vec2 vSeed; varying float vAge;
      #include <fog_pars_vertex>
      void main(){
        float life = uLife * (0.75 + 0.5 * fract(aSeed.w * 7.31));
        float age = fract(uTime / life + aSeed.x); float t = age * life;
        vec3 p = position + uRise * t * (0.8 + 0.4 * aSeed.w) + uWind * uWindAmt * t * t * 0.5;
        p.xz += vec2(aSeed.y, aSeed.z) * uSpread * (0.25 + age * 1.6);
        // lazy curling drift so a plume never reads as a stack of balls
        p.x += sin(t * 1.4 + aSeed.w * 6.28) * uSway * age; p.z += cos(t * 1.1 + aSeed.y * 5.0) * uSway * age;
        ${petal ? 'p.y -= uFall * t; p.x += sin(t * 1.7 + aSeed.w * 6.0) * 0.4; p.z += cos(t * 1.3 + aSeed.y * 5.0) * 0.4; p.y = max(p.y, 0.03);' : ''}
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        float dz = max(-mvPosition.z, 0.05);
        gl_PointSize = min(uSize * (0.35 + uGrow * age) * uScale / dz, uScale * 0.5);
        vA = smoothstep(0.0, 0.18, age) * (1.0 - smoothstep(0.45, 1.0, age));
        ${petal ? '' : 'vA *= smoothstep(0.35, 1.4, dz) * (1.0 - 0.55 * age);'}
        vRot = t * (aSeed.y * 1.5) + aSeed.w * 6.28; vSeed = aSeed.yz * 13.7 + aSeed.w * 3.1; vAge = age;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uOpacity; varying float vA; varying float vRot; varying vec2 vSeed; varying float vAge;
      #include <fog_pars_fragment>
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float cs = cos(vRot), sn = sin(vRot); c = mat2(cs, -sn, sn, cs) * c;
        ${petal ? 'c.x *= 1.9; float d = length(c); float a = smoothstep(0.5, 0.35, d);' : !wisp ? 'float d = length(c); float a = smoothstep(0.5, 0.0, d); a *= a;' : `
        float d = length(c);
        vec2 q = c * 3.2 + vSeed;
        float n = vn(q) * 0.55 + vn(q * 2.1 + 4.7) * 0.3 + vn(q * 4.3 - 2.1) * 0.15;
        // soft wisp: noise eroded more strongly towards the edge and as the puff ages
        float a = smoothstep(0.5, 0.05, d) * smoothstep(0.28 + 0.25 * vAge, 0.85, n + 0.42 - d);
        a *= a;`}
        if (a < 0.004) discard;
        vec3 col = uColor ${petal ? '* (0.85 + 0.3 * (0.5 - d))' : ''};
        gl_FragColor = vec4(col, a * vA * uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  m.uniforms.uTime = shared.uTime; m.uniforms.uScale = fx.uScale; m.uniforms.uWindAmt = shared.uWind;
  const p = new THREE.Points(g, m); p.frustumCulled = false; return p;
}

export function buildEffects(scene, parts) {
  const group = new THREE.Group(); group.name = 'atmosphere'; scene.add(group);
  const smoke = particles({ origins: parts.chimneys, perOrigin: 22, life: 9, rise: new THREE.Vector3(0, 0.55, 0), wind: new THREE.Vector3(0.09, 0.0, 0.03), spread: 0.4, size: 1.4, grow: 2.4, color: 0xd9d4cc, opacity: 0.42, sway: 0.5 });
  smoke.name = 'chimneySmoke'; group.add(smoke);
  const incense = particles({ origins: parts.incenseAll || [parts.smokeIncense], perOrigin: 30, life: 7, rise: new THREE.Vector3(0, 0.42, 0), wind: new THREE.Vector3(0.05, 0, 0.02), spread: 0.12, size: 0.5, grow: 2.6, color: 0xe8e2da, opacity: 0.5, sway: 0.22 });
  incense.name = 'incense'; group.add(incense);
  const incenseIn = particles({ origins: parts.incenseSmall || [], perOrigin: 22, life: 5.5, rise: new THREE.Vector3(0, 0.3, 0), wind: new THREE.Vector3(0.01, 0, 0.005), spread: 0.03, size: 0.12, grow: 3.2, color: 0xe6e0d8, opacity: 0.45, sway: 0.1 });
  incenseIn.name = 'incenseIndoor'; group.add(incenseIn);
  const steam = particles({ origins: parts.steam, perOrigin: 18, life: 2.8, rise: new THREE.Vector3(0, 0.36, 0), wind: new THREE.Vector3(0.06, 0.04, 0.02), spread: 0.14, size: 0.2, grow: 3.4, color: 0xece6dc, opacity: 0.3, sway: 0.16 });
  steam.name = 'steam'; group.add(steam);
  const petalOrigins = L.PLUMS.map(([x, z]) => new THREE.Vector3(x, 4.2, z));
  const petals = particles({ origins: petalOrigins, perOrigin: 40, life: 9, rise: new THREE.Vector3(0.25, 0, 0.12), wind: new THREE.Vector3(0.04, 0, 0.02), spread: 2.4, size: 0.12, grow: 0.65, color: 0xf6b9cb, opacity: 1, petal: true, fall: 0.48 });
  petals.name = 'petals'; group.add(petals);
  // fireflies over the garden and canal banks, visible at night
  const ffOrigins = []; for (let i = 0; i < 70; i++) { const a = R(); ffOrigins.push(a < 0.4 ? new THREE.Vector3(-38 + (R() - 0.5) * 22, 0.4 + R() * 1.4, 15 + (R() - 0.5) * 10) : new THREE.Vector3((R() - 0.5) * 110, 0.2 + R() * 1.5, (R() < 0.5 ? -1 : 1) * (4 + R() * 1.5))); }
  const ff = particles({ origins: ffOrigins, perOrigin: 1, life: 6, rise: new THREE.Vector3(0.05, 0.04, 0.03), wind: new THREE.Vector3(0, 0, 0), spread: 0.8, size: 0.09, grow: 0.3, color: 0xd9ff8a, opacity: 0, blending: THREE.AdditiveBlending, wisp: false });
  ff.name = 'fireflies'; group.add(ff);
  // birds
  const birds = []; const wingG = new THREE.BufferGeometry();
  wingG.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.12, 0.55, 0.02, -0.05, 0, 0, -0.14], 3)); wingG.computeVertexNormals();
  const bm = new THREE.MeshBasicMaterial({ color: 0x1a1a1e, side: THREE.DoubleSide, fog: true });
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Group(); const l = new THREE.Mesh(wingG, bm), r = new THREE.Mesh(wingG, bm); r.scale.x = -1; b.add(l, r);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), bm); body.scale.z = 2.4; b.add(body);
    b.scale.setScalar(1.3); b.name = 'bird'; group.add(b);
    birds.push({ b, l, r, cx: (R() - 0.5) * 60, cz: -10 + (R() - 0.5) * 50, rad: 14 + R() * 22, h: 18 + R() * 16, sp: (0.12 + R() * 0.08) * (R() < 0.5 ? 1 : -1), a: R() * 6.28, f: 7 + R() * 3 });
  }
  return {
    group, smoke, steam, petals, incense, incenseIn, ff, birds,
    update(dt, time, night) {
      ff.material.uniforms.uOpacity.value = Math.max(0, night - 0.5) * 2 * (0.7 + 0.3 * Math.sin(time * 3.0));
      steam.material.uniforms.uOpacity.value = 0.28 + night * 0.08;
      smoke.material.uniforms.uColor.value.setRGB(0.85 - night * 0.55, 0.83 - night * 0.53, 0.8 - night * 0.45);
      for (const B of birds) {
        B.a += B.sp * dt; const x = B.cx + Math.cos(B.a) * B.rad, z = B.cz + Math.sin(B.a) * B.rad;
        B.b.position.set(x, B.h + Math.sin(B.a * 3) * 1.5, z);
        B.b.rotation.y = Math.atan2(-Math.sin(B.a) * Math.sign(B.sp), Math.cos(B.a) * Math.sign(B.sp)) + 0;
        const glide = Math.sin(time * 0.4 + B.f) > 0.3; const fl = glide ? 0.12 : Math.sin(time * B.f) * 0.7;
        B.l.rotation.z = fl; B.r.rotation.z = -fl; B.b.rotation.z = -Math.sign(B.sp) * 0.3;
      }
    },
  };
}
