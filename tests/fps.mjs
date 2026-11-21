import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
for (const [w,h,q] of [[1440,900,'high'],[1440,900,'low']]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto('file:///workspace/jade-river/dist/index.html?q=' + q);
  await p.waitForFunction(() => window.__jade && window.__jade.ready, null, { timeout: 180000 });
  for (const [name, pos, tgt] of [['start overview', null], ['street', [-16,4.5,-2.5], [-20,1,-14]]]) {
    await p.evaluate(([a,c]) => a ? __jade.view(a,c) : __jade.resetView(), [pos, tgt]);
    await p.waitForTimeout(15000);
    const r = await p.evaluate(() => { const t0 = performance.now(); return new Promise(res => { let n = 0; const f = () => { n++; if (performance.now() - t0 < 8000) requestAnimationFrame(f); else res({ fps: +(n / ((performance.now() - t0) / 1000)).toFixed(2), app: __jade.fps, ...__jade.info() }); }; requestAnimationFrame(f); }); });
    console.log(w + 'x' + h, q, name, JSON.stringify(r));
  }
  await p.close();
}
await b.close();
