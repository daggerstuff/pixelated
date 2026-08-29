import { fileURLToPath } from 'node:url'

import type { ToolContext } from 'eve/tools'
import { describe, expect, it } from 'vitest'

import auditCorpus from '../agent/tools/audit_corpus.js'
import curateShowcase from '../agent/tools/curate_showcase.js'
import gateInjection from '../agent/tools/gate_injection.js'

const CORPUS = fileURLToPath(
  new URL(
    '../../../hackathon/pixelated_email_dump_combined.json',
    import.meta.url,
  ),
)

const noopToolContext = {} as unknown as ToolContext

describe('demo-qa-agent tools against the real hackathon corpus', () => {
  it('audit_corpus runs over 800+ real records without throwing', async () => {
    const result = (await auditCorpus.execute(
      { corpus_path: CORPUS },
      noopToolContext,
    )) as {
      total_records: number
      thread_count: number
      blocking_count: number
      pass: boolean
      findings: { class: string }[]
    }
    expect(result.total_records).toBeGreaterThan(800)
    expect(result.thread_count).toBeGreaterThan(0)
    expect(Array.isArray(result.findings)).toBe(true)
  })

  it('curate_showcase picks demo-ready threads (no dup subjects)', async () => {
    const result = (await curateShowcase.execute(
      { corpus_path: CORPUS, target_count: 15 },
      noopToolContext,
    )) as {
      picked_count: number
      picks: { thread_id: string; subject: string }[]
    }
    const subjects = result.picks.map((p) => p.subject.toLowerCase().trim())
    const unique = new Set(subjects)
    expect(result.picked_count).toBeGreaterThan(0)
    expect(unique.size).toBe(subjects.length)
  })

  it('gate_injection blocks when audit is not cleared', async () => {
    const result = (await gateInjection.execute(
      {
        last_audit_pass: false,
        last_audit_blocking_count: 5,
        target: 'both',
        dry_run: true,
      },
      noopToolContext,
    )) as { authorized: boolean; state: string }
    expect(result.authorized).toBe(false)
    expect(result.state).toBe('BLOCKED')
  })

  it('gate_injection stays AWAITING_APPROVAL under dry_run even when audit cleared', async () => {
    const result = (await gateInjection.execute(
      {
        last_audit_pass: true,
        last_audit_blocking_count: 0,
        target: 'gmail',
        dry_run: true,
      },
      noopToolContext,
    )) as { authorized: boolean; state: string }
    expect(result.authorized).toBe(false)
    expect(result.state).toBe('AWAITING_APPROVAL')
  })
})
