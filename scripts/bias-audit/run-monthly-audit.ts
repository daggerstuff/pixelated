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
 * xmur3 string hash — produces a 32-bit seed from the audit month so that
 * monthly reports are reproducible run-to-run (same month → same data →
 * month-over-month deltas reflect data changes, not RNG redraws).
 */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return (h ^= h >>> 16) >>> 0
  }
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const random = mulberry32(xmur3(month)())

/**
 * Generate synthetic sessions for the audit.
 *
 * In production, this would fetch real sessions from the database
 * with proper PHI redaction. The synthetic data ensures the audit
 * runner can execute end-to-end in CI without database access.
 *
 * Response text uses a zero-padded session index so segment text length is
 * uncorrelated with generation order — otherwise averageResponseLength
 * variance measures digit growth, not bias.
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
      const n = counter++
      const sessionId = `session-${n}`
      const responses = []
      for (let j = 0; j < 5; j++) {
        responses.push({
          responseId: `${sessionId}-resp-${j}`,
          text: `Sample therapeutic response ${j} for session ${String(n).padStart(3, '0')}`,
          timestamp: new Date(),
          type: 'intervention' as const,
          confidence: 0.65 + random() * 0.3,
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
            achieved: random() > 0.2,
          },
          {
            outcomeId: `${sessionId}-o2`,
            description: 'Skill demonstration',
            achieved: random() > 0.3,
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
