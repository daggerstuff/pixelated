/**
 * Lighthouse CI configuration for EHR Mobile Parity Gate (G3.2 / PIX-4430)
 *
 * Targets EHR portal pages with mobile form factor emulation.
 * Thresholds per task spec:
 *   LCP  < 2.5s  (largest-contentful-paint)
 *   INP  < 200ms (interaction-to-next-paint)
 *   CLS  < 0.1   (cumulative-layout-shift)
 *
 * Usage:
 *   pnpm lighthouse-ci          # local run
 *   pnpm lighthouse-ci:mobile   # explicit mobile preset
 *
 * @see https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md
 */

/** @type {import('@lhci/cli').LighthouseCiConfig} */
module.exports = {
  ci: {
    collect: {
      numberOfRuns: 3,
      settings: {
        preset: 'mobile',
      },
      url: [
        'http://localhost:4321/portal',
        'http://localhost:4321/portal/scheduling',
        'http://localhost:4321/portal/messaging',
      ],
      startServerCommand: 'pnpm build && pnpm preview',
      startServerReadyPattern: 'Server running',
    },
    assert: {
      assertions: {
        // Core Web Vitals — task thresholds
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'interaction-to-next-paint': ['error', { maxNumericValue: 200 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],

        // Performance score floor
        'categories:performance': ['warn', { minScore: 0.7 }],

        // Accessibility floor (WCAG 2.1 AA)
        'categories:accessibility': ['warn', { minScore: 0.9 }],

        // Best practices floor
        'categories:best-practices': ['warn', { minScore: 0.85 }],

        // PWA installability
        'installable-manifest': ['error', { minScore: 1 }],
        'service-worker': ['error', { minScore: 1 }],

        // No render-blocking resources
        'render-blocking-resources': ['warn', { maxNumericValue: 0 }],

        // Responsive viewport meta tag
        'viewport': ['error', { minScore: 1 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './lighthouse-results',
      reportFilenamePattern: '%%URLPATH%%-%%DATETIME%%-report.html',
    },
  },
}
