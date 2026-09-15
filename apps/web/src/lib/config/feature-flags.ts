/**
 * Feature-flag registry — the single source of truth for runtime feature flags.
 *
 * Every flag is declared here with the environment variable that overrides it
 * and a safe default (off). Evaluation is a pure function of the environment,
 * so flags resolve identically on the server, in scripts, and under test.
 *
 * The registry is intentionally empty: a flag that no production code reads is
 * dead config, and `scripts/ci/flag-audit.mjs` fails on flags born dead. The
 * first real flag lands here together with the code it gates.
 *
 * Adding a flag:
 *   1. Add an entry to `FEATURE_FLAG_REGISTRY` below with a default of `false`.
 *   2. Land the consumer in the same change, read via
 *      `isFeatureEnabled('myFlag')` — never read the env var directly at the
 *      call site.
 *   3. `pnpm lint:flags` fails if the flag has no references.
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
  // Entries are added together with the production code that reads them; the
  // dead-flag audit (scripts/ci/flag-audit.mjs) rejects entries with zero
  // references.
} as const satisfies Record<string, FeatureFlagDefinition>

export type FeatureFlagName = keyof typeof FEATURE_FLAG_REGISTRY

/** Explicit `"true"`/`"false"` strings; anything else falls back to the default. */
export function parseOverride(raw: string | undefined): boolean | undefined {
  if (raw === undefined) return undefined
  const normalized = raw.trim().toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  return undefined
}

/** Pure evaluation of a single definition against an environment. */
export function evaluateFlag(
  definition: FeatureFlagDefinition,
  env: Record<string, string | undefined>,
): boolean {
  const override = parseOverride(env[definition.envVar])
  return override ?? definition.default
}

/** Resolve a declared flag from `process.env`. Pure; export for testing. */
export function resolveFeatureFlag(
  name: FeatureFlagName,
  env: Record<string, string | undefined> = process.env,
): boolean {
  return evaluateFlag(FEATURE_FLAG_REGISTRY[name], env)
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
