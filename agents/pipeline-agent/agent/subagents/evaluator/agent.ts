import { defineAgent } from 'eve'
import { z } from 'zod'
import { createWorkersAI } from 'workers-ai-provider'

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
const apiKey = process.env.CLOUDFLARE_AI_API_KEY
const workersai =
  accountId && apiKey ? createWorkersAI({ accountId, apiKey }) : null

export default defineAgent({
  description:
    'Specialist sub-agent that analyzes evaluation benchmark results using ' +
    'Workers AI (@cf/meta/llama-3.2-3b-instruct). Emits dimension-level ' +
    'pass/fail, an overall verdict, and a recommendation for the human ' +
    'reviewer at Gate 3. Falls back to Claude when Workers AI is unavailable.',
  model:
    workersai?.('@cf/meta/llama-3.2-3b-instruct') ??
    'anthropic/claude-sonnet-4.6',
  outputSchema: z.object({
    verdict: z.enum(['pass', 'conditional_pass', 'fail']),
    dimensions: z.array(
      z.object({
        benchmark: z.string(),
        score: z.number().min(0).max(1),
        passed: z.boolean(),
        note: z.string().max(280),
      }),
    ),
    recommendation: z.string().max(500),
  }),
})
