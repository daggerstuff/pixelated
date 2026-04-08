import { createBuildSafeLogger } from '../../logging/build-safe-logger';
import type { MemoryObject, GateResult, GateDecision } from './types';
import { MemoryCrisisTagger } from './tagger';

const appLogger = createBuildSafeLogger('socratic-gate');

/**
 * Socratic Gate
 * Middleman for memory ingestion. Ensures psychological safety and data quality.
 */
export class SocraticGate {
  private tagger: MemoryCrisisTagger;

  constructor(tagger: MemoryCrisisTagger) {
    this.tagger = tagger;
  }

  /**
   * Evaluates if a memory chunk should be ingested and with what level of confirmation.
   * @param memory - The memory object to evaluate
   * @param userId - The user ID associated with this memory (required for crisis tracking)
   */
  async evaluate(memory: MemoryObject, userId: string): Promise<GateResult> {
    try {
      // 1. Tag for crisis and context
      const tags = await this.tagger.tagMemory(memory, userId);
      const isCrisis = tags.includes('CRISIS_SIGNAL');

      // 2. Determine Decision Level
      let decision: GateDecision = 'auto';
      let reason = 'Normal information flow.';

      if (isCrisis) {
        decision = 'active';
        reason = 'Crisis signal detected. Requires immediate professional review.';
      } else if (tags.some((t) => t.startsWith('CONCERN'))) {
        decision = 'passive';
        reason = 'Moderate concern detected. Flagged for review in post-session summary.';
      } else if (memory.content.length > 500) {
        // Large data chunks should be passively accepted to avoid cluttering active context
        decision = 'passive';
        reason = 'Large data volume. Ingesting passively to maintain performance.';
      }

      // 3. Trait shifts always require confirmation in our philosophy
      if (memory.scope === 'trait') {
        decision = 'active';
        reason = 'Permanent trait modification requires explicit supervisor confirmation.';
      }

      return {
        decision,
        reason,
        suggested_tags: tags,
        crisis_detected: isCrisis,
      };
    } catch (error: unknown) {
      appLogger.error('Socratic Gate evaluation failed', {
        memoryId: memory.id,
        error: error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : String(error),
      });

      return {
        decision: 'block',
        reason: 'Internal safety gate error. Blocking ingestion for security.',
        suggested_tags: ['ERROR_GATE_FAILURE'],
        crisis_detected: true, // Default to true for safety
      };
    }
  }
}
