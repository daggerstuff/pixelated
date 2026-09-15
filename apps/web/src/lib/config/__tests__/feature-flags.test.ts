import { describe, expect, it } from 'vitest'

import {
  FEATURE_FLAG_REGISTRY,
  evaluateFlag,
  getFeatureFlags,
  parseOverride,
  type FeatureFlagDefinition,
} from '../feature-flags'

const testFlag: FeatureFlagDefinition = {
  envVar: 'FEATURE_TEST_FLAG',
  default: false,
  description: 'Test-only definition used to exercise the evaluator.',
}

describe('feature-flags evaluator', () => {
  it('exposes the registry as a mapping of well-formed definitions', () => {
    for (const [name, definition] of Object.entries(FEATURE_FLAG_REGISTRY)) {
      expect(name).toMatch(/^[a-zA-Z][a-zA-Z0-9]*$/)
      expect(definition.envVar).toMatch(/^FEATURE_[A-Z0-9_]+$/)
      expect(definition.default).toBe(false)
      expect(definition.description.length).toBeGreaterThan(10)
    }
  })

  it('parses only explicit true/false overrides', () => {
    expect(parseOverride(undefined)).toBeUndefined()
    expect(parseOverride('true')).toBe(true)
    expect(parseOverride(' FALSE ')).toBe(false)
    expect(parseOverride('yes')).toBeUndefined()
    expect(parseOverride('1')).toBeUndefined()
  })

  it('falls back to the default when unset or malformed', () => {
    expect(evaluateFlag(testFlag, {})).toBe(false)
    expect(evaluateFlag(testFlag, { FEATURE_TEST_FLAG: 'yes' })).toBe(false)
  })

  it('enables a flag only on an explicit true override', () => {
    expect(evaluateFlag(testFlag, { FEATURE_TEST_FLAG: 'true' })).toBe(true)
    expect(evaluateFlag(testFlag, { FEATURE_TEST_FLAG: 'TRUE' })).toBe(true)
    expect(evaluateFlag(testFlag, { FEATURE_TEST_FLAG: ' true ' })).toBe(true)
  })

  it('respects a default of true when the override is absent', () => {
    expect(evaluateFlag({ ...testFlag, default: true }, {})).toBe(true)
    expect(evaluateFlag({ ...testFlag, default: true }, { FEATURE_TEST_FLAG: 'false' })).toBe(false)
  })

  it('getFeatureFlags returns an empty record while the registry is empty', () => {
    expect(getFeatureFlags({})).toEqual({})
  })
})
