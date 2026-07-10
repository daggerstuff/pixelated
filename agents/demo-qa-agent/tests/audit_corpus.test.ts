import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { ToolContext } from 'eve/tools'
import { describe, expect, it } from 'vitest'

import auditCorpus from '../agent/tools/audit_corpus.js'

const noopToolContext = {} as unknown as ToolContext

type Finding = {
  class: string
  severity: string
  message: string
  refs: string[]
}
type AuditResult = {
  total_records: number
  pass: boolean
  blocking_count: number
  findings: Finding[]
}

function makeCorpus(records: unknown[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'demo-qa-'))
  const path = join(dir, 'corpus.json')
  writeFileSync(path, JSON.stringify(records))
  return path
}

describe('audit_corpus', () => {
  it('flags a forbidden-emoji persona emission as blocking', async () => {
    const path = makeCorpus([
      {
        id: 'PE-0001',
        sender: 'Chad',
        recipient: 'Dave Russo',
        subject: ' Sprint planning',
        body: 'Lets ship it 🚀',
        date: '2025-07-01T10:00:00Z',
        category: 'Internal-Memo',
        thread_id: 'T1',
      },
    ])
    const result = (await auditCorpus.execute(
      { corpus_path: path },
      noopToolContext,
    )) as AuditResult
    expect(result.total_records).toBe(1)
    expect(result.pass).toBe(false)
    expect(result.blocking_count).toBeGreaterThanOrEqual(1)
    expect(result.findings.some((f) => f.class === 'forbidden_emoji')).toBe(
      true,
    )
  })

  it('flags duplicate subjects as blocking when repeated >= 3x', async () => {
    const records = Array.from({ length: 4 }, (_, i) => ({
      id: `PE-000${i}`,
      sender: 'Chad',
      recipient: 'Dave Russo',
      subject: 'API Latency Investigation Update',
      body: 'Status update.',
      date: `2025-07-0${i + 1}T10:00:00Z`,
      category: 'Reply',
      thread_id: `T${i}`,
    }))
    const path = makeCorpus(records)
    const result = (await auditCorpus.execute(
      { corpus_path: path },
      noopToolContext,
    )) as AuditResult
    expect(result.pass).toBe(false)
    expect(
      result.findings.some(
        (f) => f.class === 'duplicate_subject' && f.severity === 'blocking',
      ),
    ).toBe(true)
  })

  it('passes a clean, coherent corpus', async () => {
    const records = [
      {
        id: 'PE-0001',
        sender: 'Chloe Chen',
        recipient: 'Dave Russo',
        subject: 'Dashboard layout proposal',
        body: 'Team, here is the new wireframe.',
        date: '2025-07-01T10:00:00Z',
        category: 'Internal-Memo',
        thread_id: 'T1',
      },
      {
        id: 'PE-0002',
        sender: 'Dave Russo',
        recipient: 'Chloe Chen',
        subject: 'Re: Dashboard layout proposal',
        body: 'Looks great, lets review tomorrow.',
        date: '2025-07-01T11:00:00Z',
        category: 'Reply',
        thread_id: 'T1',
      },
    ]
    const path = makeCorpus(records)
    const result = (await auditCorpus.execute(
      { corpus_path: path },
      noopToolContext,
    )) as AuditResult
    expect(result.pass).toBe(true)
    expect(result.blocking_count).toBe(0)
  })
})
