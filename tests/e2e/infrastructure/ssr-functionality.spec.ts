import { test, expect } from '@playwright/test'

test.describe('Astro SSR Functionality Tests', () => {
  test('Page loads with pre-rendered HTML (SSR)', async ({ page }) => {
    // Disable JavaScript to test pure SSR content
    await page.context().route('**/*.js', (route) => route.abort())

    // Go to the homepage
    await page.goto('/')

    // Verify that the page content is still visible even without JS
    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('footer')).toBeVisible()

    // Check for important content that should be SSR'd
    await expect(page.locator('h1')).toBeVisible()
  })

  test('Blog content is pre-rendered (SSR)', async ({ page }) => {
    // Disable JavaScript to test pure SSR content
    await page.context().route('**/*.js', (route) => route.abort())

    // Go to the blog page
    await page.goto('/blog')

    // Verify that blog content is visible without JS
    await expect(page.locator('.article-list')).toBeVisible()
    await expect(page.locator('.article-card')).toBeVisible()

    // Check that article titles and dates are visible
    await expect(page.locator('.article-title')).toBeVisible()
    await expect(page.locator('.article-date')).toBeVisible()
  })

  test('Admin dashboard requires client hydration (Island Architecture)', async ({
    page,
  }) => {
    // First visit with JavaScript disabled
    await page.context().route('**/*.js', (route) => route.abort())
    await page.goto('/admin')

    // Check that basic structure is visible
    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('main')).toBeVisible()

    // Interactive elements should not be functional
    // For example, if there's a metrics refresh button, it should be present but not functional
    const refreshButton = page.locator('button[aria-label="Refresh Metrics"]')

    // Check button exists in DOM
    await expect(refreshButton).toBeVisible()

    // Now reload the page with JavaScript enabled
    await page.context().unroute('**/*.js')
    await page.reload()

    // Click the refresh button
    await refreshButton.click()

    // Check for updated content indicating the component was hydrated
    await expect(page.locator('.metrics-updated-time')).toBeVisible()
  })

  test('Meta tags are correctly rendered', async ({ page }) => {
    // Visit the homepage
    await page.goto('/')

    // Check that important meta tags are in the HTML
    const title = await page.evaluate(() => document.title)
    expect(title).not.toBe('')

    const description = await page.evaluate(() =>
      document
        .querySelector('meta[name="description"]')
        ?.getAttribute('content'),
    )
    expect(description).not.toBeNull()
    expect(description?.length).toBeGreaterThan(10)

    // Check for Open Graph tags
    const ogTitle = await page.evaluate(() =>
      document
        .querySelector('meta[property="og:title"]')
        ?.getAttribute('content'),
    )
    expect(ogTitle).not.toBeNull()

    const ogDescription = await page.evaluate(() =>
      document
        .querySelector('meta[property="og:description"]')
        ?.getAttribute('content'),
    )
    expect(ogDescription).not.toBeNull()
  })

  test('Dynamic routes render with correct data', async ({ page }) => {
    // Visit a dynamic blog post page
    await page.goto('/blog/getting-started-with-astro')

    // Check that the post title is in the page
    await expect(page.locator('.blog-post-title')).toContainText(
      'Getting Started with Astro',
    )

    // Check that the post content is rendered
    await expect(page.locator('.blog-post-content')).toBeVisible()

    // Check that related metadata is present
    await expect(page.locator('.blog-post-date')).toBeVisible()
    await expect(page.locator('.blog-post-author')).toBeVisible()

    // Check for post navigation (previous/next links)
    await expect(page.locator('.post-navigation')).toBeVisible()
  })

  test('Astro View Transitions work correctly', async ({ page }) => {
    // Visit the homepage
    await page.goto('/')

    // Store a reference element to check if it persists during navigation
    const header = page.locator('header')

    // Get initial header properties
    const initialHeaderBounds = await header.boundingBox()

    // Click a link that should use View Transitions
    await page.click('a[href="/about"]')

    // Wait for the new page to be active
    await expect(page).toHaveURL('/about')

    // Check that the header didn't flash/disappear during transition
    // by verifying it maintains the same position
    const newHeaderBounds = await header.boundingBox()

    expect(initialHeaderBounds?.x).toBeCloseTo(newHeaderBounds?.x || 0, 0)
    expect(initialHeaderBounds?.y).toBeCloseTo(newHeaderBounds?.y || 0, 0)

    // Check that the page has the view-transition attribute
    const hasViewTransition = await page.evaluate(() => {
      return document.documentElement.hasAttribute('data-astro-transition')
    })

    expect(hasViewTransition).toBe(true)
  })
})
