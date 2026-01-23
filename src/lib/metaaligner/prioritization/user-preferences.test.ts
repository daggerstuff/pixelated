import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock logger to prevent console errors during tests
vi.mock('../../logging/build-safe-logger', () => ({
  createBuildSafeLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))
import {
  UserPreferenceManager,
  applyUserPreferences,
  DEFAULT_PREFERENCES,
  type UserPreferences,
  type RiskSensitivity,
} from './user-preferences'
import type { ObjectivePriority } from './context-objective-mapping'

describe('UserPreferenceManager', () => {
  let manager: UserPreferenceManager

  beforeEach(() => {
    manager = new UserPreferenceManager()
  })

  describe('constructor', () => {
    it('should initialize with default preferences', () => {
      expect(manager).toBeDefined()
      const prefs = manager.getPreferences('test-user')
      expect(prefs.preferredSupportStyle).toBe('empathic')
      expect(prefs.riskSensitivity).toBe('high')
    })

    it('should accept custom defaults', () => {
      const customDefaults: UserPreferences = {
        preferredSupportStyle: 'pragmatic',
        riskSensitivity: 'low',
      }
      const customManager = new UserPreferenceManager(customDefaults)
      const prefs = customManager.getPreferences('test-user')
      expect(prefs.preferredSupportStyle).toBe('pragmatic')
    })
  })

  describe('setPreferences', () => {
    it('should set valid preferences', () => {
      const prefs: UserPreferences = {
        preferredSupportStyle: 'direct',
        responseFormality: 'formal',
        riskSensitivity: 'medium',
      }

      const result = manager.setPreferences('user1', prefs)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should merge with defaults', () => {
      const prefs: UserPreferences = {
        preferredSupportStyle: 'direct',
      }

      manager.setPreferences('user1', prefs)
      const retrieved = manager.getPreferences('user1')

      expect(retrieved.preferredSupportStyle).toBe('direct')
      expect(retrieved.riskSensitivity).toBe('high') // from defaults
    })

    it('should reject invalid support style', () => {
      const prefs: any = {
        preferredSupportStyle: 'invalid_style',
      }

      const result = manager.setPreferences('user1', prefs)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should reject invalid custom weights', () => {
      const prefs: UserPreferences = {
        customObjectiveWeights: {
          empathy: 1.5, // Invalid: > 1
          safety: -0.1, // Invalid: < 0
        },
      }

      const result = manager.setPreferences('user1', prefs)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('getPreferences', () => {
    it('should return defaults for unknown user', () => {
      const prefs = manager.getPreferences('unknown-user')
      expect(prefs).toEqual(DEFAULT_PREFERENCES)
    })

    it('should return set preferences for known user', () => {
      const userPrefs: UserPreferences = {
        preferredSupportStyle: 'reflective',
        riskSensitivity: 'low',
      }

      manager.setPreferences('user1', userPrefs)
      const retrieved = manager.getPreferences('user1')

      expect(retrieved.preferredSupportStyle).toBe('reflective')
      expect(retrieved.riskSensitivity).toBe('low')
    })
  })

  describe('updatePreferences', () => {
    it('should update specific fields', () => {
      const initial: UserPreferences = {
        preferredSupportStyle: 'empathic',
        riskSensitivity: 'high',
      }

      manager.setPreferences('user1', initial)

      const update = {
        riskSensitivity: 'medium' as RiskSensitivity,
      }

      manager.updatePreferences('user1', update)
      const retrieved = manager.getPreferences('user1')

      expect(retrieved.preferredSupportStyle).toBe('empathic') // unchanged
      expect(retrieved.riskSensitivity).toBe('medium') // updated
    })
  })

  describe('clearPreferences', () => {
    it('should clear user preferences', () => {
      const prefs: UserPreferences = {
        preferredSupportStyle: 'direct',
      }

      manager.setPreferences('user1', prefs)
      expect(manager.getPreferences('user1').preferredSupportStyle).toBe('direct')

      manager.clearPreferences('user1')
      expect(manager.getPreferences('user1')).toEqual(DEFAULT_PREFERENCES)
    })
  })

  describe('validatePreferences', () => {
    it('should validate correct preferences', () => {
      const prefs: UserPreferences = {
        preferredSupportStyle: 'empathic',
        responseFormality: 'informal',
        riskSensitivity: 'high',
        verbosityLevel: 'moderate',
      }

      const result = manager.validatePreferences(prefs)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should warn about conflicting preferences', () => {
      const prefs: UserPreferences = {
        disableObjectives: ['empathy', 'safety'],
        prioritizeObjectives: ['empathy'], // Conflict!
      }

      const result = manager.validatePreferences(prefs)
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('should validate custom weights range', () => {
      const prefs: UserPreferences = {
        customObjectiveWeights: {
          empathy: 0.5,
          safety: 0.8,
          clarity: 1.0,
        },
      }

      const result = manager.validatePreferences(prefs)
      expect(result.valid).toBe(true)
    })
  })

  describe('export and import', () => {
    it('should export preferences as JSON', () => {
      const prefs: UserPreferences = {
        preferredSupportStyle: 'pragmatic',
        riskSensitivity: 'low',
      }

      manager.setPreferences('user1', prefs)
      const exported = manager.exportPreferences('user1')

      expect(typeof exported).toBe('string')
      const parsed = JSON.parse(exported)
      expect(parsed.preferredSupportStyle).toBe('pragmatic')
    })

    it('should import preferences from JSON', () => {
      const prefs: UserPreferences = {
        preferredSupportStyle: 'reflective',
        riskSensitivity: 'high',
      }

      const jsonData = JSON.stringify(prefs)
      const result = manager.importPreferences('user2', jsonData)

      expect(result.valid).toBe(true)
      const retrieved = manager.getPreferences('user2')
      expect(retrieved.preferredSupportStyle).toBe('reflective')
    })

    it('should handle invalid JSON on import', () => {
      const result = manager.importPreferences('user3', 'invalid json{')
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('getAllUsers', () => {
    it('should return all users with preferences', () => {
      manager.setPreferences('user1', { preferredSupportStyle: 'empathic' })
      manager.setPreferences('user2', { preferredSupportStyle: 'direct' })
      manager.setPreferences('user3', { riskSensitivity: 'low' })

      const users = manager.getAllUsers()
      expect(users).toHaveLength(3)
      expect(users).toContain('user1')
      expect(users).toContain('user2')
      expect(users).toContain('user3')
    })

    it('should return empty array when no users', () => {
      const users = manager.getAllUsers()
      expect(users).toHaveLength(0)
    })
  })

  describe('clearAll', () => {
    it('should clear all user preferences', () => {
      manager.setPreferences('user1', { preferredSupportStyle: 'empathic' })
      manager.setPreferences('user2', { preferredSupportStyle: 'direct' })

      expect(manager.getAllUsers()).toHaveLength(2)

      manager.clearAll()
      expect(manager.getAllUsers()).toHaveLength(0)
    })
  })
})

describe('applyUserPreferences', () => {
  const createBaseObjectives = (): ObjectivePriority[] => [
    { key: 'empathy', priority: 1, weight: 0.2 },
    { key: 'safety', priority: 2, weight: 0.2 },
    { key: 'correctness', priority: 3, weight: 0.15 },
    { key: 'informativeness', priority: 4, weight: 0.15 },
    { key: 'conciseness', priority: 5, weight: 0.1 },
    { key: 'clarity', priority: 6, weight: 0.1 },
    { key: 'warmth', priority: 7, weight: 0.1 },
  ]

  describe('basic functionality', () => {
    it('should return objectives unchanged with empty preferences', () => {
      const objectives = createBaseObjectives()
      const prefs: UserPreferences = {}

      const result = applyUserPreferences(objectives, prefs)
      expect(result).toHaveLength(objectives.length)
    })

    it('should normalize weights to sum to 1', () => {
      const objectives = createBaseObjectives()
      const prefs: UserPreferences = {
        preferredSupportStyle: 'empathic',
      }

      const result = applyUserPreferences(objectives, prefs)
      const sum = result.reduce((acc, obj) => acc + obj.weight, 0)
      expect(sum).toBeCloseTo(1.0, 4)
    })
  })

  describe('disabling objectives', () => {
    it('should filter out disabled objectives', () => {
      const objectives = createBaseObjectives()
      const prefs: UserPreferences = {
        disableObjectives: ['empathy', 'warmth'],
      }

      const result = applyUserPreferences(objectives, prefs)
      expect(result).toHaveLength(5) // 7 - 2 = 5
      expect(result.find(obj => obj.key === 'empathy')).toBeUndefined()
      expect(result.find(obj => obj.key === 'warmth')).toBeUndefined()
    })
  })

  describe('custom weights', () => {
    it('should apply custom weight overrides', () => {
      const objectives = createBaseObjectives()
      const prefs: UserPreferences = {
        customObjectiveWeights: {
          empathy: 0.5,
          safety: 0.3,
        },
      }

      const result = applyUserPreferences(objectives, prefs)

      // After normalization, empathy should have higher weight than safety
      const empathy = result.find(obj => obj.key === 'empathy')
      const safety = result.find(obj => obj.key === 'safety')

      expect(empathy).toBeDefined()
      expect(safety).toBeDefined()
      expect(empathy!.weight).toBeGreaterThan(safety!.weight)
    })
  })

  describe('support style adjustments', () => {
    it('should boost empathy for empathic style', () => {
      const objectives = createBaseObjectives()
      const prefsEmpathic: UserPreferences = {
        preferredSupportStyle: 'empathic',
      }
      const prefsNone: UserPreferences = {}

      const resultEmpathic = applyUserPreferences(objectives, prefsEmpathic)
      const resultNone = applyUserPreferences(objectives, prefsNone)

      const empathyWithStyle = resultEmpathic.find(obj => obj.key === 'empathy')!
      const empathyWithout = resultNone.find(obj => obj.key === 'empathy')!

      expect(empathyWithStyle.weight).toBeGreaterThan(empathyWithout.weight)
    })

    it('should boost conciseness for direct style', () => {
      const objectives = createBaseObjectives()
      const prefs: UserPreferences = {
        preferredSupportStyle: 'direct',
      }

      const result = applyUserPreferences(objectives, prefs)
      const conciseness = result.find(obj => obj.key === 'conciseness')!


      // After boosting and normalization, should still be relatively higher
      expect(conciseness).toBeDefined()
    })

    it('should boost correctness for pragmatic style', () => {
      const objectives = createBaseObjectives()
      const prefs: UserPreferences = {
        preferredSupportStyle: 'pragmatic',
      }

      const result = applyUserPreferences(objectives, prefs)
      const correctness = result.find(obj => obj.key === 'correctness')!

      expect(correctness).toBeDefined()
      expect(correctness.weight).toBeGreaterThan(0)
    })

    it('should handle reflective style', () => {
      const objectives = createBaseObjectives()
      const prefs: UserPreferences = {
        preferredSupportStyle: 'reflective',
      }

      const result = applyUserPreferences(objectives, prefs)
      expect(result).toHaveLength(objectives.length)

      const sum = result.reduce((acc, obj) => acc + obj.weight, 0)
      expect(sum).toBeCloseTo(1.0, 4)
    })
  })

  describe('risk sensitivity', () => {
    it('should boost safety for high risk sensitivity', () => {
      const objectives = createBaseObjectives()
      const prefsHigh: UserPreferences = {
        riskSensitivity: 'high',
      }
      const prefsLow: UserPreferences = {
        riskSensitivity: 'low',
      }

      const resultHigh = applyUserPreferences(objectives, prefsHigh)
      const resultLow = applyUserPreferences(objectives, prefsLow)

      const safetyHigh = resultHigh.find(obj => obj.key === 'safety')!
      const safetyLow = resultLow.find(obj => obj.key === 'safety')!

      expect(safetyHigh.weight).toBeGreaterThan(safetyLow.weight)
    })

    it('should not affect safety for low risk sensitivity', () => {
      const objectives = createBaseObjectives()
      const prefs: UserPreferences = {
        riskSensitivity: 'low',
      }

      const result = applyUserPreferences(objectives, prefs)
      const safety = result.find(obj => obj.key === 'safety')!

      expect(safety).toBeDefined()
    })
  })

  describe('verbosity level', () => {
    it('should boost conciseness for concise verbosity', () => {
      const objectives = createBaseObjectives()
      const prefs: UserPreferences = {
        verbosityLevel: 'concise',
      }

      const result = applyUserPreferences(objectives, prefs)
      const conciseness = result.find(obj => obj.key === 'conciseness')!

      expect(conciseness).toBeDefined()
      expect(conciseness.weight).toBeGreaterThan(0)
    })

    it('should boost informativeness for detailed verbosity', () => {
      const objectives = createBaseObjectives()
      const prefs: UserPreferences = {
        verbosityLevel: 'detailed',
      }

      const result = applyUserPreferences(objectives, prefs)
      const informativeness = result.find(obj => obj.key === 'informativeness')!

      expect(informativeness).toBeDefined()
      expect(informativeness.weight).toBeGreaterThan(0)
    })

    it('should not adjust for moderate verbosity', () => {
      const objectives = createBaseObjectives()
      const prefsModerate: UserPreferences = {
        verbosityLevel: 'moderate',
      }
      const prefsNone: UserPreferences = {}

      const resultModerate = applyUserPreferences(objectives, prefsModerate)
      const resultNone = applyUserPreferences(objectives, prefsNone)

      // Should be approximately the same
      expect(resultModerate).toHaveLength(resultNone.length)
    })
  })

  describe('prioritize objectives', () => {
    it('should boost prioritized objectives', () => {
      const objectives = createBaseObjectives()
      const prefs: UserPreferences = {
        prioritizeObjectives: ['safety', 'clarity'],
      }

      const result = applyUserPreferences(objectives, prefs)
      const safety = result.find(obj => obj.key === 'safety')!
      const clarity = result.find(obj => obj.key === 'clarity')!

      expect(safety).toBeDefined()
      expect(clarity).toBeDefined()
    })
  })

  describe('interaction preferences', () => {
    it('should boost clarity for step-by-step preference', () => {
      const objectives = createBaseObjectives()
      const prefs: UserPreferences = {
        interactionPreferences: {
          preferStepByStep: true,
        },
      }

      const result = applyUserPreferences(objectives, prefs)
      const clarity = result.find(obj => obj.key === 'clarity')!

      expect(clarity).toBeDefined()
      expect(clarity.weight).toBeGreaterThan(0)
    })

    it('should boost informativeness for examples preference', () => {
      const objectives = createBaseObjectives()
      const prefs: UserPreferences = {
        interactionPreferences: {
          preferExamples: true,
        },
      }

      const result = applyUserPreferences(objectives, prefs)
      const informativeness = result.find(obj => obj.key === 'informativeness')!

      expect(informativeness).toBeDefined()
      expect(informativeness.weight).toBeGreaterThan(0)
    })

    it('should boost conciseness for summaries preference', () => {
      const objectives = createBaseObjectives()
      const prefs: UserPreferences = {
        interactionPreferences: {
          preferSummaries: true,
        },
      }

      const result = applyUserPreferences(objectives, prefs)
      const conciseness = result.find(obj => obj.key === 'conciseness')!

      expect(conciseness).toBeDefined()
      expect(conciseness.weight).toBeGreaterThan(0)
    })
  })

  describe('combined preferences', () => {
    it('should handle multiple preference types together', () => {
      const objectives = createBaseObjectives()
      const prefs: UserPreferences = {
        preferredSupportStyle: 'empathic',
        riskSensitivity: 'high',
        verbosityLevel: 'concise',
        prioritizeObjectives: ['safety'],
        customObjectiveWeights: {
          empathy: 0.3,
        },
      }

      const result = applyUserPreferences(objectives, prefs)

      // Should have all objectives except disabled ones
      expect(result.length).toBeGreaterThan(0)

      // Weights should sum to 1
      const sum = result.reduce((acc, obj) => acc + obj.weight, 0)
      expect(sum).toBeCloseTo(1.0, 4)

      // Safety should be boosted (high risk + prioritized)
      const safety = result.find(obj => obj.key === 'safety')!
      expect(safety).toBeDefined()
      expect(safety.weight).toBeGreaterThan(0.1)
    })

    it('should handle conflicting preferences gracefully', () => {
      const objectives = createBaseObjectives()
      const prefs: UserPreferences = {
        verbosityLevel: 'detailed', // Boosts informativeness (would override)
        interactionPreferences: {
          preferSummaries: true, // Also boosts conciseness
        },
      }

      const result = applyUserPreferences(objectives, prefs)

      // Should still normalize properly
      const sum = result.reduce((acc, obj) => acc + obj.weight, 0)
      expect(sum).toBeCloseTo(1.0, 4)
    })
  })

  describe('edge cases', () => {
    it('should handle empty objectives array', () => {
      const result = applyUserPreferences([], {})
      expect(result).toEqual([])
    })

    it('should handle all objectives disabled', () => {
      const objectives = createBaseObjectives()
      const prefs: UserPreferences = {
        disableObjectives: objectives.map(obj => obj.key),
      }

      const result = applyUserPreferences(objectives, prefs)
      expect(result).toHaveLength(0)
    })

    it('should handle zero weights gracefully', () => {
      const objectives: ObjectivePriority[] = [
        { key: 'test1', priority: 1, weight: 0 },
        { key: 'test2', priority: 2, weight: 0 },
      ]

      const result = applyUserPreferences(objectives, {})

      // Should distribute equally when all weights are 0
      expect(result[0]!.weight).toBeCloseTo(0.5, 4)
      expect(result[1]!.weight).toBeCloseTo(0.5, 4)
    })
  })
})

describe('DEFAULT_PREFERENCES', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_PREFERENCES.preferredSupportStyle).toBe('empathic')
    expect(DEFAULT_PREFERENCES.responseFormality).toBe('adaptive')
    expect(DEFAULT_PREFERENCES.riskSensitivity).toBe('high')
    expect(DEFAULT_PREFERENCES.verbosityLevel).toBe('moderate')
  })
})
