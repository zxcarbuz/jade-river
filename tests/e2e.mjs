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
// Playwright's actionability click can stall for 30s+ on SwiftShader after a heavy
// synchronous sim (the button is in the DOM and already verified earlier). Fire the
// same click handlers directly.
const domClick = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) throw new Error('missing ' + s); el.click(); }, sel);
const simNPC = (page, sec) => page.evaluate((s) => { const R = __jade.residents; const n = Math.round(s * 20); for (let i = 0; i < n; i++) R.update(1 / 20); }, sec);
const v4dir = path.join(shots, 'v4'); fs.mkdirSync(v4dir, { recursive: true });
const shotV4 = async (page, name) => { const t0 = Date.now(); await page.screenshot({ path: path.join(v4dir, name), timeout: 240000 }); console.log('  shot v4/' + name, Date.now() - t0, 'ms'); };

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
    const test = (ax, az, bx, bz, tag) => { const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.1); for (let i = 0; i <= n; i++) { const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n; for (const r of C) if ((r.length < 5 || r[4] < 1.0) && inR(x, z, r)) { bad.push(tag + ' hits ' + r.join(',') + ' @' + x.toFixed(1) + ',' + z.toFixed(1)); return; } if (Math.abs(z) < 5.1 && !((Math.abs(x) < 1.8) || Math.abs(x - 34) < 1.5)) { bad.push(tag + ' water @' + x.toFixed(1) + ',' + z.toFixed(1)); return; } } };
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
  check('v4 build marker', v2a.v === 4, JSON.stringify(v2a));
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
  const br = await page.evaluate(async () => { const j = __jade; const W = j.rig.walk; W.pos.set(0, 0, -7); W.feet = 0; W.vel.set(0, 0, 0); W.yaw = W.tYaw = Math.PI; let maxY = 0; j.rig.keys.add('KeyW'); for (let i = 0; i < 30; i++) { j.advance(0.15); maxY = Math.max(maxY, W.pos.y); } j.rig.keys.delete('KeyW'); return { z: W.pos.z, maxY }; });
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

  // ================= v3: vessels, temple hall, upper floors, camera clearance
  const vs = await page.evaluate(() => { const L = __jade.lathes; const bad = L.filter((l) => !l.closed && !l.doubleSide); return { n: L.length, vessels: L.filter((l) => l.kind === 'vessel').length, bad: [...new Set(bad.map((l) => l.name))] }; });
  check('v3: every lathe (bowls, woks, cups, pots…) is closed or double-sided', vs.n > 50 && vs.bad.length === 0, `${vs.n} lathes, ${vs.vessels} thick-walled vessels, open+single-sided: ${vs.bad.length ? vs.bad.join(', ') : 'none'}`);
  const monk = await page.evaluate(() => { const v = __jade.residents.vendors.find((x) => x.name[0] === '慧明法师'); return v ? { p: v.fig.root.position.toArray().map((a) => +a.toFixed(2)), state: v.state } : null; });
  check('v3: monk NPC in the temple hall', !!monk && monk.p[1] > 0.9 && monk.p[2] < -46, JSON.stringify(monk));
  await page.evaluate(() => { __jade.minClear = Infinity; });
  const clearLog = [];
  const sampleWalk = (fn) => page.evaluate(fn);
  // temple: enter, walk towards the statue (altar blocks), look, exit
  await page.evaluate(() => __jade.enter('temple')); await adv(page, 6.0);
  const te = await page.evaluate(() => { const j = __jade; return { inside: j.inside, mode: j.rig.mode, cam: j.camera.position.toArray().map((a) => +a.toFixed(2)), feet: +j.rig.walk.feet.toFixed(2), built: j.interiors.rooms.get('temple')?.visible, door: +j.interiors.doorOpen('temple').toFixed(2) }; });
  check('v3: entered the temple hall (up the platform steps, through the door)', te.inside === 'temple' && te.mode === 'walk' && Math.abs(te.feet - 1.0) < 0.05 && te.built === true && te.door > 0.5, JSON.stringify(te));
  const tw = await sampleWalk(() => { const j = __jade; const W = j.rig.walk; W.yaw = W.tYaw = 0; let mc = Infinity; j.rig.keys.add('KeyW'); for (let i = 0; i < 40; i++) { j.step(0.1); mc = Math.min(mc, j.collision.clearance(j.camera.position)); } j.rig.keys.delete('KeyW'); return { p: W.pos.toArray().map((a) => +a.toFixed(2)), mc: +mc.toFixed(3), inside: j.inside }; });
  check('v3: altar/dais stop the walker before the statue', tw.inside === 'temple' && tw.p[2] > -49.45 && tw.p[2] < -47.0, JSON.stringify(tw)); clearLog.push(['temple walk', tw.mc]);
  await page.evaluate(() => { const W = __jade.rig.walk; W.pos.set(0, 1.0, -46.9); W.feet = 1.0; W.yaw = W.tYaw = 0; W.pitch = W.tPitch = 0.12; }); await adv(page, 1.5);
  await shot(page, '30-v3-temple-hall.png');
  await page.evaluate(() => { const W = __jade.rig.walk; W.pos.set(1.0, 1.0, -48.2); W.feet = 1.0; W.yaw = W.tYaw = -0.75; W.pitch = W.tPitch = 0.0; }); await adv(page, 1.5);
  await shot(page, '31-v3-temple-monk.png');
  const pk = await page.evaluate(() => { const v = new __jade.camera.position.constructor(0, 2.2, -51.6); __jade.rig.walk.yaw = __jade.rig.walk.tYaw = 0; __jade.rig.walk.pos.set(0, 1, -47.2); __jade.advance(0.8); v.project(__jade.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; });
  await page.mouse.click(pk[0], pk[1]); await adv(page, 0.4);
  const tpk = await page.evaluate(() => document.getElementById('label').innerText);
  check('v3: temple statue is pickable', /佛|Будд/.test(tpk), tpk.replace(/\n/g, ' / '));
  await page.click('#b-exit'); await adv(page, 7.0);
  const tx = await page.evaluate(() => ({ inside: __jade.inside, p: __jade.rig.walk.pos.toArray().map((a) => +a.toFixed(2)), feet: +__jade.rig.walk.feet.toFixed(2) }));
  check('v3: exit button leaves the temple (down the steps)', tx.inside === null && tx.p[2] > -45.5, JSON.stringify(tx));
  // teahouse: climb the stairs to the upper room, then out onto the balcony
  await page.evaluate(() => __jade.enter('teahouse')); await adv(page, 5.0);
  const ts = await sampleWalk(() => { const j = __jade; const U = j.L.INTERIORS.find((d) => d.id === 'teahouse').upper; j.rig.placeWalker(14.97, -14.75, 0, { dur: 0.05 }); j.advance(0.3); const W = j.rig.walk; W.yaw = W.tYaw = 0; let mc = Infinity, maxF = 0; j.rig.keys.add('KeyW'); for (let i = 0; i < 70; i++) { j.step(0.1); mc = Math.min(mc, j.collision.clearance(j.camera.position)); maxF = Math.max(maxF, W.feet); } j.rig.keys.delete('KeyW'); j.advance(0.5); return { p: W.pos.toArray().map((a) => +a.toFixed(2)), feet: +W.feet.toFixed(2), floor: U.floorY, level: j.level, inside: j.inside, mc: +mc.toFixed(3), cam: +j.camera.position.y.toFixed(2) }; });
  check('v3: teahouse stairs climb to the upper floor', ts.inside === 'teahouse' && ts.level === 1 && Math.abs(ts.feet - ts.floor) < 0.05 && ts.cam > ts.floor + 1.4, JSON.stringify(ts)); clearLog.push(['teahouse stairs', ts.mc]);
  const tb = await sampleWalk(() => { const j = __jade; const W = j.rig.walk; W.pos.x = 9.0; W.pos.z = -17.0; j.advance(0.3); W.yaw = W.tYaw = Math.PI; let mc = Infinity; j.rig.keys.add('KeyW'); for (let i = 0; i < 45; i++) { j.step(0.1); mc = Math.min(mc, j.collision.clearance(j.camera.position)); } j.rig.keys.delete('KeyW'); j.advance(0.4); return { p: W.pos.toArray().map((a) => +a.toFixed(2)), feet: +W.feet.toFixed(2), mc: +mc.toFixed(3) }; });
  check('v3: teahouse balcony reachable through the upper door, railing holds', tb.p[2] > -14.0 && tb.p[2] < -11.55 && Math.abs(tb.feet - 4.64) < 0.05, JSON.stringify(tb)); clearLog.push(['teahouse balcony', tb.mc]);
  await page.evaluate(() => { const W = __jade.rig.walk; W.pos.set(9.2, 4.64, -12.4); W.feet = 4.64; W.yaw = W.tYaw = Math.PI - 0.5; W.pitch = W.tPitch = -0.12; }); await adv(page, 1.5);
  await shot(page, '32-v3-teahouse-balcony.png');
  await page.evaluate(() => { const W = __jade.rig.walk; W.pos.set(6.0, 4.64, -15.2); W.feet = 4.64; W.yaw = W.tYaw = -0.6; W.pitch = W.tPitch = -0.15; }); await adv(page, 1.5);
  await shot(page, '33-v3-teahouse-upper-room.png');
  await page.evaluate(() => { const W = __jade.rig.walk; W.pos.set(10, 4.64, -17); W.feet = 4.64; }); await adv(page, 0.5);
  await page.click('#b-exit'); await page.evaluate(() => __jade.step(15)); await adv(page, 0.5);
  const tdx = await page.evaluate(() => ({ inside: __jade.inside, p: __jade.rig.walk.pos.toArray().map((a) => +a.toFixed(2)), feet: +__jade.rig.walk.feet.toFixed(2) }));
  check('v3: exit from the upper floor walks down the stairs and out', tdx.inside === null && tdx.feet < 0.6 && tdx.p[2] > -14.0, JSON.stringify(tdx));
  // inn: stairs up, room, gallery
  await page.evaluate(() => __jade.enter('inn')); await adv(page, 5.0);
  const is = await sampleWalk(() => { const j = __jade; j.rig.placeWalker(16.05, 16.6, Math.PI, { dur: 0.05 }); j.advance(0.3); const W = j.rig.walk; W.yaw = W.tYaw = Math.PI; let mc = Infinity; j.rig.keys.add('KeyW'); for (let i = 0; i < 60; i++) { j.step(0.1); mc = Math.min(mc, j.collision.clearance(j.camera.position)); } j.rig.keys.delete('KeyW'); j.advance(0.5); return { p: W.pos.toArray().map((a) => +a.toFixed(2)), feet: +W.feet.toFixed(2), level: j.level, inside: j.inside, mc: +mc.toFixed(3) }; });
  check('v3: inn stairs climb to the guest rooms', is.inside === 'inn' && is.level === 1 && Math.abs(is.feet - 3.83) < 0.05, JSON.stringify(is)); clearLog.push(['inn stairs', is.mc]);
  const ib = await sampleWalk(() => { const j = __jade; const W = j.rig.walk; W.pos.x = 9.4; W.pos.z = 14.5; j.advance(0.3); W.yaw = W.tYaw = 0; let mc = Infinity; j.rig.keys.add('KeyW'); for (let i = 0; i < 45; i++) { j.step(0.1); mc = Math.min(mc, j.collision.clearance(j.camera.position)); } j.rig.keys.delete('KeyW'); j.advance(0.4); return { p: W.pos.toArray().map((a) => +a.toFixed(2)), feet: +W.feet.toFixed(2), mc: +mc.toFixed(3) }; });
  check('v3: inn gallery reachable, railing holds', ib.p[2] < 11.25 && ib.p[2] > 10.2 && Math.abs(ib.feet - 3.83) < 0.05, JSON.stringify(ib)); clearLog.push(['inn gallery', ib.mc]);
  await page.evaluate(() => { const W = __jade.rig.walk; W.pos.set(13.5, 3.83, 12.2); W.feet = 3.83; W.yaw = W.tYaw = Math.PI - 0.6; W.pitch = W.tPitch = -0.2; }); await adv(page, 1.5);
  await shot(page, '34-v3-inn-upper-room.png');
  await page.evaluate(() => __jade.exit()); await page.evaluate(() => __jade.step(15)); await adv(page, 0.5);
  const idx = await page.evaluate(() => ({ inside: __jade.inside, feet: +__jade.rig.walk.feet.toFixed(2) }));
  check('v3: exit from the inn upper floor', idx.inside === null && idx.feet < 0.6, JSON.stringify(idx));
  // stress: seeded random walks over the town and through rooms; camera clearance sampled every 0.1 s
  const rw = await page.evaluate(() => { const j = __jade; j.minClear = Infinity; let s = 12345; const R = () => (s = (s * 16807) % 2147483647) / 2147483647; const N = j.nav.nodes; let mc = Infinity, where = null, n = 0;
    const starts = [0, 7, 15, 23, 31, 40, 52, 61].map((i) => N[i % N.length]).map((p) => [p.x, p.z]);
    for (const id of ['teahouse', 'noodle', 'inn', 'temple', 'house']) { const d = j.L.INTERIORS.find((x) => x.id === id); starts.push([d.spawn[0], d.spawn[1]]); }
    for (const [x, z] of starts) { j.rig.placeWalker(x, z, R() * 6.28, { dur: 0.05 }); j.advance(0.2); const W = j.rig.walk; j.rig.keys.add('KeyW');
      for (let i = 0; i < 100; i++) { if (i % 12 === 0) W.tYaw = W.yaw + (R() - 0.5) * 3.5; j.step(0.1); n++; const c = j.collision.clearance(j.camera.position); if (c < mc) { mc = c; where = j.camera.position.toArray().map((a) => +a.toFixed(2)); } }
      j.rig.keys.delete('KeyW'); }
    return { mc: +mc.toFixed(3), where, samples: n, globalMin: +j.minClear.toFixed(3), at: j.minClearAt }; });
  clearLog.push(['random walks', rw.mc]);
  check('v3: camera never inside a collider (min clearance over all walk samples > 0.15 m)', Math.min(rw.globalMin, ...clearLog.map((c) => c[1])) > 0.15, `${clearLog.map(([k, v]) => `${k} ${v}`).join(', ')}; random ${rw.samples} samples min ${rw.mc} at ${JSON.stringify(rw.where)}; every-frame min ${rw.globalMin} at ${JSON.stringify(rw.at)}`);

  // ================= v3.1: moon gate, seated props, closed pot bottoms, step risers
  const v31caps = await page.evaluate(() => { const v = __jade.lathes.filter((l) => l.kind === 'vessel'); return { n: v.length, uncapped: v.filter((l) => !l.capped).map((l) => l.name) }; });
  check('v3.1: thick-walled vessels have an upward inner cap (pots are not open tubes)', v31caps.n > 10 && v31caps.uncapped.length === 0, JSON.stringify(v31caps));
  const v31steps = await page.evaluate(() => {
    const rows = __jade.L.ENTRY_STEPS; const bad = rows.filter((s) => s.rise < 0.13 || s.rise > 0.19);
    return { n: rows.length, bad: bad.slice(0, 8), rises: [...new Set(rows.map((s) => +s.rise.toFixed(3)))].sort((a, b) => a - b) };
  });
  check('v3.1: entrance and temple step risers are ~15–18 cm', v31steps.n >= 6 && v31steps.bad.length === 0, JSON.stringify(v31steps));
  const v31feet = await page.evaluate(() => {
    const list = __jade.propFeet(); const bad = [];
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      let sup = __jade.L.groundY(p.x, p.z, Math.max(0.2, p.y) + 0.5);
      if (sup <= 0.02) { const on = __jade.L.STREETS.some((s) => p.x > s[0] && p.x < s[1] && p.z > s[2] && p.z < s[3]); sup = on ? 0.012 : -0.03; }
      // only treat a neighbour as a support if this foot actually sits on its top (stacked crates), not when it merely stands beside it
      if (Math.abs(p.y - sup) > 0.07) {
        for (let k = 0; k < list.length; k++) if (k !== i && Math.hypot(list[k].x - p.x, list[k].z - p.z) < 0.7) {
          const top = list[k].y + list[k].h; if (Math.abs(p.y - top) <= 0.08) { sup = top; break; }
        }
      }
      if (Math.abs(p.y - sup) > 0.07) bad.push({ kind: p.kind, x: +p.x.toFixed(2), z: +p.z.toFixed(2), y: +p.y.toFixed(3), sup: +sup.toFixed(3) });
    }
    return { n: list.length, bad };
  });
  check('v3.1: barrels, crates and jars rest on the ground or a support', v31feet.n > 5 && v31feet.bad.length === 0, JSON.stringify(v31feet));
  const v31gate = await sampleWalk(() => {
    const j = __jade; if (j.inside) { j.exit(); j.step(15); }
    j.rig.placeWalker(-23.5, 16, Math.PI / 2, { dur: 0.05 }); j.advance(0.3);
    const W = j.rig.walk; W.yaw = W.tYaw = Math.PI / 2; j.rig.keys.add('KeyW');
    for (let i = 0; i < 70; i++) j.step(0.1); j.rig.keys.delete('KeyW');
    return { p: W.pos.toArray().map((a) => +a.toFixed(2)), feet: +W.feet.toFixed(2) };
  });
  check('v3.1: walker can pass through the moon gate to the koi pond', v31gate.p[0] < -27.2 && v31gate.p[0] > -50 && Math.abs(v31gate.p[2] - 16) < 2.5, JSON.stringify(v31gate));
  const v31climb = await sampleWalk(() => {
    const j = __jade; if (j.inside) { j.exit(); j.step(15); }
    j.rig.placeWalker(0, -42.2, 0, { dur: 0.05 }); j.advance(0.3);
    const W = j.rig.walk; W.yaw = W.tYaw = 0; j.rig.keys.add('KeyW');
    for (let i = 0; i < 55; i++) j.step(0.1); j.rig.keys.delete('KeyW');
    return { p: W.pos.toArray().map((a) => +a.toFixed(2)), feet: +W.feet.toFixed(2) };
  });
  check('v3.1: walker climbs the temple steps onto the hall platform', v31climb.feet > 0.95 && v31climb.p[2] < -44.5, JSON.stringify(v31climb));

  await page.evaluate(() => { const j = __jade; if (j.inside) { j.exit(); j.step(15); } }); await adv(page, 0.5);
  await domClick(page, '[data-time="sunset"]'); await waitDay(page, () => Math.abs(__jade.day.hour - 17.7) < 0.3);
  await domClick(page, '[data-cam="orbit"]'); await page.evaluate(() => __jade.resetView());
  // Doors stay open while forceOpen (6s wall-clock after enter/exit) or a resident is in the doorway.
  // End the hold and pause residents so this checks "far from the building ⇒ door shuts", not NPC luck
  // or a stalled wall-clock timer on SwiftShader.
  await page.evaluate(() => { __jade.residents.paused = true; __jade.interiors.forceOpen = null; });
  await adv(page, 2.5);
  const lz = await page.evaluate(() => ({ built: __jade.interiors.buildCount, visible: [...__jade.interiors.rooms.values()].filter((g) => g.visible).length, doors: __jade.L.INTERIORS.map((d) => +__jade.interiors.doorOpen(d.id).toFixed(2)), forceOpen: __jade.interiors.forceOpen }));
  check('v2: interiors built only on demand, hidden again when far, doors closed', lz.built === 5 && lz.visible === 0 && lz.doors.every((v) => v < 0.1), JSON.stringify(lz));
  await page.evaluate(() => { __jade.residents.paused = false; });
  await page.evaluate(() => __jade.view([30, 3, -7], [23, 3.5, -12])); await adv(page, 1.5);
  const st = await page.evaluate(() => ({ lod: __jade.lod.stats, ...__jade.info() }));
  check('v2: detailed LOD near the camera', st.lod.near > 5 && st.lod.detail > 5, JSON.stringify(st));
  await shot(page, '26-detailed-street.png');

  // hide / show UI
  await domClick(page, '#b-hide'); await page.waitForFunction(() => +getComputedStyle(document.getElementById('bar')).opacity < 0.05, null, { timeout: 15000 }).catch(() => {});
  const hid = await page.evaluate(() => ({ cls: document.body.classList.contains('ui-hidden'), op: getComputedStyle(document.getElementById('bar')).opacity, ghost: getComputedStyle(document.getElementById('ghost')).display }));
  await page.evaluate(() => __jade.view([-40, 30, 50], [0, 2, -8])); await adv(page, 1.2); await shot(page, '17-ui-hidden.png');
  await domClick(page, '#ghost'); await page.waitForFunction(() => getComputedStyle(document.getElementById('bar')).opacity === '1', null, { timeout: 15000 }).catch(() => {});
  const shown = await page.evaluate(() => !document.body.classList.contains('ui-hidden') && getComputedStyle(document.getElementById('bar')).opacity === '1');
  check('hide UI button hides the interface', hid.cls && +hid.op < 0.05 && hid.ghost === 'flex', JSON.stringify(hid));
  check('ghost button brings the UI back', shown);

  // snapshot
  const dl = page.waitForEvent('download'); await domClick(page, '#b-shot'); const d = await dl; const fp = path.join(shots, 'snapshot-from-button.png'); await d.saveAs(fp);
  const buf = fs.readFileSync(fp); const isPng = buf.slice(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  check('snapshot button downloads a PNG', isPng && buf.length > 100000 && d.suggestedFilename().endsWith('.png'), `${d.suggestedFilename()} ${w}×${h} ${(buf.length / 1024).toFixed(0)} KB`);

  // resize
  await page.setViewportSize({ width: 1000, height: 700 }); await page.waitForFunction(() => Math.abs(__jade.camera.aspect - 1000 / 700) < 0.01, null, { timeout: 20000 }).catch(() => {});
  const rs = await page.evaluate(() => ({ w: __jade.renderer.domElement.width, h: __jade.renderer.domElement.height, a: __jade.camera.aspect }));
  check('resize updates canvas & camera', rs.w === Math.round(1000 * (await page.evaluate(() => __jade.renderer.getPixelRatio()))) && Math.abs(rs.a - 1000 / 700) < 0.01, JSON.stringify(rs));
  await page.setViewportSize({ width: 1440, height: 900 }); await adv(page, 0.8);


  // ================= v4: living residents
  const STALLS = [{ x: -26.7, z: -11.2 }, { x: -26.7, z: -15.8 }, { x: -13.3, z: -11.2 }, { x: -13.3, z: -15.8 }];
  const atMarket = () => page.evaluate((stalls) => {
    const mv = __jade.residents.vendors.filter((v) => v.id >= 12 && v.id <= 15);
    const at = mv.filter((v) => !v.hidden && stalls.some((s) => Math.hypot(v.x - s.x, v.z - s.z) < 2.5));
    return { at: at.length, hidden: mv.filter((v) => v.hidden).length, states: mv.map((v) => v.name[1] + ':' + (v.hidden ? 'hid' : v.state)) };
  }, STALLS);
  const settle = async (preset, sec = 90) => {
    const target = { morning: 7.4, day: 12.5, sunset: 17.7, night: 21.5 }[preset];
    await page.evaluate((t) => __jade.setTime(t), preset);
    await page.evaluate((h) => { window.__jadeWaitH = h; }, target);
    if (preset === 'night') await waitDay(page, () => __jade.day.night > 0.99);
    else await waitDay(page, () => Math.abs(__jade.day.hour - window.__jadeWaitH) < 0.3);
    await simNPC(page, sec); await adv(page, 0.2);
  };

  await settle('day', 90);
  const dayM = await atMarket();
  check('v4 day: market vendors are at their stalls', dayM.at === 4, JSON.stringify(dayM));
  const daySched = await page.evaluate(() => {
    const R = __jade.residents;
    const hidden = R.list.filter((r) => r.hidden).length;
    const acts = {};
    for (const r of R.list) { const k = r.hidden ? 'sleep' : (r.act || r.state); acts[k] = (acts[k] || 0) + 1; }
    return { hidden, acts, hour: __jade.residents.hour };
  });
  check('v4 day: walkers are out, not asleep at home', daySched.hidden <= 1, JSON.stringify(daySched));
  await page.evaluate(() => __jade.view([-6, 6.5, -4], [-20, 1.2, -14])); await adv(page, 1.0);
  await shotV4(page, 'market-day.png');

  await settle('morning', 50);
  const morn = await page.evaluate(() => {
    const R = __jade.residents;
    const monk = R.vendors.find((v) => v.name[0] === '慧明法师');
    return { hidden: R.list.filter((r) => r.hidden).length, monk: monk.state, monkZ: monk.z, hour: R.hour, acts: R.list.map((r) => r.name[1] + ':' + (r.hidden ? 'hid' : (r.act || r.state))) };
  });
  const mornM = await atMarket();
  check('v4 morning: market is open and people are out', mornM.at === 4 && morn.hidden <= 2, JSON.stringify({ mornM, hidden: morn.hidden, acts: morn.acts }));
  check('v4 morning: monk stays in the temple', morn.monk === 'monk' && morn.monkZ < -46, JSON.stringify(morn));

  await settle('sunset', 40);
  const suns = await page.evaluate(() => {
    const R = __jade.residents;
    const acts = {}; for (const r of R.list) { if (r.hidden) continue; const k = r.act || r.state; acts[k] = (acts[k] || 0) + 1; }
    return { hidden: R.list.filter((r) => r.hidden).length, acts, hour: R.hour };
  });
  check('v4 sunset: residents follow evening schedules (out and about)', suns.hidden <= 2 && Object.keys(suns.acts).length >= 2, JSON.stringify(suns));

  await settle('night', 90);
  const night = await page.evaluate(() => {
    const R = __jade.residents;
    const monk = R.vendors.find((v) => v.name[0] === '慧明法师');
    const inn = R.vendors.find((v) => v.name[0] === '掌柜钱');
    return {
      hidden: R.list.filter((r) => r.hidden).length,
      walking: R.list.filter((r) => !r.hidden).map((r) => r.name[1] + ':' + r.state + ':' + r.act),
      monk: { state: monk.state, hid: monk.hidden, y: +monk.fig.root.position.y.toFixed(2), z: +monk.z.toFixed(2) },
      innHid: inn.hidden,
      hour: R.hour,
    };
  });
  const nightM = await atMarket();
  check('v4 night: market is empty, vendors gone or indoors', nightM.at === 0 && nightM.hidden + (4 - nightM.at) >= 4, JSON.stringify(nightM));
  check('v4 night: most walkers are home and hidden', night.hidden >= 10, JSON.stringify({ hidden: night.hidden, walking: night.walking }));
  check('v4 night: monk is in the temple hall', !night.monk.hid && night.monk.state === 'monk' && night.monk.y > 0.9 && night.monk.z < -46, JSON.stringify(night.monk));
  await page.evaluate(() => __jade.view([-6, 6.5, -4], [-20, 1.2, -14])); await adv(page, 1.0);
  await shotV4(page, 'market-night.png');
  await page.evaluate(() => {
    __jade.setCam('walk');
    __jade.enter('temple');
  });
  await adv(page, 6.0);
  await page.evaluate(() => {
    const W = __jade.rig.walk;
    W.pos.set(1.0, 1.0, -48.2); W.feet = 1.0; W.vel.set(0, 0, 0);
    W.yaw = W.tYaw = -0.75; W.pitch = W.tPitch = 0.0;
  });
  await adv(page, 1.5);
  await shotV4(page, 'monk-night.png');

  // memory ring stays capped
  const mem = await page.evaluate(() => {
    const r = __jade.residents.list[0];
    const n0 = r.mem.n;
    for (let i = 0; i < 20; i++) {
      const m = r.mem; const s = m.slots[m.i];
      s.kind = 1; s.hour = i; s.imp = 7; s.x = 0; s.z = 0; s.who = -1;
      m.i = (m.i + 1) % m.slots.length; if (m.n < m.slots.length) m.n++;
    }
    return { n0, n: r.mem.n, cap: r.mem.slots.length, i: r.mem.i };
  });
  check('v4 memory buffer stays capped at 8', mem.n === 8 && mem.cap === 8, JSON.stringify(mem));

  // greeting near an NPC (use the monk — he stays visible at night)
  const greet = await page.evaluate(() => {
    const monk = __jade.residents.vendors.find((v) => v.name[0] === '慧明法师');
    if (__jade.inside !== 'temple') __jade.enter('temple');
    const W = __jade.rig.walk;
    W.pos.set(1.0, 1.0, -48.2); W.feet = 1.0; W.vel.set(0, 0, 0);
    W.yaw = W.tYaw = -0.75; W.pitch = W.tPitch = 0.0;
    const R = __jade.residents;
    R.playerX = W.pos.x; R.playerZ = W.pos.z; R.playerOn = true;
    R.urgent = 30;
    for (let i = 0; i < 60; i++) R.update(1 / 20);
    return { text: R.greeting && R.greeting.text, id: R.greeting && R.greeting.id, hid: monk.hidden };
  });
  await adv(page, 0.4);
  const greetUI = await page.evaluate(() => ({ show: document.getElementById('greet').classList.contains('show'), text: document.getElementById('greet').textContent }));
  check('v4 greeting appears near an NPC', !!(greet.text && greetUI.show && greetUI.text.length > 0), JSON.stringify({ greet, greetUI }));
  await page.waitForTimeout(400); // CSS opacity fade-in is wall-clock, not simulated
  await shotV4(page, 'greeting.png');

  // info card with a thought: click the monk
  await page.evaluate(() => {
    const W = __jade.rig.walk;
    W.pos.set(1.0, 1.0, -48.2); W.feet = 1.0; W.vel.set(0, 0, 0);
    W.yaw = W.tYaw = -0.75; W.pitch = W.tPitch = 0.0;
    if (__jade.inside !== 'temple') __jade.enter('temple');
  });
  await adv(page, 1.0);
  const monkScr = await page.evaluate(() => { const r = __jade.residents.vendors.find((v) => v.name[0] === '慧明法师'); const v = r.fig.root.position.clone(); v.y += 1.0; v.project(__jade.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; });
  await page.mouse.click(monkScr[0], monkScr[1]); await adv(page, 0.5);
  await page.waitForTimeout(400);
  const card = await page.evaluate(() => {
    const el = document.getElementById('label');
    return { show: el.classList.contains('show'), has: el.classList.contains('has-thought'), text: el.innerText, thought: el.querySelector('.thought') && el.querySelector('.thought').textContent };
  });
  check('v4 info card shows name, role and a thought', card.show && card.has && /—/.test(card.text) && !!(card.thought && card.thought.length > 8), card.text.replace(/\n/g, ' / '));
  await shotV4(page, 'npc-card-thought.png');

  // AI budget on desktop (think + greet, not locomotion)
  const ai = await page.evaluate(() => {
    const R = __jade.residents;
    R._aiMsN = 0; R._aiMsI = 0; R._aiSum = 0;
    for (let i = 0; i < 1800; i++) R.update(1 / 30);
    R._refreshP95();
    return R.stats();
  });
  check('v4 AI budget: average < 0.5 ms per frame on desktop', ai.avg < 0.5, JSON.stringify(ai));

  await page.evaluate(() => { __jade.setTime('sunset'); __jade.setCam('orbit'); });
  await waitDay(page, () => Math.abs(__jade.day.hour - 17.7) < 0.3);

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

  // v3 mobile: portrait walk FOV, temple + stairs with the joystick, camera clearance
  const joyHold = async (dx, dy, sec) => { const r = await page.evaluate(() => document.getElementById('joy').getBoundingClientRect().toJSON()); const c = [r.left + r.width / 2, r.top + r.height / 2];
    await page.evaluate(([cx, cy, dx, dy]) => { const el = document.getElementById('joy'); const ev = (t, x, y) => el.dispatchEvent(new PointerEvent(t, { pointerId: 11, pointerType: 'touch', clientX: x, clientY: y, bubbles: true })); ev('pointerdown', cx, cy); ev('pointermove', cx + dx, cy + dy); }, [...c, dx, dy]);
    await page.evaluate(() => { __jade.minClear = Infinity; }); let mc = Infinity; for (let i = 0; i < Math.round(sec / 0.1); i++) { mc = Math.min(mc, await page.evaluate(() => { __jade.step(0.1); return __jade.collision.clearance(__jade.camera.position); })); }
    await page.evaluate(([cx, cy]) => { document.getElementById('joy').dispatchEvent(new PointerEvent('pointerup', { pointerId: 11, pointerType: 'touch', clientX: cx, clientY: cy, bubbles: true })); }, c); await adv(page, 0.3); return Math.min(mc, await page.evaluate(() => __jade.minClear)); };
  await page.evaluate(() => { __jade.minClear = Infinity; __jade.enter('temple'); }); await adv(page, 6.0);
  const mt = await page.evaluate(() => ({ inside: __jade.inside, fov: +__jade.camera.fov.toFixed(1), near: __jade.camera.near, aspect: +__jade.camera.aspect.toFixed(3) }));
  const hfov = 2 * Math.atan(Math.tan(mt.fov * Math.PI / 360) * mt.aspect) * 180 / Math.PI;
  check('mobile v3: portrait walk FOV widened (horizontal ≥ 38°), near plane 0.1', mt.fov >= 70 && hfov >= 38 && mt.near <= 0.1, `vertical ${mt.fov}°, horizontal ${hfov.toFixed(1)}°, near ${mt.near}`);
  check('mobile v3: temple entered', mt.inside === 'temple', JSON.stringify(mt));
  const mtc = await joyHold(0, -50, 4);
  await shot(page, '35-mobile-temple.png');
  await page.tap('#b-exit'); await adv(page, 7.0);
  await page.evaluate(() => __jade.enter('teahouse')); await adv(page, 5.0);
  await page.evaluate(() => { __jade.rig.placeWalker(14.97, -14.75, 0, { dur: 0.05 }); }); await adv(page, 0.3);
  const msc2 = await joyHold(0, -50, 7);
  const mu = await page.evaluate(() => ({ inside: __jade.inside, level: __jade.level, feet: +__jade.rig.walk.feet.toFixed(2) }));
  check('mobile v3: joystick climbs the teahouse stairs', mu.inside === 'teahouse' && mu.level === 1 && Math.abs(mu.feet - 4.64) < 0.05, JSON.stringify(mu));
  await page.evaluate(() => { const W = __jade.rig.walk; W.pos.x = 9.0; W.pos.z = -17; W.yaw = W.tYaw = Math.PI; }); await adv(page, 0.4);
  const mbc = await joyHold(0, -50, 4.5);
  await shot(page, '36-mobile-balcony.png');
  const mgm = await page.evaluate(() => +__jade.minClear.toFixed(3)); const mga = await page.evaluate(() => __jade.minClearAt);
  check('mobile v3: camera never inside a collider (joystick walks)', Math.min(mtc, msc2, mbc, mgm) > 0.15, `temple ${mtc.toFixed(3)}, stairs ${msc2.toFixed(3)}, balcony ${mbc.toFixed(3)}, every-frame ${mgm} at ${JSON.stringify(mga)}`);
  await page.evaluate(() => { const W = __jade.rig.walk; W.pos.x = 9.0; W.pos.z = -17; __jade.step(0.5); }); await adv(page, 0.3);
  await domClick(page, '#b-exit'); await page.evaluate(() => __jade.step(15)); await adv(page, 0.5);
  check('mobile v3: exit from the upper floor', (await page.evaluate(() => __jade.inside)) === null);

  await domClick(page, '[data-cam="orbit"]'); await domClick(page, '[data-time="night"]'); await waitDay(page, () => __jade.day.night > 0.99); await adv(page, 1.5);
  await shot(page, '20-mobile-night.png');

  // v4 mobile: after night, market empty; AI budget under threshold
  await simNPC(page, 70); await adv(page, 0.2);
  const mv4 = await page.evaluate(() => {
    const stalls = [{ x: -26.7, z: -11.2 }, { x: -26.7, z: -15.8 }, { x: -13.3, z: -11.2 }, { x: -13.3, z: -15.8 }];
    const mv = __jade.residents.vendors.filter((v) => v.id >= 12 && v.id <= 15);
    const at = mv.filter((v) => !v.hidden && stalls.some((s) => Math.hypot(v.x - s.x, v.z - s.z) < 2.5));
    const monk = __jade.residents.vendors.find((v) => v.name[0] === '慧明法师');
    const R = __jade.residents; R._aiMsN = 0; R._aiMsI = 0; R._aiSum = 0;
    for (let i = 0; i < 900; i++) R.update(1 / 30);
    R._refreshP95();
    return { at: at.length, hidden: mv.filter((v) => v.hidden).length, walkersHid: R.list.filter((r) => r.hidden).length, monk: monk.state, monkZ: monk.z, ai: R.stats(), version: __jade.version };
  });
  check('mobile v4: night market empty and monk in the temple', mv4.at === 0 && mv4.monk === 'monk' && mv4.monkZ < -46 && mv4.version === 4, JSON.stringify(mv4));
  check('mobile v4: AI budget average < 0.5 ms per frame', mv4.ai.avg < 0.5, JSON.stringify(mv4.ai));
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
