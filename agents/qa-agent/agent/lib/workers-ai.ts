/**
 * Shared Workers AI provider instance for qa-agent tools.
 *
 * Uses CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_API_KEY env vars to
 * create a @cf/meta/llama-3.2-3b-instruct model instance via the
 * workers-ai-provider package.
 */

import { createWorkersAI } from 'workers-ai-provider'

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
const apiKey = process.env.CLOUDFLARE_AI_API_KEY

if (!accountId || !apiKey) {
  console.warn(
    '[workers-ai] CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_AI_API_KEY not set. ' +
      'Workers AI tools will fall back to stub responses.',
  )
}

const workersai =
  accountId && apiKey ? createWorkersAI({ accountId, apiKey }) : null

export const MODEL = '@cf/meta/llama-3.2-3b-instruct'

export function getModel() {
  return workersai ? workersai(MODEL) : null
}
