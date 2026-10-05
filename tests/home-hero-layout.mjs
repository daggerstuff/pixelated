import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { chromium } from '@playwright/test'

const source = await readFile('apps/web/src/pages/index.astro', 'utf8')
const workstation = await readFile(
  'apps/web/src/components/landing/SimulationWorkstation.astro',
  'utf8',
)
const font = await readFile('apps/web/src/assets/fonts/monocraft/Monocraft.ttf')
const css = (
  await readFile('apps/web/src/styles/np-landing.css', 'utf8')
).replace(
  '../assets/fonts/monocraft/Monocraft.ttf',
  `data:font/ttf;base64,${font.toString('base64')}`,
)
const hero = source
  .slice(source.indexOf('<section'), source.indexOf('</section>') + 10)
  .replace(
    '<SimulationWorkstation />',
    workstation.split('---')[2].split('<script>')[0],
  )
  .replace(/href=\{withBasePath\('([^']+)'\)\}/g, 'href="$1"')
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.setContent(
      `<style>body { margin: 0; } ${css}</style><main class="np-page">${hero}</main>`,
    )
    await page.evaluate(() => document.fonts.ready)
    assert.equal(
      await page.evaluate(() => document.fonts.check('400 48px Monocraft')),
      true,
      `${width}: Minecraft-inspired display font must load`,
    )
    const header = await page.locator('.np-hero-header').boundingBox()
    const apparatus = await page.locator('.np-apparatus').boundingBox()
    assert.ok(header && apparatus)
    if (width >= 1024) {
      assert.ok(
        apparatus.x >= header.x + header.width,
        `${width}: workstation must be on the right`,
      )
      assert.ok(
        Math.abs(apparatus.y - header.y) < 1,
        `${width}: hero must share one row`,
      )
      assert.ok(
        apparatus.height <= 672,
        `${width}: workstation must remain bounded`,
      )
    } else {
      assert.ok(
        apparatus.y >= header.y + header.height,
        `${width}: mobile must stack`,
      )
    }
    assert.ok(
      apparatus.x + apparatus.width <= width,
      `${width}: workstation must fit viewport`,
    )
    const overflow = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          '.np-hero-container, .np-apparatus, .np-apparatus-pane',
        ),
      ].some((element) => element.scrollWidth > element.clientWidth + 1),
    )
    assert.equal(
      overflow,
      false,
      `${width}: hero panels must not overflow horizontally`,
    )
    console.log(`PASS home hero layout at ${width}px`)
  }
} finally {
  await browser.close()
}
