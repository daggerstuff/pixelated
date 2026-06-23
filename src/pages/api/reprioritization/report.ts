import type { ReprioritizationReport } from '@/lib/memory/reprioritization_engine'

import {
  jsonError,
  jsonResponse,
  withAuthenticatedReprioritizationRoute,
  getRedis,
} from './_shared'

function parseReport(raw: string): ReprioritizationReport {
  return JSON.parse(raw) as ReprioritizationReport
}

export const GET = withAuthenticatedReprioritizationRoute(
  'fetching reprioritization report',
  async ({ params }, _user) => {
    const redis = getRedis()
    await redis.connect()

    // Handle GET /api/reprioritization/report/:runId
    if (params?.['runId']) {
      const runId = params['runId']
      const reportData = await redis.get(`reprioritization:report:${runId}`)

      if (!reportData) {
        return jsonError(404, 'Not Found', 'Reprioritization report not found')
      }

      try {
        const report = parseReport(reportData)
        return jsonResponse({
          success: true,
          runId: report['runId'],
          timestamp: report.timestamp,
          humanReadableSummary: generateHumanReadableSummary(report),
          report,
        })
      } catch {
        return jsonError(
          500,
          'Internal Server Error',
          'Failed to parse reprioritization report',
        )
      }
    }

    // Handle GET /api/reprioritization/report (latest report)
    const keys = await redis.keys('reprioritization:report:*')
    if (keys.length === 0) {
      return jsonError(404, 'Not Found', 'No reprioritization reports found')
    }

    // Find the report with the latest timestamp
    let latestReport: ReprioritizationReport | null = null
    let latestTimestamp = 0

    for (const key of keys) {
      const reportData = await redis.get(key)
      if (reportData) {
        try {
          const report = parseReport(reportData)
          const timestamp = new Date(report['timestamp']).getTime()
          if (timestamp > latestTimestamp) {
            latestTimestamp = timestamp
            latestReport = report
          }
        } catch {
          // Skip invalid reports
          continue
        }
      }
    }

    if (!latestReport) {
      return jsonError(
        500,
        'Internal Server Error',
        'Failed to retrieve latest reprioritization report',
      )
    }

    return jsonResponse({
      success: true,
      runId: latestReport['runId'],
      timestamp: latestReport.timestamp,
      humanReadableSummary: generateHumanReadableSummary(latestReport),
      report: latestReport,
    })
  },
)

export const POST = withAuthenticatedReprioritizationRoute(
  'triggering reprioritization run',
  async (_context, _user) => {
    return jsonResponse(
      {
        success: true,
        message:
          'Reprioritization trigger endpoint - implementation would call scheduler.triggerRun()',
        timestamp: new Date().toISOString(),
      },
      202,
    )
  },
)

function generateHumanReadableSummary(report: ReprioritizationReport): string {
  const {
    backlogItemsCreated,
    backlogItemsReprioritized,
    priorityChanges,
    actionablePatterns,
    totalEvidencePoints,
  } = report

  const upgradedCount = priorityChanges.filter(
    (change) =>
      ['urgent', 'high', 'medium', 'low', 'backlog'].indexOf(change.newTier) >
      ['urgent', 'high', 'medium', 'low', 'backlog'].indexOf(
        change.previousTier ?? 'backlog',
      ),
  ).length

  const downgradedCount = priorityChanges.length - upgradedCount

  return (
    `Processed ${totalEvidencePoints} evidence points from ${actionablePatterns} actionable patterns. ` +
    `Created ${backlogItemsCreated} new backlog items, reprioritized ${backlogItemsReprioritized} existing items. ` +
    `Priority changes: ${upgradedCount} upgraded, ${downgradedCount} downgraded.`
  )
}
