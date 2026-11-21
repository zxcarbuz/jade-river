// End-to-end checks + screenshots for JADE RIVER.
// usage: node tests/e2e.mjs [url]   (default: dist/index.html via file://)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const url = process.argv[2] || 'file://' + path.join(root, 'dist/index.html');
const shots = path.join(root, 'shots'); fs.mkdirSync(shots, { recursive: true });
const results = []; let failed = 0;
const check = (name, ok, detail = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); if (!ok) failed++; console.log(results[results.length - 1]); };
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function open(ctxOpts, q = '') {
  const ctx = await browser.newContext({ ...ctxOpts, acceptDownloads: true });
  const page = await ctx.newPage(); const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(url + q);
  await page.waitForFunction(() => window.__jade && window.__jade.ready, null, { timeout: 180000 });
  await page.evaluate(() => { window.__jade.manual = true; });
  return { ctx, page, errors };
}
const adv = (page, sec) => page.evaluate((s) => window.__jade.advance(s), sec);
const waitDay = async (page, pred) => { for (let i = 0; i < 30; i++) { await adv(page, 0.5); if (await page.evaluate(pred)) return; } };
const shot = async (page, name) => { const t0 = Date.now(); await page.screenshot({ path: path.join(shots, name), timeout: 240000 }); console.log('  shot', name, Date.now() - t0, 'ms'); };

// ================================================================ desktop
{
  const { ctx, page, errors } = await open({ viewport: { width: 1440, height: 900 } }, url.includes('?') ? '&q=high' : '?q=high');
  await adv(page, 3.5);
  check('scene ready, WebGL2 renderer', await page.evaluate(() => __jade.renderer.capabilities.isWebGL2));
  const info = await page.evaluate(() => __jade.info());
  check('scene stats', info.calls > 10, JSON.stringify(info));
  await shot(page, '01-golden-hour-overview.png');

  // static nav graph validation: every edge & approach path clear of colliders, not over water except bridges
  const nav = await page.evaluate(() => {
    const j = __jade; const N = j.nav.nodes; const C = j.colliders; const bad = [];
    const inR = (x, z, r) => x > r[0] && x < r[1] && z > r[2] && z < r[3];
    const test = (ax, az, bx, bz, tag) => { const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.1); for (let i = 0; i <= n; i++) { const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n; for (const r of C) if (inR(x, z, r)) { bad.push(tag + ' hits ' + r.join(',') + ' @' + x.toFixed(1) + ',' + z.toFixed(1)); return; } if (Math.abs(z) < 5.1 && !((Math.abs(x) < 1.8) || Math.abs(x - 34) < 1.5)) { bad.push(tag + ' water @' + x.toFixed(1) + ',' + z.toFixed(1)); return; } } };
    N.forEach((a, i) => a.adj.forEach((k) => { if (k > i) { const b = N[k]; for (const o of [-0.42, 0, 0.42]) { const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz); test(a.x - dz / l * o, a.z + dx / l * o, b.x - dz / l * o, b.z + dx / l * o, `edge ${i}-${k}`); } } }));
    for (const k of Object.keys(j.pois)) j.pois[k].forEach((s, si) => { let px = N[s.node].x, pz = N[s.node].z; for (const [x, z] of s.path) { test(px, pz, x, z, `${k}${si}`); px = x; pz = z; } });
    let comps = 0; const seen = new Set(); for (let i = 0; i < N.length; i++) { if (seen.has(i)) continue; comps++; const st = [i]; while (st.length) { const u = st.pop(); if (seen.has(u)) continue; seen.add(u); N[u].adj.forEach((v) => st.push(v)); } }
    return { nodes: N.length, bad, comps, slots: Object.fromEntries(Object.entries(j.pois).map(([k, v]) => [k, v.length])) };
  });
  check('nav graph: edges/approach paths clear of buildings & water', nav.bad.length === 0, `${nav.nodes} nodes, slots ${JSON.stringify(nav.slots)} ${nav.bad.slice(0, 5).join(' | ')}`);
  check('nav graph connected', nav.comps === 1, `components=${nav.comps}`);
  const cine = await page.evaluate(() => { const j = __jade; const bad = []; for (let i = 0; i < 400; i++) { const p = j.rig.cineP.getPointAt(i / 400); for (const r of j.buildingRects) if (p.x > r[0] - 0.5 && p.x < r[1] + 0.5 && p.z > r[2] - 0.5 && p.z < r[3] + 0.5 && p.y < 11) bad.push(p.toArray().map((v) => v.toFixed(1)).join(',')); if (p.y < 1) bad.push('low ' + p.y); } return bad; });
  check('cinematic path stays clear of buildings', cine.length === 0, cine.slice(0, 4).join(' | '));
  // ---- v2: LOD / lazy interiors at the start view
  const v2a = await page.evaluate(() => ({ v: __jade.version, lod: __jade.lod.stats, built: __jade.interiors.buildCount, koi: __jade.koi.fish.length }));
  check('v2 build marker', v2a.v === 2, JSON.stringify(v2a));
  check('v2: interiors are not built at the overview (lazy)', v2a.built === 0, `built=${v2a.built}`);
  check('v2: chunked LOD active', v2a.lod && v2a.lod.total > 50 && v2a.lod.near < v2a.lod.total / 2, JSON.stringify(v2a.lod));

  // canal + bridge
  await page.evaluate(() => __jade.view([-18, 5, 2], [0, 2.5, 0])); await adv(page, 1.5); await shot(page, '02-canal-bridge.png');
  // street with NPCs (market): put camera over the market aisle
  await page.evaluate(() => __jade.view([-6, 6.5, -4], [-20, 1.2, -14])); await adv(page, 1.5); await shot(page, '03-market-street-npcs.png');
  await page.evaluate(() => __jade.view([20, 4.2, 2.5], [9, 3.2, -12])); await adv(page, 1.5); await shot(page, '04-teahouse.png');
  await page.evaluate(() => __jade.view([-30, 6, 27], [-40, 0, 14])); await adv(page, 1.5); await shot(page, '05-koi-garden.png');
  await page.evaluate(() => __jade.view([0, 3.2, -24], [0, 4.5, -45])); await adv(page, 1.5); await shot(page, '06-temple-paifang.png');

  // NPC movement over time
  const sample = () => page.evaluate(() => ({ t: __jade.residents.time, list: __jade.residents.list.map((r) => ({ x: r.x, z: r.z, s: r.state, off: __jade.residents.offNetwork(r) })) }));
  const s0 = await sample(); const samples = [s0];
  for (let i = 0; i < 16; i++) { await adv(page, 1.5); samples.push(await sample()); }
  const moved = s0.list.map((r, i) => Math.hypot(samples.at(-1).list[i].x - r.x, samples.at(-1).list[i].z - r.z));
  let maxOff = 0, maxJump = 0; const states = new Set();
  for (let k = 1; k < samples.length; k++) { const dt = samples[k].t - samples[k - 1].t; samples[k].list.forEach((r, i) => { maxOff = Math.max(maxOff, r.off); states.add(r.s); const j = Math.hypot(r.x - samples[k - 1].list[i].x, r.z - samples[k - 1].list[i].z) / Math.max(dt, 1e-3); maxJump = Math.max(maxJump, j); }); }
  const simT = samples.at(-1).t - s0.t;
  check('NPCs move over time', moved.filter((d) => d > 1).length >= 8, `${moved.filter((d) => d > 1).length}/12 moved >1 m in ${simT.toFixed(1)} s sim; distances ${moved.map((d) => d.toFixed(1)).join(',')}`);
  check('NPCs stay on the walk network', maxOff < 0.7, `max distance from graph/approach lines ${maxOff.toFixed(2)} m`);
  check('NPCs never teleport', maxJump < 2.2, `max speed between samples ${maxJump.toFixed(2)} m/s`);
  check('NPC FSM uses several states', states.size >= 2, [...states].join(','));
  const acts = await page.evaluate(() => __jade.residents.list.map((r) => r.state + (r.act ? ':' + r.act : '')).join(' '));
  check('NPC activity snapshot', true, acts);
  // fast-forward the residents' simulation (deterministic dt steps) to see all activities happen
  const ff = await page.evaluate(() => { const R = __jade.residents; const seen = {}; let maxOff = 0; const inside = {}; for (let i = 0; i < 20 * 60 * 8; i++) { R.update(1 / 20); if (i % 20 === 0) for (const r of R.list) { if (r.state === 'activity') { seen[r.act] = (seen[r.act] || 0) + 1; if (r.slot && r.slot.inside) inside[r.slot.inside] = (inside[r.slot.inside] || 0) + 1; } maxOff = Math.max(maxOff, R.offNetwork(r)); } } return { seen, inside, maxOff, stuck: R.list.filter((r) => r.state === 'walk' && r.path.length === 0).length }; });
  check('8 simulated minutes: all activities occur', ['shop', 'tea', 'noodle', 'bench', 'pray'].every((k) => ff.seen[k]), JSON.stringify(ff.seen));
  check('8 simulated minutes: still on network', ff.maxOff < 0.7, `max off ${ff.maxOff.toFixed(2)} m`);
  check('v2: residents sit inside the teahouse / noodle shop', (ff.inside.teahouse || 0) > 0 && (ff.inside.noodle || 0) > 0, JSON.stringify(ff.inside));
  await page.evaluate(() => __jade.view([-16, 4.5, -2.5], [-20, 1.0, -14])); await adv(page, 1.2); await shot(page, '07-street-npcs-activities.png');
  await page.evaluate(() => __jade.view([14, 3.2, -6.5], [9, 1.2, -11.5])); await adv(page, 1.2); await shot(page, '08-teahouse-terrace-npcs.png');

  // NPC pause / resume via button
  await page.click('#b-npc'); const p1 = await sample(); await adv(page, 2.0); const p2 = await sample();
  const still = p1.list.every((r, i) => Math.hypot(r.x - p2.list[i].x, r.z - p2.list[i].z) < 1e-6);
  await page.click('#b-npc'); await adv(page, 2.5); const p3 = await sample();
  const again = p2.list.some((r, i) => Math.hypot(r.x - p3.list[i].x, r.z - p3.list[i].z) > 0.2);
  check('NPC pause button freezes residents', still); check('NPC button resumes residents', again);

  // time of day buttons change lighting
  const d0 = await page.evaluate(() => ({ ...__jade.day }));
  await page.click('[data-time="day"]'); await waitDay(page, () => Math.abs(__jade.day.hour - 12.5) < 0.02); await adv(page, 0.8);
  const d1 = await page.evaluate(() => ({ ...__jade.day }));
  await page.evaluate(() => __jade.view([-40, 30, 50], [0, 2, -8])); await adv(page, 1.5); await shot(page, '09-day-overview.png');
  await page.click('[data-time="morning"]'); await waitDay(page, () => Math.abs(__jade.day.hour - 7.4) < 0.02); await adv(page, 1.5); await shot(page, '10-morning-overview.png');
  await page.click('[data-time="night"]'); await waitDay(page, () => __jade.day.night > 0.99); await adv(page, 1.5);
  const d2 = await page.evaluate(() => ({ ...__jade.day }));
  await shot(page, '11-night-overview.png');
  await page.evaluate(() => __jade.view([-9, 1.8, -6.9], [12, 2.6, -8])); await adv(page, 1.5); await shot(page, '12-night-canal-street.png');
  await page.evaluate(() => __jade.view([-18, 5, 2], [0, 2.5, 0])); await adv(page, 1.5); await shot(page, '13-night-bridge-reflections.png');
  check('time buttons change lighting', d0.fog !== d1.fog && d1.fog !== d2.fog && d1.sunIntensity !== d2.sunIntensity && d2.night > 0.99 && d1.night < 0.01, `sunset fog #${d0.fog} sun ${d0.sunIntensity.toFixed(2)} → day #${d1.fog} sun ${d1.sunIntensity.toFixed(2)} → night #${d2.fog} sun ${d2.sunIntensity.toFixed(2)} night=${d2.night.toFixed(2)}`);
  await page.click('[data-time="sunset"]'); await waitDay(page, () => Math.abs(__jade.day.hour - 17.7) < 0.3);

  // atmosphere toggle
  const fx0 = await page.evaluate(() => __jade.scene.getObjectByName('atmosphere').visible);
  await page.click('#b-fx'); const fx1 = await page.evaluate(() => ({ v: __jade.scene.getObjectByName('atmosphere').visible, fog: __jade.scene.fog.density }));
  await page.click('#b-fx'); const fx2 = await page.evaluate(() => ({ v: __jade.scene.getObjectByName('atmosphere').visible, fog: __jade.scene.fog.density }));
  check('atmosphere toggle hides particles/birds and thins fog', fx0 && !fx1.v && fx2.v && fx1.fog < fx2.fog, `fog ${fx1.fog.toFixed(4)} vs ${fx2.fog.toFixed(4)}`);

  // camera modes
  await page.click('[data-cam="cinematic"]'); const c0 = await page.evaluate(() => __jade.camera.position.toArray()); await adv(page, 3.0); const c1 = await page.evaluate(() => __jade.camera.position.toArray());
  check('cinematic mode moves the camera', Math.hypot(c1[0] - c0[0], c1[2] - c0[2]) > 1 && (await page.evaluate(() => __jade.rig.mode)) === 'cinematic', `moved ${Math.hypot(c1[0] - c0[0], c1[2] - c0[2]).toFixed(1)} m`);
  await shot(page, '14-cinematic.png');
  await page.click('[data-cam="walk"]'); await adv(page, 1.8);
  const w0 = await page.evaluate(() => __jade.rig.walk.pos.toArray());
  await page.mouse.move(700, 450); await page.keyboard.down('KeyW'); await adv(page, 2.5); await page.keyboard.up('KeyW'); await adv(page, 0.6);
  const w1 = await page.evaluate(() => __jade.rig.walk.pos.toArray());
  // mouse-look drag
  const yaw0 = await page.evaluate(() => __jade.rig.walk.yaw);
  await page.mouse.move(700, 450); await page.mouse.down(); await page.mouse.move(900, 450, { steps: 8 }); await page.mouse.up(); await adv(page, 0.6);
  const yaw1 = await page.evaluate(() => __jade.rig.walk.yaw);
  check('walk mode: W moves forward with inertia', Math.hypot(w1[0] - w0[0], w1[2] - w0[2]) > 2, `from ${w0.map((v) => v.toFixed(1))} to ${w1.map((v) => v.toFixed(1))}`);
  check('walk mode: mouse drag turns view', Math.abs(yaw1 - yaw0) > 0.3, `yaw ${yaw0.toFixed(2)} → ${yaw1.toFixed(2)}`);
  // walk collisions: run into a wall for a while, must stay outside colliders and canal
  const col = await page.evaluate(async () => { const j = __jade; const W = j.rig.walk; W.pos.set(-7, 0, -8); W.yaw = W.tYaw = 0; j.rig.keys.add('KeyW'); j.advance(3); j.rig.keys.delete('KeyW'); const p = W.pos.clone(); const inside = j.colliders.some((r) => p.x > r[0] && p.x < r[1] && p.z > r[2] && p.z < r[3]); W.pos.set(10, 0, -6.5); W.yaw = W.tYaw = Math.PI; j.rig.keys.add('KeyW'); j.advance(2.5); j.rig.keys.delete('KeyW'); const q = W.pos.clone(); return { p: p.toArray(), inside, q: q.toArray() }; });
  check('walk mode: house walls block the player', !col.inside && col.p[2] > -10.6, `stopped at ${col.p.map((v) => v.toFixed(2))}`);
  check('walk mode: canal blocks the player (no walking on water)', col.q[2] < -4.9, `stopped at ${col.q.map((v) => v.toFixed(2))}`);
  // bridge accessible: walk over the main bridge
  const br = await page.evaluate(async () => { const j = __jade; const W = j.rig.walk; W.pos.set(0, 0, -7); W.vel.set(0, 0, 0); W.yaw = W.tYaw = Math.PI; let maxY = 0; j.rig.keys.add('KeyW'); for (let i = 0; i < 30; i++) { j.advance(0.15); maxY = Math.max(maxY, W.pos.y); } j.rig.keys.delete('KeyW'); return { z: W.pos.z, maxY }; });
  check('walk mode: bridge is walkable end to end', br.z > 5.5 && br.maxY > 2.5, `reached z=${br.z.toFixed(1)}, max height ${br.maxY.toFixed(2)} m`);
  await page.evaluate(() => { const W = __jade.rig.walk; W.pos.set(-4, 0, -7); W.yaw = W.tYaw = -Math.PI / 2 + 0.25; W.pitch = W.tPitch = 0.02; }); await adv(page, 1.5);
  await shot(page, '15-walk-mode.png');
  await page.click('[data-cam="orbit"]'); await adv(page, 1.8);
  check('orbit mode re-enabled', await page.evaluate(() => __jade.rig.mode === 'orbit' && __jade.rig.orbit.enabled));
  // orbit zoom via wheel
  const od0 = await page.evaluate(() => __jade.camera.position.distanceTo(__jade.rig.orbit.target)); await page.mouse.move(720, 400); await page.mouse.wheel(0, -600); await adv(page, 1.2);
  const od1 = await page.evaluate(() => __jade.camera.position.distanceTo(__jade.rig.orbit.target));
  check('orbit: wheel zooms', od1 < od0 - 1, `${od0.toFixed(1)} → ${od1.toFixed(1)}`);
  await page.mouse.move(720, 400); await page.mouse.down(); await page.mouse.move(820, 380, { steps: 6 }); await page.mouse.up(); await adv(page, 0.5);

  // reset view
  await page.click('#b-reset'); await adv(page, 2.6);
  const rv = await page.evaluate(() => [__jade.camera.position.toArray(), __jade.rig.orbit.target.toArray()]);
  check('reset returns to the start view', Math.hypot(rv[0][0] + 30, rv[0][1] - 24, rv[0][2] - 46) < 1.5, rv[0].map((v) => v.toFixed(1)).join(','));

  // picking: click the bridge and a resident
  await page.evaluate(() => __jade.view([-18, 5, 2], [0, 2.5, 0])); await adv(page, 1.2);
  const scr = await page.evaluate(() => { const v = __jade.P.picks.find((p) => p.name[0] === '玉带桥').anchor.clone(); v.y -= 1.2; v.project(__jade.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; });
  await page.mouse.click(scr[0], scr[1]); await adv(page, 0.6);
  const lbl = await page.evaluate(() => ({ show: document.getElementById('label').classList.contains('show'), text: document.getElementById('label').innerText }));
  check('click on bridge shows its name', lbl.show && /桥/.test(lbl.text), lbl.text.replace(/\n/g, ' / '));
  await shot(page, '16-pick-label.png');
  const npcPick = await page.evaluate(() => { const j = __jade; const r = j.residents.vendors[0]; j.view([r.x + 3, 2.2, r.z + 2.5], [r.x, 1.2, r.z]); return true; });
  await adv(page, 0.8);
  const npcScr = await page.evaluate(() => { const r = __jade.residents.vendors[0]; const v = r.fig.root.position.clone(); v.y += 1.0; v.project(__jade.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; });
  await page.mouse.click(npcScr[0], npcScr[1]); await adv(page, 0.5);
  const lbl2 = await page.evaluate(() => document.getElementById('label').innerText);
  check('click on a resident shows name + activity', /—/.test(lbl2), lbl2.replace(/\n/g, ' / '));

  // ================= v2: koi
  const k0 = await page.evaluate(() => { const K = __jade.koi; return { n: K.fish.length, tris: K.tris, kinds: [...new Set(K.fish.map((f) => f.kind))].length, p: K.fish.map((f) => [f.x, f.z, f.phase]) }; });
  await adv(page, 4);
  const k1 = await page.evaluate(() => { const K = __jade.koi; const G = __jade.L.GARDEN.pond; return { p: K.fish.map((f) => [f.x, f.z, f.phase]), out: K.fish.filter((f) => ((f.x - G.cx) / G.rx) ** 2 + ((f.z - G.cz) / G.rz) ** 2 > 1).length, speed: K.fish.reduce((a, f) => a + f.v, 0) / K.fish.length }; });
  const kMoved = k0.p.filter((a, i) => Math.hypot(k1.p[i][0] - a[0], k1.p[i][1] - a[1]) > 0.15).length;
  const kWave = k0.p.every((a, i) => k1.p[i][2] - a[2] > 4);
  check('v2 koi: detailed fish present', k0.n >= 12 && k0.tris > 1000 && k0.kinds >= 3, `${k0.n} koi, ${k0.tris} tris each, ${k0.kinds} varieties (Kohaku/Showa/Ogon/Sanke)`);
  check('v2 koi: swim (wander/school) and stay in the pond', kMoved >= k0.n - 1 && k1.out === 0, `${kMoved}/${k0.n} moved >0.15 m in 4 s, ${k1.out} outside the pond`);
  check('v2 koi: body undulation phase advances', kWave, 'tail-wave phase advanced on every fish');
  await page.evaluate(() => { __jade.rig.orbit.minDistance = 0.5; __jade.view([-36.2, 1.4, 15.8], [-37.6, -0.45, 13.6]); }); await adv(page, 1.0);
  await shot(page, '25-koi-closeup.png');
  const pondScr = await page.evaluate(() => { const v = new __jade.camera.position.constructor(-37.6, -0.28, 13.6); v.project(__jade.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; });
  await page.mouse.click(pondScr[0], pondScr[1]); await adv(page, 0.5);
  const ks = await page.evaluate(() => ({ pick: __jade.lastPick, boosted: __jade.koi.fish.filter((f) => f.boost > 0.3).length, speed: __jade.koi.fish.reduce((a, f) => a + f.v, 0) / __jade.koi.fish.length, label: document.getElementById('label').innerText }));
  check('v2 koi: click on the pond scatters them', /^koi:/.test(ks.pick || '') && ks.boosted > 0 && ks.speed > k1.speed, `${ks.label.replace(/\n/g, ' / ')} · boosted ${ks.boosted}, mean speed ${k1.speed.toFixed(2)} → ${ks.speed.toFixed(2)} m/s`);
  await page.evaluate(() => { __jade.rig.orbit.minDistance = 2.5; });

  // ================= v2: interiors
  const center = (name) => page.evaluate((name) => { const pk = __jade.P.picks.find((p) => p.name[0] === name && !p.interior); const c = pk.box.getCenter(new __jade.camera.position.constructor()); c.y = 2.2; c.project(__jade.camera); return [(c.x + 1) / 2 * innerWidth, (1 - c.y) / 2 * innerHeight]; }, name);
  await page.evaluate(() => __jade.view([20, 4.2, 2.5], [9, 2.2, -12])); await adv(page, 1.0);
  let sc = await center('茶楼'); await page.mouse.click(sc[0], sc[1]); await adv(page, 0.3);
  const canEnter = await page.evaluate(() => document.getElementById('label').classList.contains('can-enter') && getComputedStyle(document.querySelector('#label .enter')).display !== 'none');
  check('v2: clicking the teahouse offers «Войти внутрь»', canEnter, await page.evaluate(() => document.getElementById('label').innerText.replace(/\n/g, ' / ')));
  await page.click('#label .enter'); await adv(page, 5.0);
  const t1 = await page.evaluate(() => { const j = __jade; return { inside: j.inside, mode: j.rig.mode, cam: j.camera.position.toArray(), door: j.interiors.doorOpen('teahouse'), room: j.interiors.rooms.get('teahouse')?.visible, exitBtn: getComputedStyle(document.getElementById('b-exit')).display }; });
  check('v2: entered the teahouse (walk mode, smooth flight + walk-in)', t1.inside === 'teahouse' && t1.mode === 'walk' && t1.cam[1] > 1.9 && t1.cam[1] < 2.5 && t1.room === true, JSON.stringify(t1));
  check('v2: teahouse doors open, exit button shown', t1.door > 0.5 && t1.exitBtn !== 'none', `door open ${t1.door.toFixed(2)}, exit button ${t1.exitBtn}`);
  await page.evaluate(() => { const W = __jade.rig.walk; W.pos.set(10.6, 0.5, -14.9); W.tYaw = W.yaw = 0.35; W.tPitch = W.pitch = -0.12; }); await adv(page, 1.2);
  await shot(page, '21-interior-teahouse.png');
  // interior collisions: walk into the back wall / counter for 4 s
  const tc = await page.evaluate(() => { const j = __jade; const W = j.rig.walk; W.yaw = W.tYaw = 0; j.rig.keys.add('KeyW'); j.advance(4); j.rig.keys.delete('KeyW'); return { p: W.pos.toArray(), inside: j.inside }; });
  check('v2: walls and furniture block the walker inside', tc.inside === 'teahouse' && tc.p[2] > -19.6, `stopped at ${tc.p.map((v) => v.toFixed(2))}`);
  const cs = await page.evaluate(() => { const W = __jade.rig.walk; W.pos.set(10, 0.5, -16.5); W.yaw = W.tYaw = 0; W.pitch = W.tPitch = -0.15; return true; }); void cs; await adv(page, 0.8);
  const cnt = await page.evaluate(() => { const v = new __jade.camera.position.constructor(10, 1.2, -20.0); v.project(__jade.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; });
  await page.mouse.click(cnt[0], cnt[1]); await adv(page, 0.4);
  const ip = await page.evaluate(() => document.getElementById('label').innerText);
  check('v2: interior objects are pickable', /茶台/.test(ip), ip.replace(/\n/g, ' / '));
  await page.click('#b-exit'); await adv(page, 6.0);
  const t2 = await page.evaluate(() => ({ inside: __jade.inside, p: __jade.rig.walk.pos.toArray() }));
  check('v2: exit button walks back out through the door', t2.inside === null && t2.p[2] > -14.0, JSON.stringify(t2));
  // walk in on foot through the house door (no scripting)
  const hw = await page.evaluate(() => { const j = __jade; const d = j.L.INTERIORS.find((x) => x.id === 'house'); j.rig.placeWalker(d.exit[0], d.exit[1], 0, { dur: 0.2 }); j.advance(0.5); j.rig.keys.add('KeyW'); let door = 0; for (let i = 0; i < 13; i++) { j.advance(0.2); door = Math.max(door, j.interiors.doorOpen('house')); } j.rig.keys.delete('KeyW'); j.advance(0.6); return { inside: j.inside, p: j.rig.walk.pos.toArray(), door }; });
  check('v2: walking through the open house door enters the house', hw.inside === 'house' && hw.door > 0.5, JSON.stringify(hw));
  await page.evaluate(() => { const W = __jade.rig.walk; W.pos.set(24.6, 0.45, -11.4); W.tYaw = W.yaw = 0.42; W.tPitch = W.pitch = -0.1; }); await adv(page, 1.2);
  await shot(page, '22-interior-house.png');
  await page.keyboard.press('KeyX'); await adv(page, 6.0);
  const hx = await page.evaluate(() => ({ inside: __jade.inside, p: __jade.rig.walk.pos.toArray() }));
  check('v2: X key leaves the house', hx.inside === null && hx.p[2] > -10.4, JSON.stringify(hx));
  // noodle kitchen + inn lobby via the API (same code path as the label button)
  await page.evaluate(() => __jade.enter('noodle')); await adv(page, 5.0);
  const nk = await page.evaluate(() => { const j = __jade; const cook = j.residents.vendors.find((v) => v.name[0] === '二厨小李'); return { inside: j.inside, cookY: cook.fig.root.position.y, steam: true }; });
  check('v2: entered the noodle kitchen (cook inside)', nk.inside === 'noodle' && Math.abs(nk.cookY - 0.4) < 0.05, JSON.stringify(nk));
  await page.evaluate(() => { const W = __jade.rig.walk; W.pos.set(-8.4, 0.4, 15.0); W.tYaw = W.yaw = Math.PI - 0.7; W.tPitch = W.pitch = -0.12; }); await adv(page, 1.2);
  await shot(page, '23-interior-noodle-kitchen.png');
  await page.evaluate(() => __jade.exit()); await adv(page, 5.0);
  await page.evaluate(() => __jade.enter('inn')); await adv(page, 5.0);
  const inn = await page.evaluate(() => ({ inside: __jade.inside }));
  check('v2: entered the inn lobby', inn.inside === 'inn', JSON.stringify(inn));
  await page.evaluate(() => { const W = __jade.rig.walk; W.pos.set(12.0, 0.45, 12.2); W.tYaw = W.yaw = Math.PI + 0.45; W.tPitch = W.pitch = -0.08; }); await adv(page, 1.2);
  await shot(page, '24-interior-inn.png');
  await page.click('[data-time="night"]'); await waitDay(page, () => __jade.day.night > 0.99); await adv(page, 1.0);
  await shot(page, '27-interior-inn-night.png');
  await page.evaluate(() => __jade.exit()); await adv(page, 5.0);
  await page.click('[data-time="sunset"]'); await waitDay(page, () => Math.abs(__jade.day.hour - 17.7) < 0.3);
  await page.click('[data-cam="orbit"]'); await page.evaluate(() => __jade.resetView()); await adv(page, 4.0);
  const lz = await page.evaluate(() => ({ built: __jade.interiors.buildCount, visible: [...__jade.interiors.rooms.values()].filter((g) => g.visible).length, doors: __jade.L.INTERIORS.map((d) => +__jade.interiors.doorOpen(d.id).toFixed(2)) }));
  check('v2: interiors built only on demand, hidden again when far, doors closed', lz.built === 4 && lz.visible === 0 && lz.doors.every((v) => v < 0.1), JSON.stringify(lz));
  await page.evaluate(() => __jade.view([30, 3, -7], [23, 3.5, -12])); await adv(page, 1.5);
  const st = await page.evaluate(() => ({ lod: __jade.lod.stats, ...__jade.info() }));
  check('v2: detailed LOD near the camera', st.lod.near > 5 && st.lod.detail > 5, JSON.stringify(st));
  await shot(page, '26-detailed-street.png');

  // hide / show UI
  await page.click('#b-hide'); await page.waitForFunction(() => +getComputedStyle(document.getElementById('bar')).opacity < 0.05, null, { timeout: 15000 }).catch(() => {});
  const hid = await page.evaluate(() => ({ cls: document.body.classList.contains('ui-hidden'), op: getComputedStyle(document.getElementById('bar')).opacity, ghost: getComputedStyle(document.getElementById('ghost')).display }));
  await page.evaluate(() => __jade.view([-40, 30, 50], [0, 2, -8])); await adv(page, 1.2); await shot(page, '17-ui-hidden.png');
  await page.click('#ghost'); await page.waitForFunction(() => getComputedStyle(document.getElementById('bar')).opacity === '1', null, { timeout: 15000 }).catch(() => {});
  const shown = await page.evaluate(() => !document.body.classList.contains('ui-hidden') && getComputedStyle(document.getElementById('bar')).opacity === '1');
  check('hide UI button hides the interface', hid.cls && +hid.op < 0.05 && hid.ghost === 'flex', JSON.stringify(hid));
  check('ghost button brings the UI back', shown);

  // snapshot
  const dl = page.waitForEvent('download'); await page.click('#b-shot'); const d = await dl; const fp = path.join(shots, 'snapshot-from-button.png'); await d.saveAs(fp);
  const buf = fs.readFileSync(fp); const isPng = buf.slice(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  check('snapshot button downloads a PNG', isPng && buf.length > 100000 && d.suggestedFilename().endsWith('.png'), `${d.suggestedFilename()} ${w}×${h} ${(buf.length / 1024).toFixed(0)} KB`);

  // resize
  await page.setViewportSize({ width: 1000, height: 700 }); await page.waitForFunction(() => Math.abs(__jade.camera.aspect - 1000 / 700) < 0.01, null, { timeout: 20000 }).catch(() => {});
  const rs = await page.evaluate(() => ({ w: __jade.renderer.domElement.width, h: __jade.renderer.domElement.height, a: __jade.camera.aspect }));
  check('resize updates canvas & camera', rs.w === Math.round(1000 * (await page.evaluate(() => __jade.renderer.getPixelRatio()))) && Math.abs(rs.a - 1000 / 700) < 0.01, JSON.stringify(rs));
  await page.setViewportSize({ width: 1440, height: 900 }); await adv(page, 0.8);

  // FPS (swiftshader software rendering — not representative of a real GPU)
  await page.evaluate(() => { __jade.resetView(); __jade.manual = false; }); await page.waitForTimeout(15000);
  const fps = await page.evaluate(() => ({ view: 'start overview', fps: __jade.fps, q: __jade.quality, ...__jade.info() }));
  await page.evaluate(() => __jade.view([-16, 4.5, -2.5], [-20, 1.0, -14])); await page.waitForTimeout(12000);
  const fps2 = await page.evaluate(() => ({ view: 'street close-up', fps: __jade.fps, q: __jade.quality, ...__jade.info() }));
  check('desktop FPS street view (SwiftShader CPU renderer)', fps2.fps > 0, JSON.stringify(fps2));
  await page.evaluate(() => { __jade.manual = true; });
  check('desktop FPS measured (SwiftShader CPU renderer)', fps.fps > 0, JSON.stringify(fps));
  // dispose
  const disp = await page.evaluate(() => { const before = __jade.renderer.info.memory.geometries; __jade.dispose(); return { before, after: __jade.renderer.info.memory.geometries, canvas: !!document.querySelector('#app canvas') }; });
  check('dispose frees GPU resources and removes canvas', disp.after < disp.before * 0.1 && !disp.canvas, JSON.stringify(disp));
  check('desktop: no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  await ctx.close();
}

// ================================================================ mobile (iPhone-like)
{
  const { ctx, page, errors } = await open({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  await adv(page, 4.0);
  const m = await page.evaluate(() => ({ pr: __jade.renderer.getPixelRatio(), q: __jade.quality, bar: document.getElementById('bar').getBoundingClientRect().toJSON(), vw: innerWidth }));
  check('mobile: pixel ratio capped', m.pr <= 1.5, `dpr 3 → pixelRatio ${m.pr}, quality ${m.q}`);
  check('mobile: control bar fits the screen', m.bar.left >= 0 && m.bar.right <= m.vw && m.bar.bottom <= 844, JSON.stringify(m.bar));
  await shot(page, '18-mobile-golden-hour.png');
  await page.tap('[data-cam="walk"]'); await adv(page, 1.8);
  const joyVis = await page.evaluate(() => getComputedStyle(document.getElementById('joy')).display);
  const jb = await page.evaluate(() => document.getElementById('joy').getBoundingClientRect().toJSON());
  const j0 = await page.evaluate(() => __jade.rig.walk.pos.toArray());
  // drag the joystick up via pointer events (touch)
  const cx = jb.left + jb.width / 2, cy = jb.top + jb.height / 2;
  await page.evaluate(([cx, cy]) => { const el = document.getElementById('joy'); const ev = (t, x, y) => el.dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true })); ev('pointerdown', cx, cy); ev('pointermove', cx, cy - 50); }, [cx, cy]);
  await adv(page, 2.5);
  await page.evaluate(([cx, cy]) => { const el = document.getElementById('joy'); el.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType: 'touch', clientX: cx, clientY: cy - 50, bubbles: true })); }, [cx, cy]);
  await adv(page, 0.5);
  const j1 = await page.evaluate(() => __jade.rig.walk.pos.toArray());
  check('mobile: joystick visible in walk mode', joyVis === 'block');
  check('mobile: joystick moves the walker', Math.hypot(j1[0] - j0[0], j1[2] - j0[2]) > 1.5, `moved ${Math.hypot(j1[0] - j0[0], j1[2] - j0[2]).toFixed(1)} m`);
  // swipe-look on right side
  const y0 = await page.evaluate(() => __jade.rig.walk.yaw);
  await page.evaluate(() => { const el = __jade.renderer.domElement; const ev = (t, x, y) => el.dispatchEvent(new PointerEvent(t, { pointerId: 9, pointerType: 'touch', clientX: x, clientY: y, bubbles: true })); ev('pointerdown', 300, 300); for (let i = 1; i <= 6; i++) window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 9, pointerType: 'touch', clientX: 300 - i * 15, clientY: 300 })); window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, pointerType: 'touch', clientX: 210, clientY: 300 })); });
  await adv(page, 0.5);
  const y1 = await page.evaluate(() => __jade.rig.walk.yaw);
  check('mobile: swipe turns the view', Math.abs(y1 - y0) > 0.2, `yaw ${y0.toFixed(2)} → ${y1.toFixed(2)}`);
  await shot(page, '19-mobile-walk.png');
  // v2 mobile: tap the teahouse → «Войти» → joystick inside → exit button
  await page.tap('[data-cam="orbit"]'); await page.evaluate(() => __jade.view([20, 5, 4], [9, 2.2, -12])); await adv(page, 1.5);
  const msc = await page.evaluate(() => { const pk = __jade.P.picks.find((p) => p.name[0] === '茶楼' && !p.interior); const c = pk.box.getCenter(new __jade.camera.position.constructor()); c.y = 2.2; c.project(__jade.camera); return [(c.x + 1) / 2 * innerWidth, (1 - c.y) / 2 * innerHeight]; });
  await page.touchscreen.tap(msc[0], msc[1]); await adv(page, 0.3);
  const mCan = await page.evaluate(() => document.getElementById('label').classList.contains('can-enter'));
  if (mCan) await page.tap('#label .enter'); await adv(page, 5.0);
  const mi = await page.evaluate(() => ({ inside: __jade.inside, mode: __jade.rig.mode }));
  check('mobile v2: tap building → «Войти» enters the teahouse', mCan && mi.inside === 'teahouse' && mi.mode === 'walk', JSON.stringify({ mCan, ...mi }));
  const mj = await page.evaluate(() => document.getElementById('joy').getBoundingClientRect().toJSON());
  const mp0 = await page.evaluate(() => __jade.rig.walk.pos.toArray());
  await page.evaluate(([cx, cy]) => { const el = document.getElementById('joy'); const ev = (t, x, y) => el.dispatchEvent(new PointerEvent(t, { pointerId: 8, pointerType: 'touch', clientX: x, clientY: y, bubbles: true })); ev('pointerdown', cx, cy); ev('pointermove', cx + 30, cy - 30); }, [mj.left + mj.width / 2, mj.top + mj.height / 2]);
  await adv(page, 1.5);
  await page.evaluate(([cx, cy]) => { document.getElementById('joy').dispatchEvent(new PointerEvent('pointerup', { pointerId: 8, pointerType: 'touch', clientX: cx, clientY: cy, bubbles: true })); }, [mj.left + mj.width / 2, mj.top + mj.height / 2]);
  await adv(page, 0.5);
  const mp1 = await page.evaluate(() => ({ p: __jade.rig.walk.pos.toArray(), inside: __jade.inside }));
  check('mobile v2: joystick walks inside, walls hold', Math.hypot(mp1.p[0] - mp0[0], mp1.p[2] - mp0[2]) > 0.8 && mp1.inside === 'teahouse', JSON.stringify(mp1));
  await shot(page, '28-mobile-interior.png');
  await page.tap('#b-exit'); await adv(page, 6.0);
  check('mobile v2: exit button leaves the building', (await page.evaluate(() => __jade.inside)) === null);

  await page.tap('[data-cam="orbit"]'); await page.tap('[data-time="night"]'); await waitDay(page, () => __jade.day.night > 0.99); await adv(page, 1.5);
  await shot(page, '20-mobile-night.png');
  await page.evaluate(() => { __jade.manual = false; }); await page.waitForTimeout(12000);
  const mf = await page.evaluate(() => ({ fps: __jade.fps, q: __jade.quality, ...__jade.info() }));
  check('mobile FPS measured (SwiftShader CPU renderer)', mf.fps > 0, JSON.stringify(mf));
  check('mobile v2: rendered triangles below v1 (v1 mobile ≈2.22M at this view)', mf.tris < 2.2e6, `${mf.tris} tris, ${mf.calls} calls, quality ${mf.q}`);
  check('mobile: no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(shots, 'test-results.txt'), `JADE RIVER e2e — ${new Date().toISOString()}\nURL: ${url}\n\n` + results.join('\n') + `\n\n${failed ? failed + ' FAILED' : 'ALL PASSED'}\n`);
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
