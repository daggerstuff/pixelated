#!/usr/bin/env node

/**
 * Browser Compatibility Report Generator
 *
 * This script processes Playwright test results and creates a structured
 * compatibility report with issue tracking and statistics.
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// Configuration
const REPORTS_DIR = path.join(process.cwd(), 'browser-compatibility', 'reports')
const SCREENSHOTS_DIR = path.join(process.cwd(), 'test-results')
const OUTPUT_DIR = path.join(process.cwd(), 'browser-compatibility')
const TIMESTAMP = new Date().toISOString()
const REPORT_FILE = path.join(REPORTS_DIR, `compatibility-${TIMESTAMP}.json`)

// Ensure directories exist
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true })
}

/**
 * Run Playwright tests and collect results
 */
async function runTests() {
  console.log('Running browser compatibility tests...')
  try {
    // Run tests and capture output
    execSync(
      'pnpm playwright test tests/browser/responsive.spec.ts --config=playwright.config.ts --reporter=json',
      {
        stdio: ['inherit', 'pipe', 'inherit'],
        encoding: 'utf-8',
      },
    )
    console.log('Tests completed successfully.')
    return true
  } catch (error) {
    console.error('Failed to run browser compatibility tests:', error)
    return false
  }
}

/**
 * Process test results and gather compatibility data
 */
async function processResults() {
  console.log('Processing test results...')

  // Initialize report structure
  const report = {
    timestamp: TIMESTAMP,
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      browserResults: {},
    },
    issues: [],
    browsers: {},
    screenshots: [],
  }

  // Find all result files
  const files = fs.readdirSync(SCREENSHOTS_DIR)
  const resultFiles = files.filter((file) => file.endsWith('-results.json'))

  if (resultFiles.length === 0) {
    console.log('No test results found. Did the tests run correctly?')
    return report
  }

  // Process each result file
  for (const resultFile of resultFiles) {
    const resultPath = path.join(SCREENSHOTS_DIR, resultFile)
    const resultData = JSON.parse(fs.readFileSync(resultPath, 'utf8'))

    // Process test suites
    for (const suite of resultData.suites || []) {
      processTestSuite(suite, report)
    }
  }

  // Find all screenshots and add to report
  try {
    collectScreenshots(report)
  } catch (error) {
    console.error('Error collecting screenshots:', error)
  }

  // Calculate summary statistics
  report.summary.total = report.summary.passed + report.summary.failed

  return report
}

/**
 * Process a test suite recursively
 */
function processTestSuite(suite, report) {
  // Process specs in this suite
  for (const spec of suite.specs || []) {
    processTestSpec(spec, report)
  }

  // Process child suites
  for (const childSuite of suite.suites || []) {
    processTestSuite(childSuite, report)
  }
}

/**
 * Process an individual test spec
 */
function processTestSpec(spec, report) {
  const testName = spec.title

  // Extract browser information from test title
  const browserMatch = testName.match(
    /(Chrome|Firefox|Safari|Edge|Mobile Chrome|Mobile Safari)/i,
  )
  const browser = browserMatch ? browserMatch[1] : 'Unknown'

  // Initialize browser data if not exists
  if (!report.browsers[browser]) {
    report.browsers[browser] = {
      tests: 0,
      passed: 0,
      failed: 0,
    }
  }
  if (!report.summary.browserResults[browser]) {
    report.summary.browserResults[browser] = {
      total: 0,
      passed: 0,
      failed: 0,
    }
  }

  report.browsers[browser].tests++
  report.summary.browserResults[browser].total++

  // Check test results
  let testPassed = true

  for (const result of spec.tests || []) {
    for (const run of result.results || []) {
      if (run.status !== 'passed') {
        testPassed = false

        // Record issue
        report.issues.push({
          browser,
          test: testName,
          status: run.status,
          error: run.error?.message || 'Unknown error',
          location: spec.file,
          severity: run.status === 'failed' ? 'major' : 'minor',
        })
      }
    }
  }

  // Update counters
  if (testPassed) {
    report.summary.passed++
    report.browsers[browser].passed++
    report.summary.browserResults[browser].passed++
  } else {
    report.summary.failed++
    report.browsers[browser].failed++
    report.summary.browserResults[browser].failed++
  }
}

/**
 * Collect screenshots from test results
 */
function collectScreenshots(report) {
  try {
    const files = fs.readdirSync(SCREENSHOTS_DIR)
    const screenshots = files.filter((file) => file.endsWith('.png'))

    // Process each screenshot
    for (const screenshot of screenshots) {
      // Extract browser info from filename
      const browserMatch = screenshot.match(
        /(chrome|firefox|safari|edge|webkit)/i,
      )
      const browser = browserMatch ? browserMatch[1] : 'unknown'

      // Extract test info from filename
      const testMatch = screenshot.match(
        /-(mobile|desktop|tablet)-([a-z-]+)\.png$/i,
      )
      const deviceType = testMatch ? testMatch[1] : 'unknown'
      const testName = testMatch ? testMatch[2] : screenshot

      // Add to report
      report.screenshots.push({
        browser,
        deviceType,
        testName,
        path: path.join(SCREENSHOTS_DIR, screenshot),
      })
    }
  } catch (error) {
    console.error('Error processing screenshots:', error)
  }
}

/**
 * Generate a Markdown report
 */
function generateMarkdownReport(report) {
  const reportPath = path.join(
    OUTPUT_DIR,
    `compatibility-report-${TIMESTAMP.slice(0, 10)}.md`,
  )

  let markdown = `# Browser Compatibility Report\n\n`
  markdown += `Generated: ${new Date(TIMESTAMP).toLocaleString()}\n\n`

  // Summary section
  markdown += `## Summary\n\n`
  markdown += `- Total Tests: ${report.summary.total}\n`
  markdown += `- Passed: ${report.summary.passed} (${Math.round((report.summary.passed / report.summary.total) * 100)}%)\n`
  markdown += `- Failed: ${report.summary.failed} (${Math.round((report.summary.failed / report.summary.total) * 100)}%)\n\n`

  // Browser results
  markdown += `## Browser Results\n\n`
  markdown += `| Browser | Tests | Passed | Failed | Pass Rate |\n`
  markdown += `| ------- | ----- | ------ | ------ | --------- |\n`

  for (const [browser, data] of Object.entries(report.summary.browserResults)) {
    const passRate =
      data.total > 0 ? Math.round((data.passed / data.total) * 100) : 0
    markdown += `| ${browser} | ${data.total} | ${data.passed} | ${data.failed} | ${passRate}% |\n`
  }

  // Issues section
  if (report.issues.length > 0) {
    markdown += `\n## Issues\n\n`

    for (const issue of report.issues) {
      markdown += `### ${issue.browser}: ${issue.test}\n\n`
      markdown += `- **Severity:** ${issue.severity}\n`
      markdown += `- **Status:** ${issue.status}\n`
      markdown += `- **Location:** ${issue.location}\n`

      if (issue.error) {
        markdown += `- **Error:** ${issue.error}\n`
      }

      markdown += `\n`
    }
  }

  fs.writeFileSync(reportPath, markdown)
  console.log(`Markdown report generated: ${reportPath}`)
  return reportPath
}

/**
 * Main function
 */
async function main() {
  console.log('Starting browser compatibility report generation...')

  // Run tests
  await runTests()

  // Process results
  const report = await processResults()

  // Save JSON report
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2))
  console.log(`JSON report saved: ${REPORT_FILE}`)

  // Generate Markdown report
  const mdReport = generateMarkdownReport(report)

  // Check for issues
  if (report.issues.length > 0) {
    console.log(`\n🚨 Found ${report.issues.length} compatibility issues.`)
    console.log(`See the full report at: ${mdReport}`)
    process.exit(1) // Exit with error code
  } else {
    console.log('\n✅ No compatibility issues found.')
    process.exit(0)
  }
}

// Run the script
main().catch((error) => {
  console.error('Error generating compatibility report:', error)
  process.exit(1)
})
