import { test, expect } from '@playwright/test'

test.describe('Astro SSR Functionality Tests', () => {
  test('Page loads with pre-rendered HTML (SSR)', async ({ page }) => {
    // Disable JavaScript to test pure SSR content
    await page.context().route('**/*.js', async (route) => route.abort())

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
    await page.context().route('**/*.js', async (route) => route.abort())

    // Go to the blog page
    await page.goto('/blog')

    // Verify that blog content is visible without JS
    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('article.group').first()).toBeVisible()

    // Check that article titles and dates are visible
    await expect(page.locator('article h3').first()).toBeVisible()
    await expect(page.getByText(/2025/).first()).toBeVisible()
  })

  test('Admin dashboard renders static HTML (SSR, no interactive islands)', async ({
    page,
  }) => {
    // Visit the admin dashboard (redirects /admin → /admin/dashboard)
    await page.goto('/admin')

    // Check that basic structure is visible
    await expect(page.locator('header')).toBeVisible()
    // Use id selector to avoid strict-mode clash (skip-link main + content main)
    await expect(page.locator('#main-content')).toBeVisible()

    // Verify sidebar navigation is rendered
    await expect(page.getByRole('link', { name: /Dashboard/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Users/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Settings/i })).toBeVisible()

    // Verify page heading rendered server-side
    await expect(
      page.getByRole('heading', { name: /Admin Dashboard/i }),
    ).toBeVisible()
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

  test('Tag page renders with correct data', async ({ page }) => {
    // Visit a dynamic tag page
    await page.goto('/blog/tags/trauma')

    // Check that the tag heading is rendered
    await expect(page.getByRole('heading', { name: /#trauma/i })).toBeVisible()

    // Check that tagged articles are rendered
    await expect(page.locator('article.group').first()).toBeVisible()
    await expect(page.locator('article h3').first()).toBeVisible()
  })

  test('Astro View Transitions work correctly', async ({ page }) => {
    // Visit the homepage
    await page.goto('/')

    // Confirm view transitions are enabled in the app
    const transitionsEnabled = await page.evaluate(() => {
      const meta = document.querySelector(
        'meta[name="astro-view-transitions-enabled"]',
      )
      return meta?.getAttribute('content') === 'true'
    })
    expect(transitionsEnabled).toBe(true)

    // Store a reference element to check if it persists during navigation
    const header = page.locator('header')

    // Get initial header properties
    const initialHeaderBounds = await header.boundingBox()

    // Click an internal link to navigate
    await page.click('a[href="/about"]')

    // Wait for the new page to be active
    await expect(page).toHaveURL('/about')

    // Check that the header persists and maintains position
    const newHeaderBounds = await header.boundingBox()

    expect(initialHeaderBounds?.x).toBeCloseTo(newHeaderBounds?.x ?? 0, 0)
    expect(initialHeaderBounds?.y).toBeCloseTo(newHeaderBounds?.y ?? 0, 0)
  })
})
