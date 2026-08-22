import { createWorkersAI } from 'workers-ai-provider'

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
const apiKey = process.env.CLOUDFLARE_AI_API_KEY

if (!accountId || !apiKey) {
  console.warn(
    '[workers-ai] CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_AI_API_KEY not set.',
  )
}

const workersai = createWorkersAI({
  accountId: accountId ?? 'missing-cloudflare-account-id',
  apiKey: apiKey ?? 'missing-cloudflare-api-key',
})

// GLM 5.2 — 1M token context window. Free for eve agents through Aug 27 2026
// via Blackbox on Vercel AI Gateway.
const AI_GATEWAY_MODEL = 'zai/glm-5.2'
const WORKERS_AI_FALLBACK_MODEL = '@cf/zai-org/glm-5.2'

// Primary: AI Gateway (free through Aug 27 2026). Fallback: Workers AI.
// Set WORKERS_AI_AGENT_MODEL to force Workers AI with a specific model.
const hasAiGateway = Boolean(
  process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_OIDC_TOKEN,
)
const workersAiOverride = process.env.WORKERS_AI_AGENT_MODEL
const useAiGateway = hasAiGateway && !workersAiOverride

export const AGENT_MODEL = useAiGateway
  ? AI_GATEWAY_MODEL
  : (workersAiOverride ?? WORKERS_AI_FALLBACK_MODEL)

export const AGENT_MODEL_CONTEXT_WINDOW_TOKENS = 1_000_000

// When using AI Gateway, pass the string directly (eve resolves it).
// When using Workers AI, wrap in the workers-ai-provider LanguageModel.
export const agentModel = useAiGateway ? AGENT_MODEL : workersai(AGENT_MODEL)
