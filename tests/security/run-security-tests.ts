#!/usr/bin/env ts-node

/**
 * AI Security Test Runner
 *
 * This script runs all security tests and generates a comprehensive report.
 * Tests include:
 * - Endpoint security tests
 * - Authentication bypass tests
 * - Web vulnerability tests
 * - HIPAA compliance tests
 */

import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { performance } from 'perf_hooks'
import { getEnvironment, getBaseUrl, getSecurityReportPath } from './utils/env'

// Get current directory equivalent to __dirname in CommonJS
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration
interface Config {
  outputDir: string
  reportTitle: string
  environment: string
  baseUrl: string
  authToken: string
  adminToken: string
}

interface TestItem {
  testName: string
  category: string
  severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational'
  status: 'Pass' | 'Fail' | 'Error'
  details: string
  evidence?: string
  responseTime?: number
  timestamp: string
}

interface TestResultOutput {
  suite: TestSuite
  output: string
  duration: number
  timestamp: string
}

interface TestSuite {
  name: string
  script: string
  description: string
  category: string
}

// Default configuration
const config: Config = {
  outputDir: getSecurityReportPath(),
  reportTitle: 'AI Security Test Report',
  environment: getEnvironment(),
  baseUrl: getBaseUrl(),
  authToken: 'user-token',
  adminToken: 'admin-token',
}

// Define test suites
const testSuites: TestSuite[] = [
  {
    name: 'Endpoint Security',
    script: 'ai-endpoint-scanner.ts',
    description: 'Tests AI endpoints for basic security issues',
    category: 'Endpoint Security',
  },
  {
    name: 'Authentication Bypass',
    script: 'ai-auth-bypass-tester.ts',
    description:
      'Tests for authentication and authorization bypass vulnerabilities',
    category: 'Authentication',
  },
  {
    name: 'Web Vulnerabilities',
    script: 'ai-web-vulnerability-scanner.ts',
    description: 'Tests for common web vulnerabilities',
    category: 'Web Security',
  },
]

// Ensure output directory exists
if (!fs.existsSync(config.outputDir)) {
  fs.mkdirSync(config.outputDir, { recursive: true })
}

// Create report file
const reportFile = path.join(
  config.outputDir,
  `ai-security-report-${new Date().toISOString().split('T')[0]}.html`,
)

/**
 * Run a test suite
 */
async function runTestSuite(suite: TestSuite): Promise<TestResultOutput> {
  return new Promise((resolve, reject) => {
    const startTime = performance.now()

    console.log(`\nRunning ${suite.name}...`)

    const scriptPath = path.join(__dirname, suite.script)

    const childProcess = spawn('ts-node', [scriptPath], {
      env: {
        ...(process.env as NodeJS.ProcessEnv),
        BASE_URL: config.baseUrl,
        AUTH_TOKEN: config.authToken,
        ADMIN_TOKEN: config.adminToken,
        NODE_ENV: config.environment,
      },
    })

    let output = ''
    let error = ''

    childProcess.stdout.on('data', (data: Buffer) => {
      output += data
      console.log(data.toString())
    })

    childProcess.stderr.on('data', (data: Buffer) => {
      error += data
      console.error(data.toString())
    })

    childProcess.on('close', (code: number) => {
      const endTime = performance.now()
      const duration = endTime - startTime

      if (code === 0) {
        resolve({
          suite,
          output,
          duration,
          timestamp: new Date().toISOString(),
        })
      } else {
        reject(
          new Error(
            `Test suite ${suite.name} failed with code ${code}: ${error}`,
          ),
        )
      }
    })
  })
}

/**
 * Generate HTML report
 */
function generateReport(results: TestResultOutput[]): string {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.reportTitle}</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
      }

      h1, h2, h3 {
        color: #2c3e50;
      }

      .summary {
        background: #f8f9fa;
        padding: 20px;
        border-radius: 5px;
        margin: 20px 0;
      }

      .test-suite {
        background: white;
        border: 1px solid #dee2e6;
        border-radius: 5px;
        padding: 20px;
        margin: 20px 0;
      }

      .test-suite h3 {
        margin-top: 0;
      }

      .vulnerability {
        background: #fff5f5;
        border-left: 4px solid #fc8181;
        padding: 15px;
        margin: 10px 0;
      }

      .vulnerability.critical {
        border-left-color: #e53e3e;
        background: #fff5f5;
      }

      .vulnerability.high {
        border-left-color: #ed8936;
        background: #fffaf0;
      }

      .vulnerability.medium {
        border-left-color: #ecc94b;
        background: #fffff0;
      }

      .vulnerability.low {
        border-left-color: #48bb78;
        background: #f0fff4;
      }

      .vulnerability h4 {
        margin: 0 0 10px 0;
        color: #2d3748;
      }

      .metadata {
        color: #718096;
        font-size: 0.9em;
      }

      .evidence {
        background: #2d3748;
        color: #e2e8f0;
        padding: 15px;
        border-radius: 5px;
        overflow-x: auto;
        margin: 10px 0;
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin: 20px 0;
      }

      .stat-card {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 5px;
        padding: 15px;
        text-align: center;
      }

      .stat-card h4 {
        margin: 0;
        color: #718096;
      }

      .stat-card .value {
        font-size: 2em;
        font-weight: bold;
        color: #2d3748;
      }

      .chart {
        width: 100%;
        height: 300px;
        margin: 20px 0;
      }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  </head>
  <body>
    <h1>${config.reportTitle}</h1>

    <div class="summary">
      <h2>Executive Summary</h2>
      <p>Security test report generated on ${new Date().toLocaleString()} for environment: ${config.environment}</p>

      <div class="stats">
        <div class="stat-card">
          <h4>Total Tests</h4>
          <div class="value">${results.length}</div>
        </div>
        <div class="stat-card">
          <h4>Critical Issues</h4>
          <div class="value" style="color: #e53e3e;">
            ${results.reduce((count, result) => {
              try {
                const data = JSON.parse(result.output) as TestItem[]
                return (
                  count +
                  data.filter((item: TestItem) => item.severity === 'Critical')
                    .length
                )
              } catch {
                return count
              }
            }, 0)}
          </div>
        </div>
        <div class="stat-card">
          <h4>High Issues</h4>
          <div class="value" style="color: #ed8936;">
            ${results.reduce((count, result) => {
              try {
                const data = JSON.parse(result.output) as TestItem[]
                return (
                  count +
                  data.filter((item: TestItem) => item.severity === 'High')
                    .length
                )
              } catch {
                return count
              }
            }, 0)}
          </div>
        </div>
        <div class="stat-card">
          <h4>Total Duration</h4>
          <div class="value">
            ${(results.reduce((total, result) => total + result.duration, 0) / 1000).toFixed(2)}s
          </div>
        </div>
      </div>

      <div class="chart">
        <canvas id="severityChart"></canvas>
      </div>
    </div>

    ${results
      .map(
        (result) => `
      <div class="test-suite">
        <h3>${result.suite.name}</h3>
        <p>${result.suite.description}</p>
        <div class="metadata">
          <strong>Duration:</strong> ${(result.duration / 1000).toFixed(2)}s
          <br>
          <strong>Timestamp:</strong> ${result.timestamp}
        </div>

        ${(() => {
          try {
            const data = JSON.parse(result.output) as TestItem[]
            return data
              .map(
                (item: TestItem) => `
              <div class="vulnerability ${item.severity.toLowerCase()}">
                <h4>${item.testName}</h4>
                <p>${item.details}</p>
                ${
                  item.evidence
                    ? `
                  <div class="evidence">
                    <pre><code>${item.evidence}</code></pre>
                  </div>
                `
                    : ''
                }
                <div class="metadata">
                  <strong>Severity:</strong> ${item.severity}
                  <br>
                  <strong>Category:</strong> ${item.category}
                  <br>
                  <strong>Response Time:</strong> ${((item.responseTime || 0) / 1000).toFixed(2)}s
                </div>
              </div>
            `,
              )
              .join('')
          } catch {
            return `<p>Error parsing test results</p>`
          }
        })()}
      </div>
    `,
      )
      .join('')}

    <script>
      // Create severity distribution chart
      const severityData = {
        Critical: ${results.reduce((count, result) => {
          try {
            const data = JSON.parse(result.output) as TestItem[]
            return (
              count +
              data.filter((item: TestItem) => item.severity === 'Critical')
                .length
            )
          } catch {
            return count
          }
        }, 0)},
        High: ${results.reduce((count, result) => {
          try {
            const data = JSON.parse(result.output) as TestItem[]
            return (
              count +
              data.filter((item: TestItem) => item.severity === 'High').length
            )
          } catch {
            return count
          }
        }, 0)},
        Medium: ${results.reduce((count, result) => {
          try {
            const data = JSON.parse(result.output) as TestItem[]
            return (
              count +
              data.filter((item: TestItem) => item.severity === 'Medium').length
            )
          } catch {
            return count
          }
        }, 0)},
        Low: ${results.reduce((count, result) => {
          try {
            const data = JSON.parse(result.output) as TestItem[]
            return (
              count +
              data.filter((item: TestItem) => item.severity === 'Low').length
            )
          } catch {
            return count
          }
        }, 0)}
      };

      new Chart(document.getElementById('severityChart'), {
        type: 'bar',
        data: {
          labels: Object.keys(severityData),
          datasets: [{
            label: 'Issues by Severity',
            data: Object.values(severityData),
            backgroundColor: [
              '#e53e3e',
              '#ed8936',
              '#ecc94b',
              '#48bb78'
            ]
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1
              }
            }
          }
        }
      });
    </script>
  </body>
  </html>
    `
}

/**
 * Run all tests and generate report
 */
async function runTests() {
  console.log('Starting AI security tests...')

  const results: TestResultOutput[] = []

  for (const suite of testSuites) {
    // Run the test and capture results
    try {
      const result = await runTestSuite(suite)
      results.push(result)
    } catch (error: unknown) {
      console.error(`Error running test suite ${suite.name}:`, error)
      results.push({
        suite,
        output: JSON.stringify([
          {
            testName: suite.name,
            category: suite.category,
            severity: 'High',
            status: 'Error',
            details: error instanceof Error ? String(error) : String(error),
            timestamp: new Date().toISOString(),
          },
        ]),
        duration: 0,
        timestamp: new Date().toISOString(),
      })
    }
  }

  // Generate and write report
  const report = generateReport(results)
  fs.writeFileSync(reportFile, report)

  console.log(`\nSecurity testing complete. Report saved to: ${reportFile}`)

  // Print summary
  const totalTests = results.length
  const totalDuration = results.reduce(
    (total, result) => total + result.duration,
    0,
  )

  console.log('\nSummary:')
  console.log(`- Total test suites: ${totalTests}`)
  console.log(`- Total duration: ${(totalDuration / 1000).toFixed(2)}s`)

  // Count issues by severity
  const severityCounts: Record<string, number> = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
  }

  results.forEach((result: TestResultOutput) => {
    try {
      const data = JSON.parse(result.output) as TestItem[]
      data.forEach((item: TestItem) => {
        if (item.severity && item.severity in severityCounts) {
          severityCounts[item.severity] =
            (severityCounts[item.severity] || 0) + 1
        }
      })
    } catch {
      // Ignore parsing errors
    }
  })

  console.log('\nIssues by severity:')
  Object.entries(severityCounts).forEach(([severity, count]) => {
    console.log(`- ${severity}: ${count}`)
  })
}

// Run tests
runTests().catch((error) => {
  console.error('Error running security tests:', error)
  process.exit(1)
})
