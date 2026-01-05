import {
  EmotionSynthesizer,
  type EnhancedSynthesisOptions,
} from '../EmotionSynthesizer'

describe('EmotionSynthesizer', () => {
  let synthesizer: EmotionSynthesizer

  beforeEach(() => {
    synthesizer = EmotionSynthesizer.createTestInstance()
    vi.clearAllMocks()
  })

  describe('synthesizeEmotion (Enhanced)', () => {
    it('should return a default neutral profile if no options are provided', async () => {
      const result = await synthesizer.synthesizeEmotion({})
      expect(result.success).toBe(true)
      expect(result.profile.emotions['neutral']).toBeCloseTo(1.0 * 0.85, 2) // Default decay from default neutral
    })

    it('should apply decayFactor to currentEmotions', async () => {
      const currentEmotions = { joy: 0.8, sadness: 0.4 }
      const decayFactor = 0.5
      const options: EnhancedSynthesisOptions = {
        currentEmotions,
        decayFactor,
        randomFluctuation: 0,
      } // No noise for this test

      const result = await synthesizer.synthesizeEmotion(options)
      expect(result.success).toBe(true)
      expect(result.profile.emotions['joy']).toBeCloseTo(0.8 * decayFactor, 3)
      expect(result.profile.emotions['sadness']).toBeCloseTo(
        0.4 * decayFactor,
        3,
      )
    })

    it('should apply baseEmotion and baseIntensity', async () => {
      const options: EnhancedSynthesisOptions = {
        currentEmotions: { joy: 0.2, sadness: 0.5 },
        baseEmotion: 'joy',
        baseIntensity: 0.9,
        decayFactor: 1, // No decay for simplicity
        randomFluctuation: 0,
      }
      const result = await synthesizer.synthesizeEmotion(options)
      expect(result.success).toBe(true)
      expect(result.profile.emotions['joy']).toBe(0.9) // Max of current (0.2) and baseIntensity (0.9)
      expect(result.profile.emotions['sadness']).toBe(0.5) // Unchanged by baseEmotion
    })

    it('should add baseEmotion if not in currentEmotions', async () => {
      const options: EnhancedSynthesisOptions = {
        currentEmotions: { sadness: 0.5 },
        baseEmotion: 'anger',
        baseIntensity: 0.6,
        decayFactor: 1,
        randomFluctuation: 0,
      }
      const result = await synthesizer.synthesizeEmotion(options)
      expect(result.success).toBe(true)
      expect(result.profile.emotions['anger']).toBe(0.6)
      expect(result.profile.emotions['sadness']).toBe(0.5)
    })

    it('should apply contextual influence for "therapist_validates"', async () => {
      const currentEmotions = { joy: 0.2, sadness: 0.5, anger: 0.3 }
      const contextInfluence = 0.5 // Stronger influence for testing
      const options: EnhancedSynthesisOptions = {
        currentEmotions,
        context: 'therapist_validates',
        contextInfluence,
        decayFactor: 1, // No decay
        randomFluctuation: 0, // No noise
      }
      const result = await synthesizer.synthesizeEmotion(options)
      const expectedJoy = Math.min(1, 0.2 + 0.1 * contextInfluence) // 0.2 + 0.05 = 0.25
      const expectedSadness = Math.max(0, 0.5 - 0.05 * contextInfluence) // 0.5 - 0.025 = 0.475
      const expectedAnger = Math.max(0, 0.3 - 0.05 * contextInfluence) // 0.3 - 0.025 = 0.275

      expect(result.profile.emotions['joy']).toBeCloseTo(expectedJoy, 3)
      expect(result.profile.emotions['sadness']).toBeCloseTo(expectedSadness, 3)
      expect(result.profile.emotions['anger']).toBeCloseTo(expectedAnger, 3)
    })

    it('should apply contextual influence for "patient_discusses_trauma"', async () => {
      const currentEmotions = { joy: 0.5, sadness: 0.1, fear: 0.1 }
      const contextInfluence = 0.5 // Stronger influence
      const options: EnhancedSynthesisOptions = {
        currentEmotions,
        context: 'patient_discusses_trauma',
        contextInfluence,
        decayFactor: 1,
        randomFluctuation: 0,
      }
      const result = await synthesizer.synthesizeEmotion(options)
      const expectedSadness = Math.min(1, 0.1 + 0.2 * contextInfluence) // 0.1 + 0.1 = 0.2
      const expectedFear = Math.min(1, 0.1 + 0.15 * contextInfluence) // 0.1 + 0.075 = 0.175
      const expectedJoy = Math.max(0, 0.5 - 0.1 * contextInfluence) // 0.5 - 0.05 = 0.45

      expect(result.profile.emotions['sadness']).toBeCloseTo(expectedSadness, 3)
      expect(result.profile.emotions['fear']).toBeCloseTo(expectedFear, 3)
      expect(result.profile.emotions['joy']).toBeCloseTo(expectedJoy, 3)
    })

    it('should clamp emotions between 0 and 1 after all modifications', async () => {
      const options: EnhancedSynthesisOptions = {
        currentEmotions: { joy: 0.9 },
        baseEmotion: 'joy',
        baseIntensity: 0.5, // Lower than current decayed joy
        context: 'therapist_validates', // joy += 0.1 * contextInfluence
        contextInfluence: 1, // joy += 0.1
        decayFactor: 1, // joy = 0.9
        randomFluctuation: 0.3, // Can make joy go > 1 or < 0 if not clamped
      }
      // Expected joy before final clamp: 0.9 (current) + 0.1 (context) = 1.0. Max with baseIntensity (0.5) is 1.0.
      // With fluctuation, it could go up to 1.0 + 0.3 = 1.3 or down to 1.0 - 0.3 = 0.7
      // The final value must be clamped.

      for (let i = 0; i < 10; i++) {
        // Run multiple times due to randomness
        const result = await synthesizer.synthesizeEmotion(options)
        expect(result.profile.emotions['joy']).toBeGreaterThanOrEqual(0)
        expect(result.profile.emotions['joy']).toBeLessThanOrEqual(1)
      }
    })

    it('should remove neutral if other significant emotions are present', async () => {
      const options: EnhancedSynthesisOptions = {
        currentEmotions: { neutral: 0.8, joy: 0.01 }, // joy is not significant yet
        baseEmotion: 'joy',
        baseIntensity: 0.5, // Makes joy significant
        decayFactor: 1,
        randomFluctuation: 0,
      }
      const result = await synthesizer.synthesizeEmotion(options)
      expect(result.profile.emotions['joy']).toBe(0.5)
      expect(result.profile.emotions['neutral']).toBeUndefined()
    })

    it('should keep neutral if it is the only significant emotion', async () => {
      const options: EnhancedSynthesisOptions = {
        currentEmotions: { neutral: 0.8, joy: 0.01, sadness: 0.02 },
        decayFactor: 1,
        randomFluctuation: 0,
      }
      // After decay (which is 1 here), neutral is 0.8, joy 0.01, sadness 0.02
      // No other emotion becomes significant
      const result = await synthesizer.synthesizeEmotion(options)
      expect(result.profile.emotions['neutral']).toBeCloseTo(0.8, 2)
      expect(result.profile.emotions['joy']).toBeCloseTo(0.01, 2)
    })

    it('should handle undefined currentEmotions by using default profile', async () => {
      const options: EnhancedSynthesisOptions = {
        baseEmotion: 'sadness',
        baseIntensity: 0.6,
        decayFactor: 0.9, // Default decayFactor is 0.85, let's test override
        randomFluctuation: 0,
      }
      // Default profile is { neutral: 1.0, ...zeros }
      // After decay (0.9): neutral = 0.9
      // Base emotion: sadness = 0.6
      // Neutral should be removed as sadness is significant
      const result = await synthesizer.synthesizeEmotion(options)
      expect(result.profile.emotions['sadness']).toBe(0.6)
      expect(result.profile.emotions['neutral']).toBeUndefined()
    })
  })

  describe('getCurrentProfile', () => {
    it('should return null if no emotion has been synthesized yet', () => {
      expect(synthesizer.getCurrentProfile()).toBeNull()
    })

    it('should return the last synthesized profile', async () => {
      const options: EnhancedSynthesisOptions = {
        baseEmotion: 'happy',
        baseIntensity: 0.8,
      }
      const result = await synthesizer.synthesizeEmotion(options)
      expect(synthesizer.getCurrentProfile()).toEqual(result.profile)
    })
  })

  describe('reset', () => {
    it('should reset currentProfile to null', async () => {
      await synthesizer.synthesizeEmotion({
        baseEmotion: 'tense',
        baseIntensity: 0.7,
      })
      expect(synthesizer.getCurrentProfile()).not.toBeNull()
      synthesizer.reset()
      expect(synthesizer.getCurrentProfile()).toBeNull()
    })
  })
})
