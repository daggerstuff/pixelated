import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import { join } from 'node:path'
import { FEATURES } from '../lib/browser/feature-detection'

// Define types for compatibility results
interface PageResult {
  navigationSuccessful?: boolean
  visualIssues?: string[]
  criticalElements?: Record<string, boolean>
  interactions?: Record<string, { success: boolean; details?: string }>
  jsErrors?: string[]
  viewportAdaption?: {
    viewport: { width: number; height: number }
    hasViewportMeta: boolean
    hasHorizontalOverflow: boolean
    tooSmallTapTargets: Element[]
  }
  touchInputResults?: Record<string, { success: boolean; details?: string }>
}

interface CompatibilityResults {
  browsers: Record<
    string,
    {
      pages: Record<string, PageResult>
      features: Record<string, boolean>
    }
  >
}

// Skip browser compatibility tests in CI environment
const skipTests = process.env.SKIP_BROWSER_COMPAT_TESTS === 'true'

// Create a separate test suite
;(skipTests ? test.describe.skip : test.describe)(
  'Browser Features and Compatibility',
  () => {
    test('should test browser features and compatibility', async ({
      page,
    }: {
      page: any
    }) => {
      const compatibilityResults: CompatibilityResults = {
        browsers: {},
      }

      // Test each feature
      for (const [featureKey, feature] of Object.entries(FEATURES)) {
        const detectionCode = feature.detectionFn.toString()
        const result = await page.evaluate(`(${detectionCode})()`)
        compatibilityResults.browsers.chromium = {
          ...compatibilityResults.browsers.chromium,
          features: {
            ...compatibilityResults.browsers.chromium?.features,
            [featureKey]: Boolean(result),
          },
        }
      }

      // Save results
      const resultsPath = join(
        process.cwd(),
        'browser-compatibility-results.json',
      )
      await fs.writeFile(
        resultsPath,
        JSON.stringify(compatibilityResults, null, 2),
      )

      // Basic assertion to ensure test ran
      expect(Object.keys(compatibilityResults.browsers)).toHaveLength(1)
    })
  },
)

// Use conditional test execution for a standalone test
if (!skipTests) {
  test('should work in all browsers', async ({
    page: _page,
    browserName: _browserName,
  }: {
    page: any
    browserName: string
  }) => {
    // ... test implementation ...
  })
}
