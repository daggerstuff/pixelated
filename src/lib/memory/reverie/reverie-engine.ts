/**
 * ReverieEngine — orchestrates the Reverie system.
 *
 * Coordinates FishhookDetector, LatentSurfacer, and SoftInjector to
 * surface latent memories as subconscious behavioral modifiers.
 *
 * Flow:
 *   1. Check if fishhook detection should run (every N messages)
 *   2. Run FishhookDetector on current message vs latent pool
 *   3. Pass matches to LatentSurfacer → ReverieVector[]
 *   4. Pass new reveries to SoftInjector → behavioral modifier prompt
 *   5. Return ReverieResult with all pieces
 *
 * Also provides:
 *   - seedReverieCandidates: mark memories as latent + reverieEligible
 *   - getLatentPool: filter memories by consolidation phase
 *   - getActiveReveries: read-only access to current active reveries
 *
 * TS/Python parity: ai/memory/reverie/reverie_engine.py
 */

import type { MemoryBlock } from '../../../types/memory'
import type {
  ReverieConfig,
  ReverieResult,
  ReverieSeed,
  ReverieSeedResult,
  FishhookMatch,
  ReverieVector,
} from '../../../types/reverie'
import { DEFAULT_REVERIE_CONFIG } from '../../../types/reverie'
import { FishhookDetector } from './fishhook-detector'
import { LatentSurfacer } from './latent-surfacer'
import { SoftInjector } from './soft-injector'

export class ReverieEngine {
  private config: ReverieConfig
  private detector: FishhookDetector
  private surfacer: LatentSurfacer
  private injector: SoftInjector
  private messageCount = 0
  private latentPool: MemoryBlock[] = []

  constructor(config: ReverieConfig = DEFAULT_REVERIE_CONFIG) {
    this.config = config
    this.detector = new FishhookDetector(config)
    this.surfacer = new LatentSurfacer(config)
    this.injector = new SoftInjector(config)
  }

  /**
   * Process a new message through the reverie pipeline.
   *
   * @param currentMessage - The user's current message text
   * @param currentEmotions - Emotions detected in the current message
   * @param allMemories - All memories (used to extract latent pool if not set)
   * @returns ReverieResult with fishhooks, new reveries, active reveries, prompt
   */
  process(
    currentMessage: string,
    currentEmotions: { valence: number; arousal: number; categories: string[] },
    allMemories?: MemoryBlock[],
  ): ReverieResult {
    const startTime = Date.now()
    this.messageCount++

    // Refresh latent pool if memories provided
    if (allMemories) {
      this.latentPool = this.extractLatentPool(allMemories)
    }

    // Check if detection should run this cycle
    if (!this.detector.shouldRun(this.messageCount)) {
      const injectionResult = this.injector.apply([], this.messageCount)
      return {
        fishhooks: [],
        newReveries: [],
        activeReveries: injectionResult.activeReveries,
        reveriePrompt: injectionResult.prompt,
        changed: !injectionResult.empty,
        elapsedMs: Date.now() - startTime,
      }
    }

    // Build IDF index from latent pool
    this.detector.buildIndex(this.latentPool)

    // Phase 1: Detect fishhooks
    const fishhooks: FishhookMatch[] = this.detector.detect(
      currentMessage,
      currentEmotions,
      this.latentPool,
    )

    if (fishhooks.length === 0) {
      // No matches — still decay existing reveries
      const injectionResult = this.injector.apply([], this.messageCount)
      return {
        fishhooks: [],
        newReveries: [],
        activeReveries: injectionResult.activeReveries,
        reveriePrompt: injectionResult.prompt,
        changed: !injectionResult.empty,
        elapsedMs: Date.now() - startTime,
      }
    }

    // Phase 2: Surface reverie vectors from matches
    const newReveries: ReverieVector[] = this.surfacer.surface(
      fishhooks,
      this.latentPool,
      this.messageCount,
    )

    // Phase 3: Inject into soft injector (merge + decay + resolve + prompt)
    const injectionResult = this.injector.apply(newReveries, this.messageCount)

    return {
      fishhooks,
      newReveries,
      activeReveries: injectionResult.activeReveries,
      reveriePrompt: injectionResult.prompt,
      changed: true,
      elapsedMs: Date.now() - startTime,
    }
  }

  /**
   * Seed reverie candidates from a list of memories.
   *
   * Marks memories as latent + reverieEligible if they meet criteria:
   * - consolidation phase is 'archived' or 'forgotten'
   * - emotional weight >= reverieEligibleMinEmotionalWeight
   * - NOT a crisis memory (crisis memories stay preserved)
   * - importance.raw >= latentPoolMinImportance
   *
   * Returns the seeded memories and count of already-latent.
   */
  seedReverieCandidates(memories: MemoryBlock[]): ReverieSeedResult {
    const startTime = Date.now()
    const seeds: ReverieSeed[] = []
    const alreadyLatent: string[] = []

    for (const mem of memories) {
      // Skip crisis memories — they stay preserved, never latent
      if (mem.gating.crisisFlag) continue

      // Skip if already latent
      if (mem.consolidation.phase === 'latent') {
        alreadyLatent.push(mem.id)
        continue
      }

      // Only seed from archived, forgotten, raw, or consolidated phase
      if (
        mem.consolidation.phase !== 'archived' &&
        mem.consolidation.phase !== 'forgotten' &&
        mem.consolidation.phase !== 'raw' &&
        mem.consolidation.phase !== 'consolidated'
      ) {
        continue
      }

      // Raw/consolidated memories haven't been through full consolidation
      // cycles that amplify emotional weight, so apply a reduced threshold
      // (75% of full) to allow moderately emotional fresh memories to seed.
      const isProcessed =
        mem.consolidation.phase === 'archived' ||
        mem.consolidation.phase === 'forgotten'
      const minWeight = isProcessed
        ? this.config.reverieEligibleMinEmotionalWeight
        : this.config.reverieEligibleMinEmotionalWeight * 0.75
      if (mem.importance.emotionalWeight < minWeight) {
        continue
      }

      // Check minimum importance
      if (mem.importance.raw < this.config.latentPoolMinImportance) {
        continue
      }

      // Calculate reverie potential
      const potential = this.calculateReveriePotential(mem)

      seeds.push({
        memoryId: mem.id,
        reason: this.deriveSeedReason(mem),
        potential,
      })
    }

    // Sort seeds by potential descending
    seeds.sort((a, b) => b.potential - a.potential)

    return {
      seeds,
      alreadyLatent,
      latentPoolSize: this.latentPool.length + seeds.length,
      elapsedMs: Date.now() - startTime,
    }
  }

  /**
   * Apply seeding to memories — returns updated MemoryBlocks with
   * consolidation.phase = 'latent', consolidation.reverieEligible = true,
   * and importance.reveriePotential set.
   */
  applySeeds(memories: MemoryBlock[], seeds: ReverieSeed[]): MemoryBlock[] {
    const seedMap = new Map(seeds.map((s) => [s.memoryId, s]))
    const updated: MemoryBlock[] = []

    for (const mem of memories) {
      const seed = seedMap.get(mem.id)
      if (seed) {
        updated.push({
          ...mem,
          consolidation: {
            ...mem.consolidation,
            phase: 'latent',
            reverieEligible: true,
            reveriePhase: 'seeded',
          },
          importance: {
            ...mem.importance,
            reveriePotential: seed.potential,
          },
        })
      } else {
        updated.push(mem)
      }
    }

    // Update internal latent pool
    this.latentPool = this.extractLatentPool(updated)

    return updated
  }

  /**
   * Get the current latent pool (memories with phase='latent' and reverieEligible=true).
   */
  getLatentPool(): MemoryBlock[] {
    return [...this.latentPool]
  }

  /**
   * Set the latent pool directly (e.g., from external memory store).
   */
  setLatentPool(memories: MemoryBlock[]): void {
    this.latentPool = this.extractLatentPool(memories)
  }

  /**
   * Get currently active reverie vectors.
   */
  getActiveReveries(): ReverieVector[] {
    return [...this.injector.getActive()]
  }

  /**
   * Get the current reverie prompt (behavioral modifier).
   */
  getReveriePrompt(): string {
    return this.injector.getCurrentPrompt()
  }

  /**
   * Clear all active reveries (e.g., on session end).
   */
  clear(): void {
    this.injector.clear()
    this.messageCount = 0
    this.latentPool = []
  }

  /**
   * Get message count for external monitoring.
   */
  getMessageCount(): number {
    return this.messageCount
  }

  // ─── Private helpers ─────────────────────────────────────────────────

  /**
   * Extract latent pool from a list of memories.
   * Latent = phase is 'latent' AND reverieEligible is true.
   */
  private extractLatentPool(memories: MemoryBlock[]): MemoryBlock[] {
    return memories.filter(
      (m) =>
        m.consolidation.phase === 'latent' && m.consolidation.reverieEligible,
    )
  }

  /**
   * Calculate reverie potential for a memory.
   *
   * Potential = weighted combination of:
   * - emotional weight (0.4) — more emotional = more reverie potential
   * - emotional categories diversity (0.2) — richer emotional content
   * - schema references (0.2) — consolidated patterns
   * - recency (0.2) — more recent latent memories have higher potential
   */
  private calculateReveriePotential(mem: MemoryBlock): number {
    const emotionalComponent = Math.min(
      mem.importance.emotionalWeight / 5.0,
      1.0,
    )
    const categoryDiversity = Math.min(
      mem.emotions.categories.length / 5.0,
      1.0,
    )
    const schemaRichness = Math.min(
      mem.consolidation.schemaReferences.length / 5.0,
      1.0,
    )
    const recencyComponent = mem.importance.recency

    return Math.min(
      0.4 * emotionalComponent +
        0.2 * categoryDiversity +
        0.2 * schemaRichness +
        0.2 * recencyComponent,
      1.0,
    )
  }

  /**
   * Derive a human-readable reason for why a memory was seeded.
   */
  private deriveSeedReason(mem: MemoryBlock): string {
    const reasons: string[] = []

    if (mem.importance.emotionalWeight >= 4.0) {
      reasons.push('high emotional weight')
    }
    if (mem.emotions.categories.length >= 3) {
      reasons.push('rich emotional categories')
    }
    if (mem.consolidation.schemaReferences.length >= 2) {
      reasons.push('cross-linked in consolidation')
    }
    if (mem.importance.recency > 0.5) {
      reasons.push('recently active')
    }

    if (reasons.length === 0) {
      return 'eligible for reverie surfacing'
    }

    return reasons.join('; ')
  }
}
