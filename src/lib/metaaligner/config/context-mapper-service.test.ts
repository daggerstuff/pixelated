import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ContextType } from '../core/objectives'
import {
  ContextMapperService,
  getContextMapperService,
  resetContextMapperService,
} from './context-mapper-service'
import {
  DEFAULT_MAPPING_CONFIG,
  ObjectiveId,
  type MappingConfiguration,
} from './mapping-config'

describe('ContextMapperService', () => {
  let service: ContextMapperService

  beforeEach(() => {
    service = new ContextMapperService()
    resetContextMapperService()
  })

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      expect(service).toBeDefined()
      const config = service.getConfiguration()
      expect(config.version).toBe(DEFAULT_MAPPING_CONFIG.version)
    })

    it('should fail fast with invalid configuration', () => {
      const invalidConfig: MappingConfiguration = {
        ...DEFAULT_MAPPING_CONFIG,
        mappings: [], // Empty mappings - invalid
      }

      expect(() => new ContextMapperService(invalidConfig)).toThrow(
        /Invalid mapping configuration/,
      )
    })

    it('should validate configuration on initialization', () => {
      const config: MappingConfiguration = {
        ...DEFAULT_MAPPING_CONFIG,
        mappings: DEFAULT_MAPPING_CONFIG.mappings.map((m) => ({
          ...m,
          weights: {
            ...m.weights,
            [ObjectiveId.CORRECTNESS]: 2.0, // Invalid weight
          },
        })),
      }

      expect(() => new ContextMapperService(config)).toThrow()
    })
  })

  describe('getWeightsForContext', () => {
    it('should return weights for CRISIS context', () => {
      const result = service.getWeightsForContext(ContextType.CRISIS)

      expect(result.context).toBe(ContextType.CRISIS)
      expect(result.weights[ObjectiveId.SAFETY]).toBeGreaterThan(0.5)
      expect(result.precedence).toBe(1) // Highest precedence
      expect(result.reasoning.length).toBeGreaterThan(0)
    })

    it('should return weights for CLINICAL_ASSESSMENT context', () => {
      const result = service.getWeightsForContext(ContextType.CLINICAL_ASSESSMENT)

      expect(result.context).toBe(ContextType.CLINICAL_ASSESSMENT)
      expect(result.weights[ObjectiveId.CORRECTNESS]).toBeGreaterThanOrEqual(0.3)
      expect(result.weights[ObjectiveId.SAFETY]).toBeGreaterThanOrEqual(0.25)
      expect(result.weights[ObjectiveId.PROFESSIONALISM]).toBeGreaterThanOrEqual(0.2)
    })

    it('should return weights for all context types', () => {
      const contexts = Object.values(ContextType)

      for (const context of contexts) {
        const result = service.getWeightsForContext(context)
        expect(result.context).toBe(context)
        expect(result.weights).toBeDefined()
        expect(result.precedence).toBeGreaterThan(0)
      }
    })

    it('should cache results for performance', () => {
      const result1 = service.getWeightsForContext(ContextType.CRISIS)
      const result2 = service.getWeightsForContext(ContextType.CRISIS)

      // Should return same object reference (cached)
      expect(result1).toBe(result2)
    })

    it('should include explainability reasoning', () => {
      const result = service.getWeightsForContext(ContextType.EDUCATIONAL)

      expect(result.reasoning).toBeDefined()
      expect(result.reasoning.length).toBeGreaterThan(0)
      expect(result.reasoning[0]).toContain('EDUCATIONAL')
    })
  })

  describe('safety floor enforcement', () => {
    it('should apply safety floor when enabled', () => {
      const config: MappingConfiguration = {
        ...DEFAULT_MAPPING_CONFIG,
        safetyFloor: {
          enabled: true,
          minimumSafetyWeight: 0.15,
          contexts: [ContextType.EDUCATIONAL],
        },
        mappings: DEFAULT_MAPPING_CONFIG.mappings.map((m) =>
          m.context === ContextType.EDUCATIONAL
            ? { ...m, enforceSafetyFloor: true }
            : m,
        ),
      }

      const customService = new ContextMapperService(config)
      const result = customService.getWeightsForContext(ContextType.EDUCATIONAL)

      expect(result.weights[ObjectiveId.SAFETY]).toBeGreaterThanOrEqual(0.15)
      expect(result.safetyFloorApplied).toBe(true)
      expect(result.reasoning.some((r) => r.includes('Safety floor'))).toBe(true)
    })

    it('should not apply safety floor when disabled', () => {
      const config: MappingConfiguration = {
        ...DEFAULT_MAPPING_CONFIG,
        safetyFloor: {
          enabled: false,
          minimumSafetyWeight: 0.5,
          contexts: [ContextType.EDUCATIONAL],
        },
      }

      const customService = new ContextMapperService(config)
      const result = customService.getWeightsForContext(ContextType.EDUCATIONAL)

      expect(result.safetyFloorApplied).toBe(false)
    })

    it('should enforce safety floor for CRISIS context', () => {
      const result = service.getWeightsForContext(ContextType.CRISIS)

      // CRISIS should always have significant safety weight
      expect(result.weights[ObjectiveId.SAFETY]).toBeGreaterThanOrEqual(
        DEFAULT_MAPPING_CONFIG.safetyFloor.minimumSafetyWeight,
      )
    })
  })

  describe('resolveContextConflict', () => {
    it('should handle single context (no conflict)', () => {
      const conflict = service.resolveContextConflict([ContextType.EDUCATIONAL])

      expect(conflict.resolvedContext).toBe(ContextType.EDUCATIONAL)
      expect(conflict.reason).toContain('no conflict')
    })

    it('should handle empty contexts array', () => {
      const conflict = service.resolveContextConflict([])

      expect(conflict.resolvedContext).toBe(ContextType.GENERAL)
      expect(conflict.reason).toContain('defaulting to GENERAL')
    })

    it('should resolve CRISIS vs GENERAL conflict', () => {
      const conflict = service.resolveContextConflict([
        ContextType.GENERAL,
        ContextType.CRISIS,
      ])

      expect(conflict.resolvedContext).toBe(ContextType.CRISIS)
      expect(conflict.contexts).toContain(ContextType.CRISIS)
      expect(conflict.contexts).toContain(ContextType.GENERAL)
    })

    it('should resolve CRISIS vs EDUCATIONAL conflict', () => {
      const conflict = service.resolveContextConflict([
        ContextType.EDUCATIONAL,
        ContextType.CRISIS,
      ])

      expect(conflict.resolvedContext).toBe(ContextType.CRISIS)
    })

    it('should resolve CLINICAL_ASSESSMENT vs GENERAL conflict', () => {
      const conflict = service.resolveContextConflict([
        ContextType.GENERAL,
        ContextType.CLINICAL_ASSESSMENT,
      ])

      expect(conflict.resolvedContext).toBe(ContextType.CLINICAL_ASSESSMENT)
    })

    it('should resolve SUPPORT vs INFORMATIONAL conflict', () => {
      const conflict = service.resolveContextConflict([
        ContextType.INFORMATIONAL,
        ContextType.SUPPORT,
      ])

      expect(conflict.resolvedContext).toBe(ContextType.SUPPORT)
    })

    it('should use precedence when no explicit rule exists', () => {
      const conflict = service.resolveContextConflict([
        ContextType.EDUCATIONAL,
        ContextType.INFORMATIONAL,
      ])

      // EDUCATIONAL has lower precedence number than INFORMATIONAL
      expect(conflict.resolvedContext).toBe(ContextType.EDUCATIONAL)
    })

    it('should handle three-way conflicts', () => {
      const conflict = service.resolveContextConflict([
        ContextType.GENERAL,
        ContextType.EDUCATIONAL,
        ContextType.CRISIS,
      ])

      // CRISIS should win (highest precedence)
      expect(conflict.resolvedContext).toBe(ContextType.CRISIS)
    })

    it('should provide explainability for conflict resolution', () => {
      const conflict = service.resolveContextConflict([
        ContextType.CRISIS,
        ContextType.GENERAL,
      ])

      expect(conflict.reason).toBeDefined()
      expect(conflict.reason.length).toBeGreaterThan(0)
    })
  })

  describe('normalization', () => {
    it('should normalize weights when enabled', () => {
      const result = service.getWeightsForContext(ContextType.CRISIS)

      expect(result.normalized).toBe(true)

      const sum = Object.values(result.weights).reduce((acc, w) => acc + (w || 0), 0)
      expect(Math.abs(sum - 1.0)).toBeLessThan(0.001)
    })

    it('should not normalize when disabled', () => {
      const config: MappingConfiguration = {
        ...DEFAULT_MAPPING_CONFIG,
        normalization: 'disabled',
      }

      const customService = new ContextMapperService(config)
      const result = customService.getWeightsForContext(ContextType.CRISIS)

      expect(result.normalized).toBe(false)
    })
  })

  describe('configuration updates', () => {
    it('should update configuration successfully', () => {
      const newConfig: MappingConfiguration = {
        ...DEFAULT_MAPPING_CONFIG,
        version: '2.0.0',
      }

      service.updateConfiguration(newConfig)

      const config = service.getConfiguration()
      expect(config.version).toBe('2.0.0')
    })

    it('should fail fast on invalid configuration update', () => {
      const invalidConfig: MappingConfiguration = {
        ...DEFAULT_MAPPING_CONFIG,
        mappings: [], // Invalid
      }

      expect(() => service.updateConfiguration(invalidConfig)).toThrow(
        /validation failed/,
      )
    })

    it('should clear cache after configuration update', () => {
      const result1 = service.getWeightsForContext(ContextType.CRISIS)

      const newConfig: MappingConfiguration = {
        ...DEFAULT_MAPPING_CONFIG,
        version: '2.0.0',
      }
      service.updateConfiguration(newConfig)

      const result2 = service.getWeightsForContext(ContextType.CRISIS)

      // Should be different objects (cache cleared)
      expect(result1).not.toBe(result2)
    })
  })

  describe('explainability', () => {
    it('should provide mapping reasoning', () => {
      const result = service.getMappingWithExplainability(ContextType.SUPPORT)

      expect(result.reasoning).toBeDefined()
      expect(result.reasoning.length).toBeGreaterThan(0)
      expect(result.reasoning.some((r) => r.includes('SUPPORT'))).toBe(true)
    })

    it('should log reasoning when safety floor is applied', () => {
      const config: MappingConfiguration = {
        ...DEFAULT_MAPPING_CONFIG,
        safetyFloor: {
          enabled: true,
          minimumSafetyWeight: 0.2,
          contexts: [ContextType.EDUCATIONAL],
        },
        mappings: DEFAULT_MAPPING_CONFIG.mappings.map((m) =>
          m.context === ContextType.EDUCATIONAL
            ? { ...m, enforceSafetyFloor: true }
            : m,
        ),
      }

      const customService = new ContextMapperService(config)
      const result = customService.getMappingWithExplainability(ContextType.EDUCATIONAL)

      expect(result.reasoning.some((r) => r.includes('Safety floor'))).toBe(true)
    })

    it('should log normalization when applied', () => {
      const result = service.getMappingWithExplainability(ContextType.CRISIS)

      expect(result.reasoning.some((r) => r.includes('normalized'))).toBe(true)
    })
  })

  describe('singleton instance', () => {
    it('should return singleton instance', () => {
      const instance1 = getContextMapperService()
      const instance2 = getContextMapperService()

      expect(instance1).toBe(instance2)
    })

    it('should reset singleton instance', () => {
      const instance1 = getContextMapperService()
      resetContextMapperService()
      const instance2 = getContextMapperService()

      expect(instance1).not.toBe(instance2)
    })
  })

  describe('edge cases', () => {
    it('should handle unknown context gracefully', () => {
      // This should not be possible with TypeScript, but test defensive coding
      const result = service.getWeightsForContext('UNKNOWN' as ContextType)

      expect(result.context).toBe(ContextType.GENERAL) // Fallback
    })

    it('should handle cache clearing', () => {
      service.getWeightsForContext(ContextType.CRISIS)
      expect(service['mappingCache'].size).toBeGreaterThan(0)

      service.clearCache()
      expect(service['mappingCache'].size).toBe(0)
    })
  })

  describe('deterministic behavior', () => {
    it('should return consistent results for same context', () => {
      const result1 = service.getWeightsForContext(ContextType.CRISIS)
      service.clearCache()
      const result2 = service.getWeightsForContext(ContextType.CRISIS)

      expect(result1.context).toBe(result2.context)
      expect(result1.weights).toEqual(result2.weights)
      expect(result1.precedence).toBe(result2.precedence)
    })

    it('should resolve conflicts deterministically', () => {
      const conflict1 = service.resolveContextConflict([
        ContextType.CRISIS,
        ContextType.GENERAL,
      ])
      const conflict2 = service.resolveContextConflict([
        ContextType.GENERAL,
        ContextType.CRISIS,
      ])

      expect(conflict1.resolvedContext).toBe(conflict2.resolvedContext)
    })
  })
})
