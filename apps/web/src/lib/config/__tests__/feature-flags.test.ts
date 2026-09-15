import { beforeEach, describe, expect, it } from 'vitest'

import {
  FEATURE_FLAG_REGISTRY,
  getFeatureFlags,
  isFeatureEnabled,
  resolveFeatureFlag,
  type FeatureFlagName,
} from '../feature-flags'

const FLAG_NAMES = Object.keys(FEATURE_FLAG_REGISTRY) as FeatureFlagName[]

describe('feature-flags registry', () => {
  const FLAG_VARS = FLAG_NAMES.map((name) => FEATURE_FLAG_REGISTRY[name].envVar)

  beforeEach(() => {
    for (const envVar of FLAG_VARS) delete process.env[envVar]
  })

  it('declares every flag with an env var, an off default, and a description', () => {
    for (const name of FLAG_NAMES) {
      const definition = FEATURE_FLAG_REGISTRY[name]
      expect(definition.envVar).toMatch(/^FEATURE_[A-Z0-9_]+$/)
      expect(definition.default).toBe(false)
      expect(definition.description.length).toBeGreaterThan(10)
    }
  })

  it('resolves every flag to its default when the environment is unset', () => {
    expect(getFeatureFlags({})).toEqual(
      Object.fromEntries(FLAG_NAMES.map((name) => [name, false])),
    )
  })

  it('enables a flag only on an explicit true override', () => {
    expect(
      resolveFeatureFlag('aiInsights', { FEATURE_AI_INSIGHTS: 'true' }),
    ).toBe(true)
    expect(
      resolveFeatureFlag('aiInsights', { FEATURE_AI_INSIGHTS: 'TRUE' }),
    ).toBe(true)
    expect(
      resolveFeatureFlag('aiInsights', { FEATURE_AI_INSIGHTS: ' true ' }),
    ).toBe(true)
  })

  it('falls back to the default on unset, false, or malformed overrides', () => {
    expect(resolveFeatureFlag('approvalWorkflows', {})).toBe(false)
    expect(
      resolveFeatureFlag('approvalWorkflows', {
        FEATURE_APPROVAL_WORKFLOWS: 'false',
      }),
    ).toBe(false)
    // Malformed values must never enable a flag.
    expect(
      resolveFeatureFlag('approvalWorkflows', {
        FEATURE_APPROVAL_WORKFLOWS: 'yes',
      }),
    ).toBe(false)
    expect(
      resolveFeatureFlag('approvalWorkflows', {
        FEATURE_APPROVAL_WORKFLOWS: '1',
      }),
    ).toBe(false)
  })

  it('isFeatureEnabled reads the current process environment', () => {
    expect(isFeatureEnabled('collaboration')).toBe(false)
    process.env.FEATURE_COLLABORATION = 'true'
    expect(isFeatureEnabled('collaboration')).toBe(true)
  })

  it('leaves non-flag environment variables untouched', () => {
    process.env.FEATURE_VERSIONING = 'true'
    const before = { ...process.env }
    getFeatureFlags()
    for (const key of Object.keys(process.env)) {
      if (!FLAG_VARS.includes(key)) expect(process.env[key]).toBe(before[key])
    }
  })
})
