// Mobile (iPhone emulation) walk-mode close-ups: node tests/mv.mjs url prefix '{"walk":[x,z,yaw,pitch],"y":?,"preset":?,"js":?}' ...
import { chromium } from 'playwright-core';
const [base, prefix, ...views] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
const page = await ctx.newPage(); const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); }); page.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message));
await page.goto(base); await page.waitForFunction(() => window.__jade?.ready, null, { timeout: 180000 });
await page.evaluate(() => { __jade.manual = true; });
let i = 0; const out = [];
for (const v of views) {
  const V = JSON.parse(v);
  const r = await page.evaluate((V) => { const j = __jade; if (V.preset) j.setTime(V.preset);
    if (V.walk) { const [x, z, yaw, pitch] = V.walk; j.rig.placeWalker(x, z, yaw, { dur: 0.05, y: V.fy ?? 0.6 }); const W = j.rig.walk; W.pitch = W.tPitch = pitch; if (V.y !== undefined) W.pos.y = V.y; }
    if (V.js) eval(V.js); j.advance(V.preset ? 6 : 2.0);
    const W = j.rig.walk; return { pos: W.pos.toArray().map((a) => +a.toFixed(2)), cam: j.camera.position.toArray().map((a) => +a.toFixed(2)), inside: j.inside, level: j.level, feet: +(W.feet ?? 0).toFixed(2), clear: +j.collision.clearance(j.camera.position).toFixed(2), fov: +j.camera.fov.toFixed(1), near: j.camera.near }; }, V);
  await page.screenshot({ path: `${prefix}${i}.png`, timeout: 240000 }); out.push([i++, r]);
}
console.log(JSON.stringify(out)); if (logs.length) console.log('ERRORS', logs);
await browser.close();
