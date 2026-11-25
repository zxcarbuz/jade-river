import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { initMaterials, M, shared, allMaterials } from './materials.js';
import { disposeTextures } from './textures.js';
import { Builder, ChunkLOD } from './builder.js';
import { TownParts, buildHouse, buildTeahouse, upperShell, buildNoodle, buildInn, buildTemple, buildPaifang, buildPavilion, buildGardenWalls } from './buildings.js';
import { buildTerrain, buildForest, buildPagoda, buildGround, buildStreets, buildEmbankment, buildBridge } from './world.js';
import { buildCanalWater, buildPondWater } from './water.js';
import { buildVegetation } from './vegetation.js';
import { buildKoi } from './koi.js';
import { Collision } from './collide.js';
import { LATHES } from './geom.js';
import { Interiors, INTERIOR_PICKS } from './interiors.js';
import { buildLanterns, lanternStrings, buildMarket, buildStreetProps, buildBoats, propFeet } from './props.js';
import { buildSky, dayParams } from './sky.js';
import { buildEffects, fx } from './effects.js';
import { Residents } from './npc.js';
import { CameraRig, START_VIEW } from './controls.js';
import { clamp, smoothstep, lerp } from './util.js';
import * as L from './layout.js';

const PRESETS = { morning: 7.4, day: 12.5, sunset: 17.7, night: 21.5 };
const QUALITY = {
  high: { pr: 2, shadow: 2048, bloom: true, samples: 4, shadowEvery: 1, near: 46, detail: 50, forest: 1, npcFar: 34 },
  medium: { pr: 1.5, shadow: 2048, bloom: true, samples: 0, shadowEvery: 1, near: 30, detail: 32, forest: 0.7, npcFar: 26 },
  low: { pr: 1, shadow: 1024, bloom: false, samples: 0, shadowEvery: 3, near: 16, detail: 15, forest: 0.45, npcFar: 18, proxy: true },
};
const params = new URLSearchParams(location.search);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const isMobile = isTouch || Math.min(innerWidth, innerHeight) < 700;

const app = { ready: false };
window.__jade = app;

function start() {
  const container = document.getElementById('app');
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.info.autoReset = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(isMobile ? 55 : 45, innerWidth / innerHeight, 0.45, 950);

  initMaterials();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  allMaterials().forEach((m) => { if (m.map) m.map.anisotropy = Math.min(8, maxAniso); });

  // ------------------------------------------------------------ build town
  const B = new Builder({ chunk: 32, chunkTris: 64000 }); const P = new TownParts(B);
  const staticGroup = new THREE.Group(); staticGroup.name = 'town'; scene.add(staticGroup);
  buildTerrain(scene); buildForest(scene); buildGround(scene);
  buildStreets(B); buildEmbankment(B, P);
  L.BRIDGES.forEach((b) => buildBridge(B, P, b));
  L.HOUSES.forEach((h, i) => buildHouse(P, h, i));
  buildTeahouse(P); buildNoodle(P); buildInn(P); buildTemple(P); for (const d of L.INTERIORS) if (d.upper) upperShell(B, d); buildPaifang(P); buildPavilion(P); buildGardenWalls(P);
  buildPagoda(B, P);
  buildMarket(scene, B, P); buildStreetProps(scene, B, P); lanternStrings(B, P);
  const vegGroup = new THREE.Group(); vegGroup.name = 'vegetation'; scene.add(vegGroup);
  buildVegetation(vegGroup, B);
  const staticMeshes = B.build(staticGroup, { noShadow: ['paving', 'canalBed', 'rope'] });
  const lod = new ChunkLOD(staticMeshes);
  P.signs.forEach((s) => scene.add(s));
  const lanterns = buildLanterns(scene, P.lanterns);
  const koi = buildKoi(scene);
  const boats = buildBoats(scene);
  const water = buildCanalWater(scene, 'high');
  water.getReflectionCamera(camera).layers.mask = 1 | 4; // reflections use far-LOD proxies only
  const pond = buildPondWater(scene);
  const sky = buildSky(); scene.add(sky);
  const effects = buildEffects(scene, P);
  // paper lamps (stone lanterns) glow with the lanterns
  const lights = P.lights.slice(0, 8).map((l) => { const pl = new THREE.PointLight(l.color, 0, l.dist, 1.6); pl.position.copy(l.p); pl.userData.base = l.intensity; scene.add(pl); return pl; });

  // ------------------------------------------------------------ lighting
  const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true;
  camera.layers.mask = 1 | 2; sun.shadow.camera.layers.mask = 1 | 4;
  sun.shadow.camera.left = -78; sun.shadow.camera.right = 78; sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70; sun.shadow.camera.near = 1; sun.shadow.camera.far = 400;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.055; sun.shadow.radius = 3;
  sun.target.position.set(0, 0, -5); scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xbcd0ea, 0x5a5040, 1); scene.add(hemi);
  scene.fog = new THREE.FogExp2(0xd2c6b0, 0.0035);

  // environment map from the sky
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene(); const envSky = buildSky(); envSky.material.uniforms.uStars.value = 0; envScene.add(envSky);
  let envRT = null;
  const refreshEnv = () => {
    for (const k of Object.keys(sky.material.uniforms)) if (k !== 'uTime') envSky.material.uniforms[k].value = sky.material.uniforms[k].value;
    envSky.material.uniforms.uSunSize.value = 0;
    const rt = pmrem.fromScene(envScene, 0, 1, 1000);
    if (envRT) envRT.dispose(); envRT = rt; scene.environment = rt.texture;
  };

  // ------------------------------------------------------------ residents & camera
  const nav = L.buildNav(); const pois = L.buildPOIs(nav); const colliders = L.buildColliders();
  const residents = new Residents(scene, nav, pois, colliders);
  // walker collision: layout rects + prop boxes harvested from the town builder (+ rooms as they are built)
  const collision = new Collision(colliders); collision.addSolids(B.solids.concat(P.lanterns.map(({ p, size: k }) => [p.x - 0.42 * k, p.x + 0.42 * k, p.z - 0.42 * k, p.z + 0.42 * k, p.y - 0.78 * k, p.y, 'lantern']))); B.solids = [];
  const rig = new CameraRig(camera, renderer.domElement, collision);
  rig.joyZone = isTouch;
  const interiors = new Interiors(scene, camera, { onBuild: (solids) => collision.addSolids(solids) });
  for (const [id, name, x0, x1, y0, y1, z0, z1] of INTERIOR_PICKS) P.picks.push({ name, box: new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)), anchor: new THREE.Vector3((x0 + x1) / 2, y1 + 0.1, (z0 + z1) / 2), interior: id });
  const ENTER_BY_NAME = { '茶楼': 'teahouse', '面馆': 'noodle', '悦来客栈': 'inn', '大雄宝殿': 'temple' };
  for (const pk of P.picks) if (ENTER_BY_NAME[pk.name[0]] && !pk.interior) pk.enter = ENTER_BY_NAME[pk.name[0]];

  // ------------------------------------------------------------ post
  let composer, bloom, quality;
  const setQuality = (q) => {
    quality = q; const Q = QUALITY[q];
    lod.set(Q.near, Q.detail, !!Q.proxy); camera.layers.mask = Q.proxy ? 1 | 2 | 4 : 1 | 2;
    scene.traverse((o) => { if (o.isInstancedMesh && (o.name === 'forest' || o.name === 'pines')) { o.userData.full = o.userData.full ?? o.count; o.count = Math.round(o.userData.full * Q.forest); } });
    const pr = Math.min(window.devicePixelRatio || 1, isMobile ? Math.min(Q.pr, 1.5) : Q.pr);
    renderer.setPixelRatio(pr);
    sun.shadow.mapSize.set(Q.shadow, Q.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    renderer.shadowMap.autoUpdate = Q.shadowEvery === 1;
    if (composer) composer.dispose();
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: Q.samples });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.4, 0.55, 0.88);
    bloom.enabled = Q.bloom; composer.addPass(bloom);
    composer.addPass(new OutputPass());
    resize();
    app.quality = q;
  };
  // portrait phones: a 60° vertical view is only ~30° wide, so walking feels like a tunnel; widen it in walk mode
  const baseFov = () => { const portrait = innerWidth < innerHeight; if (rig.mode === 'walk') return portrait ? 74 : isMobile ? 62 : 55; return portrait ? 60 : isMobile ? 52 : 45; };
  const resize = () => {
    const w = innerWidth, h = innerHeight;
    camera.aspect = w / h; camera.fov = baseFov(); camera.updateProjectionMatrix();
    renderer.setSize(w, h, false); renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
    if (composer) composer.setSize(w, h);
    const db = renderer.getDrawingBufferSize(new THREE.Vector2());
    water.userData.resize(db.x, db.y, quality);
    fx.uScale.value = db.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  };
  window.addEventListener('resize', resize);
  const initialQ = params.get('q') || (isMobile ? 'medium' : 'high');
  setQuality(QUALITY[initialQ] ? initialQ : 'high');

  // ------------------------------------------------------------ time of day
  const state = { hour: PRESETS.sunset, target: null, flow: true, effects: true, preset: 'sunset' };
  if (params.get('t') && PRESETS[params.get('t')]) { state.hour = PRESETS[params.get('t')]; state.preset = params.get('t'); state.flow = false; }
  const sunDirNow = new THREE.Vector3(0, 1, 0); let shWalk = null;
  let night = 0, lastEnvHour = -99; const dayBase = { hi: 1, fog: 0.003, env: 0.5, hs: new THREE.Color(), hg: new THREE.Color() }; const WARM_S = new THREE.Color(0xffc48a), WARM_G = new THREE.Color(0x5a3a24);
  const latticeMats = [0, 1, 2].map((i) => M('lattice' + i));
  const applyDay = (force = false) => {
    const d = dayParams(state.hour);
    night = d.night; shared.uNight.value = d.night;
    const sunDir = d.sunDir.clone(); if (sunDir.y < 0.06) sunDir.y = 0.06; sunDir.normalize();
    const moonW = smoothstep(0.55, 0.92, d.night);
    const ld = sunDir.lerp(d.moonDir, moonW).normalize();
    sunDirNow.copy(ld); sun.position.copy(ld).multiplyScalar(160).add(sun.target.position);
    sun.color.copy(d.sun); sun.intensity = d.si;
    hemi.color.copy(d.hs); hemi.groundColor.copy(d.hg); hemi.intensity = d.hi; dayBase.hi = d.hi; dayBase.hs.copy(d.hs); dayBase.hg.copy(d.hg);
    scene.fog.color.copy(d.fog); scene.fog.density = d.fd * (state.effects ? 1 : 0.35); dayBase.fog = scene.fog.density;
    renderer.toneMappingExposure = d.ex;
    scene.environmentIntensity = lerp(0.5, 0.14, d.night); dayBase.env = scene.environmentIntensity;
    const U = sky.material.uniforms;
    U.uTop.value.copy(d.top); U.uHorizon.value.copy(d.fog).lerp(d.hor, 0.6); U.uBottom.value.copy(d.fog);
    U.uSunDir.value.copy(d.sunDir); U.uSunCol.value.copy(d.sun).multiplyScalar(d.night > 0.9 ? 0 : 1 - d.night * 0.6);
    U.uMoonDir.value.copy(d.moonDir); U.uCloudLit.value.copy(d.cl); U.uCloudDark.value.copy(d.cd); U.uCloud.value = state.effects ? d.cov : 0; U.uStars.value = smoothstep(0.7, 1, d.night);
    const wu = water.material.uniforms; wu.uSunDir.value.copy(d.sunDir.y > 0 ? d.sunDir : d.moonDir); wu.uSunCol.value.copy(d.sunDir.y > 0 ? d.sun : new THREE.Color(0.5, 0.55, 0.7)).multiplyScalar(d.sunDir.y > 0 ? 1 : 0.4); wu.uSky.value.copy(d.hor);
    wu.uDeep.value.set('#1f4a3c').lerp(new THREE.Color('#0a1a1a'), d.night * 0.7);
    const pu = pond.material.uniforms; pu.uSky.value.copy(d.hor); pu.uSunDir.value.copy(wu.uSunDir.value); pu.uSunCol.value.copy(wu.uSunCol.value);
    for (const m of latticeMats) m.emissiveIntensity = smoothstep(0.25, 0.9, d.night) * 1.5;
    M('paperLamp').emissiveIntensity = 0.05 + smoothstep(0.3, 0.8, d.night) * 2.2;
    for (const s of P.signs) s.material.emissiveIntensity = smoothstep(0.5, 1, d.night) * 0.25;
    lights.forEach((l, i) => { l.intensity = l.userData.base * smoothstep(0.15 + i * 0.03, 0.6 + i * 0.03, d.night); });
    if (bloom) { bloom.strength = 0.22 + d.night * 0.55; bloom.threshold = 0.9 - d.night * 0.12; }
    if (force || Math.abs(state.hour - lastEnvHour) > 0.35) { refreshEnv(); lastEnvHour = state.hour; }
    app.day = { hour: state.hour, night, sunIntensity: sun.intensity, exposure: renderer.toneMappingExposure, fog: scene.fog.color.getHexString(), preset: state.preset };
  };
  residents.setHour(state.hour);
  applyDay(true);

  // ------------------------------------------------------------ UI
  const $ = (s) => document.querySelector(s);
  const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200); };
  const syncUI = () => {
    document.querySelectorAll('[data-time]').forEach((b) => b.classList.toggle('on', b.dataset.time === state.preset));
    document.querySelectorAll('[data-cam]').forEach((b) => b.classList.toggle('on', b.dataset.cam === rig.mode));
    $('#b-npc').classList.toggle('paused', residents.paused); $('#b-npc').classList.toggle('on', !residents.paused);
    $('#b-fx').classList.toggle('off', !state.effects); $('#b-fx').classList.toggle('on', state.effects);
    document.body.classList.toggle('walk', rig.mode === 'walk'); document.body.classList.toggle('touch', isTouch);
  };
  const setTime = (name) => { state.preset = name; state.flow = name === 'sunset'; state.target = PRESETS[name]; syncUI(); };
  const setCam = (mode) => {
    rig.setMode(mode); syncUI();
    const h = $('#hint');
    h.textContent = mode === 'walk' ? (isTouch ? 'Джойстик — идти · свайп справа — смотреть' : 'WASD — идти · тяни мышью — смотреть · Shift — бег') : mode === 'cinematic' ? 'Кинооблёт · выбери «Орбита», чтобы остановить' : 'Тяни — вращать · колесо/щипок — зум · правая кнопка/два пальца — сдвиг';
    h.classList.add('show'); clearTimeout(setCam._t); setCam._t = setTimeout(() => h.classList.remove('show'), 3800);
  };
  const toggleNPC = () => { residents.paused = !residents.paused; syncUI(); toast(residents.paused ? 'Жители замерли' : 'Жители снова в пути'); };
  const toggleFX = () => {
    state.effects = !state.effects; effects.group.visible = state.effects; shared.uWind.value = state.effects ? 1 : 0.25;
    applyDay(); syncUI(); toast(state.effects ? 'Атмосфера включена' : 'Атмосфера выключена');
  };
  const toggleUI = (force) => { const hide = force ?? !document.body.classList.contains('ui-hidden'); document.body.classList.toggle('ui-hidden', hide); app.uiHidden = hide; };
  const snapshot = (download = true) => {
    composer.render();
    const url = renderer.domElement.toDataURL('image/png');
    if (download) { const a = document.createElement('a'); a.href = url; a.download = `jade-river-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`; document.body.appendChild(a); a.click(); a.remove(); toast('Снимок сохранён'); }
    return url;
  };
  // ---------------------------------------------------------------- interiors: enter / exit
  const enter = (id) => {
    const d = L.INTERIORS.find((x) => x.id === id); if (!d) return false;
    interiors.ensure(d); interiors.forceOpen = id; clearTimeout(enter._t); enter._t = setTimeout(() => { if (interiors.forceOpen === id) interiors.forceOpen = null; }, 6000);
    label.classList.remove('show', 'can-enter'); picked = null;
    rig.placeWalker(d.exit[0], d.exit[1], d.spawn[2], { dur: 1.6, auto: [[d.spawn[0], d.spawn[1]]] });
    syncUI(); toast('Входим: ' + d.name[1]);
    return true;
  };
  const exitRoom = () => {
    const d = interiors.inside || L.INTERIORS.find((x) => x.id === app.lastInside); if (!d) return false;
    interiors.forceOpen = d.id; clearTimeout(enter._t); enter._t = setTimeout(() => { interiors.forceOpen = null; }, 6000);
    const inner = [d.door.x, d.door.z - d.door.out * 0.9];
    const down = interiors.level === 1 && d.upper ? d.upper.down : [];
    rig.walk.auto = [...down.map(([x, z]) => ({ x, z })), { x: inner[0], z: inner[1] }, { x: d.exit[0], z: d.exit[1] }]; rig.walk.stuck = 0;
    rig.walk.tYaw = d.exit[2];
    toast('Выходим на улицу');
    return true;
  };
  $('#b-exit').addEventListener('click', exitRoom);
  const resetView = () => { rig.reset(); setTime('sunset'); syncUI(); };
  document.querySelectorAll('[data-time]').forEach((b) => b.addEventListener('click', () => setTime(b.dataset.time)));
  document.querySelectorAll('[data-cam]').forEach((b) => b.addEventListener('click', () => setCam(b.dataset.cam)));
  $('#b-npc').addEventListener('click', toggleNPC); $('#b-fx').addEventListener('click', toggleFX);
  $('#b-reset').addEventListener('click', resetView); $('#b-shot').addEventListener('click', () => snapshot());
  $('#b-hide').addEventListener('click', () => toggleUI(true)); $('#ghost').addEventListener('click', () => toggleUI(false));
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.code;
    if (k === 'Digit1') setTime('morning'); else if (k === 'Digit2') setTime('day'); else if (k === 'Digit3') setTime('sunset'); else if (k === 'Digit4') setTime('night');
    else if (k === 'KeyH') toggleUI(); else if (k === 'KeyP') toggleNPC(); else if (k === 'KeyF') toggleFX(); else if (k === 'KeyR' && rig.mode !== 'walk') resetView(); else if (k === 'KeyC') snapshot();
    else if (k === 'KeyX' && interiors.inside) exitRoom();
    else if (k === 'KeyO') setCam('orbit'); else if (k === 'KeyK') setCam('cinematic'); else if (k === 'KeyG') setCam('walk');
    else if (rig.mode !== 'walk' && ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(k) && rig.mode !== 'cinematic') setCam('walk');
  });
  // virtual joystick
  const joy = $('#joy'), knob = joy.querySelector('.knob'); let joyId = null;
  const joyMove = (e) => { const r = joy.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } knob.style.transform = `translate(${x * 36}px, ${y * 36}px)`; rig.setJoystick(x, y, true); };
  joy.addEventListener('pointerdown', (e) => { joyId = e.pointerId; try { joy.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ } joyMove(e); e.stopPropagation(); });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) joyMove(e); });
  const joyEnd = (e) => { if (e.pointerId !== joyId) return; joyId = null; knob.style.transform = ''; rig.setJoystick(0, 0, false); };
  joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);

  // ------------------------------------------------------------ picking
  const roomName = document.getElementById('roomname');
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2(); const label = $('#label');
  let picked = null; let down = null;
  label.querySelector('.enter').addEventListener('click', (e) => { e.stopPropagation(); if (picked?.pick?.enter) enter(picked.pick.enter); });
  renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); const dt = performance.now() - down.t; down = null;
    if (moved > 8) return; void dt;
    pickAt(e.clientX, e.clientY);
  });
  const pickAt = (cx, cy) => {
    ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(residents.group.children, true);
    let best = null;
    if (hits.length) { let o = hits[0].object; while (o && !o.userData.resident) o = o.parent; if (o) best = { dist: hits[0].distance, res: o.userData.resident }; }
    const p = new THREE.Vector3();
    const inRoom = interiors.inside ? interiors.inside.id : null;
    // koi: click on the pond scatters them; a click near one names its variety
    if (!best || best.dist > 4) {
      const pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.28); const hp = new THREE.Vector3();
      if (ray.ray.intersectPlane(pl, hp) && L.inPond(hp.x, hp.z, 0.4)) {
        const f = koi.nearest(hp.x, hp.z, 0.7); const n = koi.scatter(hp.x, hp.z);
        const v = f ? koi.varieties[f.kind] : null;
        label.querySelector('.cn').textContent = v ? '锦鲤 · ' + v[0] : '锦鲤池';
        label.querySelector('.ru').textContent = v ? 'Карп кои «' + v[1] + '» — бросился прочь' : `Пруд с карпами кои — ${n} рыб${n === 1 ? 'а' : n < 5 && n > 1 ? 'ы' : ''} бросились врассыпную`;
        label.classList.remove('can-enter', 'has-thought'); const th = label.querySelector('.thought'); if (th) th.textContent = ''; label.classList.add('show');
        picked = { pick: { anchor: hp.clone().setY(0.6), name: ['锦鲤', 'кои'] }, until: performance.now() + 3500 };
        app.lastPick = 'koi:' + n + (v ? ':' + v[1] : ''); return app.lastPick;
      }
    }
    for (const pk of P.picks) {
      if (pk.interior && pk.interior !== inRoom) continue;
      if (inRoom && !pk.interior && pk.box.containsPoint(camera.position)) continue;
      if (ray.ray.intersectBox(pk.box, p)) { const d = p.distanceTo(ray.ray.origin); if (!best || d < best.dist - (best.res ? 3.0 : 0)) best = { dist: d, pick: pk }; } }
    if (!best) { label.classList.remove('show'); picked = null; return null; }
    picked = { ...best, until: performance.now() + (best.pick?.enter ? 8000 : 4000) };
    label.classList.toggle('can-enter', !!(best.pick?.enter && !interiors.inside));
    const thought = label.querySelector('.thought');
    if (best.res) {
      const c = residents.card(best.res);
      label.querySelector('.cn').textContent = c.cn;
      label.querySelector('.ru').textContent = c.ru;
      thought.textContent = c.thought || '';
      label.classList.toggle('has-thought', !!c.thought);
    } else {
      label.querySelector('.cn').textContent = best.pick.name[0];
      label.querySelector('.ru').textContent = best.pick.name[1];
      thought.textContent = '';
      label.classList.remove('has-thought');
    }
    label.classList.add('show');
    app.lastPick = best.res ? best.res.name[1] : best.pick.name[1];
    return app.lastPick;
  };
  const tmpV = new THREE.Vector3();
  const updateLabel = () => {
    if (!picked) return;
    if (performance.now() > picked.until) { label.classList.remove('show'); picked = null; return; }
    if (picked.res) tmpV.copy(picked.res.fig.root.position).add(new THREE.Vector3(0, 2.1, 0)); else tmpV.copy(picked.pick.anchor);
    tmpV.project(camera);
    if (tmpV.z > 1) { label.style.opacity = 0; return; }
    label.style.opacity = '';
    { const lw = label.offsetWidth / 2 + 8, lh = label.offsetHeight + 14; const lx = Math.min(innerWidth - lw, Math.max(lw, (tmpV.x + 1) / 2 * innerWidth)); const ly = Math.min(innerHeight - 8, Math.max(lh, (1 - tmpV.y) / 2 * innerHeight - 10)); label.style.left = lx + 'px'; label.style.top = ly + 'px'; }
  };
  const greetEl = document.getElementById('greet');
  const updateGreet = () => {
    const g = residents.greeting;
    if (!g) { greetEl.classList.remove('show'); return; }
    if (greetEl.textContent !== g.text) greetEl.textContent = g.text;
    tmpV.set(g.x, L.groundY(g.x, g.z) + 2.05, g.z); tmpV.project(camera);
    if (tmpV.z > 1) { greetEl.classList.remove('show'); return; }
    greetEl.classList.add('show');
    const lw = greetEl.offsetWidth / 2 + 8, lh = greetEl.offsetHeight + 14;
    const lx = Math.min(innerWidth - lw, Math.max(lw, (tmpV.x + 1) / 2 * innerWidth));
    const ly = Math.min(innerHeight - 8, Math.max(lh, (1 - tmpV.y) / 2 * innerHeight - 10));
    greetEl.style.left = lx + 'px'; greetEl.style.top = ly + 'px';
  };

  // ------------------------------------------------------------ loop
  const clock = new THREE.Timer(); clock.connect?.(document);
  let frames = 0, acc = 0, fpsWindow = [], frameNo = 0, adaptT = 0, upgradeOK = !params.get('q');
  app.fps = 0;
  let running = true;
  // one simulation step; everything animated is driven by dt
  const tick = (dt, render = true) => {
    frameNo++; app.frame = frameNo;
    shared.uTime.value += dt;
    const t = shared.uTime.value;
    if (state.target !== null) {
      let diff = state.target - state.hour; if (diff > 12) diff -= 24; if (diff < -12) diff += 24;
      const step = Math.sign(diff) * Math.min(Math.abs(diff), dt * Math.max(2.5, Math.abs(diff) * 1.6));
      state.hour = (state.hour + step + 24) % 24; if (Math.abs(diff) < 0.01) { state.hour = state.target; state.target = null; applyDay(true); }
      applyDay();
    } else if (state.flow && state.hour < 19.6) { state.hour += dt / 150; applyDay(); }
    residents.setHour(state.hour);
    { const pl = rig.mode === 'walk' ? rig.walk.pos : camera.position; residents.playerX = pl.x; residents.playerZ = pl.z; residents.playerOn = rig.mode === 'walk' || pl.y < 4.2; }
    residents.update(dt);
    app.aiMs = residents.aiLast; app.aiAvg = residents.aiAvg; app.aiP95 = residents.aiP95;
    boats.update(dt, t); koi.update(dt);
    lanterns.update(t, shared.uWind.value);
    if (state.effects) effects.update(dt, t, night);
    collision.dynamic = interiors.leafSegments();
    collision.npcs.length = 0; for (const r of residents.list) if (!r.hidden && r.fig.root.visible) collision.npcs.push({ x: r.x, z: r.z, y: r.fig.root.position.y }); for (const v of residents.vendors) if (!v.hidden && v.fig.root.visible) collision.npcs.push({ x: v.x, z: v.z, y: v.fig.root.position.y });
    rig.update(dt);
    { const near = interiors.inside ? 0.12 : rig.mode === 'walk' ? 0.22 : 0.45, fov = rig.transition ? camera.fov : baseFov(); if (camera.near !== near || Math.abs(camera.fov - fov) > 0.01) { camera.near = near; camera.fov = camera.fov + (fov - camera.fov) * Math.min(1, dt * 4); if (Math.abs(camera.fov - fov) < 0.05) camera.fov = fov; camera.updateProjectionMatrix(); fx.uScale.value = renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)); } }
    // walk mode: a tight sun frustum around the walker, cast from the real roof/eave meshes
    // (the shared 156 m frustum + coarse proxies drew stair-stepped eave shadows up close)
    { const sw = rig.mode === 'walk' && !QUALITY[quality].proxy; const c = sun.shadow.camera;
      if (sw !== shWalk) { shWalk = sw; const h = sw ? 26 : 78, v = sw ? 26 : 70; c.left = -h; c.right = h; c.top = v; c.bottom = -v; c.updateProjectionMatrix(); c.layers.mask = sw ? 1 | 2 : 1 | 4; if (!sw) sun.target.position.set(0, 0, -5); }
      if (sw) { const t = 52 / sun.shadow.mapSize.x * 4; sun.target.position.set(Math.round(camera.position.x / t) * t, 0, Math.round(camera.position.z / t) * t); }
      sun.position.copy(sunDirNow).multiplyScalar(160).add(sun.target.position); }
    if (rig.mode === 'walk' && !rig.transition && !rig.settling) { const c = collision.clearance(camera.position); if (c < (app.minClear ?? Infinity)) { app.minClear = c; app.minClearAt = camera.position.toArray().map((v) => +v.toFixed(2)); } }
    interiors.update(dt, { player: rig.walk.pos, mode: rig.mode, residents: residents.list });
    {
      const f = interiors.insideF; hemi.intensity = dayBase.hi * (1 - 0.45 * f); hemi.color.copy(dayBase.hs).lerp(WARM_S, 0.55 * f); hemi.groundColor.copy(dayBase.hg).lerp(WARM_G, 0.6 * f); scene.environmentIntensity = dayBase.env * (1 - 0.55 * f); scene.fog.density = dayBase.fog * (1 - 0.8 * f);
      const ins = interiors.inside; if (ins) app.lastInside = ins.id;
      if (!!ins !== document.body.classList.contains('inside')) document.body.classList.toggle('inside', !!ins);
      if (ins) { const nm = interiors.level === 1 && ins.upper ? ins.upper.name : ins.name; const txt = nm[0] + ' · ' + nm[1]; if (roomName.textContent !== txt) roomName.textContent = txt; }
      app.level = ins ? interiors.level : 0;
      if (app.inside !== (ins ? ins.id : null)) { label.classList.remove('show', 'can-enter'); picked = null; }
      app.inside = ins ? ins.id : null;
    }
    sky.position.copy(camera.position);
    sky.material.uniforms.uTime.value = t;
    if (!render) return;
    lod.update(camera); residents.lod(camera, QUALITY[quality].npcFar);
    if (!renderer.shadowMap.autoUpdate && frameNo % QUALITY[quality].shadowEvery === 0) renderer.shadowMap.needsUpdate = true;
    renderer.info.reset();
    composer.render(dt);
    app.lastInfo = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
    updateLabel();
    updateGreet();
  };
  const loop = () => {
    if (!running) return;
    requestAnimationFrame(loop);
    clock.update();
    if (app.manual) { frames = 0; acc = 0; return; } const rawDt = clock.getDelta(), dt = Math.min(rawDt, 0.1);
    tick(dt);
    // fps + adaptive quality
    frames++; acc += rawDt;
    if (acc >= 1) {
      app.fps = Math.round(frames / acc * 10) / 10; fpsWindow.push(app.fps); if (fpsWindow.length > 5) fpsWindow.shift(); frames = 0; acc = 0; adaptT++;
      const avg = fpsWindow.reduce((a, b) => a + b, 0) / fpsWindow.length;
      if (!params.get('q') && adaptT > 4 && fpsWindow.length >= 4) {
        if (avg < 32 && quality === 'high') { setQuality('medium'); fpsWindow = []; adaptT = 0; upgradeOK = false; }
        else if (avg < 24 && quality === 'medium') { setQuality('low'); fpsWindow = []; adaptT = 0; upgradeOK = false; }
        else if (avg > 58 && upgradeOK && quality === 'medium' && !isMobile) { setQuality('high'); fpsWindow = []; adaptT = 0; upgradeOK = false; }
      }
    }
  };
  // deterministic fast-forward used by automated tests (fixed 1/30 s steps)
  app.step = (seconds) => { const n = Math.round(seconds * 30); for (let i = 0; i < n; i++) tick(1 / 30, false); }; // simulate without rendering (tests)
  app.advance = (seconds) => { const n = Math.round(seconds * 30); for (let i = 0; i < n; i++) tick(1 / 30, false); tick(0.0001, true); };
  syncUI();
  loop();

  const dispose = () => {
    running = false;
    window.removeEventListener('resize', resize);
    rig.dispose(); residents.dispose();
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.map?.dispose?.(); m.dispose(); }); } });
    water.dispose?.(); if (envRT) envRT.dispose(); pmrem.dispose(); composer.dispose(); disposeTextures();
    renderer.dispose(); renderer.domElement.remove();
  };
  window.addEventListener('pagehide', dispose);

  Object.assign(app, {
    ready: true, version: 4, collision, lathes: LATHES, propFeet, lod, koi, interiors, enter, exit: exitRoom, buildingRects: L.buildingRects(), L, scene, camera, renderer, rig, residents, nav, pois, colliders, state, P, lanterns,
    view: (p, t) => { rig.setMode('orbit', { instant: true }); rig.transition = null; camera.position.set(...p); rig.orbit.target.set(...t); rig.orbit.update(); },
    setTime, setCam, toggleNPC, toggleFX, toggleUI, snapshot, resetView, pickAt, setQuality, dispose, applyDay,
    info: () => ({ calls: app.lastInfo?.calls, tris: app.lastInfo?.tris, geoms: renderer.info.memory.geometries, textures: renderer.info.memory.textures, quality, pr: renderer.getPixelRatio() }),
    ai: () => residents.stats(),
  });
  document.getElementById('loading').classList.add('done');
}

requestAnimationFrame(() => setTimeout(() => {
  try { start(); } catch (e) { console.error(e); document.querySelector('#loading .lsub').textContent = 'Ошибка WebGL: ' + e.message; }
}, 30));
