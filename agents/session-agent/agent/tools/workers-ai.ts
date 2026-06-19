/**
 * Shared Workers AI provider instance for session-agent tools.
 *
 * Uses the CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_API_KEY env vars
 * (set in the agent's runtime environment) to create a Workers AI
 * language model compatible with the Vercel AI SDK.
 *
 * Model: @cf/meta/llama-3.2-3b-instruct
 *   - 3B params, free tier, fast inference
 *   - Sufficient for classification, sentiment, crisis detection
 */

import { createWorkersAI } from "workers-ai-provider";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiKey = process.env.CLOUDFLARE_AI_API_KEY;

if (!accountId || !apiKey) {
  console.warn(
    "[workers-ai] CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_AI_API_KEY not set. " +
      "Workers AI tools will fall back to stub responses.",
  );
}

const workersai =
  accountId && apiKey
    ? createWorkersAI({ accountId, apiKey })
    : null;

/** The default classification/inference model slug. */
export const MODEL = "@cf/meta/llama-3.2-3b-instruct";

/** Get a Workers AI model instance, or null if credentials are missing. */
export function getModel() {
  return workersai ? workersai(MODEL) : null;
}
