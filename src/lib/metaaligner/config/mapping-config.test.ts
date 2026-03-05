import { describe, it, expect } from 'vitest'
import { ContextType } from '../core/objectives'
import {
  DEFAULT_MAPPING_CONFIG,
  ObjectiveId,
  ValidationErrorType,
  validateContextCoverage,
  validateWeights,
  validateSafetyFloor,
  validateMappingConfiguration,
  type MappingConfiguration,
  type ObjectiveWeightConfig,
} from './mapping-config'

describe('MappingConfiguration', () => {
  describe('validateContextCoverage', () => {
    it('should validate that all ContextType enum values are present', () => {
      const errors = validateContextCoverage(DEFAULT_MAPPING_CONFIG)
      expect(errors).toHaveLength(0)
    })

    it('should detect missing context types', () => {
      const incompleteConfig: MappingConfiguration = {
        ...DEFAULT_MAPPING_CONFIG,
        mappings: DEFAULT_MAPPING_CONFIG.mappings.filter(
          (m) => m.context !== ContextType.CRISIS,
        ),
      }

      const errors = validateContextCoverage(incompleteConfig)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].type).toBe(ValidationErrorType.MISSING_CONTEXT)
      expect(errors[0].context).toBe(ContextType.CRISIS)
    })

    it('should detect duplicate context types', () => {
      const duplicateConfig: MappingConfiguration = {
        ...DEFAULT_MAPPING_CONFIG,
        mappings: [
          ...DEFAULT_MAPPING_CONFIG.mappings,
          DEFAULT_MAPPING_CONFIG.mappings[0], // Duplicate
        ],
      }

      const errors = validateContextCoverage(duplicateConfig)
      expect(errors.some((e) => e.type === ValidationErrorType.DUPLICATE_CONTEXT)).toBe(true)
    })

    it('should validate all ContextType enum values are mapped', () => {
      const configuredContexts = new Set(
        DEFAULT_MAPPING_CONFIG.mappings.map((m) => m.context),
      )
      const allContextTypes = Object.values(ContextType)

      for (const contextType of allContextTypes) {
        expect(configuredContexts.has(contextType)).toBe(true)
      }
    })
  })

  describe('validateWeights', () => {
    it('should accept valid weights between 0 and 1', () => {
      const validWeights: ObjectiveWeightConfig = {
        [ObjectiveId.CORRECTNESS]: 0.3,
        [ObjectiveId.INFORMATIVENESS]: 0.2,
        [ObjectiveId.PROFESSIONALISM]: 0.2,
        [ObjectiveId.EMPATHY]: 0.2,
        [ObjectiveId.SAFETY]: 0.1,
      }

      const errors = validateWeights(validWeights, ContextType.GENERAL)
      expect(errors).toHaveLength(0)
    })

    it('should reject weights less than 0', () => {
      const invalidWeights: ObjectiveWeightConfig = {
        [ObjectiveId.CORRECTNESS]: -0.1,
        [ObjectiveId.INFORMATIVENESS]: 0.3,
        [ObjectiveId.PROFESSIONALISM]: 0.3,
        [ObjectiveId.EMPATHY]: 0.3,
        [ObjectiveId.SAFETY]: 0.1,
      }

      const errors = validateWeights(invalidWeights, ContextType.GENERAL)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].type).toBe(ValidationErrorType.INVALID_WEIGHT)
      expect(errors[0].objectiveId).toBe(ObjectiveId.CORRECTNESS)
    })

    it('should reject weights greater than 1', () => {
      const invalidWeights: ObjectiveWeightConfig = {
        [ObjectiveId.CORRECTNESS]: 1.5,
        [ObjectiveId.INFORMATIVENESS]: 0.1,
        [ObjectiveId.PROFESSIONALISM]: 0.1,
        [ObjectiveId.EMPATHY]: 0.1,
        [ObjectiveId.SAFETY]: 0.1,
      }

      const errors = validateWeights(invalidWeights, ContextType.GENERAL)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].type).toBe(ValidationErrorType.INVALID_WEIGHT)
    })

    it('should detect missing required objectives', () => {
      const incompleteWeights: any = {
        [ObjectiveId.CORRECTNESS]: 0.5,
        [ObjectiveId.INFORMATIVENESS]: 0.5,
        // Missing: professionalism, empathy, safety
      }

      const errors = validateWeights(incompleteWeights, ContextType.GENERAL)
      expect(errors.length).toBeGreaterThanOrEqual(3)
      expect(errors.every((e) => e.type === ValidationErrorType.MISSING_OBJECTIVE)).toBe(true)
    })
  })

  describe('validateSafetyFloor', () => {
    it('should enforce minimum safety weight when enabled', () => {
      const config: MappingConfiguration = {
        ...DEFAULT_MAPPING_CONFIG,
        safetyFloor: {
          enabled: true,
          minimumSafetyWeight: 0.1,
          contexts: [ContextType.CRISIS, ContextType.SUPPORT],
        },
        mappings: [
          {
            context: ContextType.CRISIS,
            precedence: 1,
            description: 'Test',
            enforceSafetyFloor: true,
            weights: {
              [ObjectiveId.CORRECTNESS]: 0.5,
              [ObjectiveId.INFORMATIVENESS]: 0.4,
              [ObjectiveId.PROFESSIONALISM]: 0.05,
              [ObjectiveId.EMPATHY]: 0.03,
              [ObjectiveId.SAFETY]: 0.02, // Below minimum
            },
          },
        ],
      }

      const errors = validateSafetyFloor(config)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].type).toBe(ValidationErrorType.SAFETY_FLOOR_VIOLATION)
      expect(errors[0].context).toBe(ContextType.CRISIS)
    })

    it('should allow safety weight above minimum', () => {
      const config: MappingConfiguration = {
        ...DEFAULT_MAPPING_CONFIG,
        safetyFloor: {
          enabled: true,
          minimumSafetyWeight: 0.1,
          contexts: [ContextType.CRISIS],
        },
        mappings: [
          {
            context: ContextType.CRISIS,
            precedence: 1,
            description: 'Test',
            enforceSafetyFloor: true,
            weights: {
              [ObjectiveId.CORRECTNESS]: 0.3,
              [ObjectiveId.INFORMATIVENESS]: 0.2,
              [ObjectiveId.PROFESSIONALISM]: 0.2,
              [ObjectiveId.EMPATHY]: 0.1,
              [ObjectiveId.SAFETY]: 0.2, // Above minimum
            },
          },
        ],
      }

      const errors = validateSafetyFloor(config)
      expect(errors).toHaveLength(0)
    })

    it('should not enforce safety floor when disabled', () => {
      const config: MappingConfiguration = {
        ...DEFAULT_MAPPING_CONFIG,
        safetyFloor: {
          enabled: false,
          minimumSafetyWeight: 0.5,
          contexts: [ContextType.CRISIS],
        },
        mappings: [
          {
            context: ContextType.CRISIS,
            precedence: 1,
            description: 'Test',
            enforceSafetyFloor: true,
            weights: {
              [ObjectiveId.CORRECTNESS]: 0.5,
              [ObjectiveId.INFORMATIVENESS]: 0.4,
              [ObjectiveId.PROFESSIONALISM]: 0.05,
              [ObjectiveId.EMPATHY]: 0.03,
              [ObjectiveId.SAFETY]: 0.02, // Below minimum but floor disabled
            },
          },
        ],
      }

      const errors = validateSafetyFloor(config)
      expect(errors).toHaveLength(0)
    })
  })

  describe('validateMappingConfiguration', () => {
    it('should validate the default configuration successfully', () => {
      const result = validateMappingConfiguration(DEFAULT_MAPPING_CONFIG)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail fast with multiple validation errors', () => {
      const invalidConfig: MappingConfiguration = {
        version: '1.0.0',
        normalization: 'enabled',
        validationStrict: true,
        safetyFloor: {
          enabled: true,
          minimumSafetyWeight: 0.5,
          contexts: [ContextType.CRISIS],
        },
        precedenceRules: [],
        mappings: [
          {
            context: ContextType.CRISIS,
            precedence: 1,
            description: 'Test',
            enforceSafetyFloor: true,
            weights: {
              [ObjectiveId.CORRECTNESS]: 1.5, // Invalid: > 1
              [ObjectiveId.INFORMATIVENESS]: -0.1, // Invalid: < 0
              [ObjectiveId.PROFESSIONALISM]: 0.2,
              [ObjectiveId.EMPATHY]: 0.1,
              [ObjectiveId.SAFETY]: 0.1, // Below minimum
            },
          },
          // Missing other required contexts
        ],
      }

      const result = validateMappingConfiguration(invalidConfig)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)

      // Should have errors for missing contexts, invalid weights, and safety floor
      const errorTypes = new Set(result.errors.map((e) => e.type))
      expect(errorTypes.has(ValidationErrorType.MISSING_CONTEXT)).toBe(true)
      expect(errorTypes.has(ValidationErrorType.INVALID_WEIGHT)).toBe(true)
      expect(errorTypes.has(ValidationErrorType.SAFETY_FLOOR_VIOLATION)).toBe(true)
    })

    it('should validate normalization when enabled', () => {
      const unnormalizedConfig: MappingConfiguration = {
        ...DEFAULT_MAPPING_CONFIG,
        normalization: 'enabled',
        mappings: [
          {
            context: ContextType.GENERAL,
            precedence: 1,
            description: 'Test',
            enforceSafetyFloor: false,
            weights: {
              [ObjectiveId.CORRECTNESS]: 0.5,
              [ObjectiveId.INFORMATIVENESS]: 0.5,
              [ObjectiveId.PROFESSIONALISM]: 0.5, // Sum > 1
              [ObjectiveId.EMPATHY]: 0.1,
              [ObjectiveId.SAFETY]: 0.1,
            },
          },
        ],
      }

      const result = validateMappingConfiguration(unnormalizedConfig)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.type === ValidationErrorType.NORMALIZATION_ERROR)).toBe(
        true,
      )
    })

    it('should allow unnormalized weights when normalization disabled', () => {
      const config: MappingConfiguration = {
        ...DEFAULT_MAPPING_CONFIG,
        normalization: 'disabled',
        mappings: [
          {
            context: ContextType.GENERAL,
            precedence: 1,
            description: 'Test',
            enforceSafetyFloor: false,
            weights: {
              [ObjectiveId.CORRECTNESS]: 0.5,
              [ObjectiveId.INFORMATIVENESS]: 0.5,
              [ObjectiveId.PROFESSIONALISM]: 0.5, // Sum > 1 but normalization disabled
              [ObjectiveId.EMPATHY]: 0.1,
              [ObjectiveId.SAFETY]: 0.1,
            },
          },
        ],
      }

      const result = validateMappingConfiguration(config)
      // Should only fail on missing contexts, not normalization
      expect(
        result.errors.every((e) => e.type !== ValidationErrorType.NORMALIZATION_ERROR),
      ).toBe(true)
    })
  })

  describe('Default Configuration Integrity', () => {
    it('should have all required contexts mapped', () => {
      const contexts = DEFAULT_MAPPING_CONFIG.mappings.map((m) => m.context)
      const requiredContexts = Object.values(ContextType)

      for (const required of requiredContexts) {
        expect(contexts).toContain(required)
      }
    })

    it('should have valid precedence ordering', () => {
      const precedences = DEFAULT_MAPPING_CONFIG.mappings.map((m) => m.precedence)

      // Precedences should be unique and ordered
      const uniquePrecedences = new Set(precedences)
      expect(uniquePrecedences.size).toBe(precedences.length)

      // CRISIS should have highest precedence (lowest number)
      const crisisMapping = DEFAULT_MAPPING_CONFIG.mappings.find(
        (m) => m.context === ContextType.CRISIS,
      )
      expect(crisisMapping?.precedence).toBe(1)
    })

    it('should enforce safety floor for crisis and support contexts', () => {
      const crisisMapping = DEFAULT_MAPPING_CONFIG.mappings.find(
        (m) => m.context === ContextType.CRISIS,
      )
      const supportMapping = DEFAULT_MAPPING_CONFIG.mappings.find(
        (m) => m.context === ContextType.SUPPORT,
      )

      expect(crisisMapping?.enforceSafetyFloor).toBe(true)
      expect(supportMapping?.enforceSafetyFloor).toBe(true)
    })

    it('should have all weights sum to 1.0 when normalization enabled', () => {
      for (const mapping of DEFAULT_MAPPING_CONFIG.mappings) {
        const sum = Object.values(mapping.weights).reduce((acc, w) => acc + (w || 0), 0)
        expect(Math.abs(sum - 1.0)).toBeLessThan(0.001) // Allow floating point errors
      }
    })

    it('should have meaningful precedence rules', () => {
      expect(DEFAULT_MAPPING_CONFIG.precedenceRules.length).toBeGreaterThan(0)

      // Crisis should have precedence over other contexts
      const crisisRules = DEFAULT_MAPPING_CONFIG.precedenceRules.filter(
        (r) => r.higherPrecedenceContext === ContextType.CRISIS,
      )
      expect(crisisRules.length).toBeGreaterThan(0)
    })
  })
})
