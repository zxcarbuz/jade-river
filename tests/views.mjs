// node tests/views.mjs prefix "[[pos],[target],hourPreset]" ...
import { chromium } from 'playwright-core';
const [base, prefix, w = '1440', h = '900', ...views] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
await page.goto(base);
await page.waitForFunction(() => window.__jade && window.__jade.ready, null, { timeout: 120000 });
let i = 0;
for (const v of views) {
  const [p, t, preset] = JSON.parse(v);
  await page.evaluate(([p, t, preset]) => { const j = window.__jade; if (preset) j.setTime(preset); j.view(p, t); }, [p, t, preset]);
  await page.waitForTimeout(preset ? 4500 : 1500);
  await page.screenshot({ path: `${prefix}${i++}.png` });
}
console.log(logs.join('\n'));
console.log(JSON.stringify(await page.evaluate(() => ({ fps: __jade.fps, ...__jade.info() }))));
await browser.close();
