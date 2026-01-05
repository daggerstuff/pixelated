---
title: "Performance Testing Guide"
description: "Performance Testing Guide documentation"
pubDate: 2024-01-15
author: "Pixelated Team"
tags: ["documentation", "testing"]
draft: false
toc: true
---

# Performance Testing Guide

This guide outlines our approach to performance testing for the Astro project, covering key metrics, testing tools, and optimization strategies.

## Key Performance Metrics

We focus on measuring the following Core Web Vitals and performance metrics:

### Loading Performance

- **Time to First Byte (TTFB)**: Time from request to first byte of response received
- **First Contentful Paint (FCP)**: Time until first content is rendered
- **Largest Contentful Paint (LCP)**: Time until largest content element is rendered
- **Speed Index**: How quickly content is visually displayed

### Interactivity

- **Total Blocking Time (TBT)**: Sum of time when main thread is blocked
- **First Input Delay (FID)**: Time from user interaction to response
- **Time to Interactive (TTI)**: Time until page is fully interactive

### Visual Stability

- **Cumulative Layout Shift (CLS)**: Measures visual stability and unexpected layout shifts

### Resource Metrics

- **JavaScript bundle size**: Total size of JS assets
- **CSS size**: Total size of CSS assets
- **Request count**: Number of HTTP requests made
- **Image optimization**: Size and format efficiency

## Performance Testing Infrastructure

Our performance testing setup consists of:

1. **Automated tests** with Playwright that measure core metrics
   - Located in `tests/performance/`
   - Captures metrics for key pages
   - Validates against performance budgets

2. **Lighthouse CI** integration (in CI/CD pipeline)
   - Runs performance audits on PRs
   - Blocks merges if performance regresses
   - Generates reports with optimization suggestions

3. **Real User Monitoring (RUM)**
   - Collects metrics from actual users
   - Segments by device type, connection speed, and geography
   - Provides insights into real-world performance

## Running Performance Tests

### Local Testing

```bash
# Run all performance tests
pnpm test:performance

# Run performance tests for specific pages
pnpm test:performance -- -g "Homepage"
```

### CI/CD Pipeline

Performance tests run automatically on:

- Pull requests (blocking if performance budgets are exceeded)
- Daily against the main branch
- Release candidate builds

#### Cloudflare Access (staging/production)

If the target environment is protected by Cloudflare Zero Trust Access, the pipeline/test runner must authenticate via a **Service Auth token**.

- **Azure DevOps variables** (variable group `pixelated-pipeline-variables`):
  - `CF_ACCESS_CLIENT_ID`
  - `CF_ACCESS_CLIENT_SECRET`
- **Cloudflare configuration**:
  - Ensure the Access Application protecting the target routes (e.g. `/demo`) has a Policy that **allows Service Auth** and includes the service token used by CI.

## Performance Budgets

We've established the following performance budgets:

| Metric | Target (Good) | Maximum (Acceptable) |
|--------|---------------|----------------------|
| TTFB   | < 300ms       | < 600ms              |
| FCP    | < 1.8s        | < 3s                 |
| LCP    | < 2.5s        | < 4s                 |
| CLS    | < 0.1         | < 0.25               |
| TBT    | < 200ms       | < 600ms              |
| FID    | < 100ms       | < 300ms              |
| JS Size| < 500KB       | < 1MB                |
| CSS Size| < 100KB      | < 200KB              |
| Requests| < 50         | < 80                 |

## Common Performance Optimizations

### Astro-specific Optimizations

1. **Partial Hydration**
   - Use client directives judiciously (`client:idle`, `client:visible`)
   - Only hydrate components that need interactivity

2. **Image Optimization**
   - Use Astro's built-in `<Image>` component
   - Implement responsive images with appropriate sizes
   - Use modern formats (WebP, AVIF)

3. **Content Collections**
   - Leverage Astro's content collections for optimal static generation
   - Use front matter for metadata to avoid runtime calculations

4. **View Transitions**
   - Implement view transitions for smoother page navigation
   - Use `transition:animate` directives effectively

### General Optimizations

1. **Code Splitting**
   - Split code into logical chunks
   - Implement dynamic imports for large dependencies

2. **Asset Optimization**
   - Minify and compress all assets
   - Remove unused CSS/JS
   - Implement proper caching strategies

3. **Third-party Scripts**
   - Defer non-critical third-party scripts
   - Use resource hints (`preconnect`, `preload`)
   - Consider self-hosting critical third-party resources

4. **Server Optimizations**
   - Implement HTTP/2 or HTTP/3
   - Enable Brotli compression
   - Use appropriate caching headers

## Debugging Performance Issues

When a performance test fails or metrics degrade:

1. Compare the failing test with the baseline to identify regression
2. Check Lighthouse reports for specific recommendations
3. Use Chrome DevTools Performance panel to profile the page
4. Look for:
   - Long-running JavaScript
   - Render-blocking resources
   - Layout shifts
   - Large network payloads

## Adding New Performance Tests

When adding new pages or features:

1. Add the page to `PAGES_TO_TEST` in `tests/performance/page-performance.spec.ts`
2. Set appropriate thresholds if different from defaults
3. Run the tests locally to establish a baseline
4. Document any special considerations for the new page

## Continuous Improvement Process

Our performance optimization is an ongoing process:

1. **Measure**: Collect metrics from tests and RUM
2. **Analyze**: Identify performance bottlenecks
3. **Optimize**: Implement improvements
4. **Validate**: Confirm improvements with tests
5. **Monitor**: Watch for regressions

By following this approach, we maintain high performance standards while continuing to evolve the application.
