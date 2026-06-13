/**
 * PIX-510 Task 3: Emotional Tagging System — TypeScript mirror
 * Mirrors ai/memory/emotion_classifier.py exactly.
 *
 * Supports: VAD scoring, Plutchik wheel classification (multi-label),
 * crisis detection, session trajectory tracking.
 */

// ─── Plutchik wheel categories ────────────────────────────────────────────────

export const PLUTCHIK_PRIMARY = new Set([
  'joy',
  'sadness',
  'anger',
  'fear',
  'surprise',
  'disgust',
  'trust',
  'anticipation',
])

export const PLUTCHIK_SECONDARY = new Set([
  'optimism',
  'love',
  'submission',
  'awe',
  'disapproval',
  'remorse',
  'contempt',
  'aggression',
])

export const ALL_EMOTION_CATEGORIES = new Set([
  ...PLUTCHIK_PRIMARY,
  ...PLUTCHIK_SECONDARY,
])

// ─── Emotion-to-multiplier mapping ───────────────────────────────────────────

export const EMOTION_MULTIPLIER: Record<string, number> = {
  // Crisis indicators
  'suicide': 5.0,
  'self-harm': 5.0,
  'overdose': 5.0,
  'panic': 5.0,
  'psychosis': 5.0,
  // High-intensity
  'grief': 2.5,
  'trauma': 2.5,
  'despair': 2.5,
  'hopelessness': 2.5,
  'anxiety': 2.0,
  'fear': 2.0,
  'anger': 2.0,
  'terror': 2.0,
  // Standard
  'joy': 1.0,
  'sadness': 1.0,
  'surprise': 1.0,
  'disgust': 1.0,
  'trust': 1.0,
  'anticipation': 1.0,
  // Secondary
  'optimism': 1.0,
  'love': 1.0,
  'submission': 1.0,
  'awe': 1.0,
  'disapproval': 1.0,
  'remorse': 1.0,
  'contempt': 1.0,
  'aggression': 1.5,
}

export function emotionMultiplier(categories: string[]): number {
  if (!categories.length) return 1.0
  return Math.max(
    ...categories.map((c) => EMOTION_MULTIPLIER[c.toLowerCase()] ?? 1.0),
  )
}

// ─── VAD lexicon ─────────────────────────────────────────────────────────────

const HIGH_VALENCE = new Set([
  'happy',
  'joy',
  'grateful',
  'hopeful',
  'excited',
  'relieved',
  'peaceful',
  'love',
  'appreciate',
  'wonderful',
  'better',
  'improving',
  'progress',
])
const LOW_VALENCE = new Set([
  'sad',
  'depressed',
  'hopeless',
  'worthless',
  'anxious',
  'worried',
  'fear',
  'terrible',
  'awful',
  'horrible',
  'devastated',
  'anguish',
  'despair',
])
const HIGH_AROUSAL = new Set([
  'panic',
  'overwhelmed',
  'shocked',
  'frantic',
  'intense',
  'trembling',
  'racing',
  'pounding',
  'breathing',
  'screaming',
])
const LOW_AROUSAL = new Set([
  'calm',
  'peaceful',
  'relaxed',
  'numb',
  'detached',
  'empty',
  'flat',
  'indifferent',
  'still',
  'quiet',
  'resting',
])
const HIGH_DOMINANCE = new Set([
  'control',
  'confident',
  'capable',
  'strong',
  'determined',
  'empowered',
  'boundaries',
  'standing up',
])
const LOW_DOMINANCE = new Set([
  'helpless',
  'powerless',
  'trapped',
  'stuck',
  'unable',
  'surrendering',
  'out of control',
  'giving up',
])

function tokenise(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/\b\w+\b/g) ?? [])
}

function scoreDimension(
  tokens: Set<string>,
  pos: Set<string>,
  neg: Set<string>,
): number {
  let posCount = 0,
    negCount = 0
  for (const w of tokens) {
    if (pos.has(w)) posCount++
    if (neg.has(w)) negCount++
  }
  const total = posCount + negCount
  if (total === 0) return 0.5
  return (posCount - negCount) / (2 * total) + 0.5
}

export function vadScore(text: string): {
  valence: number
  arousal: number
  dominance: number
} {
  const tokens = tokenise(text)
  const valence = scoreDimension(tokens, HIGH_VALENCE, LOW_VALENCE)
  const arousal = scoreDimension(tokens, HIGH_AROUSAL, LOW_AROUSAL)
  const dominance = scoreDimension(tokens, HIGH_DOMINANCE, LOW_DOMINANCE)
  return { valence, arousal, dominance }
}

// ─── Emotion classifier ───────────────────────────────────────────────────────

export interface EmotionClassificationResult {
  categories: string[]
  categoryScores: Record<string, number>
  valence: number
  arousal: number
  dominance: number
  topCategory: string | null
  topScore: number
  multiplier: number
}

export type TrajectoryTrend =
  | 'escalating'
  | 'de-escalating'
  | 'stable'
  | 'volatile'

export interface EmotionTrajectory {
  startValence: number
  endValence: number
  startArousal: number
  endArousal: number
  startDominance: number
  endDominance: number
  trend: TrajectoryTrend
  maxIntensity: number
  crisisIndicators: string[]
  trajectoryScores: Array<{
    valence: number
    arousal: number
    dominance: number
  }>
}

// Keyword → Plutchik mapping (multi-word phrases use substring match)
const KEYWORD_MAP: Record<string, string[]> = {
  'joy': ['happy', 'joy', 'glad', 'excited', 'wonderful', 'grateful', 'love'],
  'sadness': [
    'sad',
    'unhappy',
    'depressed',
    'grief',
    'sorrow',
    'crying',
    'tears',
  ],
  'anger': ['angry', 'rage', 'furious', 'frustrated', 'irritated', 'mad'],
  'fear': [
    'afraid',
    'scared',
    'fearful',
    'frightened',
    'terrified',
    'panic',
    'anxious',
    'worried',
    'nervous',
  ],
  'surprise': ['surprised', 'amazed', 'shocked', 'unexpected', 'wow'],
  'disgust': ['disgusted', 'revolted', 'gross', 'sickened', 'repulsed'],
  'trust': ['trust', 'believe', 'confidence', 'rely', 'comfort'],
  'anticipation': [
    'anticipate',
    'expect',
    'looking forward',
    'hopeful',
    'hope',
  ],
  'grief': ['grief', 'mourning', 'loss', 'bereavement', 'lost'],
  'trauma': ['trauma', 'traumatic', 'abuse', 'violence', 'assault'],
  'despair': ['despair', 'hopeless', 'worthless', 'helpless', 'giving up'],
  'suicide': [
    'suicide',
    'kill myself',
    'end it all',
    'no reason to live',
    'end my life',
  ],
  'self-harm': [
    'cut myself',
    'self-harm',
    'hurt myself',
    'self injury',
    'selfharm',
  ],
}

const MAX_KEYWORDS = 7
const CRISIS_CATEGORIES = new Set([
  'suicide',
  'self-harm',
  'panic',
  'psychosis',
])

function classifyLexicon(
  text: string,
  _multiLabel: boolean,
): EmotionClassificationResult {
  const textLower = text.toLowerCase()
  const categoryScores: Record<string, number> = {}

  for (const [emotion, keywords] of Object.entries(KEYWORD_MAP)) {
    let count = 0
    for (const kw of keywords) {
      if (textLower.includes(kw.toLowerCase())) count++
    }
    if (count > 0) {
      categoryScores[emotion] = Math.min(count / MAX_KEYWORDS, 1.0)
    }
  }

  const { valence, arousal, dominance } = vadScore(text)

  const entries = Object.entries(categoryScores)
  if (!entries.length) {
    return {
      categories: [],
      categoryScores: {},
      valence,
      arousal,
      dominance,
      topCategory: null,
      topScore: 0,
      multiplier: 1.0,
    }
  }

  const [topCategory, topScore] = entries.reduce((a, b) =>
    a[1] >= b[1] ? a : b,
  )

  return {
    categories: Object.keys(categoryScores),
    categoryScores,
    valence,
    arousal,
    dominance,
    topCategory,
    topScore,
    multiplier: emotionMultiplier(Object.keys(categoryScores)),
  }
}

function computeTrend(
  valences: number[],
  dominances: number[],
): TrajectoryTrend {
  if (valences.length < 2) return 'stable'

  const mean = valences.reduce((s, v) => s + v, 0) / valences.length
  const variance =
    valences.reduce((s, v) => s + (v - mean) ** 2, 0) / valences.length
  if (variance > 0.04) return 'volatile'

  const valenceTrend = valences[0] - valences[valences.length - 1]
  const dominanceTrend = dominances[0] - dominances[dominances.length - 1]

  if (valenceTrend < -0.1 && dominanceTrend < -0.1) return 'escalating'
  if (valenceTrend > 0.1 && dominanceTrend > 0.1) return 'de-escalating'
  return 'stable'
}

// ─── Public API ────────────────────────────────────────────────────────────────

export class EmotionClassifier {
  classify(text: string, _multiLabel = true): EmotionClassificationResult {
    if (!text.trim()) {
      return {
        categories: [],
        categoryScores: {},
        valence: 0.5,
        arousal: 0.5,
        dominance: 0.5,
        topCategory: null,
        topScore: 0,
        multiplier: 1.0,
      }
    }
    return classifyLexicon(text, _multiLabel)
  }

  classifyBatch(
    texts: string[],
    _multiLabel = true,
  ): EmotionClassificationResult[] {
    return texts.map((t) => this.classify(t, _multiLabel))
  }

  sessionTrajectory(results: EmotionClassificationResult[]): EmotionTrajectory {
    if (!results.length) {
      return {
        startValence: 0.5,
        endValence: 0.5,
        startArousal: 0.5,
        endArousal: 0.5,
        startDominance: 0.5,
        endDominance: 0.5,
        trend: 'stable',
        maxIntensity: 0,
        crisisIndicators: [],
        trajectoryScores: [],
      }
    }

    const first = results[0]
    const last = results[results.length - 1]
    const valences = results.map((r) => r.valence)
    const dominances = results.map((r) => r.dominance)

    const crisisIndicators = results
      .map((r) => r.topCategory)
      .filter((c): c is string => c !== null && CRISIS_CATEGORIES.has(c))

    let maxIntensity = 0
    for (const r of results) {
      if (
        r.topCategory !== null &&
        (r.categoryScores[r.topCategory] ?? 0) > maxIntensity
      ) {
        maxIntensity = r.categoryScores[r.topCategory] ?? 0
      }
    }

    return {
      startValence: first.valence,
      endValence: last.valence,
      startArousal: first.arousal,
      endArousal: last.arousal,
      startDominance: first.dominance,
      endDominance: last.dominance,
      trend: computeTrend(valences, dominances),
      maxIntensity,
      crisisIndicators,
      trajectoryScores: results.map((r) => ({
        valence: r.valence,
        arousal: r.arousal,
        dominance: r.dominance,
      })),
    }
  }

  /** Average ms per classification over n iterations. */
  benchmarkLatency(text: string, n = 100): number {
    const start = performance.now()
    for (let i = 0; i < n; i++) this.classify(text)
    return performance.now() - start
  }
}
