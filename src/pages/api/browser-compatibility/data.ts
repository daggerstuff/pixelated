import type { APIRoute } from 'astro'
import fs from 'node:fs'
import path from 'node:path'

/**
 * API endpoint to fetch browser compatibility data from reports
 *
 * This API reads report files from the browser-compatibility/reports directory
 * and returns the data for displaying in the dashboard.
 *
 * Query parameters:
 * - latest: boolean - If true, only return the most recent report
 * - days: number - Only return reports from the last X days
 * - browsers: string - Comma-separated list of browsers to filter reports for
 * - since: string - ISO timestamp - Only return issues that occurred after this timestamp
 */
export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url)
    const latestOnly = url.searchParams.get('latest') === 'true'
    const days = parseInt(url.searchParams.get('days') || '30')
    const browsers = url.searchParams.get('browsers')?.split(',') || []
    const since = url.searchParams.get('since') || null

    // Get report files
    const reportsDir = path.join(
      process.cwd(),
      'browser-compatibility',
      'reports',
    )
    if (!fs.existsSync(reportsDir)) {
      return new Response(
        JSON.stringify({
          error: 'No compatibility reports found',
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Read report files
    const reportFiles = fs
      .readdirSync(reportsDir)
      .filter(
        (file) => file.endsWith('.json') && file.startsWith('compatibility-'),
      )
      .sort()
      .reverse() // Get most recent first

    if (reportFiles.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'No compatibility reports found',
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Calculate date threshold for filtering by days
    const now = new Date()
    const threshold = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

    // Parse the since timestamp if provided
    const sinceDate = since ? new Date(since) : null

    // Process reports
    let reports = []
    const filesToProcess = latestOnly ? [reportFiles[0]] : reportFiles

    for (const file of filesToProcess) {
      const reportPath = path.join(reportsDir, file)
      const fileContent = fs.readFileSync(reportPath, 'utf8')
      const report = JSON.parse(fileContent)

      // Skip reports older than the threshold
      const reportDate = new Date(report.timestamp)
      if (reportDate < threshold) {
        continue
      }

      // Filter by browsers if specified
      if (browsers.length > 0) {
        // Filter report issues and test results by selected browsers
        const filteredBrowsers = Object.fromEntries(
          Object.entries(report.browsers || {}).filter(([key]) =>
            browsers.includes(key),
          ),
        )

        report.browsers = filteredBrowsers

        if (report.issues) {
          report.issues = report.issues.filter((issue: { browser: string }) =>
            browsers.includes(issue.browser),
          )
        }

        if (report.tests) {
          report.tests = report.tests.filter((test: { browser: string }) =>
            browsers.includes(test.browser),
          )
        }
      }

      // Filter issues by timestamp if 'since' parameter was provided
      if (sinceDate && report.issues) {
        report.issues = report.issues.filter(
          (issue: { timestamp?: string }) => {
            if (!issue.timestamp) {
              return false
            }
            const issueDate = new Date(issue.timestamp)
            return issueDate >= sinceDate
          },
        )
      }

      reports.push({
        timestamp: report.timestamp,
        summary: report.summary,
        issues: report.issues || [],
        browsers: report.browsers || {},
        tests: report.tests || [],
        screenshots: report.screenshots || [],
      })
    }

    // Prepare response data
    const responseData = {
      reports: reports,
      meta: {
        total: reports.length,
        latest: reports.length > 0 ? reports[0].timestamp : null,
        hasNewIssues: reports.some(
          (report) => report.issues && report.issues.length > 0,
        ),
      },
    }

    // Return the response
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Error fetching compatibility data:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}
