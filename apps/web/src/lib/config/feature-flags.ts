/**
 * Feature-flag registry — the single source of truth for runtime feature flags.
 *
 * Every flag is declared here with the environment variable that overrides it
 * and a safe default (off). Evaluation is a pure function of
 * `process.env`, so flags resolve identically on the server, in scripts, and
 * under test (set the env var in the test or mock it).
 *
 * Adding a flag:
 *   1. Add an entry to `FEATURE_FLAG_REGISTRY` below with a default of `false`.
 *   2. Read it with `isFeatureEnabled('myFlag')` — never read the env var
 *      directly at the call site.
 *   3. Do not remove flags that shipped enabled; retire them via
 *      `scripts/ci/flag-audit.mjs` when no code reads them anymore.
 */

export interface FeatureFlagDefinition {
  /** Environment variable that overrides the default. `FEATURE_*` by convention. */
  readonly envVar: string
  /** Safe default when the env var is unset. Always ship `false`. */
  readonly default: boolean
  /** One sentence: what behavior the flag gates. */
  readonly description: string
}

export const FEATURE_FLAG_REGISTRY = {
  aiInsights: {
    envVar: 'FEATURE_AI_INSIGHTS',
    default: false,
    description: 'AI-generated insight summaries in monitoring dashboards.',
  },
  approvalWorkflows: {
    envVar: 'FEATURE_APPROVAL_WORKFLOWS',
    default: false,
    description: 'Multi-step approval workflows for high-risk actions.',
  },
  collaboration: {
    envVar: 'FEATURE_COLLABORATION',
    default: false,
    description: 'Real-time collaborative editing of shared documents.',
  },
  versioning: {
    envVar: 'FEATURE_VERSIONING',
    default: false,
    description: 'Document version history and restore.',
  },
} as const satisfies Record<string, FeatureFlagDefinition>

export type FeatureFlagName = keyof typeof FEATURE_FLAG_REGISTRY

/** Explicit `"true"`/`"false"` strings; anything else falls back to the default. */
function parseOverride(raw: string | undefined): boolean | undefined {
  if (raw === undefined) return undefined
  const normalized = raw.trim().toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  return undefined
}

/** Resolve a single flag from `process.env`. Pure; export for testing. */
export function resolveFeatureFlag(
  name: FeatureFlagName,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const definition = FEATURE_FLAG_REGISTRY[name]
  const override = parseOverride(env[definition.envVar])
  return override ?? definition.default
}

/** All flags at once, e.g. for config bootstrap or diagnostics endpoints. */
export function getFeatureFlags(
  env: Record<string, string | undefined> = process.env,
): Record<FeatureFlagName, boolean> {
  const flags = {} as Record<FeatureFlagName, boolean>
  for (const name of Object.keys(FEATURE_FLAG_REGISTRY) as FeatureFlagName[]) {
    flags[name] = resolveFeatureFlag(name, env)
  }
  return flags
}

/** Read a flag at runtime. Prefer this over caching `getFeatureFlags()`. */
export function isFeatureEnabled(name: FeatureFlagName): boolean {
  return resolveFeatureFlag(name)
}
