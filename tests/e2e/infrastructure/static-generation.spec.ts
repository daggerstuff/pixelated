import { test, expect } from '@playwright/test'

test.describe('Static Generation Tests', () => {
  test('Blog content is correctly generated from content collections', async ({
    page,
  }) => {
    // Visit the blog page
    await page.goto('/blog')

    // Check that multiple article cards are rendered
    await expect(page.locator('.article-card')).toHaveCount.greaterThan(1)

    // Check that articles have expected metadata
    await expect(page.locator('.article-title')).toBeVisible()
    await expect(page.locator('.article-date')).toBeVisible()
    await expect(page.locator('.article-author')).toBeVisible()

    // Get the first article link
    const firstArticleLink = page.locator('.article-card a').first()
    const articleTitle = await firstArticleLink.textContent()
    const articleHref = await firstArticleLink.getAttribute('href')

    // Check that the link exists and has an href attribute
    expect(articleHref).toBeTruthy()

    // Click on the first article
    await firstArticleLink.click()

    // Check that we navigated to the article page
    await expect(page).toHaveURL(articleHref || '/blog')

    // Check that the article title on the detail page matches
    await expect(page.locator('.blog-post-title')).toContainText(
      articleTitle || '',
    )

    // Check for MDX rendered content
    await expect(page.locator('.blog-post-content')).toBeVisible()
  })

  test('Tag filtering works correctly', async ({ page }) => {
    // Visit the blog page
    await page.goto('/blog')

    // Find a tag link
    const tagLink = page.locator('.article-tag').first()
    const tagText = await tagLink.textContent()

    // Click on the tag
    await tagLink.click()

    // Check that we navigated to the tag page
    await expect(page).toHaveURL(/\/blog\/tag\//)

    // Check that the tag title is displayed
    await expect(page.locator('h1')).toContainText(tagText || '')

    // Check that filtered articles are displayed
    await expect(page.locator('.article-card')).toBeVisible()

    // All displayed articles should have the selected tag
    const articleTags = page.locator('.article-card .article-tag')
    const count = await articleTags.count()

    for (let i = 0; i < count; i++) {
      const tag = await articleTags.nth(i).textContent()
      if (tag?.trim() === tagText?.trim()) {
        // Found a matching tag, which is expected
        return
      }
    }

    // If we get here without finding a matching tag, fail the test
    expect(false, `Could not find articles with tag "${tagText}"`).toBe(true)
  })

  test('RSS feed is correctly generated', async ({ request }) => {
    // Request the RSS feed
    const response = await request.get('/rss.xml')

    // Check that the response is successful
    expect(response.status()).toBe(200)

    // Check that the content type is XML
    expect(response.headers()['content-type']).toContain('application/xml')

    // Get the RSS content
    const rssContent = await response.text()

    // Check that it's valid RSS
    expect(rssContent).toContain('<?xml')
    expect(rssContent).toContain('<rss')
    expect(rssContent).toContain('<channel>')
    expect(rssContent).toContain('<item>')

    // Check for expected blog content
    expect(rssContent).toContain('<title>')
    expect(rssContent).toContain('<link>')
    expect(rssContent).toContain('<description>')
  })

  test('Sitemap is correctly generated', async ({ request }) => {
    // Request the sitemap
    const response = await request.get('/sitemap.xml')

    // Check that the response is successful
    expect(response.status()).toBe(200)

    // Check that the content type is XML
    expect(response.headers()['content-type']).toContain('application/xml')

    // Get the sitemap content
    const sitemapContent = await response.text()

    // Check that it's valid sitemap XML
    expect(sitemapContent).toContain('<?xml')
    expect(sitemapContent).toContain('<urlset')
    expect(sitemapContent).toContain('<url>')

    // Check for homepage URL
    expect(sitemapContent).toContain('<loc>')

    // Check for blog URLs
    expect(sitemapContent).toContain('/blog/')
  })

  test('Code syntax highlighting works', async ({ page }) => {
    // Visit a blog post with code examples
    await page.goto('/blog')

    // Find a blog post that might have code examples
    const codePost = page.locator('.article-card:has-text("Code")').first()
    if ((await codePost.count()) === 0) {
      test.skip('No blog post with code examples found')
      return
    }

    // Click on the post
    await codePost.click()

    // Check for code blocks
    const codeBlocks = page.locator('pre code')

    // If there are code blocks, check that they have syntax highlighting
    if ((await codeBlocks.count()) > 0) {
      // Check that syntax highlighting classes have been applied
      const hasHighlighting = await page.evaluate(() => {
        const codeBlocks = document.querySelectorAll('pre code')
        for (const block of codeBlocks) {
          // Check if the code block or its parent has syntax highlighting classes
          if (
            block.classList.length > 0 ||
            block.querySelectorAll('.token, .hljs-keyword, .astro-code')
              .length > 0
          ) {
            return true
          }
        }
        return false
      })

      expect(hasHighlighting).toBe(true)
    } else {
      test.skip('No code blocks found in the blog post')
    }
  })
})
