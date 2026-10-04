import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4323';
const widths = [320, 375, 414];
const out = {};

const browser = await chromium.launch();
for (const width of widths) {
  for (const blockFonts of [false, true]) {
    const ctx = await browser.newContext({ viewport: { width, height: 800 } });
    if (blockFonts) {
      await ctx.route(/\.woff2?($|\?)|\.ttf($|\?)/, r => r.abort());
    }
    const page = await ctx.newPage();
    await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const report = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const sw = document.documentElement.scrollWidth;
      const offenders = [];
      if (sw > vw) {
        for (const el of document.querySelectorAll('*')) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && (r.right > vw + 1 || r.left < -1)) {
            const cs = getComputedStyle(el);
            offenders.push({
              tag: el.tagName.toLowerCase(),
              cls: (el.className || '').toString().slice(0, 90),
              id: el.id || undefined,
              rect: { l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width) },
              font: cs.fontFamily.slice(0, 60),
              whiteSpace: cs.whiteSpace,
              pos: cs.position + '/' + cs.overflow,
              text: (el.textContent || '').trim().slice(0, 60),
            });
          }
        }
      }
      return { vw, sw, offenderCount: offenders.length, offenders: offenders.slice(0, 40) };
    });
    out[`${width}px fonts=${blockFonts ? 'blocked' : 'loaded'}`] = report;
    await ctx.close();
  }
}
await browser.close();
fs.mkdirSync('test-results', { recursive: true });
fs.writeFileSync('test-results/overflow-diagnostic.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
