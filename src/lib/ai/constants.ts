/**
 * AI constants — env-configurable defaults for Neon AI Gateway or any OpenAI-compatible provider.
 *
 * Neon AI Gateway is free during beta. See:
 *   https://neon.com/docs/ai-gateway/overview
 *
 * Set LLM_DEFAULT_MODEL in .env to override the default model.
 * Set LLM_API_KEY + LLM_BASE_URL to point to Neon (or any OpenAI-compatible endpoint).
 */

/**
 * Resolve an env var from process.env (SSR) or import.meta.env (Vite/Build).
 * Mirrors the pattern used in providers.ts and completion.ts.
 */
function getEnvVar(key: string): string | undefined {
  const metaEnv = import.meta.env as Record<string, string> | undefined
  return process.env[key] ?? metaEnv?.[key]
}

/**
 * Default LLM model — env-configurable via LLM_DEFAULT_MODEL.
 * Falls back to gpt-oss-120b (Neon AI Gateway open-weight model, free during beta).
 */
export const DEFAULT_LLM_MODEL: string =
  getEnvVar('LLM_DEFAULT_MODEL') ?? 'gpt-oss-120b'

/**
 * Neon AI Gateway — open-weight models enabled by default (free during beta).
 * Frontier models (gpt-5*, claude-*, gemini-*) require a verified account.
 */
export const NEON_ENABLED_MODELS: readonly string[] = [
  'gpt-oss-120b',
  'gpt-oss-20b',
  'llama-4-maverick',
  'meta-llama-3-3-70b-instruct',
  'meta-llama-3-1-8b-instruct',
  'qwen3-next-80b-a3b-instruct',
  'qwen35-122b-a10b',
  'gemma-3-12b',
]
