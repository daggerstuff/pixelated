import { v4 as uuidv4 } from 'uuid';
import { createBuildSafeLogger } from '../../logging/build-safe-logger';
import type { 
  MemoryObject, 
  SynthesisResult, 
  StanceShift, 
  EmotionalMetadata 
} from './types';

const appLogger = createBuildSafeLogger('memory-synthesizer');

/**
 * Memory Synthesizer
 * Handles reconciliation of stale memories and detection of behavioral shifts.
 */
export class MemorySynthesizer {
  private readonly RECONCILIATION_THRESHOLD = 0.4;
  private readonly SHIFT_THRESHOLD = 0.25;

  /**
   * Performs synthesis over a set of memories.
   * Identifies logical clusters for merging and detects stance shifts.
   */
  async synthesize(memories: MemoryObject[]): Promise<SynthesisResult | null> {
    if (memories.length < 5) {
      return null; // Not enough context for synthesis
    }

    try {
      // 1. Calculate Stance Shifts (comparing recent vs historic)
      const splits = this.splitRecentAndHistoric(memories);
      const stance_shifts = this.detectStanceShifts(splits.historic, splits.recent);

      // 2. Identify candidates for merging (low importance/decayed)
      const mergeCandidates = this.identifyMergeCandidates(memories);

      if (mergeCandidates.length < 2) {
        return {
          merged_ids: [],
          new_memory_id: '',
          stance_shifts,
          compression_ratio: 1,
        };
      }

      // 3. Create a synthesized "Abstract Memory"
      const synthesizedContent = this.generateSynthesizedContent(mergeCandidates);
      const merged_ids = mergeCandidates.map(m => m.id);

      appLogger.info('Synthesis completed', {
        mergedCount: merged_ids.length,
        shiftsDetected: stance_shifts.length,
      });

      return {
        merged_ids,
        new_memory_id: uuidv4(),
        stance_shifts,
        compression_ratio: memories.length / (memories.length - merged_ids.length + 1),
      };
    } catch (error: unknown) {
      appLogger.error('Synthesis pass failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Splits memories into historic baseline and recent observations (last 20%)
   */
  private splitRecentAndHistoric(memories: MemoryObject[]): { historic: MemoryObject[], recent: MemoryObject[] } {
    const sorted = [...memories].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const splitIdx = Math.floor(sorted.length * 0.8);
    return {
      historic: sorted.slice(0, splitIdx),
      recent: sorted.slice(splitIdx),
    };
  }

  /**
   * Detects behavioral shifts in empathy and emotional metrics.
   */
  private detectStanceShifts(historic: MemoryObject[], recent: MemoryObject[]): StanceShift[] {
    const shifts: StanceShift[] = [];
    const historicEmpathy = this.avgEmpathy(historic);
    const recentEmpathy = this.avgEmpathy(recent);

    // Check reciprocity shift
    const reciprocityDelta = recentEmpathy.reciprocity - historicEmpathy.reciprocity;
    if (Math.abs(reciprocityDelta) > this.SHIFT_THRESHOLD) {
      shifts.push({
        attribute: 'reciprocity',
        old_value: historicEmpathy.reciprocity,
        new_value: recentEmpathy.reciprocity,
        delta: reciprocityDelta,
        evidence_ids: recent.map(r => r.id),
        confidence: 0.8,
      });
    }

    // Check validation accuracy shift
    const validationDelta = recentEmpathy.validation_accuracy - historicEmpathy.validation_accuracy;
    if (Math.abs(validationDelta) > this.SHIFT_THRESHOLD) {
      shifts.push({
        attribute: 'validation_accuracy',
        old_value: historicEmpathy.validation_accuracy,
        new_value: recentEmpathy.validation_accuracy,
        delta: validationDelta,
        evidence_ids: recent.map(r => r.id),
        confidence: 0.75,
      });
    }

    return shifts;
  }

  /**
   * Identifies memories that are candidates for archival/synthesis based on importance scores.
   */
  private identifyMergeCandidates(memories: MemoryObject[]): MemoryObject[] {
    return memories.filter(m => {
      // Never merge traits or facts without manual review in this phase
      if (m.scope === 'trait' || m.scope === 'fact') return false;
      
      // Never merge crisis signals
      if (m.tags.includes('CRISIS_SIGNAL')) return false;

      const score = this.calculateImportance(m);
      return score < this.RECONCILIATION_THRESHOLD;
    });
  }

  /**
   * Calculates importance based on recency and intensity.
   */
  private calculateImportance(memory: MemoryObject): number {
    const now = new Date().getTime();
    const age = now - new Date(memory.timestamp).getTime();
    const dayInMs = 24 * 60 * 60 * 1000;
    
    // Time decay: 1.0 at creation, halves every 7 days
    const decay = Math.pow(0.5, age / (7 * dayInMs));
    
    // Intensity boost
    const intensity = memory.emotional_context?.intensity || 0.2;
    
    // Hybrid score
    return (decay * 0.7) + (intensity * 0.3);
  }

  private avgEmpathy(mems: MemoryObject[]) {
    const valid = mems.filter(m => m.metrics);
    if (valid.length === 0) return { reciprocity: 0.5, validation_accuracy: 0.5 };
    
    return {
      reciprocity: valid.reduce((acc, m) => acc + (m.metrics?.reciprocity || 0), 0) / valid.length,
      validation_accuracy: valid.reduce((acc, m) => acc + (m.metrics?.validation_accuracy || 0), 0) / valid.length,
    };
  }

  /**
   * Place-holder for LLM-driven synthesis. 
   * In a real system, this would call an LLM to "gist" the merged content.
   */
  private generateSynthesizedContent(candidates: MemoryObject[]): string {
    return `Synthesized context from ${candidates.length} previous observations regarding ${candidates[0]?.gist || 'session flow'}.`;
  }
}
