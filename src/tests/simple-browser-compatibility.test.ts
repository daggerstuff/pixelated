import { test, expect } from '@playwright/test'
import * as fs from 'fs'

// Ensure screenshots directory exists
function ensureDirectoryExists(directory) {
  try {
    fs.mkdirSync(directory, { recursive: true })
  } catch (err) {
    // Directory already exists or cannot be created
    console.error(`Failed to create directory ${directory}:`, err)
  }
}

// Simple browser compatibility test that doesn't require the application to be running
test('basic browser compatibility check', async ({ page, browser }) => {
  // Log browser information
  console.log(`Testing browser: ${browser.browserType().name()}`)

  // Simple browser feature detection test that doesn't rely on localStorage
  await page.setContent(`
    <html>
      <head>
        <title>Browser Compatibility Test</title>
        <style>
          body { font-family: sans-serif; padding: 20px; }
        </style>
      </head>
      <body>
        <h1>Browser Feature Detection</h1>
        <div id="results">Running tests...</div>
        <script>
          function runTests() {
            try {
              // Only check features that are safe in all contexts
              const features = {
                fetch: typeof fetch !== 'undefined',
                promise: typeof Promise !== 'undefined',
                async: typeof async function(){} !== 'undefined',
                arrayMethods: typeof Array.prototype.map !== 'undefined',
                css: {
                  grid: CSS.supports('display', 'grid'),
                  flexbox: CSS.supports('display', 'flex'),
                  variables: CSS.supports('--custom-property', 'value')
                }
              };

              document.getElementById('results').textContent = JSON.stringify(features, null, 2);
            } catch (e) {
              document.getElementById('results').textContent = JSON.stringify({
                testCompleted: true,
                error: e.message
              });
            }
          }

          // Ensure DOM is ready before running tests
          setTimeout(runTests, 100);
        </script>
      </body>
    </html>
  `)

  // Wait for results to be populated
  await page.waitForFunction(
    () => {
      const content = document.getElementById('results')?.textContent
      return content && content !== 'Running tests...'
    },
    { timeout: 5000 },
  )

  // Verify the test ran and completed
  const content = await page.textContent('#results')
  console.log('Content:', content)
  expect(content).toBeTruthy()

  // Ensure directories exist before taking screenshots
  ensureDirectoryExists('./playwright-report')
  ensureDirectoryExists('./test-results')

  try {
    // Take screenshots for the report
    await page.screenshot({
      path: './test-results/browser-compatibility-test.png',
    })

    // If we're in a CI environment, take additional screenshots for reporting
    if (process.env.CI) {
      const browserName = browser.browserType().name()
      ensureDirectoryExists('./test-results/cross-browser')
      await page.screenshot({
        path: `./test-results/cross-browser/${browserName}-compatibility.png`,
      })
    }
  } catch (err) {
    console.error('Failed to take screenshot:', err)
    // Don't fail the test if screenshot fails
  }

  // Parse and validate the content
  try {
    const featuresJson = JSON.parse(content)
    console.log('Features detected:', featuresJson)

    // Verify essential features
    expect(featuresJson.fetch).toBe(true)
    expect(featuresJson.promise).toBe(true)
    expect(featuresJson.arrayMethods).toBe(true)
    expect(featuresJson.css.flexbox).toBe(true)
  } catch (err) {
    console.error('Error parsing features JSON:', err)
    // Include the content in the error message for better debugging
    throw new Error(`Failed to parse features JSON. Content: ${content}`)
  }
})
