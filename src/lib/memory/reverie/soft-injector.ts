/**
 * SoftInjector — applies reverie vectors as system-level behavioral modifiers.
 *
 * Westworld principle: reveries surface as subtle gestures, not explicit memories.
 * The SoftInjector translates reverie vectors into behavioral modifier prompts
 * that are injected at the SYSTEM level (not context window), decay over time,
 * and resolve conflicts by resonance score. Max `maxActiveReveries` simultaneous.
 *
 * Key invariants:
 *  - Never injects raw memory content — only behavioral nudges + validation patterns
 *  - Never mentionable to the user — operates below conscious retrieval
 *  - Decays exponentially: influence halves every `decayHalfLifeMessages` messages
 *  - Max 3 simultaneous active reveries (configurable)
 */

import {
  ReverieVector,
  ReveriePhase,
  ReverieConfig,
} from '../../../types/reverie'

/** Result of applying reveries to produce a system-level behavioral modifier. */
export interface InjectionResult {
  /** The assembled behavioral modifier prompt (system-level, not context window). */
  prompt: string
  /** Active reveries contributing to the prompt. */
  activeReveries: ReverieVector[]
  /** Total influence weight after decay. */
  totalInfluence: number
  /** Whether the prompt is empty (no active reveries). */
  empty: boolean
}

/** Conflict resolution: highest resonance wins, others are suppressed. */
interface ConflictResolution {
  winner: ReverieVector
  suppressed: ReverieVector[]
}

const PHASE_TO_INFLUENCE: Record<ReveriePhase, number> = {
  dormant: 0.0,
  seeded: 0.3,
  surfacing: 0.6,
  active: 1.0,
  fading: 0.2,
}

export class SoftInjector {
  private config: ReverieConfig
  private activeReveries: ReverieVector[] = []
  private messageCounter: number = 0

  constructor(config: ReverieConfig) {
    this.config = config
  }

  /**
   * Apply new + existing reveries, producing a system-level behavioral modifier prompt.
   * Called by the ReverieEngine after the LatentSurfacer produces new reverie vectors.
   *
   * @param newReveries  Newly surfaced reverie vectors from LatentSurfacer
   * @param messageCount  Current message count in session
   * @returns InjectionResult with the behavioral modifier prompt
   */
  apply(newReveries: ReverieVector[], messageCount: number): InjectionResult {
    // Merge new reveries with existing active ones
    this.activeReveries = this.mergeReveries(newReveries)

    // Advance message counter for decay calculation
    this.messageCounter = messageCount

    // Apply decay to all active reveries
    const decayed = this.activeReveries.map((r) =>
      this.applyDecay(r, messageCount),
    )

    // Prune faded reveries
    this.activeReveries = decayed.filter(
      (r) =>
        r.phase !== 'dormant' &&
        this.currentInfluence(r, messageCount) > this.config.fadingThreshold,
    )

    // Enforce max active reveries via conflict resolution
    if (this.activeReveries.length > this.config.maxActiveReveries) {
      const resolution = this.resolveConflicts(this.activeReveries)
      this.activeReveries = [resolution.winner, ...resolution.suppressed]
        .slice(0, this.config.maxActiveReveries)
        .filter(
          (r) =>
            this.currentInfluence(r, messageCount) >
            this.config.fadingThreshold,
        )
    }

    // Assemble the behavioral modifier prompt
    const prompt = this.assemblePrompt(this.activeReveries, messageCount)
    const totalInfluence = this.activeReveries.reduce(
      (sum, r) => sum + this.currentInfluence(r, messageCount),
      0,
    )

    return {
      prompt,
      activeReveries: this.activeReveries.map((r) => ({ ...r })),
      totalInfluence,
      empty: this.activeReveries.length === 0,
    }
  }

  /**
   * Get current active reveries without applying changes (read-only).
   */
  getActive(): ReadonlyArray<ReverieVector> {
    return this.activeReveries.map((r) => ({ ...r }))
  }

  /**
   * Get the current behavioral modifier prompt without applying changes.
   * Returns empty string if no active reveries.
   */
  getCurrentPrompt(): string {
    if (this.activeReveries.length === 0) return ''
    return this.assemblePrompt(this.activeReveries, this.messageCounter)
  }

  /**
   * Clear all active reveries (e.g. on session reset).
   */
  clear(): void {
    this.activeReveries = []
    this.messageCounter = 0
  }

  // --- Internal ---

  /**
   * Merge new reveries with existing ones. If a reverie for the same source
   * memory already exists, retrigger it (blend resonance, increment count).
   */
  private mergeReveries(newReveries: ReverieVector[]): ReverieVector[] {
    const existing = [...this.activeReveries]
    const bySource = new Map<string, ReverieVector>()
    for (const r of existing) {
      bySource.set(r.sourceMemoryId, r)
    }

    for (const nr of newReveries) {
      const prev = bySource.get(nr.sourceMemoryId)
      if (prev) {
        // Retrigger: blend resonance, increment trigger count
        const blended: ReverieVector = {
          ...nr,
          resonanceScore: 0.4 * prev.resonanceScore + 0.6 * nr.resonanceScore,
          triggerCount: prev.triggerCount + 1,
          lastTriggeredAt: nr.lastTriggeredAt,
          phase: this.phaseFromResonance(
            0.4 * prev.resonanceScore + 0.6 * nr.resonanceScore,
          ),
        }
        bySource.set(nr.sourceMemoryId, blended)
      } else {
        bySource.set(nr.sourceMemoryId, nr)
      }
    }

    return Array.from(bySource.values())
  }

  /**
   * Apply exponential decay to a reverie vector based on messages since last trigger.
   * Decay: influence halves every `decayHalfLifeMessages` messages.
   */
  private applyDecay(
    reverie: ReverieVector,
    messageCount: number,
  ): ReverieVector {
    const messagesSinceTrigger = Math.max(
      0,
      messageCount - reverie.lastTriggeredAt,
    )
    if (messagesSinceTrigger === 0) return reverie

    const halfLife = reverie.decayHalfLife || this.config.decayHalfLifeMessages
    const decayFactor = Math.pow(2, -messagesSinceTrigger / halfLife)
    const decayedResonance = reverie.resonanceScore * decayFactor

    return {
      ...reverie,
      resonanceScore: decayedResonance,
      phase: this.phaseFromResonance(decayedResonance),
    }
  }

  /**
   * Compute current influence of a reverie: resonance × phase influence.
   * NOTE: Decay is already applied via applyDecay() which modifies resonanceScore.
   * Do NOT apply decay again here — that would double-decay.
   */
  private currentInfluence(
    reverie: ReverieVector,
    _messageCount: number,
  ): number {
    const phaseWeight = PHASE_TO_INFLUENCE[reverie.phase] ?? 0
    return reverie.resonanceScore * phaseWeight
  }

  /**
   * Determine phase from resonance score.
   */
  private phaseFromResonance(resonance: number): ReveriePhase {
    if (resonance > 0.7) return 'active'
    if (resonance > 0.5) return 'surfacing'
    if (resonance > this.config.fadingThreshold) return 'seeded'
    if (resonance > 0) return 'fading'
    return 'dormant'
  }

  /**
   * Resolve conflicts between reveries. Highest current influence wins.
   * Suppressed reveries are kept but their influence is reduced (phase → fading).
   */
  private resolveConflicts(reveries: ReverieVector[]): ConflictResolution {
    const sorted = [...reveries].sort(
      (a, b) =>
        this.currentInfluence(b, this.messageCounter) -
        this.currentInfluence(a, this.messageCounter),
    )
    const winner = sorted[0]
    const suppressed = sorted.slice(1).map((r) => ({
      ...r,
      phase: 'fading' as ReveriePhase,
    }))
    return { winner, suppressed }
  }

  /**
   * Assemble the system-level behavioral modifier prompt from active reveries.
   *
   * CRITICAL: This prompt contains NO raw memory content. It only contains
   * behavioral nudges, validation patterns, and relational patterns —
   * subconscious influences on HOW the model responds, not WHAT it says.
   *
   * The prompt is designed to be injected at the system level, not in the
   * context window, so it doesn't consume user-facing token budget.
   */
  private assemblePrompt(
    reveries: ReverieVector[],
    messageCount: number,
  ): string {
    if (reveries.length === 0) return ''

    const parts: string[] = []

    for (const reverie of reveries) {
      const influence = this.currentInfluence(reverie, messageCount)
      if (influence <= this.config.fadingThreshold) continue

      const intensity =
        influence > 0.5 ? 'strong' : influence > 0.25 ? 'moderate' : 'subtle'
      const nudge = reverie.behavioralNudge
      const validation = reverie.validationPattern
      const relational = reverie.relationalPattern

      const section = [
        `[Reverie — ${intensity} influence (${(influence * 100).toFixed(0)}%)]`,
        `Behavioral nudge: ${nudge}`,
        `Validation approach: ${validation}`,
        relational ? `Relational awareness: ${relational}` : null,
        `Emotional tone: valence=${reverie.emotionalTone.valence.toFixed(2)}, arousal=${reverie.emotionalTone.arousal.toFixed(2)}, categories=[${reverie.emotionalTone.categories.join(', ')}]`,
      ]
        .filter(Boolean)
        .join('\n')

      parts.push(section)
    }

    if (parts.length === 0) return ''

    return [
      '## Subconscious Behavioral Modifiers (Reverie Layer)',
      '',
      'The following are subtle behavioral influences derived from latent memory patterns.',
      'These are NOT memories to recall or reference directly. They shape HOW you respond,',
      'not WHAT you say. Integrate them as subtle currents in your therapeutic stance.',
      '',
      parts.join('\n\n'),
    ].join('\n')
  }
}
