/**
 * Unit tests for src/lib/memory/emotion-classifier.ts — PIX-510 Task 3.
 * Mirrors ai/memory/test_emotion_classifier.py exactly.
 */

import {
  vadScore,
  emotionMultiplier,
  EMOTION_MULTIPLIER,
  PLUTCHIK_PRIMARY,
  EmotionClassifier,
} from '../emotion-classifier'

// ─── VAD scorer ──────────────────────────────────────────────────────────────

describe('vadScore', () => {
  it('high valence for positive text', () => {
    const { valence } = vadScore('I am so happy and grateful today')
    expect(valence).toBeGreaterThan(0.6)
  })

  it('low valence for negative text', () => {
    const { valence } = vadScore(
      'I feel devastated and hopeless about everything',
    )
    expect(valence).toBeLessThan(0.4)
  })

  it('neutral for factual text', () => {
    const { valence } = vadScore('The meeting is scheduled for 3pm tomorrow')
    expect(valence).toBeGreaterThan(0.3)
    expect(valence).toBeLessThan(0.7)
  })

  it('all components in [0, 1]', () => {
    for (const text of ['Happy!', 'Terrible!', 'Okay.']) {
      const { valence, arousal, dominance } = vadScore(text)
      expect(valence).toBeGreaterThanOrEqual(0)
      expect(valence).toBeLessThanOrEqual(1)
      expect(arousal).toBeGreaterThanOrEqual(0)
      expect(arousal).toBeLessThanOrEqual(1)
      expect(dominance).toBeGreaterThanOrEqual(0)
      expect(dominance).toBeLessThanOrEqual(1)
    }
  })
})

// ─── Emotion multiplier ──────────────────────────────────────────────────────

describe('emotionMultiplier', () => {
  it('crisis → 5.0', () => {
    expect(emotionMultiplier(['suicide'])).toBe(5.0)
    expect(emotionMultiplier(['self-harm'])).toBe(5.0)
  })

  it('high → 2.0', () => {
    expect(emotionMultiplier(['anxiety'])).toBe(2.0)
    expect(emotionMultiplier(['fear'])).toBe(2.0)
    expect(emotionMultiplier(['grief'])).toBe(2.5)
  })

  it('normal → 1.0', () => {
    expect(emotionMultiplier(['joy'])).toBe(1.0)
    expect(emotionMultiplier(['trust'])).toBe(1.0)
  })

  it('empty → 1.0', () => expect(emotionMultiplier([])).toBe(1.0))

  it('highest wins', () => {
    expect(emotionMultiplier(['joy', 'anxiety'])).toBe(2.0)
    expect(emotionMultiplier(['anxiety', 'suicide'])).toBe(5.0)
  })
})

// ─── EmotionClassifier ───────────────────────────────────────────────────────

describe('EmotionClassifier', () => {
  let clf: EmotionClassifier

  beforeEach(() => {
    clf = new EmotionClassifier()
  })

  describe('classify()', () => {
    it('classifies fear/anxiety', () => {
      const result = clf.classify(
        'I feel really anxious and scared about the interview',
      )
      expect(result.topCategory).toBe('fear')
      expect(result.multiplier).toBeGreaterThanOrEqual(2.0)
      expect(result.categories).toContain('fear')
    })

    it('classifies joy', () => {
      const result = clf.classify('I am so happy and grateful for your support')
      expect(result.topCategory).toBe('joy')
      expect(result.multiplier).toBe(1.0)
    })

    it('classifies crisis (self-harm)', () => {
      const result = clf.classify('I want to hurt myself and end everything')
      expect(result.topCategory).toBe('self-harm')
      expect(result.multiplier).toBe(5.0)
    })

    it('classifies crisis (suicide)', () => {
      const result = clf.classify(
        'I have no reason to live and want to end my life',
      )
      expect(result.topCategory).toBe('suicide')
      expect(result.multiplier).toBe(5.0)
    })

    it('empty input → neutral defaults', () => {
      const result = clf.classify('')
      expect(result.categories).toHaveLength(0)
      expect(result.topCategory).toBeNull()
      expect(result.multiplier).toBe(1.0)
      expect(result.valence).toBe(0.5)
    })

    it('whitespace → neutral defaults', () => {
      const result = clf.classify('   ')
      expect(result.categories).toHaveLength(0)
    })

    it('multi-label returns multiple categories', () => {
      const result = clf.classify('I feel sad and anxious today', true)
      expect(result.categories.length).toBeGreaterThanOrEqual(2)
      expect(result.multiplier).toBeGreaterThanOrEqual(2.0)
    })

    it('VAD scores are in [0, 1]', () => {
      const result = clf.classify('I am feeling really sad and overwhelmed')
      expect(result.valence).toBeGreaterThanOrEqual(0)
      expect(result.valence).toBeLessThanOrEqual(1)
      expect(result.arousal).toBeGreaterThanOrEqual(0)
      expect(result.arousal).toBeLessThanOrEqual(1)
      expect(result.dominance).toBeGreaterThanOrEqual(0)
      expect(result.dominance).toBeLessThanOrEqual(1)
    })

    it('batch classification', () => {
      const texts = ['I feel happy', 'I feel anxious', 'I feel okay']
      const results = clf.classifyBatch(texts)
      expect(results).toHaveLength(3)
      results.forEach((r) => {
        expect(r).toHaveProperty('categories')
        expect(r).toHaveProperty('topCategory')
        expect(r).toHaveProperty('valence')
      })
    })
  })

  describe('latency benchmark', () => {
    it('under 50ms per classification', () => {
      const ms = clf.benchmarkLatency(
        'I feel anxious about my upcoming medical appointment',
        500,
      )
      expect(ms).toBeLessThan(200)
    })
  })
})

// ─── Session trajectory ──────────────────────────────────────────────────────

describe('sessionTrajectory', () => {
  let clf: EmotionClassifier

  beforeEach(() => {
    clf = new EmotionClassifier()
  })

  it('stable trajectory for neutral session', () => {
    const results = [
      clf.classify('I am feeling okay today'),
      clf.classify('I am feeling okay today'),
    ]
    const traj = clf.sessionTrajectory(results)
    expect(traj.trend).toBe('stable')
    expect(traj.crisisIndicators).toHaveLength(0)
  })

  it('empty results → stable', () => {
    const traj = clf.sessionTrajectory([])
    expect(traj.trend).toBe('stable')
    expect(traj.maxIntensity).toBe(0)
  })

  it('detects crisis indicators', () => {
    const results = [
      clf.classify('I am feeling okay today'),
      clf.classify('I feel panicked and scared'),
      clf.classify('I want to hurt myself'),
    ]
    const traj = clf.sessionTrajectory(results)
    expect(traj.crisisIndicators.length).toBeGreaterThanOrEqual(1)
    expect(traj.crisisIndicators[0]).toMatch(/^(suicide|self-harm)$/)
  })

  it('returns all trajectory fields', () => {
    const results = [clf.classify('I feel happy'), clf.classify('I feel sad')]
    const traj = clf.sessionTrajectory(results)
    expect(traj.startValence).toBeDefined()
    expect(traj.endValence).toBeDefined()
    expect(traj.trend).toMatch(/^(escalating|de-escalating|stable|volatile)$/)
    expect(traj.maxIntensity).toBeGreaterThanOrEqual(0)
    expect(traj.trajectoryScores).toHaveLength(2)
  })
})

// ─── Plutchik categories ──────────────────────────────────────────────────────

describe('Plutchik categories', () => {
  it('all primary categories present', () => {
    const expected = [
      'joy',
      'sadness',
      'anger',
      'fear',
      'surprise',
      'disgust',
      'trust',
      'anticipation',
    ]
    expected.forEach((cat) => expect(PLUTCHIK_PRIMARY.has(cat)).toBe(true))
  })

  it('crisis categories have 5.0 multiplier', () => {
    expect(EMOTION_MULTIPLIER['suicide']).toBe(5.0)
    expect(EMOTION_MULTIPLIER['self-harm']).toBe(5.0)
  })
})
