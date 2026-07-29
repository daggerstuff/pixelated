import { createWorkersAI } from "workers-ai-provider";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiKey = process.env.CLOUDFLARE_AI_API_KEY;
const hasCredentials = Boolean(accountId && apiKey);

if (!accountId || !apiKey) {
  console.warn(
    "[workers-ai] CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_AI_API_KEY not set. " +
      "Workers AI tools will fall back to stub responses.",
  );
}

const workersai = createWorkersAI({
  accountId: accountId ?? "missing-cloudflare-account-id",
  apiKey: apiKey ?? "missing-cloudflare-api-key",
});

export const MODEL = "@cf/meta/llama-3.2-3b-instruct";

export const AGENT_MODEL = process.env.WORKERS_AI_AGENT_MODEL ?? "@cf/moonshotai/kimi-k2.7-code";

export const AGENT_MODEL_CONTEXT_WINDOW_TOKENS = 256_000;

export const agentModel = workersai(AGENT_MODEL);

export function getModel() {
  return hasCredentials ? workersai(MODEL) : null;
}
