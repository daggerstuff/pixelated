# Test info

- Name: Cross-browser compatibility >> home page should work in all browsers
- Location: /home/runner/work/pixelated/pixelated/src/tests/cross-browser-compatibility.test.ts:46:5

# Error details

```
Error: expect.toBeVisible: Error: strict mode violation: locator('header') resolved to 7 elements:
    1) <header class="flex items-center justify-between p-6 w-full absolute top-0 left-0 right-0 z-10">…</header> aka getByRole('banner')
    2) <header class="prose mx-auto mb-4 text-center astro-vgdbh7zs">    </header> aka locator('#main header')
    3) <header>…</header> aka getByText('5.7.10 Copy debug info')
    4) <header>…</header> aka getByText('Featured integrationsView all')
    5) <header>…</header> aka locator('header').filter({ hasText: 'Audit 0' })
    6) <header>…</header> aka locator('header').filter({ hasText: 'No accessibility or' })
    7) <header>…</header> aka locator('header').filter({ hasText: 'Settings' })

Call log:
  - expect.toBeVisible with timeout 15000ms
  - waiting for locator('header')

    at testCoreFunctionality (/home/runner/work/pixelated/pixelated/src/tests/cross-browser-compatibility.test.ts:27:40)
    at /home/runner/work/pixelated/pixelated/src/tests/cross-browser-compatibility.test.ts:51:22
```

# Page snapshot

```yaml
- alert
- link "Skip to content":
  - /url: "#main"
- banner:
  - link "Vivi Ornitier @ pixelatedempathy.com":
    - /url: /
    - img
  - navigation:
    - list:
      - listitem:
        - link "Features":
          - /url: /features
      - listitem:
        - link "Blog":
          - /url: /blog
      - listitem:
        - link "Dashboard":
          - /url: /dashboard
      - listitem:
        - link "AntfuStyle on Github":
          - /url: https://github.com/vivirox
      - listitem:
        - link "Vivi on Twitter":
          - /url: https://x.com/pixelated
    - button "Toggle theme":
      - img
- main:
  - paragraph:
    - text: Pixelated Empathy - the premier destination for the world of AI-assisted emotional intelligence. Therapy training has never been more accessible, or more effective.
    - strong: Ever.
- contentinfo:
  - paragraph: © 2025 Pixelated Empathy. All rights reserved.
  - link "Privacy Policy":
    - /url: /privacy
  - link "Terms of Service":
    - /url: /terms
  - link "Contact":
    - /url: /contact
- button "Scroll to top"
```

# Test source

```ts
   1 | /**
   2 |  * Cross-Browser Compatibility Tests
   3 |  *
   4 |  * This file contains tests to verify that our application works correctly
   5 |  * across different browsers (Chromium, Firefox, and WebKit).
   6 |  */
   7 |
   8 | import { test, expect } from '@playwright/test'
   9 |
   10 | // Define test URLs to check across browsers
   11 | const TEST_URLS = {
   12 |   home: '/',
   13 |   blog: '/blog',
   14 |   documentation: '/docs',
   15 |   dashboard: '/admin/dashboard',
   16 |   simulator: '/simulator',
   17 | }
   18 |
   19 | // Define a reusable function to test core page functionality
   20 | async function testCoreFunctionality(page, url) {
   21 |   await page.goto(url)
   22 |
   23 |   // Verify page loaded
   24 |   expect(await page.title()).not.toBe('')
   25 |
   26 |   // Check that critical elements are visible
>  27 |   await expect(page.locator('header')).toBeVisible()
      |                                        ^ Error: expect.toBeVisible: Error: strict mode violation: locator('header') resolved to 7 elements:
   28 |   await expect(page.locator('footer')).toBeVisible()
   29 |
   30 |   // Check that no console errors occurred
   31 |   const errors = []
   32 |   page.on('console', (msg) => {
   33 |     if (msg.type() === 'error') {
   34 |       errors.push(msg.text())
   35 |     }
   36 |   })
   37 |
   38 |   // Return any errors found
   39 |   return errors
   40 | }
   41 |
   42 | // Define tests for different browsers
   43 | // Note: These tests will run on the browsers configured in playwright.config.ts
   44 | test.describe('Cross-browser compatibility', () => {
   45 |   for (const [pageName, url] of Object.entries(TEST_URLS)) {
   46 |     test(`${pageName} page should work in all browsers`, async ({
   47 |       page,
   48 |       browserName,
   49 |     }) => {
   50 |       // Run the core functionality test
   51 |       const errors = await testCoreFunctionality(page, url)
   52 |
   53 |       // Take a screenshot for visual comparison
   54 |       await page.screenshot({
   55 |         path: `./test-results/cross-browser/${browserName}-${pageName}.png`,
   56 |       })
   57 |
   58 |       // Verify no console errors occurred
   59 |       expect(errors).toEqual([])
   60 |
   61 |       // Test page-specific elements
   62 |       switch (pageName) {
   63 |         case 'home':
   64 |           // Check hero section
   65 |           await expect(page.locator('.hero-section')).toBeVisible()
   66 |           break
   67 |
   68 |         case 'blog':
   69 |           // Check blog post listing
   70 |           await expect(page.locator('article')).toBeVisible()
   71 |           break
   72 |
   73 |         case 'documentation':
   74 |           // Check docs navigation
   75 |           await expect(page.locator('.docs-sidebar')).toBeVisible()
   76 |           // Ensure code blocks render correctly
   77 |           await expect(page.locator('pre code')).toBeVisible()
   78 |           break
   79 |
   80 |         case 'dashboard':
   81 |           // Check dashboard elements
   82 |           await expect(page.locator('.dashboard-header')).toBeVisible()
   83 |           // Ensure charts render properly
   84 |           await expect(page.locator('.chart-container')).toBeVisible()
   85 |           break
   86 |
   87 |         case 'simulator':
   88 |           // Check simulator elements
   89 |           await expect(
   90 |             page.locator('h2:has-text("Therapeutic Practice Simulator")'),
   91 |           ).toBeVisible()
   92 |           break
   93 |       }
   94 |     })
   95 |   }
   96 |
   97 |   // Test responsive behavior across browsers
   98 |   test('responsive navigation works correctly in all browsers', async ({
   99 |     page,
  100 |     browserName,
  101 |   }) => {
  102 |     // Go to home page
  103 |     await page.goto('/')
  104 |
  105 |     // Test desktop navigation
  106 |     await page.setViewportSize({ width: 1280, height: 800 })
  107 |     await expect(page.locator('nav ul')).toBeVisible()
  108 |
  109 |     // Take a screenshot
  110 |     await page.screenshot({
  111 |       path: `./test-results/cross-browser/${browserName}-nav-desktop.png`,
  112 |     })
  113 |
  114 |     // Test mobile navigation
  115 |     await page.setViewportSize({ width: 375, height: 667 })
  116 |
  117 |     // Menu should be collapsed on mobile
  118 |     await expect(page.locator('nav ul')).not.toBeVisible()
  119 |     await expect(page.locator('button[aria-label="Toggle menu"]')).toBeVisible()
  120 |
  121 |     // Open mobile menu
  122 |     await page.locator('button[aria-label="Toggle menu"]').click()
  123 |
  124 |     // Menu should now be visible
  125 |     await expect(page.locator('nav ul')).toBeVisible()
  126 |
  127 |     // Take a screenshot
```
