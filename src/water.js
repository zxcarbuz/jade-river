import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { shared } from './materials.js';
import * as L from './layout.js';

const WAVES = /* glsl */`
  vec2 waveN(vec2 p, float t) {
    vec2 n = vec2(0.0);
    n += vec2(cos(p.x * 0.9 + t * 1.1), sin(p.y * 1.3 - t * 0.9)) * 0.35;
    n += vec2(sin(p.x * 2.3 - p.y * 1.7 + t * 1.7), cos(p.y * 2.1 + p.x * 0.6 - t * 1.5)) * 0.18;
    n += vec2(sin(p.x * 5.1 + p.y * 3.7 + t * 2.6), cos(p.x * 4.3 - p.y * 5.3 + t * 2.2)) * 0.07;
    return n;
  }
`;

const CanalShader = {
  name: 'CanalWater',
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
    uTime: { value: 0 }, uDeep: { value: new THREE.Color('#1f4a3c') }, uShallow: { value: new THREE.Color('#4d8a6a') },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 0.8, 0.5) }, uSky: { value: new THREE.Color('#9cc') },
    uHalf: { value: L.CANAL.half }, uReflect: { value: 0.75 },
  }]),
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix;
    varying vec4 vUv; varying vec3 vWorld;
    #include <fog_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz;
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec3 color; uniform float uTime; uniform vec3 uDeep; uniform vec3 uShallow;
    uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSky; uniform float uHalf; uniform float uReflect;
    varying vec4 vUv; varying vec3 vWorld;
    #include <fog_pars_fragment>
    ${WAVES}
    void main() {
      vec2 n2 = waveN(vWorld.xz * 0.9, uTime);
      vec3 N = normalize(vec3(n2.x * 0.09, 1.0, n2.y * 0.09));
      vec3 V = normalize(cameraPosition - vWorld);
      float fres = pow(1.0 - max(dot(V, N), 0.0), 4.0);
      vec4 uv = vUv; uv.xy += n2 * 0.045 * uv.w * 0.35;
      vec3 refl = texture2DProj(tDiffuse, uv).rgb;
      float edge = smoothstep(uHalf - 1.6, uHalf, abs(vWorld.z));
      vec3 body = mix(uDeep, uShallow, 0.25 + 0.35 * edge + 0.15 * n2.x);
      body = mix(body, uSky * 0.6, 0.12);
      vec3 col = mix(body, refl, clamp(uReflect * (0.55 + 0.45 * fres), 0.0, 0.95));
      vec3 H = normalize(normalize(uSunDir) + V);
      float spec = pow(max(dot(N, H), 0.0), 220.0) * 3.5;
      col += uSunCol * spec;
      // soft foam line where water meets the stone
      col += vec3(0.08) * smoothstep(uHalf - 0.25, uHalf, abs(vWorld.z)) * (0.5 + 0.5 * sin(vWorld.x * 3.0 + uTime * 2.0));
      gl_FragColor = vec4(col, 0.93);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`,
};

export function buildCanalWater(scene, quality) {
  const size = quality === 'low' ? 256 : quality === 'medium' ? 512 : 1024;
  const g = new THREE.PlaneGeometry(600, L.CANAL.half * 2 + 0.6, 1, 1);
  const water = new Reflector(g, { textureWidth: size * 2, textureHeight: size, clipBias: 0.003, shader: CanalShader, multisample: 0 });
  water.rotation.x = -Math.PI / 2; water.position.y = L.CANAL.waterY; water.name = 'canalWater';
  water.material.transparent = true; water.material.fog = true;
  water.material.uniforms.uTime = shared.uTime;
  water.userData.resize = (w, h, q) => { const s = q === 'low' ? 0.25 : q === 'medium' ? 0.4 : 0.5; water.getRenderTarget().setSize(Math.round(w * s), Math.round(h * s)); };
  scene.add(water);
  return water;
}

export function buildPondWater(scene) {
  const G = L.GARDEN.pond;
  const sh = new THREE.Shape(); sh.absellipse(0, 0, G.rx + 0.65, G.rz + 0.65, 0, Math.PI * 2, false);
  const g = new THREE.ShapeGeometry(sh, 64); g.rotateX(-Math.PI / 2);
  const m = new THREE.ShaderMaterial({
    transparent: true, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: shared.uTime, uSky: { value: new THREE.Color('#9cc') }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 0.8, 0.5) }, uDeep: { value: new THREE.Color('#163a2c') } }]),
    vertexShader: `varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vWorld = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; uniform vec3 uSky; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uDeep; varying vec3 vWorld;
      #include <fog_pars_fragment>
      ${WAVES}
      void main(){ vec2 n2 = waveN(vWorld.xz * 1.6, uTime * 0.6); vec3 N = normalize(vec3(n2.x*0.06,1.0,n2.y*0.06));
        vec3 V = normalize(cameraPosition - vWorld); float fres = pow(1.0 - max(dot(V,N),0.0), 3.0);
        vec3 col = mix(uDeep, uSky * 0.8, 0.06 + 0.5 * fres);
        vec3 H = normalize(normalize(uSunDir) + V); col += uSunCol * pow(max(dot(N,H),0.0), 160.0) * 2.5;
        gl_FragColor = vec4(col, 0.3 + 0.5 * fres);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.position.set(G.cx, -0.28, G.cz); mesh.name = 'pondWater';
  m.uniforms.uTime = shared.uTime;
  mesh.renderOrder = 2;
  scene.add(mesh);
  // basin
  const basin = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3d4a30, roughness: 1, side: THREE.DoubleSide }));
  basin.scale.set(G.rx + 0.7, 1.1, G.rz + 0.7); basin.position.set(G.cx, -0.05, G.cz); basin.receiveShadow = true; basin.name = 'pondBasin';
  scene.add(basin);
  return mesh;
}
