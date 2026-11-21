import * as THREE from 'three';
import { clamp, lerp, smoothstep } from './util.js';

// Art-directed sky dome: gradient + sun glow + drifting fbm clouds + stars + moon
export function buildSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
      uCloudLit: { value: new THREE.Color() }, uCloudDark: { value: new THREE.Color() }, uCloud: { value: 0.5 }, uStars: { value: 0 },
      uTime: { value: 0 }, uSunSize: { value: 1 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `
      uniform vec3 uTop, uHorizon, uBottom, uSunDir, uSunCol, uMoonDir, uCloudLit, uCloudDark; uniform float uCloud, uStars, uTime, uSunSize;
      varying vec3 vDir;
      float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir); float y = d.y;
        vec3 col = mix(uHorizon, uTop, pow(clamp(y,0.0,1.0), 0.55));
        col = mix(col, uBottom, smoothstep(0.0, -0.25, y));
        vec3 sd = normalize(uSunDir); float sdot = max(dot(d, sd), 0.0);
        col += uSunCol * (pow(sdot, 6.0) * 0.35 + pow(sdot, 64.0) * 0.6) ;
        col += uSunCol * smoothstep(0.9993 - 0.0004*uSunSize, 0.9997, sdot) * 6.0 * step(-0.02, sd.y);
        // horizon glow band toward the sun
        col += uSunCol * 0.25 * pow(1.0 - abs(y), 8.0) * pow(max(dot(normalize(vec2(d.x,d.z)), normalize(vec2(sd.x,sd.z)+1e-4)),0.0), 3.0);
        // stars
        if (uStars > 0.0 && y > 0.0) {
          vec2 sp = d.xz / (d.y + 0.25) * 140.0; float st = step(0.9965, h21(floor(sp))) * (0.5 + 0.5*sin(uTime*2.0 + h21(floor(sp)+3.0)*30.0));
          col += vec3(0.9,0.95,1.0) * st * uStars * smoothstep(0.0,0.25,y);
        }
        // moon
        float md = max(dot(d, normalize(uMoonDir)), 0.0);
        col += vec3(0.95,0.93,0.85) * smoothstep(0.99955, 0.9997, md) * uStars * 2.0 + vec3(0.25,0.3,0.45) * pow(md, 40.0) * uStars * 0.5;
        // clouds on a virtual plane
        if (y > 0.01) {
          vec2 cp = d.xz / (y + 0.08) * 1.2 + vec2(uTime * 0.012, uTime * 0.004);
          float c = fbm(cp * 1.3); c = smoothstep(1.0 - uCloud * 0.75, 1.15 - uCloud * 0.5, c + 0.25);
          float lit = pow(max(dot(d, sd), 0.0), 3.0);
          vec3 cc = mix(uCloudDark, uCloudLit, 0.35 + 0.65 * lit);
          col = mix(col, cc, c * smoothstep(0.01, 0.12, y) * 0.92);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 48, 24), mat);
  sky.name = 'sky'; sky.frustumCulled = false; sky.renderOrder = -10;
  return sky;
}

// keyframes of the day. hour -> art parameters
const K = [
  { h: 0, sun: '#8ea4ff', si: 0.32, top: '#05081a', hor: '#1a2644', bot: '#0b0f1a', fog: '#141b30', fd: 0.0042, hs: '#34447a', hg: '#141010', hi: 0.3, cl: '#3a4466', cd: '#0d1222', cov: 0.35, ex: 1.1, night: 1 },
  { h: 4.8, sun: '#8ea4ff', si: 0.3, top: '#070b20', hor: '#1d2a4a', bot: '#0b0f1a', fog: '#18203a', fd: 0.0042, hs: '#34447a', hg: '#141010', hi: 0.3, cl: '#3a4466', cd: '#0d1222', cov: 0.35, ex: 1.1, night: 1 },
  { h: 6.2, sun: '#ff9a62', si: 1.0, top: '#4d6a9a', hor: '#f0b48a', bot: '#5a5a5a', fog: '#c7b4a6', fd: 0.0075, hs: '#9aa6c6', hg: '#4e4436', hi: 0.6, cl: '#ffd0b0', cd: '#7a7890', cov: 0.45, ex: 0.95, night: 0.35 },
  { h: 7.6, sun: '#ffd6a8', si: 3.0, top: '#5f92cc', hor: '#dfe4df', bot: '#6b6e66', fog: '#cdd6d2', fd: 0.0062, hs: '#aec0d6', hg: '#5a5240', hi: 0.65, cl: '#ffffff', cd: '#a8b2c0', cov: 0.45, ex: 1.0, night: 0 },
  { h: 12.5, sun: '#fff3e2', si: 3.8, top: '#3f86d8', hor: '#cfe2ee', bot: '#6c7068', fog: '#bfd4de', fd: 0.0030, hs: '#b8d0ea', hg: '#5e5a44', hi: 0.75, cl: '#ffffff', cd: '#b6c2d2', cov: 0.42, ex: 1.0, night: 0 },
  { h: 16.0, sun: '#ffe0b0', si: 3.8, top: '#4a86cc', hor: '#e2dccb', bot: '#6c6a60', fog: '#d2d2c6', fd: 0.0032, hs: '#c2cad6', hg: '#5e5440', hi: 0.68, cl: '#fff6e8', cd: '#b4b4be', cov: 0.42, ex: 1.0, night: 0 },
  { h: 17.6, sun: '#ffa456', si: 4.4, top: '#5a78b0', hor: '#ffc286', bot: '#6a5a4a', fog: '#d9ae8c', fd: 0.0042, hs: '#a9a6b8', hg: '#4c3a2a', hi: 0.5, cl: '#ffd2a0', cd: '#8a7a8e', cov: 0.45, ex: 1.0, night: 0.12 },
  { h: 18.4, sun: '#ff7a3a', si: 3.0, top: '#3e4f8a', hor: '#ff9258', bot: '#4a3a34', fog: '#c88468', fd: 0.0038, hs: '#9a8aa0', hg: '#3a2a22', hi: 0.55, cl: '#ffa070', cd: '#5a4a66', cov: 0.48, ex: 1.02, night: 0.42 },
  { h: 19.2, sun: '#ff5a30', si: 0.55, top: '#222a58', hor: '#b8645a', bot: '#2a2228', fog: '#5e4452', fd: 0.0042, hs: '#5a5a8a', hg: '#231a1a', hi: 0.42, cl: '#c06a60', cd: '#2e2a44', cov: 0.45, ex: 1.06, night: 0.78 },
  { h: 20.4, sun: '#8ea4ff', si: 0.32, top: '#070b20', hor: '#1d2a4a', bot: '#0b0f1a', fog: '#18203a', fd: 0.0042, hs: '#34447a', hg: '#141010', hi: 0.3, cl: '#3a4466', cd: '#0d1222', cov: 0.35, ex: 1.1, night: 1 },
  { h: 24, sun: '#8ea4ff', si: 0.32, top: '#05081a', hor: '#1a2644', bot: '#0b0f1a', fog: '#141b30', fd: 0.0042, hs: '#34447a', hg: '#141010', hi: 0.3, cl: '#3a4466', cd: '#0d1222', cov: 0.35, ex: 1.1, night: 1 },
];
const cA = new THREE.Color(), cB = new THREE.Color();
export function dayParams(hour) {
  hour = ((hour % 24) + 24) % 24;
  let i = 0; while (i < K.length - 2 && K[i + 1].h <= hour) i++;
  const a = K[i], b = K[i + 1]; const t = smoothstep(0, 1, (hour - a.h) / (b.h - a.h));
  const out = {};
  for (const k of Object.keys(a)) {
    if (k === 'h') continue;
    if (typeof a[k] === 'string') out[k] = cA.set(a[k]).lerp(cB.set(b[k]), t).clone();
    else out[k] = lerp(a[k], b[k], t);
  }
  // sun path: rises in the east (+x), culminates in the south (+z), sets west
  const ang = (hour - 6) / 13 * Math.PI;
  const elev = Math.sin(ang) * 0.95;
  out.sunDir = new THREE.Vector3(Math.cos(ang), elev, 0.55 + 0.25 * Math.sin(ang)).normalize();
  out.sunUp = clamp(elev * 4 + 0.2, 0, 1);
  const mAng = ((hour + 12) - 6) / 12 * Math.PI; // moon opposite-ish
  out.moonDir = new THREE.Vector3(Math.cos(mAng) * 0.8, Math.max(0.35, Math.sin(mAng)), -0.4).normalize();
  out.hour = hour;
  return out;
}
