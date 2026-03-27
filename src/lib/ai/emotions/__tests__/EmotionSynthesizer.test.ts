import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EmotionSynthesizer, type EnhancedSynthesisOptions, } from '../EmotionSynthesizer'

describe('EmotionSynthesizer', () => {
  let synthesizer: EmotionSynthesizer

  beforeEach(() => {
    synthesizer = EmotionSynthesizer.createTestInstance()
    vi.clearAllMocks()
  })

  describe('synthesizeEmotion (Enhanced)', () => {
    // ... existing tests ...

    describe('blendEmotions', () => {
      // Helper to build minimal profiles for blendEmotions tests
      const makeProfile = (overrides: Partial<any> = {}) => {
        return {
          id: overrides.id ?? 'profile-' + Math.random().toString(36).slice(2),
          createdAt: overrides.createdAt ?? new Date(Date.now() - Math.floor(Math.random() * 10_000)),
          emotions: overrides.emotions ?? {},
          confidence: overrides.confidence,
          isCurrent: overrides.isCurrent ?? false,
        }
      }

      it('should default confidence to 0.8 when source profiles have no confidence', () => {
        const profileA = makeProfile({ emotions: { joy: 0.6 }, confidence: undefined, })
        const profileB = makeProfile({ emotions: { sadness: 0.4 }, confidence: undefined, })
        const blended = (synthesizer as any).blendEmotions([profileA, profileB])
        expect(blended.confidence).toBeCloseTo(0.8, 5)
      })

      it('should generate a new profile id and timestamp when blending', () => {
        const createdAtA = new Date('2020-01-01T00:00:00.000Z')
        const createdAtB = new Date('2020-01-02T00:00:00.000Z')
        const profileA = makeProfile({ id: 'profile-a', createdAt: createdAtA, emotions: { joy: 0.7 }, })
        const profileB = makeProfile({ id: 'profile-b', createdAt: createdAtB, emotions: { joy: 0.3 }, })
        const blended = (synthesizer as any).blendEmotions([profileA, profileB])
        expect(blended.id).not.toBe(profileA.id)
        expect(blended.id).not.toBe(profileB.id)
        expect(blended.createdAt instanceof Date).toBe(true)
        expect(blended.createdAt.getTime()).toBeGreaterThanOrEqual(Math.max(createdAtA.getTime(), createdAtB.getTime()), )
      })

      it('should mark the blended profile as the current/active profile', () => {
        const profileA = makeProfile({ emotions: { joy: 0.8 } })
        const profileB = makeProfile({ emotions: { neutral: 0.2 } })
        const blended = (synthesizer as any).blendEmotions([profileA, profileB])
        // Blended profile itself should be current
        expect(blended.isCurrent).toBe(true)
        // Synthesizer should also expose the blended profile as the active/current one
        const currentFromSynthesizer = (synthesizer as any).getCurrentProfile?.() ?? (synthesizer as any).currentProfile
        if (currentFromSynthesizer) {
          expect(currentFromSynthesizer.id).toBe(blended.id)
        }
      })

      it('should handle an empty emotions map by producing an empty emotions map', () => {
        const profileA = makeProfile({ emotions: {} })
        const profileB = makeProfile({ emotions: {} })
        const blended = (synthesizer as any).blendEmotions([profileA, profileB])
        expect(blended.emotions).toEqual({})
      })

      it('should merge emotion intensity maps when profiles have conflicting dominant emotions', () => {
        const profileA = makeProfile({ emotions: { joy: 0.9, neutral: 0.1 }, })
        const profileB = makeProfile({ emotions: { sadness: 0.9, neutral: 0.1 }, })
        const blended = (synthesizer as any).blendEmotions([profileA, profileB])
        // The blended profile should contain all emotion keys from all inputs
        expect(Object.keys(blended.emotions)).toEqual(expect.arrayContaining(['joy', 'sadness', 'neutral']), )
        // Conflicting dominant emotions should both be represented with non-zero intensity
        expect(blended.emotions['joy']).toBeGreaterThan(0)
        expect(blended.emotions['sadness']).toBeGreaterThan(0)
      })
    })

    describe('getCurrentProfile', () => {
      // ... existing tests ...
    })

    describe('reset', () => {
      // ... existing tests ...
    })

    it('should default to expected behavior when only randomFluctuation is overridden', () => {
      // ... existing test code ...
    })
  })
})