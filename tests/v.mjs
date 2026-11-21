// deterministic views: node tests/v.mjs url prefix w h '[[pos],[target],preset?,js?]' ...
import { chromium } from 'playwright-core';
const [base, prefix, w = '1440', h = '900', ...views] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
await page.goto(base);
await page.waitForFunction(() => window.__jade && window.__jade.ready, null, { timeout: 120000 });
await page.evaluate(() => { __jade.manual = true; });
let i = 0;
for (const v of views) {
  const [p, t, preset, js] = JSON.parse(v);
  await page.evaluate(([p, t, preset, js]) => { const j = window.__jade; if (preset) j.setTime(preset); if (p) j.view(p, t); if (js) eval(js); }, [p, t, preset, js]);
  await page.evaluate((s) => __jade.advance(s), preset ? 6 : 1.5);
  await page.screenshot({ path: `${prefix}${i++}.png`, timeout: 240000 });
}
console.log(logs.join('\n'));
console.log(JSON.stringify(await page.evaluate(() => ({ ...__jade.info(), lod: __jade.lod?.stats }))));
await browser.close();
