# Test info

- Name: Cross-browser compatibility >> blog page should work in all browsers
- Location: /home/runner/work/pixelated/pixelated/src/tests/cross-browser-compatibility.test.ts:46:5

# Error details

```
Error: expect.toBeVisible: Error: strict mode violation: locator('footer') resolved to 2 elements:
    1) <footer data-astro-source-loc="233:97" class="slide-enter animate-delay-1000! prose mx-auto mt-8 print:hidden astro-37fxchfa" data-astro-source-file="/home/runner/work/pixelated/pixelated/src/layouts/BaseLayout.astro">  </footer> aka locator('#main footer')
    2) <footer data-astro-source-loc="9:29" class="site-footer astro-oegwczy5" data-astro-source-file="/home/runner/work/pixelated/pixelated/src/components/base/Footer.astro">…</footer> aka getByRole('contentinfo')

Call log:
  - expect.toBeVisible with timeout 15000ms
  - waiting for locator('footer')

    at testCoreFunctionality (/home/runner/work/pixelated/pixelated/src/tests/cross-browser-compatibility.test.ts:28:40)
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
    - button "Toggle theme"
- main:
  - heading "Blog" [level=1]
  - heading "2025" [level=2]
  - list:
    - listitem:
      - link "The Dance of Minds - When AI and Human Psychology Collide":
        - /url: /blog/convergence-of-minds
      - text: Mar 15
    - listitem:
      - link "AI in the Therapy Room - Promise, Pitfalls, and My Patients' Reality":
        - /url: /blog/ai-mental-health-assistance
      - text: Mar 9
    - listitem:
      - link "When Machines Think But Can't Feel - The EQ Crisis":
        - /url: /blog/emotional-intelligence-in-ai-world
      - text: Mar 2
  - heading "2024" [level=2]
  - list:
    - listitem:
      - 'link "Integrative Approaches to Trauma Treatment: Synthesizing Modern Modalities"':
        - /url: /blog/neuroplasticity/integrative-approaches
      - text: May 29
    - listitem:
      - link "AI in Mental Health Crisis Prevention":
        - /url: /blog/ai/crisis-prevention
      - text: May 27
    - listitem:
      - 'link "Nature''s Therapy: Outdoor Wellness Practices"':
        - /url: /blog/wellness/nature-therapy
      - text: May 25
    - listitem:
      - link "Psychedelic Medicine & Neuroplasticity in Trauma Treatment":
        - /url: /blog/neuroplasticity/psychedelic-medicine
      - text: May 22
    - listitem:
      - 'link "Emotional AI: Understanding Human Feelings"':
        - /url: /blog/ai/emotional-ai
      - text: May 20
    - listitem:
      - link "Creative Expression for Mental Wellness":
        - /url: /blog/wellness/creative-expression
      - text: May 18
    - listitem:
      - link "Advanced Somatic Technologies in Trauma Treatment":
        - /url: /blog/neuroplasticity/somatic-technologies
      - text: May 15
    - listitem:
      - 'link "Digital Therapeutics: AI-Enhanced Mental Health Tools"':
        - /url: /blog/ai/digital-therapeutics
      - text: May 13
    - listitem:
      - 'link "Friendship as Medicine: Nurturing Social Wellness"':
        - /url: /blog/wellness/friendship-medicine
      - text: May 11
    - listitem:
      - 'link "Quantum Biology & Trauma: A New Frontier"':
        - /url: /blog/neuroplasticity/quantum-biology
      - text: May 8
    - listitem:
      - 'link "AI Companions: The Future of Emotional Support"':
        - /url: /blog/ai/ai-companions
      - text: May 6
    - listitem:
      - 'link "The Art of Micro-Joys: Finding Happiness in Small Moments"':
        - /url: /blog/wellness/micro-joys
      - text: May 4
    - listitem:
      - link "The Neuroscience Revolution in Trauma Treatment":
        - /url: /blog/neuroplasticity/neuroscience-revolution
      - text: May 1
    - listitem:
      - 'link "AI & Emotional Intelligence: The Future of Mental Wellness"':
        - /url: /blog/ai/series-outline
      - text: Apr 26
    - listitem:
      - 'link "Everyday Joy: Simple Practices for Mental Wellness"':
        - /url: /blog/wellness/series-outline
      - text: Apr 19
    - listitem:
      - link "🧬 Research Article Template":
        - /url: /blog/planning/article-template
      - text: Apr 12
    - listitem:
      - link "Editorial Roadmap 2024":
        - /url: /blog/planning/content-calendar
      - text: Apr 12
    - listitem:
      - 'link "Neuroplasticity & Trauma: A Revolutionary Approach"':
        - /url: /blog/planning/series-outline
      - text: Apr 12
    - listitem:
      - 'link "Breaking the Silence: Our Journey Begins"':
        - /url: /blog/welcome
      - text: Apr 11 · 4 min
    - listitem:
      - link "Breaking Free from Trauma Bonds":
        - /url: /blog/trauma-series/trauma-bonds
      - text: Mar 19 · 11 min
    - listitem:
      - link "Emotional Unavail":
        - /url: /blog/healing-series/emotional-unavailability
      - text: Mar 15
    - listitem:
      - link "Healing Journey Series":
        - /url: /blog/healing-series
      - text: Mar 15
    - listitem:
      - 'link "Silencing the Inner Critic: Finding Your Authentic Voice"':
        - /url: /blog/trauma-series/inner-critic
      - text: Mar 12 · 10 min
    - listitem:
      - 'link "Healing Your Inner Child: A Path to Wholeness"':
        - /url: /blog/trauma-series/healing-inner-child
      - text: Mar 5 · 12 min
    - listitem:
      - link "The Physical Impact of Trauma":
        - /url: /blog/trauma-body-series/physical-impact
      - text: Mar 4 · 15 min
    - listitem:
      - link "Trauma and the Body Series":
        - /url: /blog/trauma-body-series
      - text: Mar 1
    - listitem:
      - link "The Dance of Wounded Souls":
        - /url: /blog/healing-series/dance-of-wounded-souls
      - text: Feb 21
    - listitem:
      - link "The Dark Side of Love":
        - /url: /blog/trauma-series/dark-side-of-love
      - text: Feb 20 · 8 min
    - listitem:
      - link "Understanding the Scapegoat Dynamic":
        - /url: /blog/trauma-series/scapegoat-dynamics
      - text: Feb 20 · 10 min
    - listitem:
      - link "Understanding Narcissism and Complex Trauma":
        - /url: /blog/trauma-series/understanding-narcissism
      - text: Feb 18 · 10 min
    - listitem:
      - link "The Heart of Codependency":
        - /url: /blog/trauma-series/heart-of-codependency
      - text: Feb 15 · 12 min
    - listitem:
      - link "Understanding Trauma Series":
        - /url: /blog/trauma-series
      - text: Feb 10
    - listitem:
      - link "Codependency & Complex Trauma":
        - /url: /blog/healing-series/codependency-and-trauma
      - text: Jan 25 · 15 min
  - link "all posts":
    - /url: /blog
  - link "tags":
    - /url: /blog/tags
  - link "RSS":
    - /url: /rss.xml
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
   27 |   await expect(page.locator('header')).toBeVisible()
>  28 |   await expect(page.locator('footer')).toBeVisible()
      |                                        ^ Error: expect.toBeVisible: Error: strict mode violation: locator('footer') resolved to 2 elements:
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
  128 |     await page.screenshot({
```
