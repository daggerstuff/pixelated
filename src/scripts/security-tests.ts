#!/usr/bin/env node

/**
 * Security Testing Scrip
 *
 * This script runs a comprehensive suite of security tests including:
 * - API endpoint security testing
 * - Authentication bypass testing
 * - Web vulnerability scanning
 * - CORS policy verification
 * - Rate limiting verification
 * - Input validation testing
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

interface TestResult {
  name: string
  passed: boolean
  details: string[]
  severity: 'low' | 'medium' | 'high' | 'critical'
}

interface TestSuite {
  name: string
  results: TestResult[]
  startTime: number
  endTime: number
  passed: boolean
}

const results: TestSuite[] = []

/**
 * Run a test command and capture its outpu
 */
async function runTest(
  name: string,
  command: string,
  args: string[],
): Promise<TestResult[]> {
  console.log(`\n🔒 Running ${name}...`)

  const result = spawnSync(command, args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    encoding: 'utf-8',
  })

  if (result.status !== 0) {
    console.error(`❌ ${name} failed with status ${result.status}`)
    console.error(result?.stderr)
    return [
      {
        name,
        passed: false,
        details: [result?.stderr],
        severity: 'critical',
      },
    ]
  }

  try {
    return JSON.parse(result?.stdout)
  } catch (error) {
    console.error(`Failed to parse test results for ${name}:`, error)
    return [
      {
        name,
        passed: false,
        details: ['Failed to parse test results'],
        severity: 'critical',
      },
    ]
  }
}

/**
 * Generate HTML report
 */
async function generateReport(suites: TestSuite[]): Promise<string> {
  const totalTests = suites.reduce(
    (sum, suite) => sum + suite.results.length,
    0,
  )
  const passedTests = suites.reduce(
    (sum, suite) => sum + suite.results.filter((r) => r.passed).length,
    0,
  )
  const failedTests = totalTests - passedTests

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Test Results</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
      background: #f5f5f5;
    }
    .header {
      background: #fff;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 2rem;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .summary-item {
      background: #fff;
      padding: 1rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .suite {
      background: #fff;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 1rem;
    }
    .test {
      border-left: 4px solid;
      padding: 1rem;
      margin: 1rem 0;
    }
    .test.passed { border-color: #4caf50; }
    .test.failed { border-color: #f44336; }
    .severity {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.875rem;
      font-weight: 500;
    }
    .severity.critical { background: #ffebee; color: #c62828; }
    .severity.high { background: #fff3e0; color: #e65100; }
    .severity.medium { background: #fff8e1; color: #ffa000; }
    .severity.low { background: #f1f8e9; color: #558b2f; }
    .details {
      background: #f8f9fa;
      padding: 1rem;
      border-radius: 4px;
      margin-top: 0.5rem;
      white-space: pre-wrap;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Security Test Results</h1>
    <p>Generated on ${new Date().toLocaleString()}</p>
  </div>

  <div class="summary">
    <div class="summary-item">
      <h3>Total Tests</h3>
      <p>${totalTests}</p>
    </div>
    <div class="summary-item">
      <h3>Passed</h3>
      <p style="color: #4caf50">${passedTests}</p>
    </div>
    <div class="summary-item">
      <h3>Failed</h3>
      <p style="color: #f44336">${failedTests}</p>
    </div>
    <div class="summary-item">
      <h3>Success Rate</h3>
      <p>${((passedTests / totalTests) * 100).toFixed(1)}%</p>
    </div>
  </div>

  ${suites
    .map(
      (suite) => `
    <div class="suite">
      <h2>${suite.name}</h2>
      <p>Duration: ${((suite.endTime - suite.startTime) / 1000).toFixed(2)}s</p>
      ${suite.results
        .map(
          (test) => `
        <div class="test ${test.passed ? 'passed' : 'failed'}">
          <h3>
            ${test.passed ? '✅' : '❌'} ${test.name}
            <span class="severity ${test.severity}">${test.severity}</span>
          </h3>
          ${
            test.details.length > 0
              ? `<div class="details">${test.details.join('\n')}</div>`
              : ''
          }
        </div>
      `,
        )
        .join('')}
    </div>
  `,
    )
    .join('')}
</body>
</html>
  `

  const reportPath = path.join(process.cwd(), 'security-report.html')
  await fs.writeFile(reportPath, html)
  return reportPath
}

/**
 * Main function
 */
async function main() {
  console.log('=== Security Testing Suite ===')

  // 1. API Endpoint Security Tests
  const startTime = Date.now()
  const endpointResults = await runTest('API Endpoint Security Tests', 'pnpm', [
    'test:security:endpoint',
  ])
  results.push({
    name: 'API Endpoint Security',
    results: endpointResults,
    startTime,
    endTime: Date.now(),
    passed: endpointResults.every((r) => r.passed),
  })

  // 2. Authentication Bypass Tests
  const authStartTime = Date.now()
  const authResults = await runTest('Authentication Bypass Tests', 'pnpm', [
    'test:security:auth',
  ])
  results.push({
    name: 'Authentication Security',
    results: authResults,
    startTime: authStartTime,
    endTime: Date.now(),
    passed: authResults.every((r) => r.passed),
  })

  // 3. Web Vulnerability Tests
  const webStartTime = Date.now()
  const webResults = await runTest('Web Vulnerability Tests', 'pnpm', [
    'test:security:web',
  ])
  results.push({
    name: 'Web Security',
    results: webResults,
    startTime: webStartTime,
    endTime: Date.now(),
    passed: webResults.every((r) => r.passed),
  })

  // Generate and save report
  console.log('\n📊 Generating security report...')
  const reportPath = await generateReport(results)
  console.log(`📝 Report saved to: ${reportPath}`)

  // Check if any critical or high severity issues
  const criticalIssues = results.flatMap((suite) =>
    suite.results.filter(
      (r) => !r.passed && (r.severity === 'critical' || r.severity === 'high'),
    ),
  )

  if (criticalIssues.length > 0) {
    console.error('\n🚨 Critical security issues found:')
    criticalIssues.forEach((issue) => {
      console.error(`❌ ${issue.name} (${issue.severity})`)
      console.error(issue.details.join('\n'))
    })
    process.exit(1)
  }

  // Check overall test status
  const allPassed = results.every((suite) => suite.passed)
  if (!allPassed) {
    console.error(
      '\n❌ Some security tests failed. Check the report for details.',
    )
    process.exit(1)
  }

  console.log('\n✅ All security tests passed!')
  process.exit(0)
}

// Execute main function
main().catch(() => {
  console.error('Unhandled error')
  process.exit(1)
})
