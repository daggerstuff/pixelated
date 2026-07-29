import { readFileSync } from 'node:fs'

import { defineTool } from 'eve/tools'
import { z } from 'zod'

interface EmailRecord {
  id?: string
  sender?: string
  recipient?: string
  subject?: string
  body?: string
  date?: string
  category?: string
  thread_id?: string | null
}

interface CurateResult {
  target_count: number
  picked_count: number
  curated_at: string
  picks: Array<{
    thread_id: string
    subject: string
    message_count: number
    reason: string
  }>
  rejected_threads: string[]
  model: string
}

const PERSONA_VOICES = new Set([
  'Chad',
  'Paige Miller',
  'Dr. Elias Vance',
  'Marcus Thorne',
  'Chloe Chen',
  'Dave Russo',
  'Samira Tariq',
  'Julian Hayes',
  'Maya Lin',
])

function loadCorpus(path: string): EmailRecord[] {
  const raw = readFileSync(path, 'utf8')
  const data = JSON.parse(raw) as unknown
  if (Array.isArray(data)) return data as EmailRecord[]
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    for (const key of ['emails', 'data', 'messages', 'items']) {
      if (Array.isArray(obj[key])) return obj[key] as EmailRecord[]
    }
  }
  return []
}

export default defineTool({
  description:
    'Curate the N demo-ready threads from the corpus per the hackathon ' +
    'battle plan. Picks threads that span distinct personas and narrative ' +
    'arcs, avoids duplicate subjects, and surfaces a coherent showcase set. ' +
    'Returns the picks plus the rejected thread ids for transparency.',
  inputSchema: z.object({
    corpus_path: z.string().min(1),
    target_count: z.number().int().min(1).max(50).default(15),
  }),
  async execute(input: {
    corpus_path: string
    target_count: number
  }): Promise<CurateResult> {
    const emails = loadCorpus(input.corpus_path)

    const byThread = new Map<string, EmailRecord[]>()
    for (const em of emails) {
      const tid = em.thread_id ?? `__loose__${em.id}`
      const arr = byThread.get(tid) ?? []
      arr.push(em)
      byThread.set(tid, arr)
    }

    const candidates = [...byThread.entries()]
      .map(([tid, msgs]) => {
        const sorted = [...msgs].sort((a, b) =>
          (a.date ?? '').localeCompare(b.date ?? ''),
        )
        const subjects = sorted.map((m) => m.subject ?? '')
        const senders = new Set(
          sorted.map((m) => m.sender ?? '').filter(Boolean),
        )
        const bodyLen = sorted.reduce((s, m) => s + (m.body ?? '').length, 0)
        return {
          thread_id: tid,
          subject: sorted[0]?.subject ?? '(loose message)',
          message_count: sorted.length,
          distinct_senders: senders.size,
          body_len: bodyLen,
          // Simple quality heuristic: multi-message, multi-persona, substantive.
          score:
            sorted.length * 2 + senders.size * 3 + Math.min(bodyLen / 500, 10),
        }
      })
      .filter((c) => c.message_count >= 2 && c.distinct_senders >= 2)
      .sort((a, b) => b.score - a.score)

    const picks: CurateResult['picks'] = []
    const usedSubjects = new Set<string>()
    for (const c of candidates) {
      if (picks.length >= input.target_count) break
      const norm = c.subject.toLowerCase().trim()
      if (usedSubjects.has(norm)) continue
      usedSubjects.add(norm)
      picks.push({
        thread_id: c.thread_id,
        subject: c.subject,
        message_count: c.message_count,
        reason: `Multi-message (${c.message_count}) across ${c.distinct_senders} personas; substantive body.`,
      })
    }

    const pickedIds = new Set(picks.map((p) => p.thread_id))
    const rejected = [...byThread.keys()].filter((t) => !pickedIds.has(t))

    return {
      target_count: input.target_count,
      picked_count: picks.length,
      curated_at: new Date().toISOString(),
      picks,
      rejected_threads: rejected,
      model: 'none',
    }
  },
})
