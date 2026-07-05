import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const page1 = await browser.newPage({ colorScheme: 'light' });
  await page1.goto('http://127.0.0.1:5173/');
  await page1.evaluate(() => localStorage.setItem('theme', 'light'));
  await page1.goto('http://127.0.0.1:5173/');
  await page1.waitForTimeout(2000); // Wait for fonts and JS
  await page1.screenshot({ path: 'local_screenshot.png', fullPage: true });

  const page2 = await browser.newPage({ colorScheme: 'light' });
  await page2.goto('https://kpab.github.io/astro-keel/');
  await page2.evaluate(() => localStorage.setItem('theme', 'light'));
  await page2.goto('https://kpab.github.io/astro-keel/');
  await page2.waitForTimeout(2000);
  await page2.screenshot({ path: 'target_screenshot.png', fullPage: true });

  await browser.close();
})();
