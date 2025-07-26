---
title: "Astro Integration Testing Guide"
description: "Astro Integration Testing Guide documentation"
pubDate: 2024-01-15
author: "Pixelated Team"
tags: ["documentation", "testing"]
draft: false
toc: true
---

# Astro Integration Testing Guide

This document outlines our approach to integration testing for Astro components and pages, focusing on testing the interaction between components, SSR functionality, client-side hydration, and static generation.

## Testing Infrastructure

Our integration tests are built using:

- **Playwright** for browser automation and testing
- **Vitest** for test organization and assertions
- **GitHub Actions** for CI/CD pipeline integration

## Test Categories

The integration tests are organized into four main categories:

### 1. Layout Component Integration

These tests focus on how our layout components work together with other components:

- **Main and Dashboard Layouts**: Testing that layouts render correctly with expected child components
- **Error Boundary**: Testing that the ErrorBoundary component catches errors and displays appropriate messages
- **Client Router**: Testing that client-side navigation works correctly without full page reloads

Example:

```typescript
test('Dashboard layout renders with sidebar and content area', async ({ page }) => {
  await page.goto('/dashboard');
  
  // Check that sidebar is visible
  await expect(page.locator('aside')).toBeVisible();
  
  // Check that main content area is visible
  await expect(page.locator('main.dashboard-content')).toBeVisible();
  
  // Verify sidebar toggle button works
  const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"]');
  await expect(sidebarToggle).toBeVisible();
  
  // Click the toggle button
  await sidebarToggle.click();
  
  // Verify sidebar state changes
  await expect(page.locator('aside')).toHaveAttribute('data-collapsed', 'true');
});
```

### 2. SSR Functionality

These tests verify that our Astro pages render correctly on the server before any JavaScript hydration:

- **Pre-rendered HTML**: Testing pages with JavaScript disabled to ensure they still function
- **Meta Tags Generation**: Testing that meta tags are correctly generated for SEO
- **Dynamic Routes**: Testing that dynamic routes render with the correct data
- **Client Router**: Testing that Astro's Client Router feature works correctly

Example:

```typescript
test('Page loads with pre-rendered HTML (SSR)', async ({ page }) => {
  // Disable JavaScript to test pure SSR content
  await page.context().route('**/*.js', route => route.abort());
  
  // Go to the homepage
  await page.goto('/');
  
  // Verify that the page content is still visible even without JS
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('header')).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();
});
```

### 3. Component Hydration

These tests focus on interactive components that use Astro's client directives:

- **Theme Toggle**: Testing that the theme toggle component hydrates and functions correctly
- **Form Validation**: Testing that form submission and validation works correctly
- **Interactive Components**: Testing AIChat, AdminDashboard, and other interactive components
- **Modal Components**: Testing that modal components with client:visible directive work correctly

Example:

```typescript
test('Theme toggle hydrates and functions correctly', async ({ page }) => {
  await page.goto('/');
  
  // Theme toggle uses client:load directive
  await page.waitForSelector('button[aria-label="Toggle theme"]');
  
  // Check initial theme
  const initialTheme = await page.evaluate(() => {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });
  
  // Click the theme toggle
  await page.click('button[aria-label="Toggle theme"]');
  
  // Check that the theme changed
  const newTheme = await page.evaluate(() => {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });
  
  expect(newTheme).not.toEqual(initialTheme);
});
```

### 4. Static Generation

These tests verify that our content collections and static generation features work correctly:

- **Content Collections**: Testing that blog posts and other content are correctly generated
- **Tag Filtering**: Testing that tag-based filtering works correctly
- **RSS and Sitemap**: Testing that RSS feeds and sitemaps are correctly generated
- **Syntax Highlighting**: Testing that code blocks have proper syntax highlighting

Example:

```typescript
test('Blog content is correctly generated from content collections', async ({ page }) => {
  await page.goto('/blog');
  
  // Check that multiple article cards are rendered
  await expect(page.locator('.article-card')).toHaveCount.greaterThan(1);
  
  // Get the first article link
  const firstArticleLink = page.locator('.article-card a').first();
  const articleTitle = await firstArticleLink.textContent();
  
  // Click on the first article
  await firstArticleLink.click();
  
  // Check that the article title on the detail page matches
  await expect(page.locator('.blog-post-title')).toContainText(articleTitle || '');
});
```

## Running the Tests

### Local Development

To run the integration tests locally:

```bash
# Install Playwright browsers
pnpm run test:setup

# Run all integration tests
pnpm run test:integration

# Run a specific test file
pnpm run test:integration -- tests/integration/layout-integration.spec.ts

# Run tests with headed browser (visible browser UI)
pnpm run test:integration -- --headed
```

### CI/CD Pipeline

The integration tests are automatically run in our CI/CD pipeline:

1. On pull requests to verify changes don't break existing functionality
2. Before deployment to staging to verify the build is stable
3. After deployment to production as a smoke test to verify the deployment

## Test Best Practices

When writing integration tests:

1. **Focus on user flows**: Test how users interact with the application rather than implementation details
2. **Use data attributes for selection**: Use `data-testid` attributes when appropriate to make tests more resilient to UI changes
3. **Test without JavaScript**: Always include tests with JavaScript disabled to ensure SSR works correctly
4. **Test across viewports**: Include tests for mobile, tablet, and desktop viewports
5. **Minimize test duplication**: Use test helpers and setup functions to avoid duplicating code
6. **Keep tests independent**: Each test should be able to run independently of other tests

## Debugging Failed Tests

When tests fail:

1. **Check the screenshots**: Playwright automatically captures screenshots of failed tests in the `test-results` directory
2. **Run with `--headed`**: Run the test with a visible browser to see what's happening
3. **Add `page.pause()`**: Insert `await page.pause()` in your test to pause at a specific point and use the Playwright Inspector
4. **Check the logs**: Check the test logs for any error messages or console logs

## Adding New Tests

When adding new integration tests:

1. **Create a new file**: Add a new `.spec.ts` file in the appropriate directory
2. **Focus on a specific feature**: Each test file should focus on a specific feature or component
3. **Follow the existing patterns**: Use the existing test files as examples
4. **Run the tests locally**: Verify that your tests pass locally before pushing changes
5. **Add to CI pipeline**: Make sure your tests are included in the CI pipeline

## Current Status

We currently have integration tests for:

- Layout component integration
- SSR functionality
- Component hydration
- Static generation

Future work includes:

- Expanding cross-browser compatibility tests
- Adding more mobile-specific tests
- Implementing performance benchmarking tests
