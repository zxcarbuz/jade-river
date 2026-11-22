// Measure NPC update / AI cost. usage: node tests/ai-perf.mjs [url]
import { chromium } from 'playwright-core';
const url = process.argv[2] || 'file:///workspace/jade-river/dist/index.html?q=high';
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto(url, { timeout: 180000 });
await p.waitForFunction(() => window.__jade && window.__jade.ready, { timeout: 180000 });
await p.evaluate(() => { __jade.manual = true; });
const r = await p.evaluate(() => {
  const R = __jade.residents;
  const N = 1800;
  const samples = new Float64Array(N);
  if (R._aiMsN !== undefined) { R._aiMsN = 0; R._aiMsI = 0; R._aiSum = 0; }
  for (let i = 0; i < N; i++) {
    const t0 = performance.now();
    R.update(1 / 30);
    samples[i] = performance.now() - t0;
  }
  const arr = Array.from(samples).sort((a, b) => a - b);
  const sum = arr.reduce((a, b) => a + b, 0);
  if (R._refreshP95) R._refreshP95();
  return {
    version: __jade.version,
    update: { n: N, avg: sum / N, p50: arr[Math.floor(N * 0.5)], p95: arr[Math.floor(N * 0.95)], max: arr[N - 1] },
    ai: R.stats ? R.stats() : null,
  };
});
console.log(JSON.stringify(r, null, 2));
await b.close();
