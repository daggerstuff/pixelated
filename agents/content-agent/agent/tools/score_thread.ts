import { readFileSync } from 'node:fs'

import { generateText } from 'ai'
import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { getModel } from '../lib/workers-ai.js'

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

interface DimensionScore {
  name: string
  score: number
  max_score: number
  rationale: string
}

interface ThreadScoreResult {
  thread_id: string
  message_count: number
  state: 'SCORED'
  scored_at: string
  dimensions: DimensionScore[]
  total_score: number
  max_total: number
  demo_ready: boolean
  model: string
}

const DIMENSIONS = [
  'coherence',
  'persona_voice',
  'referential_integrity',
  'narrative_payoff',
] as const

interface ScoreThreadInput {
  corpus_path: string
  thread_id: string
}

const SCHEMA = z.object({
  corpus_path: z.string().min(1),
  thread_id: z.string().min(1),
})

export default defineTool({
  description:
    'Score one thread from the demo corpus for demo-readiness. Evaluates ' +
    'across 4 dimensions (coherence, persona_voice, referential_integrity, ' +
    'narrative_payoff) and returns per-dimension scores plus a demo_ready flag.',
  inputSchema: SCHEMA,
  async execute(input: ScoreThreadInput): Promise<ThreadScoreResult> {
    const emails = loadThread(input.corpus_path, input.thread_id)
    const base = {
      thread_id: input.thread_id,
      message_count: emails.length,
      state: 'SCORED' as const,
      scored_at: new Date().toISOString(),
      dimensions: DIMENSIONS.map((name) => ({
        name,
        score: 0,
        max_score: 10,
        rationale: 'Workers AI not available, using placeholder.',
      })),
      total_score: 0,
      max_total: DIMENSIONS.length * 10,
      demo_ready: false,
      model: 'none',
    }

    const model = getModel()
    if (!model || emails.length === 0) {
      return emails.length === 0
        ? { ...base, dimensions: [], total_score: 0, max_total: 0 }
        : base
    }

    const threadText = emails
      .map((e) => `${e.sender} -> ${e.recipient}: ${e.subject}\n${e.body}`)
      .join('\n\n')

    const prompt =
      `You are a demo-quality evaluator. Score this email thread for an ` +
      `investor demo (each dimension 0-10, where 10 is excellent).\n` +
      `Dimensions:\n` +
      DIMENSIONS.map((d) => `  - ${d}: thread quality aspect`).join('\n') +
      `\n\nReturn ONLY valid JSON with NO markdown fences, NO extra text:\n` +
      `{"dimensions":[{"name":"coherence","score":0-10,"rationale":"max 60 chars"}]}` +
      `\n\nThread:\n${threadText.slice(0, 6000)}`

    try {
      const { text } = await generateText({ model, prompt })
      const result = parseScore(text)
      const totalScore = result.dimensions.reduce((s, d) => s + d.score, 0)
      const maxTotal = DIMENSIONS.length * 10
      return {
        ...base,
        dimensions: result.dimensions,
        total_score: totalScore,
        max_total: maxTotal,
        demo_ready: totalScore >= Math.floor(maxTotal * 0.7),
        model: '@cf/meta/llama-3.2-3b-instruct',
      }
    } catch {
      return base
    }
  },
})

function loadThread(path: string, threadId: string): EmailRecord[] {
  const raw = readFileSync(path, 'utf8')
  const data = JSON.parse(raw) as unknown
  const list: EmailRecord[] = Array.isArray(data)
    ? (data as EmailRecord[])
    : data && typeof data === 'object'
      ? ((((data as Record<string, unknown>).emails ??
          (data as Record<string, unknown>).data) as
          | EmailRecord[]
          | undefined) ?? [])
      : []
  return list.filter((e) => e.thread_id === threadId)
}

function parseScore(raw: string): {
  dimensions: DimensionScore[]
  risk_flags: string[]
} {
  try {
    const cleaned = (raw.match(/\{[\s\S]*\}/) ?? [raw])[0]
    const parsed = JSON.parse(cleaned) as {
      dimensions?: unknown
      risk_flags?: unknown
    }
    return {
      dimensions: Array.isArray(parsed.dimensions)
        ? parsed.dimensions.map((d: unknown) => {
            const dd = d as {
              name?: unknown
              score?: unknown
              rationale?: unknown
            }
            return {
              name: DIMENSIONS.includes(dd.name as (typeof DIMENSIONS)[number])
                ? (dd.name as (typeof DIMENSIONS)[number])
                : 'unknown',
              score:
                typeof dd.score === 'number'
                  ? Math.max(0, Math.min(10, dd.score))
                  : 0,
              max_score: 10,
              rationale: ((dd.rationale as string) ?? '').slice(0, 60),
            }
          })
        : DIMENSIONS.map((name) => ({
            name,
            score: 0,
            max_score: 10,
            rationale: 'Failed to parse model output.',
          })),
      risk_flags: [],
    }
  } catch {
    return {
      dimensions: DIMENSIONS.map((name) => ({
        name,
        score: 0,
        max_score: 10,
        rationale: 'Failed to parse model output.',
      })),
      risk_flags: [],
    }
  }
}
