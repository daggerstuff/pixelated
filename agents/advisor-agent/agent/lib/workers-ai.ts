/**
 * Shared Workers AI provider instance for pipeline-agent tools and sub-agents.
 *
 * Uses CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_API_KEY env vars to create a
 * @cf/mistralai/mistral-small-3.1-24b-instruct model instance via the workers-ai-provider
 * package. Model DEFAULT is overridable via the WORKERS_AI_EVAL_MODEL env var
 * so the supervisor can pin a different CF model per run.
 */

import { createWorkersAI } from 'workers-ai-provider'

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
const apiKey = process.env.CLOUDFLARE_AI_API_KEY
const hasCredentials = Boolean(accountId && apiKey)

if (!accountId || !apiKey) {
  console.warn(
    '[pipeline-agent/workers-ai] CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_AI_API_KEY not set. ' +
      'Workers AI tools will fall back to stub responses.',
  )
}

const workersai = createWorkersAI({
  accountId: accountId ?? 'missing-cloudflare-account-id',
  apiKey: apiKey ?? 'missing-cloudflare-api-key',
})
