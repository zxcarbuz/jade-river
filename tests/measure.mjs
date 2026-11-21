// Rendered triangles / draw calls per quality tier at fixed views (all passes: main + shadow + reflection)
import { chromium } from 'playwright-core';
const url = process.argv[2] || 'file:///workspace/jade-river/dist/index.html';
const VIEWS = { overview: null, street: [[-16, 4.5, -2.5], [-20, 1.0, -14]], canal: [[-18, 5, 2], [0, 2.5, 0]], garden: [[-30, 6, 4], [-40, 0, 14]] };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const res = {};
for (const q of ['high', 'medium', 'low']) {
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(url + (url.includes('?') ? '&' : '?') + 'q=' + q);
  await p.waitForFunction(() => window.__jade && window.__jade.ready, null, { timeout: 180000 });
  await p.evaluate(() => { __jade.manual = true; });
  res[q] = {};
  for (const [name, v] of Object.entries(VIEWS)) {
    await p.evaluate((v) => { if (v) __jade.view(v[0], v[1]); else __jade.resetView(); }, v);
    await p.evaluate(() => __jade.advance(2.5));
    // two renders so that the reduced-rate shadow pass is included on the second
    const r = await p.evaluate(() => { const a = []; for (let i = 0; i < 3; i++) { __jade.advance(0.04); a.push(__jade.info()); } return a.reduce((m, x) => (x.tris > m.tris ? x : m)); });
    res[q][name] = { tris: r.tris, calls: r.calls };
  }
  if (errs.length) res[q].errors = errs;
  await p.close();
}
console.log(JSON.stringify(res));
await b.close();
