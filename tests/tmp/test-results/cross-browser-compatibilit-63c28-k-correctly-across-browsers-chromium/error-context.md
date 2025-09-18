# Test info

- Name: Cross-browser compatibility >> animations and transitions work correctly across browsers
- Location: /home/runner/work/pixelated/pixelated/src/tests/cross-browser-compatibility.test.ts:166:3

# Error details

```
Error: page.goto: Test timeout of 120000ms exceeded.
Call log:
  - navigating to "http://localhost:3000/", waiting until "load"

    at /home/runner/work/pixelated/pixelated/src/tests/cross-browser-compatibility.test.ts:171:16
```

# Test source

```ts
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
  160 |
  161 |     // Check for success message
  162 |     await expect(page.locator('text=Thank you for your message')).toBeVisible()
  163 |   })
  164 |
  165 |   // Test animations and transitions
  166 |   test('animations and transitions work correctly across browsers', async ({
  167 |     page,
  168 |     browserName,
  169 |   }) => {
  170 |     // Go to a page with animations
> 171 |     await page.goto('/')
      |                ^ Error: page.goto: Test timeout of 120000ms exceeded.
  172 |
  173 |     // Scroll to trigger animations
  174 |     await page.evaluate(() => window.scrollBy(0, 300))
  175 |
  176 |     // Wait for animations to complete (this is approximate)
  177 |     await page.waitForTimeout(1000)
  178 |
  179 |     // Take a screenshot after animations
  180 |     await page.screenshot({
  181 |       path: `./test-results/cross-browser/${browserName}-animations.png`,
  182 |     })
  183 |   })
  184 | })
  185 |
```
