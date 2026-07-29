/**
 * Fishhook Detector
 *
 * Detects "fishhooks" — subtle cues in the current context that resonate with
 * latent memories. Inspired by Westworld's reveries: tiny gestures that pull
 * from the deep sea of consciousness.
 *
 * Four detection modalities:
 *   1. Lexical — TF-IDF cosine similarity (subtle word overlap, not exact match)
 *   2. Emotional — VAD resonance (valence/arousal alignment)
 *   3. Pattern — recurring emotion categories (thematic echoes)
 *   4. Surprise — Bayesian surprise (deviation from expected pattern)
 *
 * TS/Python parity: ai/memory/reverie/fishhook_detector.py mirrors this file.
 */

import type { MemoryBlock } from "@/types/memory";
import type { FishhookMatch, FishhookMatchType, ReverieConfig } from "@/types/reverie";
import { DEFAULT_REVERIE_CONFIG } from "@/types/reverie";

// ─── TF-IDF Helpers ──────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z]+/g) ?? [];
}

function buildIdf(documents: string[]): Map<string, number> {
  const n = documents.length;
  if (n === 0) return new Map();

  const df = new Map<string, number>();
  for (const doc of documents) {
    const tokens = new Set(tokenize(doc));
    for (const t of tokens) {
      df.set(t, (df.get(t) ?? 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [term, freq] of df) {
    idf.set(term, Math.log((n + 1) / (freq + 1)) + 1);
  }
  return idf;
}

function tfidfVector(text: string, idf: Map<string, number>): Map<string, number> {
  const tokens = tokenize(text);
  if (tokens.length === 0) return new Map();

  const tf = new Map<string, number>();
  let maxTf = 0;
  for (const t of tokens) {
    const c = (tf.get(t) ?? 0) + 1;
    tf.set(t, c);
    if (c > maxTf) maxTf = c;
  }

  const vec = new Map<string, number>();
  for (const [term, freq] of tf) {
    const idfVal = idf.get(term);
    if (idfVal === undefined) continue;
    vec.set(term, (freq / maxTf) * idfVal);
  }
  return vec;
}

function cosineSim(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const [k, v] of a) {
    normA += v * v;
    const bv = b.get(k);
    if (bv !== undefined) dot += v * bv;
  }
  for (const [, v] of b) {
    normB += v * v;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

// ─── Emotional Resonance ──────────────────────────────────────────────────

/**
 * Computes emotional resonance between two VAD profiles.
 * Returns [0,1] where 1 = identical emotional tone.
 */
function emotionalResonance(
  a: { valence: number; arousal: number },
  b: { valence: number; arousal: number },
): number {
  // Valence: same sign = high resonance; opposite sign = low
  const valenceSim = 1 - Math.abs(a.valence - b.valence) / 2; // [-1..1] → [0..1]
  // Arousal: closer = higher resonance
  const arousalSim = 1 - Math.abs(a.arousal - b.arousal);
  return 0.5 * valenceSim + 0.5 * arousalSim;
}

// ─── Pattern Detection ────────────────────────────────────────────────────

/**
 * Computes category overlap between two sets of emotion categories.
 * Returns [0,1] Jaccard similarity.
 */
function categoryOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a.map((c) => c.toLowerCase()));
  const setB = new Set(b.map((c) => c.toLowerCase()));
  let intersection = 0;
  for (const c of setA) {
    if (setB.has(c)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ─── Bayesian Surprise ────────────────────────────────────────────────────

/**
 * Computes Bayesian surprise: how much the current emotional state
 * deviates from what would be expected given the latent memory's pattern.
 *
 * High surprise = the current context is emotionally unexpected relative
 * to the latent memory, which can trigger a reverie (the "fishhook" pulls
 * harder when reality doesn't match the stored pattern).
 *
 * Returns [0,1] where 1 = maximally surprising.
 */
function bayesianSurprise(
  current: { valence: number; arousal: number },
  expected: { valence: number; arousal: number },
  expectedVariance: number,
): number {
  // Gaussian surprise: how far current is from expected, normalized by variance
  const valenceDiff = current.valence - expected.valence;
  const arousalDiff = current.arousal - expected.arousal;
  const distSq = valenceDiff * valenceDiff + arousalDiff * arousalDiff;
  const variance = Math.max(expectedVariance, 0.01); // floor to avoid div-by-zero

  // Surprise = 1 - exp(-distSq / (2 * variance))
  // This maps distance to [0,1): 0 distance = 0 surprise, large distance → 1
  return 1 - Math.exp(-distSq / (2 * variance));
}

// ─── FishhookDetector ─────────────────────────────────────────────────────

export class FishhookDetector {
  private config: ReverieConfig;
  private idf: Map<string, number> | null = null;
  private idfCorpus: string[] = [];

  constructor(config: ReverieConfig = DEFAULT_REVERIE_CONFIG) {
    this.config = config;
  }

  /**
   * Build or rebuild the IDF index from a corpus of memory contents.
   * Call this once per session (or when the latent pool changes significantly).
   */
  buildIndex(memories: MemoryBlock[]): void {
    this.idfCorpus = memories.map((m) => m.content);
    this.idf = buildIdf(this.idfCorpus);
  }

  /**
   * Detect fishhooks between a current message and the latent memory pool.
   *
   * @param currentMessage - The incoming message content
   * @param currentEmotions - The emotional state of the current context
   * @param latentPool - Memories in the 'latent' consolidation phase
   * @param expectedVariance - Variance for Bayesian surprise (default 0.5)
   * @returns Array of fishhook matches, sorted by resonance (descending)
   */
  detect(
    currentMessage: string,
    currentEmotions: { valence: number; arousal: number; categories: string[] },
    latentPool: MemoryBlock[],
    expectedVariance = 0.5,
  ): FishhookMatch[] {
    if (latentPool.length === 0) return [];
    if (this.idf === null) {
      this.buildIndex(latentPool);
    }

    const now = Date.now();
    const matches: FishhookMatch[] = [];

    // Compute current message TF-IDF vector
    const currentVec = tfidfVector(currentMessage, this.idf!);

    for (const latent of latentPool) {
      // Only check memories that are reverie-eligible
      if (!latent.consolidation.reverieEligible) continue;

      const features: string[] = [];
      const scores: { type: FishhookMatchType; score: number }[] = [];

      // 1. Lexical resonance (TF-IDF cosine)
      const latentVec = tfidfVector(latent.content, this.idf!);
      const lexicalScore = cosineSim(currentVec, latentVec);
      if (lexicalScore >= this.config.fishhookThreshold) {
        scores.push({ type: "lexical", score: lexicalScore });
        features.push(`lexical:${lexicalScore.toFixed(3)}`);
      }

      // 2. Emotional resonance (VAD alignment)
      const emoScore = emotionalResonance(currentEmotions, latent.emotions);
      if (emoScore >= this.config.fishhookThreshold) {
        scores.push({ type: "emotional", score: emoScore });
        features.push(`emotional:${emoScore.toFixed(3)}`);
      }

      // 3. Pattern resonance (emotion category overlap)
      const patternScore = categoryOverlap(currentEmotions.categories, latent.emotions.categories);
      if (patternScore >= this.config.fishhookThreshold) {
        scores.push({ type: "pattern", score: patternScore });
        features.push(`pattern:${patternScore.toFixed(3)}`);
      }

      // 4. Surprise resonance (Bayesian deviation)
      const surpriseScore = bayesianSurprise(currentEmotions, latent.emotions, expectedVariance);
      if (surpriseScore >= this.config.fishhookThreshold) {
        scores.push({ type: "surprise", score: surpriseScore });
        features.push(`surprise:${surpriseScore.toFixed(3)}`);
      }

      // Need at least one modality above threshold to form a fishhook
      if (scores.length === 0) continue;

      // Compute weighted composite resonance score
      const compositeScore = this.computeCompositeResonance(scores);

      matches.push({
        latentMemoryId: latent.id,
        triggerMemoryId: `current_${now}`,
        matchType: scores[0].type, // Primary match type (highest individual score)
        resonanceScore: compositeScore,
        matchedFeatures: features,
        timestamp: now,
      });
    }

    // Sort by resonance (descending)
    matches.sort((a, b) => b.resonanceScore - a.resonanceScore);

    return matches;
  }

  /**
   * Compute weighted composite resonance from individual modality scores.
   */
  private computeCompositeResonance(scores: { type: FishhookMatchType; score: number }[]): number {
    let weighted = 0;
    let totalWeight = 0;

    for (const { type, score } of scores) {
      let weight: number;
      switch (type) {
        case "lexical":
          weight = this.config.lexicalResonanceWeight;
          break;
        case "emotional":
          weight = this.config.emotionalResonanceWeight;
          break;
        case "pattern":
          weight = this.config.patternResonanceWeight;
          break;
        case "surprise":
          weight = this.config.surpriseResonanceWeight;
          break;
      }
      weighted += score * weight;
      totalWeight += weight;
    }

    return totalWeight === 0 ? 0 : Math.min(weighted / totalWeight, 1);
  }

  /**
   * Quick check: should fishhook detection run this message?
   * Based on the configured trigger interval.
   */
  shouldRun(messageCount: number): boolean {
    return messageCount > 0 && messageCount % this.config.triggerInterval === 0;
  }
}
