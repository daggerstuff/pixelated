import { createWorkersAI } from 'workers-ai-provider'

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
const apiKey = process.env.CLOUDFLARE_AI_API_KEY
const hasCredentials = Boolean(accountId && apiKey)

if (!accountId || !apiKey) {
  console.warn(
    '[workers-ai] CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_AI_API_KEY not set. ' +
      'Workers AI tools will fall back to stub responses.',
  )
}

const workersai = createWorkersAI({
  accountId: accountId ?? 'missing-cloudflare-account-id',
  apiKey: apiKey ?? 'missing-cloudflare-api-key',
})
