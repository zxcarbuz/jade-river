// quick screenshot helper: node tests/shot.mjs url out.png [w h] [js-to-eval-before]
import { chromium } from 'playwright-core';
const [url, out, w = 1440, h = 900, pre = '', wait = '4000'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
await page.goto(url);
await page.waitForFunction(() => window.__jade && window.__jade.ready, null, { timeout: 120000 }).catch((e) => logs.push('not ready ' + e.message));
if (pre) await page.evaluate(pre);
await page.waitForTimeout(+wait);
await page.screenshot({ path: out });
console.log(logs.join('\n'));
await browser.close();
