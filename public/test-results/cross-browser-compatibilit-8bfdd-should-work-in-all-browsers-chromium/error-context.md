# Test info

- Name: Cross-browser compatibility >> documentation page should work in all browsers
- Location: /home/runner/work/pixelated/pixelated/src/tests/cross-browser-compatibility.test.ts:46:5

# Error details

```
Error: expect.toBeVisible: Error: strict mode violation: locator('header') resolved to 2 elements:
    1) <header class="z-30 w-full bg-card border-b border-border fixed">…</header> aka getByRole('banner')
    2) <header class="mb-8" data-astro-source-loc="313:32" data-astro-source-file="/home/runner/work/pixelated/pixelated/src/layouts/DocumentationLayout.astro">…</header> aka getByText('Documentation Welcome to the Pixelated Empathy Documentation', { exact: true })

Call log:
  - expect.toBeVisible with timeout 15000ms
  - waiting for locator('header')

    at testCoreFunctionality (/home/runner/work/pixelated/pixelated/src/tests/cross-browser-compatibility.test.ts:27:40)
    at /home/runner/work/pixelated/pixelated/src/tests/cross-browser-compatibility.test.ts:51:22
```

# Page snapshot

```yaml
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
  - heading "Documentation" [level=3]
  - button "Toggle theme":
    - img
  - navigation:
    - link "Home":
      - /url: /docs
    - link "API Reference":
      - /url: /docs/api
    - link "Components":
      - /url: /docs/components
    - link "Security":
      - /url: /docs/security
    - link "Guides":
      - /url: /docs/guides
  - heading "ON THIS PAGE" [level=4]
  - link "Latest Updates":
    - /url: "#latest-updates"
  - link "Popular Topics":
    - /url: "#popular-topics"
  - link "Get Support":
    - /url: "#get-support"
- main:
  - article:
    - heading "Documentation" [level=1]
    - paragraph: Welcome to the Pixelated Empathy Documentation
    - heading "Pixelated Empathy Documentation" [level=1]
    - paragraph: Welcome to the Pixelated Empathy documentation. Here you'll find comprehensive guides and documentation to help you start working with Pixelated Empathy as quickly as possible.
    - link "Tutorial Get up and running with Pixelated Empathy quickly":
      - /url: /docs/getting-started
      - img
      - text: Tutorial
      - paragraph: Get up and running with Pixelated Empathy quickly
    - link "API Reference Complete API documentation for developers":
      - /url: /docs/api
      - img
      - text: API Reference
      - paragraph: Complete API documentation for developers
    - link "Components Explore our UI component library":
      - /url: /docs/components
      - img
      - text: Components
      - paragraph: Explore our UI component library
    - link "Security Learn about our security features and best practices":
      - /url: /docs/security
      - img
      - text: Security
      - paragraph: Learn about our security features and best practices
    - heading "Latest Updates" [level=2]
    - img
    - text: Version 2.0 Released
    - paragraph:
      - text: We've released version 2.0 of Pixelated Empathy with many new features and improvements. Check out the
      - link "changelog":
        - /url: /docs/changelog
      - text: for details.
    - text: New Feature Performance Security
    - heading "Popular Topics" [level=2]
    - list:
      - listitem:
        - link "Authentication and Authorization":
          - /url: /docs/authentication
      - listitem:
        - link "AI Integration":
          - /url: /docs/ai-integration
      - listitem:
        - link "Deployment Guide":
          - /url: /docs/deployment
      - listitem:
        - link "Troubleshooting":
          - /url: /docs/troubleshooting
      - listitem:
        - link "Frequently Asked Questions":
          - /url: /docs/faq
    - heading "Get Support" [level=2]
    - paragraph: Need help? Our support team is available to assist you with any questions or issues.
    - link "Email Support Contact our support team directly":
      - /url: mailto:support@pixelated.dev
      - img
      - text: Email Support
      - paragraph: Contact our support team directly
    - link "Discord Community Join our community on Discord":
      - /url: https://discord.gg/pixelated
      - img
      - text: Discord Community
      - paragraph: Join our community on Discord
    - link "Previous Page":
      - /url: "#"
      - img
      - text: Previous Page
    - link "Next Page":
      - /url: "#"
      - text: Next Page
      - img
- contentinfo:
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
>  27 |   await expect(page.locator('header')).toBeVisible()
      |                                        ^ Error: expect.toBeVisible: Error: strict mode violation: locator('header') resolved to 2 elements:
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
