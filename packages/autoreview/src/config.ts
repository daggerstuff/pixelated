export interface ProviderChainSpec {
  /** Provider identifier, e.g. "anthropic" or "rule-based". */
  name: string
  /** Number of attempts allowed for this provider. */
  retries: number
  /** True for the deterministic fallback that always runs last. */
  fallback?: boolean
}

export interface ChainEnv {
  LLM_PRIMARY?: string
  LLM_SECONDARY?: string
  LLM_PRIMARY_RETRIES?: string
  LLM_SECONDARY_RETRIES?: string
  /** Set to "false" to disable the rule-based fallback (not recommended). */
  LLM_RULE_BASED?: string
}

export const DEFAULT_PRIMARY_RETRIES = 3
export const DEFAULT_SECONDARY_RETRIES = 2

/**
 * Resolves the provider chain ordering from environment variables:
 * `LLM_PRIMARY` → `LLM_SECONDARY` → `rule-based` (always last, unless
 * disabled). Retry counts are individually overridable via
 * `LLM_PRIMARY_RETRIES` / `LLM_SECONDARY_RETRIES`.
 *
 * Returns specs, not provider instances — wiring a name to a concrete
 * `ReviewProvider` is the workflow runner's job.
 */
export function providerChainFromEnv(
  env: ChainEnv = process.env,
): ProviderChainSpec[] {
  const steps: ProviderChainSpec[] = []

  const primary = (env.LLM_PRIMARY ?? '').trim()
  const secondary = (env.LLM_SECONDARY ?? '').trim()

  if (primary) {
    steps.push({
      name: primary,
      retries: readInt(env.LLM_PRIMARY_RETRIES, DEFAULT_PRIMARY_RETRIES),
    })
  }
  if (secondary) {
    steps.push({
      name: secondary,
      retries: readInt(env.LLM_SECONDARY_RETRIES, DEFAULT_SECONDARY_RETRIES),
    })
  }

  if ((env.LLM_RULE_BASED ?? 'true').trim().toLowerCase() !== 'false') {
    steps.push({ name: 'rule-based', retries: 1, fallback: true })
  }

  return steps
}

function readInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback
  }
  const value = Number.parseInt(raw, 10)
  return Number.isNaN(value) || value < 1 ? fallback : value
}
