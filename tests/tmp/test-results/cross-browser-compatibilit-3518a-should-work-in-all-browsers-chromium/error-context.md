# Test info

- Name: Cross-browser compatibility >> simulator page should work in all browsers
- Location: /home/runner/work/pixelated/pixelated/src/tests/cross-browser-compatibility.test.ts:46:5

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 5

- Array []
+ Array [
+   "[astro-island] Error hydrating /src/components/layout/HeaderReact.tsx ReferenceError: process is not defined
+     at getEnv (http://localhost:3000/src/config/env.config.ts:102:5)
+     at http://localhost:3000/src/config/env.config.ts:129:20",
+ ]
    at /home/runner/work/pixelated/pixelated/src/tests/cross-browser-compatibility.test.ts:59:22
```

# Page snapshot

```yaml
- link "Skip to content":
  - /url: "#main-content"
- banner:
  - link "Pixelated Empathy Logo Pixelated Empathy":
    - /url: /
    - img "Pixelated Empathy Logo"
    - text: Pixelated Empathy
  - navigation:
    - link "Home":
      - /url: /
    - link "About":
      - /url: /about
    - link "Contact":
      - /url: /contact
    - link "Login":
      - /url: /login
    - link "Sign Up":
      - /url: /signup
  - button "Search":
    - img
  - button:
    - img
  - button "Switch to dark theme":
    - img
  - link "Sign in":
    - /url: /login
- complementary:
  - complementary:
    - button "Toggle Menu":
      - img
      - text: Toggle Menu
    - button "Overview":
      - text: Overview
      - img
    - list:
      - listitem:
        - link "Dashboard":
          - /url: /dashboard
          - img
          - text: Dashboard
      - listitem:
        - link "Analytics":
          - /url: /analytics
          - img
          - text: Analytics
    - button "Therapy Tools":
      - text: Therapy Tools
      - img
    - button "Account":
      - text: Account
      - img
- main:
  - heading "Therapeutic Practice Simulator" [level=2]
  - heading "Select a Practice Scenario" [level=3]
  - paragraph: Choose a scenario to practice therapeutic techniques in a safe, private environment. All interactions are processed in real-time with no recording or storage.
  - heading "Depression Assessment" [level=4]
  - paragraph: "Difficulty: Intermediate"
  - link "Start Scenario →":
    - /url: "#"
  - heading "Anxiety Management" [level=4]
  - paragraph: "Difficulty: Beginner"
  - link "Start Scenario →":
    - /url: "#"
  - heading "Trauma-Informed Care" [level=4]
  - paragraph: "Difficulty: Advanced"
  - link "Start Scenario →":
    - /url: "#"
  - heading "About This Simulator" [level=3]:
    - img
    - text: About This Simulator
  - paragraph: This simulator allows you to practice therapeutic techniques in a private, safe environment. No audio or video data is recorded or stored at any time. All processing happens in real-time with zero data retention to ensure complete privacy and HIPAA compliance.
  - text: You can track your progress through anonymized metrics that are only stored in your browser.
  - link "Logo Pixelated Empathy":
    - /url: /
    - img "Logo"
    - text: Pixelated Empathy
  - paragraph: Secure AI therapy platform with advanced encryption for maximum privacy and HIPAA compliance.
  - link "Twitter":
    - /url: "#"
  - link "GitHub":
    - /url: "#"
  - link "LinkedIn":
    - /url: "#"
  - heading "Platform" [level=3]
  - list:
    - listitem:
      - link "Dashboard":
        - /url: /dashboard
    - listitem:
      - link "Chat":
        - /url: /chat
    - listitem:
      - link "Profile":
        - /url: /profile
  - heading "Resources" [level=3]
  - list:
    - listitem:
      - link "About":
        - /url: /about
    - listitem:
      - link "Contact":
        - /url: /contact
    - listitem:
      - link "FAQ":
        - /url: /faq
  - paragraph: © 2025 Pixelated Empathy. All rights reserved.
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
   27 |   await expect(page.locator('header')).toBeVisible()
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
>  59 |       expect(errors).toEqual([])
      |                      ^ Error: expect(received).toEqual(expected) // deep equality
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
  128 |     await page.screenshot({
  129 |       path: `./test-results/cross-browser/${browserName}-nav-mobile.png`,
  130 |     })
  131 |   })
  132 |
  133 |   // Test form interactions across browsers
  134 |   test('forms work correctly across browsers', async ({
  135 |     page,
  136 |     browserName,
  137 |   }) => {
  138 |     // Go to contact page with a form
  139 |     await page.goto('/contact')
  140 |
  141 |     // Fill out form
  142 |     await page.fill('input[name="name"]', 'Test User')
  143 |     await page.fill('input[name="email"]', 'test@example.com')
  144 |     await page.fill('textarea[name="message"]', 'This is a test message')
  145 |
  146 |     // Take a screenshot of the filled form
  147 |     await page.screenshot({
  148 |       path: `./test-results/cross-browser/${browserName}-form.png`,
  149 |     })
  150 |
  151 |     // Submit form (but intercept the actual submission)
  152 |     await page.route('**/api/contact', (route) => {
  153 |       route.fulfill({
  154 |         status: 200,
  155 |         body: JSON.stringify({ success: true }),
  156 |       })
  157 |     })
  158 |
  159 |     await page.click('button[type="submit"]')
```
