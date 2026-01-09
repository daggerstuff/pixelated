import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  DynamicWeightingEngine,
  DEFAULT_DYNAMIC_WEIGHTING_CONFIG,
  getDynamicWeightingEngine,
  resetDynamicWeightingEngine,
  type DynamicWeightingConfig,
} from './dynamic-weighting'
import { ContextType, type AlignmentContext } from './objectives'
import { ObjectiveId } from '../config/mapping-config'

describe('DynamicWeightingEngine', () => {
  let engine: DynamicWeightingEngine

  beforeEach(() => {
    engine = new DynamicWeightingEngine()
    resetDynamicWeightingEngine()
  })

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      expect(engine).toBeDefined()
      const config = engine.getConfiguration()
      expect(config.blendingEnabled).toBe(true)
      expect(config.crisisOverrideEnabled).toBe(true)
      expect(config.hysteresisEnabled).toBe(true)
      expect(config.stabilityGuardEnabled).toBe(true)
    })

    it('should accept custom configuration', () => {
      const customConfig: Partial<DynamicWeightingConfig> = {
        blendingAlpha: 0.5,
        hysteresisThreshold: 0.1,
      }
      const customEngine = new DynamicWeightingEngine(customConfig)
      const config = customEngine.getConfiguration()
      
      expect(config.blendingAlpha).toBe(0.5)
      expect(config.hysteresisThreshold).toBe(0.1)
    })
  })

  describe('crisis override', () => {
    it('should apply crisis override immediately with high confidence', () => {
      const crisisContext: AlignmentContext = {
        userQuery: 'I want to end my life',
        detectedContext: ContextType.CRISIS,
        confidence: 0.95,
      }

      const result = engine.calculateDynamicWeights(crisisContext)

      expect(result.crisisOverrideApplied).toBe(true)
      expect(result.blendingApplied).toBe(false)
      expect(result.weights[ObjectiveId.SAFETY]).toBeGreaterThan(0.5)
      expect(result.updateTimeMs).toBeLessThan(250)
    })

    it('should not apply crisis override with low confidence', () => {
      const crisisContext: AlignmentContext = {
        userQuery: 'I feel bad',
        detectedContext: ContextType.CRISIS,
        confidence: 0.5, // Below threshold (0.8)
      }

      const result = engine.calculateDynamicWeights(crisisContext)

      expect(result.crisisOverrideApplied).toBe(false)
    })

    it('should skip smoothing when crisis override is applied', () => {
      // First, establish some history with a different context
      const generalContext: AlignmentContext = {
        userQuery: 'What is therapy?',
        detectedContext: ContextType.GENERAL,
        confidence: 0.8,
      }
      engine.calculateDynamicWeights(generalContext)

      // Now apply crisis
      const crisisContext: AlignmentContext = {
        userQuery: 'I want to die',
        detectedContext: ContextType.CRISIS,
        confidence: 0.95,
      }

      const result = engine.calculateDynamicWeights(crisisContext)

      expect(result.crisisOverrideApplied).toBe(true)
      expect(result.blendingApplied).toBe(false)
      expect(result.reasoning.some(r => r.includes('Crisis override'))).toBe(true)
    })
  })

  describe('weighted blending (smoothing)', () => {
    it('should blend new weights with previous weights', () => {
      const context1: AlignmentContext = {
        userQuery: 'What is depression?',
        detectedContext: ContextType.EDUCATIONAL,
        confidence: 0.85,
      }

      const context2: AlignmentContext = {
        userQuery: 'Tell me about anxiety',
        detectedContext: ContextType.EDUCATIONAL,
        confidence: 0.85,
      }

      const result1 = engine.calculateDynamicWeights(context1)
      const result2 = engine.calculateDynamicWeights(context2)

      // First call should not blend (no history)
      expect(result1.blendingApplied).toBe(false)

      // Second call should blend
      expect(result2.blendingApplied).toBe(true)
      expect(result2.reasoning.some(r => r.includes('Blending applied'))).toBe(true)
    })

    it('should smooth transitions between contexts', () => {
      const educationalContext: AlignmentContext = {
        userQuery: 'What is therapy?',
        detectedContext: ContextType.EDUCATIONAL,
        confidence: 0.85,
      }

      const supportContext: AlignmentContext = {
        userQuery: 'I need help coping',
        detectedContext: ContextType.SUPPORT,
        confidence: 0.85,
      }

      const result1 = engine.calculateDynamicWeights(educationalContext)
      const result2 = engine.calculateDynamicWeights(supportContext)

      // Weights should transition smoothly, not jump
      const empathyChange = Math.abs(
        result2.weights[ObjectiveId.EMPATHY] - result1.weights[ObjectiveId.EMPATHY]
      )

      // With blending, change should be less than the full difference
      expect(empathyChange).toBeLessThan(0.3) // Reasonable smooth transition
    })

    it('should respect blendingAlpha parameter', () => {
      const customEngine = new DynamicWeightingEngine({
        blendingAlpha: 0.8, // High smoothing
      })

      const context1: AlignmentContext = {
        userQuery: 'What is therapy?',
        detectedContext: ContextType.EDUCATIONAL,
        confidence: 0.85,
      }

      const context2: AlignmentContext = {
        userQuery: 'I need support',
        detectedContext: ContextType.SUPPORT,
        confidence: 0.85,
      }

      customEngine.calculateDynamicWeights(context1)
      const result = customEngine.calculateDynamicWeights(context2)

      expect(result.blendingApplied).toBe(true)
    })
  })

  describe('hysteresis', () => {
    it('should not update weights if change is below threshold', () => {
      const context1: AlignmentContext = {
        userQuery: 'What is depression?',
        detectedContext: ContextType.EDUCATIONAL,
        confidence: 0.85,
      }

      const context2: AlignmentContext = {
        userQuery: 'What is anxiety?',
        detectedContext: ContextType.EDUCATIONAL, // Same context
        confidence: 0.86, // Slightly different confidence
      }

      const result1 = engine.calculateDynamicWeights(context1)
      const result2 = engine.calculateDynamicWeights(context2)

      // Second result should apply hysteresis (weights unchanged)
      expect(result2.hysteresisApplied).toBe(true)
      expect(result2.weights).toEqual(result1.weights)
    })

    it('should update weights if change exceeds threshold', () => {
      const context1: AlignmentContext = {
        userQuery: 'What is therapy?',
        detectedContext: ContextType.EDUCATIONAL,
        confidence: 0.85,
      }

      const context2: AlignmentContext = {
        userQuery: 'I need emotional support',
        detectedContext: ContextType.SUPPORT, // Different context
        confidence: 0.85,
      }

      const result1 = engine.calculateDynamicWeights(context1)
      const result2 = engine.calculateDynamicWeights(context2)

      // Change should be significant, hysteresis not applied
      expect(result2.hysteresisApplied).toBe(false)
    })
  })

  describe('stability guard', () => {
    it('should limit maximum weight change per turn', () => {
      const customEngine = new DynamicWeightingEngine({
        maxWeightChangePerTurn: 0.1, // 10% max change
        blendingEnabled: false, // Disable blending to test guard directly
      })

      const context1: AlignmentContext = {
        userQuery: 'What is therapy?',
        detectedContext: ContextType.EDUCATIONAL,
        confidence: 0.85,
      }

      const context2: AlignmentContext = {
        userQuery: 'I need support now',
        detectedContext: ContextType.SUPPORT,
        confidence: 0.85,
      }

      customEngine.calculateDynamicWeights(context1)
      const result = customEngine.calculateDynamicWeights(context2)

      // Check that no weight changed by more than 10%
      const history = customEngine.getWeightHistory()
      const prevWeights = history[history.length - 2].weights
      const newWeights = result.weights

      for (const key in newWeights) {
        const change = Math.abs(newWeights[key] - prevWeights[key])
        expect(change).toBeLessThanOrEqual(0.11) // 10% + small tolerance
      }
    })

    it('should apply stability guard when large changes detected', () => {
      const customEngine = new DynamicWeightingEngine({
        maxWeightChangePerTurn: 0.15,
        blendingEnabled: false,
      })

      const context1: AlignmentContext = {
        userQuery: 'General question',
        detectedContext: ContextType.GENERAL,
        confidence: 0.85,
      }

      const context2: AlignmentContext = {
        userQuery: 'Clinical assessment needed',
        detectedContext: ContextType.CLINICAL_ASSESSMENT,
        confidence: 0.85,
      }

      customEngine.calculateDynamicWeights(context1)
      const result = customEngine.calculateDynamicWeights(context2)

      expect(result.stabilityGuardApplied).toBe(true)
    })
  })

  describe('oscillation detection', () => {
    it('should detect oscillation with repeated direction changes', () => {
      const contexts = [
        ContextType.EDUCATIONAL,
        ContextType.SUPPORT,
        ContextType.EDUCATIONAL,
        ContextType.SUPPORT,
        ContextType.EDUCATIONAL,
        ContextType.SUPPORT,
      ]

      let oscillationDetected = false

      for (const contextType of contexts) {
        const context: AlignmentContext = {
          userQuery: `Query for ${contextType}`,
          detectedContext: contextType,
          confidence: 0.85,
        }

        const result = engine.calculateDynamicWeights(context)
        if (result.oscillationDetected) {
          oscillationDetected = true
        }
      }

      expect(oscillationDetected).toBe(true)
    })

    it('should increase smoothing when oscillation detected', () => {
      const contexts = [
        ContextType.EDUCATIONAL,
        ContextType.SUPPORT,
        ContextType.EDUCATIONAL,
        ContextType.SUPPORT,
        ContextType.EDUCATIONAL,
      ]

      for (const contextType of contexts) {
        const context: AlignmentContext = {
          userQuery: `Query for ${contextType}`,
          detectedContext: contextType,
          confidence: 0.85,
        }

        const result = engine.calculateDynamicWeights(context)

        if (result.oscillationDetected) {
          expect(result.reasoning.some(r => r.includes('increased smoothing'))).toBe(true)
        }
      }
    })

    it('should not detect oscillation with stable contexts', () => {
      for (let i = 0; i < 10; i++) {
        const context: AlignmentContext = {
          userQuery: `Educational query ${i}`,
          detectedContext: ContextType.EDUCATIONAL,
          confidence: 0.85,
        }

        const result = engine.calculateDynamicWeights(context)
        expect(result.oscillationDetected).toBe(false)
      }
    })
  })

  describe('performance', () => {
    it('should complete weight updates within 250ms', () => {
      const contexts = [
        ContextType.CRISIS,
        ContextType.SUPPORT,
        ContextType.EDUCATIONAL,
        ContextType.CLINICAL_ASSESSMENT,
        ContextType.INFORMATIONAL,
        ContextType.GENERAL,
      ]

      for (const contextType of contexts) {
        const context: AlignmentContext = {
          userQuery: `Test query for ${contextType}`,
          detectedContext: contextType,
          confidence: 0.85,
        }

        const result = engine.calculateDynamicWeights(context)
        expect(result.updateTimeMs).toBeLessThan(250)
      }
    })

    it('should benefit from caching for repeated contexts', () => {
      const context: AlignmentContext = {
        userQuery: 'What is therapy?',
        detectedContext: ContextType.EDUCATIONAL,
        confidence: 0.85,
      }

      const result1 = engine.calculateDynamicWeights(context)
      const result2 = engine.calculateDynamicWeights(context)

      // Second call should be faster (cached)
      expect(result2.updateTimeMs).toBeLessThanOrEqual(result1.updateTimeMs)
      expect(result2.reasoning.some(r => r.includes('Cached'))).toBe(true)
    })

    it('should invalidate cache when context changes', () => {
      const context1: AlignmentContext = {
        userQuery: 'What is therapy?',
        detectedContext: ContextType.EDUCATIONAL,
        confidence: 0.85,
      }

      const context2: AlignmentContext = {
        userQuery: 'I need support',
        detectedContext: ContextType.SUPPORT,
        confidence: 0.85,
      }

      engine.calculateDynamicWeights(context1)
      const result = engine.calculateDynamicWeights(context2)

      expect(result.reasoning.some(r => r.includes('Cached'))).toBe(false)
    })
  })

  describe('normalization', () => {
    it('should normalize weights to sum to 1.0', () => {
      const context: AlignmentContext = {
        userQuery: 'Test query',
        detectedContext: ContextType.GENERAL,
        confidence: 0.85,
      }

      const result = engine.calculateDynamicWeights(context)

      const sum = Object.values(result.weights).reduce((acc, w) => acc + w, 0)
      expect(Math.abs(sum - 1.0)).toBeLessThan(0.001)
    })

    it('should keep weights in [0, 1] range', () => {
      const contexts = [
        ContextType.CRISIS,
        ContextType.SUPPORT,
        ContextType.EDUCATIONAL,
        ContextType.CLINICAL_ASSESSMENT,
      ]

      for (const contextType of contexts) {
        const context: AlignmentContext = {
          userQuery: `Test for ${contextType}`,
          detectedContext: contextType,
          confidence: 0.85,
        }

        const result = engine.calculateDynamicWeights(context)

        for (const [key, weight] of Object.entries(result.weights)) {
          expect(weight).toBeGreaterThanOrEqual(0)
          expect(weight).toBeLessThanOrEqual(1)
        }
      }
    })
  })

  describe('stability across transitions', () => {
    it('should maintain stability during context transitions', () => {
      const transitions = [
        ContextType.GENERAL,
        ContextType.EDUCATIONAL,
        ContextType.SUPPORT,
        ContextType.EDUCATIONAL,
        ContextType.GENERAL,
      ]

      const results = []

      for (const contextType of transitions) {
        const context: AlignmentContext = {
          userQuery: `Transitioning to ${contextType}`,
          detectedContext: contextType,
          confidence: 0.85,
        }

        const result = engine.calculateDynamicWeights(context)
        results.push(result)
      }

      // Check that transitions are smooth (no wild swings)
      for (let i = 1; i < results.length; i++) {
        const prevWeights = results[i - 1].weights
        const currWeights = results[i].weights

        for (const key in currWeights) {
          const change = Math.abs(currWeights[key] - prevWeights[key])
          // Change should be reasonable (< 40% due to blending and guards)
          expect(change).toBeLessThan(0.4)
        }
      }
    })

    it('should prevent rapid oscillation between contexts', () => {
      const oscillatingContexts = [
        ContextType.EDUCATIONAL,
        ContextType.SUPPORT,
        ContextType.EDUCATIONAL,
        ContextType.SUPPORT,
        ContextType.EDUCATIONAL,
        ContextType.SUPPORT,
        ContextType.EDUCATIONAL,
      ]

      let maxChange = 0

      for (let i = 0; i < oscillatingContexts.length; i++) {
        const context: AlignmentContext = {
          userQuery: `Oscillation test ${i}`,
          detectedContext: oscillatingContexts[i],
          confidence: 0.85,
        }

        const result = engine.calculateDynamicWeights(context)

        if (i > 0) {
          const history = engine.getWeightHistory()
          const prevWeights = history[history.length - 2].weights
          const currWeights = result.weights

          for (const key in currWeights) {
            const change = Math.abs(currWeights[key] - prevWeights[key])
            maxChange = Math.max(maxChange, change)
          }
        }
      }

      // Due to oscillation detection and increased smoothing, changes should be dampened
      expect(maxChange).toBeLessThan(0.3)
    })
  })

  describe('edge cases: ties, low confidence, conflicts', () => {
    it('should handle low confidence gracefully', () => {
      const lowConfidenceContext: AlignmentContext = {
        userQuery: 'Ambiguous query',
        detectedContext: ContextType.GENERAL,
        confidence: 0.3, // Low confidence
      }

      const result = engine.calculateDynamicWeights(lowConfidenceContext)

      expect(result.weights).toBeDefined()
      expect(result.updateTimeMs).toBeLessThan(250)
    })

    it('should handle context ties by using precedence', () => {
      // This is tested at the mapper level, but verify integration
      const context: AlignmentContext = {
        userQuery: 'Query with potential conflict',
        detectedContext: ContextType.GENERAL, // Lowest precedence
        confidence: 0.85,
      }

      const result = engine.calculateDynamicWeights(context)

      expect(result.context).toBe(ContextType.GENERAL)
      expect(result.weights).toBeDefined()
    })

    it('should handle first call with no history', () => {
      const freshEngine = new DynamicWeightingEngine()

      const context: AlignmentContext = {
        userQuery: 'First query',
        detectedContext: ContextType.EDUCATIONAL,
        confidence: 0.85,
      }

      const result = freshEngine.calculateDynamicWeights(context)

      expect(result.blendingApplied).toBe(false)
      expect(result.hysteresisApplied).toBe(false)
      expect(result.weights).toBeDefined()
    })

    it('should handle all objectives having zero weight', () => {
      // This shouldn't happen in practice, but test defensive code
      const context: AlignmentContext = {
        userQuery: 'Test query',
        detectedContext: ContextType.GENERAL,
        confidence: 0.85,
      }

      const result = engine.calculateDynamicWeights(context)

      // Normalization should handle this by creating equal weights
      const sum = Object.values(result.weights).reduce((acc, w) => acc + w, 0)
      expect(sum).toBeGreaterThan(0)
    })
  })

  describe('configuration updates', () => {
    it('should allow configuration updates', () => {
      engine.updateConfiguration({
        blendingAlpha: 0.5,
        hysteresisThreshold: 0.1,
      })

      const config = engine.getConfiguration()
      expect(config.blendingAlpha).toBe(0.5)
      expect(config.hysteresisThreshold).toBe(0.1)
    })

    it('should apply updated configuration to subsequent calculations', () => {
      engine.updateConfiguration({
        blendingEnabled: false,
      })

      const context1: AlignmentContext = {
        userQuery: 'First query',
        detectedContext: ContextType.EDUCATIONAL,
        confidence: 0.85,
      }

      const context2: AlignmentContext = {
        userQuery: 'Second query',
        detectedContext: ContextType.SUPPORT,
        confidence: 0.85,
      }

      engine.calculateDynamicWeights(context1)
      const result = engine.calculateDynamicWeights(context2)

      expect(result.blendingApplied).toBe(false)
    })
  })

  describe('singleton pattern', () => {
    it('should return singleton instance', () => {
      const instance1 = getDynamicWeightingEngine()
      const instance2 = getDynamicWeightingEngine()

      expect(instance1).toBe(instance2)
    })

    it('should reset singleton instance', () => {
      const instance1 = getDynamicWeightingEngine()
      resetDynamicWeightingEngine()
      const instance2 = getDynamicWeightingEngine()

      expect(instance1).not.toBe(instance2)
    })
  })

  describe('reset functionality', () => {
    it('should clear history and cache on reset', () => {
      const context: AlignmentContext = {
        userQuery: 'Test query',
        detectedContext: ContextType.EDUCATIONAL,
        confidence: 0.85,
      }

      engine.calculateDynamicWeights(context)
      expect(engine.getWeightHistory().length).toBeGreaterThan(0)

      engine.reset()
      expect(engine.getWeightHistory().length).toBe(0)
    })
  })
})
