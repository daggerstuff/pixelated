/**
 * Monthly Bias Audit Runner Script
 *
 * Usage: pnpm tsx scripts/bias-audit/run-monthly-audit.ts [YYYY-MM]
 *
 * Generates a bias audit report and writes it to ai/data/reports/bias-audit-YYYY-MM.json.
 * Sets GitHub Actions outputs for downstream workflow steps.
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { getBiasAuditRunner } from '../../apps/web/src/lib/ai/bias-detection/audit-runner'
import type { TherapeuticSession } from '../../apps/web/src/lib/ai/bias-detection/types'

const month = process.argv[2] ?? new Date().toISOString().slice(0, 7)

/**
 * Generate synthetic sessions for the audit.
 *
 * In production, this would fetch real sessions from the database
 * with proper PHI redaction. The synthetic data ensures the audit
 * runner can execute end-to-end in CI without database access.
 */
function generateSyntheticSessions(): TherapeuticSession[] {
  const demographics = [
    {
      age: '18-25',
      gender: 'female',
      ethnicity: 'asian',
      socioeconomicStatus: 'middle',
      culturalBackground: ['east-asian'],
    },
    {
      age: '26-35',
      gender: 'male',
      ethnicity: 'white',
      socioeconomicStatus: 'upper',
      culturalBackground: ['european'],
    },
    {
      age: '36-50',
      gender: 'female',
      ethnicity: 'black',
      socioeconomicStatus: 'lower',
      culturalBackground: ['african'],
    },
    {
      age: '51-65',
      gender: 'male',
      ethnicity: 'hispanic',
      socioeconomicStatus: 'middle',
      culturalBackground: ['latino'],
    },
    {
      age: '65+',
      gender: 'female',
      ethnicity: 'white',
      socioeconomicStatus: 'middle',
      culturalBackground: ['european'],
    },
  ]

  const sessions: TherapeuticSession[] = []
  let counter = 0

  for (const demo of demographics) {
    for (let i = 0; i < 30; i++) {
      const sessionId = `session-${counter++}`
      const responses = []
      for (let j = 0; j < 5; j++) {
        responses.push({
          responseId: `${sessionId}-resp-${j}`,
          text: `Sample therapeutic response ${j} for session ${counter}`,
          timestamp: new Date(),
          type: 'intervention' as const,
          confidence: 0.65 + Math.random() * 0.3,
          modelUsed: 'llama-3.1-70b',
        })
      }
      sessions.push({
        sessionId,
        participantDemographics: demo,
        aiResponses: responses,
        expectedOutcomes: [
          {
            outcomeId: `${sessionId}-o1`,
            description: 'Patient engagement',
            achieved: Math.random() > 0.2,
          },
          {
            outcomeId: `${sessionId}-o2`,
            description: 'Skill demonstration',
            achieved: Math.random() > 0.3,
          },
        ],
      })
    }
  }

  return sessions
}

async function main() {
  console.log(`Starting bias audit for ${month}...`)

  const runner = getBiasAuditRunner()
  const sessions = generateSyntheticSessions()
  const report = await runner.runAudit(sessions, { month })

  // Ensure directory exists
  mkdirSync('ai/data/reports', { recursive: true })

  // Write report
  const reportPath = runner.getReportPath(report.month)
  writeFileSync(reportPath, runner.serializeReport(report))

  console.log(`Report written to: ${reportPath}`)
  console.log(`Summary: ${report.summary}`)
  console.log(`Alert level: ${report.alertLevel}`)
  console.log(`Threshold exceeded: ${report.thresholdExceeded}`)
  console.log(`Segments analyzed: ${report.segments.length}`)
  console.log(`Total sessions: ${report.totalSessions}`)

  // Set GitHub Actions outputs
  const ghaOutput = process.env.GITHUB_OUTPUT
  if (ghaOutput) {
    const fs = await import('node:fs')
    const lines = [
      `alert-level=${report.alertLevel}`,
      `threshold-exceeded=${report.thresholdExceeded}`,
      `report-path=${reportPath}`,
      `month=${report.month}`,
    ]
    fs.appendFileSync(ghaOutput, lines.join('\n') + '\n')
  }
}

main().catch((err) => {
  console.error('Bias audit failed:', err)
  process.exit(1)
})
