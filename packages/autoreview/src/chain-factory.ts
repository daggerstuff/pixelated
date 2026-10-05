import { providerChainFromEnv, type ChainEnv } from './config'
import { FailoverChain, type ProviderStep } from './failover-chain'
import { createAnthropicReviewProvider } from './providers/anthropic'
import { createOpenaiReviewProvider } from './providers/openai'
import { RuleBasedProvider } from './providers/rule-based'
import type { ReviewProvider } from './types'

/** Resolves a provider name (e.g. "anthropic") to a `ReviewProvider` instance. */
export type ProviderFactory = (name: string) => ReviewProvider | undefined

/**
 * Default name→provider mapping used by the runner: "anthropic", "openai",
 * and the "rule-based" fallback. Unknown names resolve to `undefined` so the
 * caller can surface a clear configuration error.
 */
export function defaultProviderFactory(
  name: string,
): ReviewProvider | undefined {
  switch (name) {
    case 'anthropic':
      return createAnthropicReviewProvider()
    case 'openai':
      return createOpenaiReviewProvider()
    case 'rule-based':
      return new RuleBasedProvider()
    default:
      return undefined
  }
}

/**
 * Builds a ready-to-run `FailoverChain` from environment variables, wiring
 * each configured provider name to an instance. The rule-based provider is
 * always appended last (unless disabled) as the deterministic fallback.
 */
export function buildChainFromEnv(
  env: ChainEnv = process.env,
  factory: ProviderFactory = defaultProviderFactory,
): FailoverChain {
  const steps: ProviderStep[] = []
  for (const spec of providerChainFromEnv(env)) {
    const provider = factory(spec.name)
    if (!provider) {
      throw new Error(`Unknown review provider: ${spec.name}`)
    }
    steps.push({ provider, retries: spec.retries })
  }
  return new FailoverChain({ steps })
}
