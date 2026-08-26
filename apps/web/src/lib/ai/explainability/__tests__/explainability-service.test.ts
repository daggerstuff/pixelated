import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  ExplainabilityService,
  getExplainabilityService,
  resetExplainabilityService,
} from '../ExplainabilityService'
import type { ExplainabilityContext } from '../types'

describe('ExplainabilityService', () => {
  let service: ExplainabilityService

  beforeEach(() => {
    resetExplainabilityService()
    service = getExplainabilityService()
  })

  afterEach(() => {
    resetExplainabilityService()
  })

  describe('normalizeConfidence', () => {
    it('returns value as-is when in 0-1 range', () => {
      expect(service.normalizeConfidence(0.5)).toBe(0.5)
      expect(service.normalizeConfidence(0.0)).toBe(0)
      expect(service.normalizeConfidence(1.0)).toBe(1)
    })

    it('clamps values above 1 to 1', () => {
      expect(service.normalizeConfidence(1.5)).toBe(1)
      expect(service.normalizeConfidence(100)).toBe(1)
    })

    it('clamps negative values to 0', () => {
      expect(service.normalizeConfidence(-0.5)).toBe(0)
      expect(service.normalizeConfidence(-100)).toBe(0)
    })

    it('returns 0 for NaN', () => {
      expect(service.normalizeConfidence(NaN)).toBe(0)
    })

    it('returns 0 for non-number', () => {
      expect(service.normalizeConfidence('high' as unknown as number)).toBe(0)
      expect(service.normalizeConfidence(undefined as unknown as number)).toBe(
        0,
      )
    })
  })

  describe('buildSources', () => {
    const baseContext: ExplainabilityContext = {
      provider: 'llama',
      modelVersion: 'llama-emotion-v1.0',
      inputLength: 500,
      processingTime: 120,
      fallbackUsed: false,
      neutralBaseline: false,
    }

    it('returns neutral-baseline source for empty input', () => {
      const ctx: ExplainabilityContext = {
        ...baseContext,
        neutralBaseline: true,
      }
      const sources = service.buildSources(ctx)
      expect(sources).toHaveLength(1)
      expect(sources[0].type).toBe('neutral-baseline')
      expect(sources[0].confidenceContribution).toBe(1.0)
    })

    it('returns LLM + FHE + dimensional sources for successful API call', () => {
      const sources = service.buildSources(baseContext)
      expect(sources).toHaveLength(3)
      expect(sources.some((s) => s.type === 'llm')).toBe(true)
      expect(sources.some((s) => s.type === 'fhe')).toBe(true)
      expect(sources.some((s) => s.type === 'dimensional-model')).toBe(true)
    })

    it('returns keyword-fallback + dimensional sources for fallback path', () => {
      const ctx: ExplainabilityContext = { ...baseContext, fallbackUsed: true }
      const sources = service.buildSources(ctx)
      expect(sources).toHaveLength(2)
      expect(sources.some((s) => s.type === 'keyword-fallback')).toBe(true)
      expect(sources.some((s) => s.type === 'dimensional-model')).toBe(true)
      expect(sources.some((s) => s.type === 'llm')).toBe(false)
      expect(sources.some((s) => s.type === 'fhe')).toBe(false)
    })

    it('includes metadata source when perEmotionConfidence provided', () => {
      const ctx: ExplainabilityContext = {
        ...baseContext,
        perEmotionConfidence: { joy: 0.8, sadness: 0.6 },
      }
      const sources = service.buildSources(ctx)
      expect(sources.some((s) => s.type === 'metadata')).toBe(true)
      const metaSource = sources.find((s) => s.type === 'metadata')
      expect(metaSource?.confidenceContribution).toBeCloseTo(0.7, 5)
    })

    it('does not include metadata source when perEmotionConfidence is undefined', () => {
      const sources = service.buildSources(baseContext)
      expect(sources.some((s) => s.type === 'metadata')).toBe(false)
    })

    it('all sources have timestamp', () => {
      const sources = service.buildSources(baseContext)
      sources.forEach((s) => {
        expect(s.timestamp).toBeTruthy()
        expect(new Date(s.timestamp).toISOString()).toBe(s.timestamp)
      })
    })

    it('all sources have type, reference, and confidenceContribution', () => {
      const sources = service.buildSources(baseContext)
      sources.forEach((s) => {
        expect(s.type).toBeTruthy()
        expect(s.reference).toBeTruthy()
        expect(s.confidenceContribution).toBeGreaterThanOrEqual(0)
        expect(s.confidenceContribution).toBeLessThanOrEqual(1)
      })
    })
  })

  describe('attributeTechnique', () => {
    it('returns undefined for empty emotions', () => {
      const result = service.attributeTechnique({})
      expect(result).toBeUndefined()
    })

    it('returns undefined for all-zero emotions', () => {
      const result = service.attributeTechnique({
        joy: 0,
        sadness: 0,
        anger: 0,
      })
      expect(result).toBeUndefined()
    })

    it('maps joy to VALIDATION technique', () => {
      const result = service.attributeTechnique({ joy: 0.8, sadness: 0.2 })
      expect(result).toBeDefined()
      expect(result!.technique).toBe('VALIDATION')
      expect(result!.confidence).toBeGreaterThan(0.7)
      expect(result!.reasoning.some((r) => r.includes('joy'))).toBe(true)
    })

    it('maps sadness to ACTIVE_LISTENING', () => {
      const result = service.attributeTechnique({ sadness: 0.9, joy: 0.1 })
      expect(result!.technique).toBe('ACTIVE_LISTENING')
    })

    it('maps anger to COGNITIVE_RESTRUCTURING', () => {
      const result = service.attributeTechnique({ anger: 0.7 })
      expect(result!.technique).toBe('COGNITIVE_RESTRUCTURING')
    })

    it('maps fear to GROUNDING_TECHNIQUES', () => {
      const result = service.attributeTechnique({ fear: 0.6 })
      expect(result!.technique).toBe('GROUNDING_TECHNIQUES')
    })

    it('includes alternatives for emotions with multiple techniques', () => {
      const result = service.attributeTechnique({ joy: 0.9 })
      expect(result!.alternatives).toBeDefined()
      expect(result!.alternatives!.length).toBeGreaterThan(0)
      expect(result!.alternatives![0].technique).toBe('STRENGTH_BASED')
    })

    it('includes reasoning with dominant emotion and intensity', () => {
      const result = service.attributeTechnique({ anger: 0.85, fear: 0.3 })
      expect(result!.reasoning[0]).toContain('anger')
      expect(result!.reasoning[0]).toContain('0.85')
      expect(result!.reasoning.some((r) => r.includes('fear'))).toBe(true)
    })

    it('caps confidence at 0.95', () => {
      const result = service.attributeTechnique({ joy: 1.0 })
      expect(result!.confidence).toBeLessThanOrEqual(0.95)
    })

    it('defaults to ACTIVE_LISTENING for unknown emotion', () => {
      const result = service.attributeTechnique({ unknown: 0.5 })
      expect(result!.technique).toBe('ACTIVE_LISTENING')
    })
  })

  describe('enrich', () => {
    const baseContext: ExplainabilityContext = {
      provider: 'llama',
      modelVersion: 'llama-emotion-v1.0',
      inputLength: 500,
      processingTime: 120,
      fallbackUsed: false,
      neutralBaseline: false,
    }

    it('adds confidence, sources, and techniqueAttribution to payload', () => {
      const payload = { confidence: 0.85, content: 'test' }
      const enriched = service.enrich(payload, baseContext, { joy: 0.7 })
      expect(enriched.confidence).toBe(0.85)
      expect(enriched.sources).toBeDefined()
      expect(enriched.sources.length).toBeGreaterThan(0)
      expect(enriched.techniqueAttribution).toBeDefined()
    })

    it('preserves original payload fields', () => {
      const payload = { confidence: 0.9, content: 'test', id: 'abc' }
      const enriched = service.enrich(payload, baseContext, { joy: 0.5 })
      expect(enriched.content).toBe('test')
      expect(enriched.id).toBe('abc')
    })

    it('normalizes confidence to 0-1 range', () => {
      const payload = { confidence: 1.5 }
      const enriched = service.enrich(payload, baseContext)
      expect(enriched.confidence).toBe(1)
    })

    it('does not add techniqueAttribution when emotions undefined', () => {
      const payload = { confidence: 0.8 }
      const enriched = service.enrich(payload, baseContext)
      expect(enriched.techniqueAttribution).toBeUndefined()
    })

    it('does not add techniqueAttribution for empty emotions', () => {
      const payload = { confidence: 0.8 }
      const enriched = service.enrich(payload, baseContext, {})
      expect(enriched.techniqueAttribution).toBeUndefined()
    })
  })

  describe('singleton', () => {
    it('returns same instance from getInstance', () => {
      const a = ExplainabilityService.getInstance()
      const b = ExplainabilityService.getInstance()
      expect(a).toBe(b)
    })

    it('reset creates new instance', () => {
      const a = ExplainabilityService.getInstance()
      resetExplainabilityService()
      const b = ExplainabilityService.getInstance()
      expect(a).not.toBe(b)
    })
  })
})
