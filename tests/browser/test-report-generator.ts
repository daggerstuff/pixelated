import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

interface TestResult {
  test: string
  browser: string
  status: 'passed' | 'failed' | 'skipped' | 'warning' | 'error'
  details?: any
  error?: string
  viewport?: string
}

interface TestReport {
  summary: {
    totalTests: number
    passedTests: number
    failedTests: number
    skippedTests: number
    passRate: number
    browserStats: Record<
      string,
      { passed: number; failed: number; skipped: number }
    >
  }
  details: TestResult[]
  recommendations: Recommendation[]
}

interface Recommendation {
  priority: 'high' | 'medium' | 'low'
  category: string
  browser?: string
  message: string
  details?: any
}

export class TestReportGenerator {
  private reportDir = 'tests/reports'

  constructor() {
    mkdirSync(this.reportDir, { recursive: true })
  }

  generateHTMLReport(
    report: TestReport,
    outputFile: string = 'theme-test-report.html',
  ) {
    const html = this.buildHTMLReport(report)
    const filePath = join(this.reportDir, outputFile)
    writeFileSync(filePath, html)
    return filePath
  }

  generateMarkdownReport(
    report: TestReport,
    outputFile: string = 'theme-test-report.md',
  ) {
    const markdown = this.buildMarkdownReport(report)
    const filePath = join(this.reportDir, outputFile)
    writeFileSync(filePath, markdown)
    return filePath
  }

  generateJSONReport(
    report: TestReport,
    outputFile: string = 'theme-test-report.json',
  ) {
    const json = JSON.stringify(report, null, 2)
    const filePath = join(this.reportDir, outputFile)
    writeFileSync(filePath, json)
    return filePath
  }

  private buildHTMLReport(report: TestReport): string {
    const { summary, details, recommendations } = report

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Theme Implementation Test Report</title>
    <style>
        :root {
            --bg-primary: #ffffff;
            --bg-secondary: #f8f9fa;
            --text-primary: #212529;
            --text-secondary: #6c757d;
            --border-color: #dee2e6;
            --success: #28a745;
            --warning: #ffc107;
            --danger: #dc3545;
            --info: #17a2b8;
        }

        .dark {
            --bg-primary: #1a1a1a;
            --bg-secondary: #2d2d2d;
            --text-primary: #ffffff;
            --text-secondary: #b3b3b3;
            --border-color: #404040;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: var(--text-primary);
            background-color: var(--bg-primary);
            margin: 0;
            padding: 20px;
            max-width: 1200px;
            margin: 0 auto;
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 2px solid var(--border-color);
            padding-bottom: 20px;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }

        .summary-card {
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 20px;
            text-align: center;
        }

        .summary-card h3 {
            margin-top: 0;
            color: var(--text-secondary);
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .summary-card .value {
            font-size: 2.5em;
            font-weight: bold;
            margin: 10px 0;
        }

        .pass-rate { color: var(--success); }
        .fail-rate { color: var(--danger); }
        .warning-rate { color: var(--warning); }

        .browser-stats {
            margin-bottom: 40px;
        }

        .browser-stats table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }

        .browser-stats th,
        .browser-stats td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid var(--border-color);
        }

        .browser-stats th {
            background-color: var(--bg-secondary);
            font-weight: 600;
        }

        .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
            text-transform: uppercase;
        }

        .status-passed { background-color: var(--success); color: white; }
        .status-failed { background-color: var(--danger); color: white; }
        .status-warning { background-color: var(--warning); color: black; }
        .status-skipped { background-color: var(--info); color: white; }

        .recommendations {
            margin-bottom: 40px;
        }

        .recommendation {
            background: var(--bg-secondary);
            border-left: 4px solid var(--info);
            padding: 16px;
            margin: 16px 0;
            border-radius: 0 8px 8px 0;
        }

        .recommendation.high {
            border-left-color: var(--danger);
        }

        .recommendation.medium {
            border-left-color: var(--warning);
        }

        .recommendation.low {
            border-left-color: var(--info);
        }

        .test-details {
            margin-bottom: 40px;
        }

        .test-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }

        .test-table th,
        .test-table td {
            padding: 10px 12px;
            text-align: left;
            border-bottom: 1px solid var(--border-color);
        }

        .test-table th {
            background-color: var(--bg-secondary);
            font-weight: 600;
        }

        .test-table tr:hover {
            background-color: var(--bg-secondary);
        }

        .theme-toggle {
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 8px 12px;
            cursor: pointer;
            font-size: 14px;
        }

        @media (max-width: 768px) {
            .summary-grid {
                grid-template-columns: 1fr;
            }

            .test-table {
                font-size: 14px;
            }

            .test-table th,
            .test-table td {
                padding: 8px;
            }
        }
    </style>
</head>
<body>
    <button class="theme-toggle" onclick="toggleTheme()">🌓 Toggle Theme</button>

    <div class="header">
        <h1>🎨 Theme Implementation Test Report</h1>
        <p>Comprehensive cross-browser compatibility and performance testing</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    </div>

    <div class="summary-grid">
        <div class="summary-card">
            <h3>Total Tests</h3>
            <div class="value">${summary.totalTests}</div>
        </div>
        <div class="summary-card">
            <h3>Pass Rate</h3>
            <div class="value pass-rate">${summary.passRate.toFixed(1)}%</div>
        </div>
        <div class="summary-card">
            <h3>Passed</h3>
            <div class="value" style="color: var(--success)">${summary.passedTests}</div>
        </div>
        <div class="summary-card">
            <h3>Failed</h3>
            <div class="value" style="color: var(--danger)">${summary.failedTests}</div>
        </div>
    </div>

    <div class="browser-stats">
        <h2>📊 Browser Compatibility Summary</h2>
        <table>
            <thead>
                <tr>
                    <th>Browser</th>
                    <th>Passed</th>
                    <th>Failed</th>
                    <th>Skipped</th>
                    <th>Success Rate</th>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(summary.browserStats)
                  .map(([browser, stats]) => {
                    const total = stats.passed + stats.failed + stats.skipped
                    const successRate =
                      total > 0 ? (stats.passed / total) * 100 : 0
                    return `
                    <tr>
                        <td><strong>${browser}</strong></td>
                        <td><span class="status-badge status-passed">${stats.passed}</span></td>
                        <td><span class="status-badge status-failed">${stats.failed}</span></td>
                        <td><span class="status-badge status-skipped">${stats.skipped}</span></td>
                        <td>${successRate.toFixed(1)}%</td>
                    </tr>
                  `
                  })
                  .join('')}
            </tbody>
        </table>
    </div>

    <div class="recommendations">
        <h2>💡 Recommendations</h2>
        ${recommendations
          .map(
            (rec) => `
            <div class="recommendation ${rec.priority}">
                <strong>${rec.priority.toUpperCase()}:</strong> ${rec.message}
                ${rec.browser ? `<br><em>Browser: ${rec.browser}</em>` : ''}
                ${rec.category ? `<br><em>Category: ${rec.category}</em>` : ''}
            </div>
        `,
          )
          .join('')}
    </div>

    <div class="test-details">
        <h2>🔍 Detailed Test Results</h2>
        <table class="test-table">
            <thead>
                <tr>
                    <th>Test</th>
                    <th>Browser</th>
                    <th>Status</th>
                    <th>Details</th>
                </tr>
            </thead>
            <tbody>
                ${details
                  .map(
                    (test) => `
                    <tr>
                        <td><strong>${test.test}</strong></td>
                        <td>${test.browser}${test.viewport ? ` (${test.viewport})` : ''}</td>
                        <td><span class="status-badge status-${test.status}">${test.status}</span></td>
                        <td>${test.error || test.details?.message || 'No additional details'}</td>
                    </tr>
                `,
                  )
                  .join('')}
            </tbody>
        </table>
    </div>

    <script>
        function toggleTheme() {
            const body = document.body;
            const isDark = body.classList.contains('dark');

            if (isDark) {
                body.classList.remove('dark');
                localStorage.setItem('theme', 'light');
            } else {
                body.classList.add('dark');
                localStorage.setItem('theme', 'dark');
            }
        }

        // Load saved theme preference
        const savedTheme = localStorage.getItem('theme') || 'light';
        if (savedTheme === 'dark') {
            document.body.classList.add('dark');
        }

        // Auto-refresh every 30 seconds if in development
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            setTimeout(() => {
                if (confirm('Would you like to refresh the test report?')) {
                    location.reload();
                }
            }, 30000);
        }
    </script>
</body>
</html>
    `
  }

  private buildMarkdownReport(report: TestReport): string {
    const { summary, details, recommendations } = report

    return `# 🎨 Theme Implementation Test Report

Generated on: ${new Date().toLocaleString()}

## 📊 Summary

| Metric | Value |
|--------|-------|
| Total Tests | ${summary.totalTests} |
| Pass Rate | ${summary.passRate.toFixed(1)}% |
| Passed | ${summary.passedTests} |
| Failed | ${summary.failedTests} |
| Skipped | ${summary.skippedTests} |

## 🌐 Browser Compatibility

| Browser | Passed | Failed | Skipped | Success Rate |
|---------|--------|--------|---------|--------------|
${Object.entries(summary.browserStats)
  .map(([browser, stats]) => {
    const total = stats.passed + stats.failed + stats.skipped
    const successRate = total > 0 ? (stats.passed / total) * 100 : 0
    return `| ${browser} | ${stats.passed} | ${stats.failed} | ${stats.skipped} | ${successRate.toFixed(1)}% |`
  })
  .join('\n')}

## 💡 Recommendations

${recommendations
  .map((rec) => {
    const priority = rec.priority.toUpperCase()
    const browserInfo = rec.browser ? ` (${rec.browser})` : ''
    const categoryInfo = rec.category ? ` [${rec.category}]` : ''
    return `- **${priority}**${browserInfo}${categoryInfo}: ${rec.message}`
  })
  .join('\n')}

## 🔍 Detailed Test Results

| Test | Browser | Status | Details |
|------|---------|--------|---------|
${details
  .map((test) => {
    const viewport = test.viewport ? ` (${test.viewport})` : ''
    const details =
      test.error || test.details?.message || 'No additional details'
    return `| ${test.test} | ${test.browser}${viewport} | ${test.status} | ${details} |`
  })
  .join('\n')}

## 🚀 Next Steps

1. **Address High Priority Issues**: Focus on browser-specific failures and performance bottlenecks
2. **Optimize for Mobile**: Ensure responsive design works across all device sizes
3. **Accessibility Audit**: Review color contrast and keyboard navigation
4. **Performance Tuning**: Optimize CSS transitions and reduce layout thrashing
5. **Cross-Browser Testing**: Test on additional browser versions and devices

---

*This report was generated automatically by the Theme Implementation Test Suite*
`
  }

  generateExecutiveSummary(report: TestReport): string {
    const { summary, recommendations } = report

    const highPriorityIssues = recommendations.filter(
      (r) => r.priority === 'high',
    ).length
    const mediumPriorityIssues = recommendations.filter(
      (r) => r.priority === 'medium',
    ).length

    return `
## Executive Summary

**Overall Status**: ${summary.passRate >= 90 ? '✅ Excellent' : summary.passRate >= 80 ? '⚠️ Good' : '❌ Needs Attention'}

**Key Findings**:
- ${summary.totalTests} tests executed across multiple browsers and devices
- ${summary.passRate.toFixed(1)}% pass rate with ${summary.failedTests} failures
- ${highPriorityIssues} high-priority issues requiring immediate attention
- ${mediumPriorityIssues} medium-priority issues for optimization

**Critical Issues**:
${recommendations
  .filter((r) => r.priority === 'high')
  .map((rec) => `- ${rec.message}`)
  .join('\n')}

**Recommended Actions**:
1. Address browser-specific compatibility issues
2. Optimize performance for theme switching
3. Enhance accessibility compliance
4. Improve responsive design consistency
`
  }
}
