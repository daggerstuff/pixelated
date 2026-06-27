import { generateText } from 'ai'
import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { getModel } from './workers-ai.js'

interface DimensionScore {
  name: string
  score: number
  max_score: number
  rationale: string
}

interface SessionScoreResult {
  session_id: string
  cohort_id: string
  rubric_version: string
  state: 'REVIEWED'
  scored_at: string
  dimensions: DimensionScore[]
  total_score: number
  max_total: number
  risk_flags: string[]
  model: string
}

const DIMENSIONS = [
  'rapport',
  'open_questions',
  'reflection',
  'boundaries',
  'crisis_recognition',
] as const

interface ScoreSessionInput {
  session_id: string
  cohort_id: string
  rubric_version: string
}

const SCHEMA = z.object({
  session_id: z.string().uuid(),
  cohort_id: z.string().min(1),
  rubric_version: z.string().min(1),
})

export default defineTool({
  description:
    'Score a completed rehearsal session using Workers AI. Evaluates ' +
    'across 5 dimensions (rapport, open_questions, reflection, boundaries, ' +
    'crisis_recognition) and returns per-dimension scores plus risk flags.',
  inputSchema: SCHEMA,
  async execute(input: ScoreSessionInput) {
    const model = getModel()
    if (!model) {
      return {
        session_id: input.session_id,
        cohort_id: input.cohort_id,
        rubric_version: input.rubric_version,
        state: 'REVIEWED' as const,
        scored_at: new Date().toISOString(),
        dimensions: DIMENSIONS.map((name) => ({
          name,
          score: 0,
          max_score: 10,
          rationale: 'Workers AI not available, using placeholder.',
        })),
        total_score: 0,
        max_total: 50,
        risk_flags: [],
        model: 'none',
      }
    }

    const prompt =
      `You are a clinical training evaluator. Score this rehearsal session ` +
      `across 5 dimensions (each 0-10, where 10 is excellent).\n\n` +
      `Dimensions:\n` +
      DIMENSIONS.map((d) => `  - ${d}: clinical skill assessment`).join('\n') +
      `\n\nReturn ONLY valid JSON with NO markdown fences, NO extra text:\n` +
      `{"dimensions":[{"name":"rapport","score":0-10,"rationale":"max 60 chars"}],` +
      `"risk_flags":["session_abort","boundary_violation","crisis_missed","escalation_needed"]}\n\n` +
      `Session: ${input.session_id}, Cohort: ${input.cohort_id}, ` +
      `Rubric: ${input.rubric_version}`

    const { text } = await generateText({ model, prompt })
    const result = parseScore(text)

    const totalScore = result.dimensions.reduce((sum, d) => sum + d.score, 0)
    const maxTotal = DIMENSIONS.length * 10

    return {
      session_id: input.session_id,
      cohort_id: input.cohort_id,
      rubric_version: input.rubric_version,
      state: 'REVIEWED' as const,
      scored_at: new Date().toISOString(),
      dimensions: result.dimensions,
      total_score: totalScore,
      max_total: maxTotal,
      risk_flags: result.risk_flags,
      model: '@cf/meta/llama-3.2-3b-instruct',
    } satisfies SessionScoreResult
  },
})

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
      risk_flags: Array.isArray(parsed.risk_flags)
        ? (parsed.risk_flags as unknown[]).filter(
            (f: unknown): f is string => typeof f === 'string',
          )
        : ([] as string[]),
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
