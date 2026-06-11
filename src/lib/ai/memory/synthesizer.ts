import { v4 as uuidv4 } from 'uuid';
import { createBuildSafeLogger } from '../../logging/build-safe-logger';
import type { 
  MemoryObject, 
  SynthesisResult, 
  StanceShift 
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
      const stanceShifts = this.detectStanceShifts(splits.historic, splits.recent);

      // 2. Identify candidates for merging (low importance/decayed)
      const mergeCandidates = this.identifyMergeCandidates(memories);

      if (mergeCandidates.length < 2) {
        return {
          mergedIds: [],
          newMemoryId: '',
          stanceShifts,
          compressionRatio: 1,
        };
      }

      // 3. Create a synthesized "Abstract Memory"
      const mergedIds = mergeCandidates.map(m => m.id);

      appLogger.info('Synthesis completed', {
        mergedCount: mergedIds.length,
        shiftsDetected: stanceShifts.length,
      });

      return {
        mergedIds,
        newMemoryId: uuidv4(),
        stanceShifts,
        compressionRatio: memories.length / (memories.length - mergedIds.length + 1),
      };
    } catch (error: unknown) {
      appLogger.error('Synthesis pass failed', {
        error: error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : String(error),
      });
      return null;
    }
  }

  /**
   * Splits memories into historic baseline and recent observations (last 20%)
   */
  private splitRecentAndHistoric(memories: MemoryObject[]): { historic: MemoryObject[], recent: MemoryObject[] } {
    const sorted = [...memories].sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
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
        oldValue: historicEmpathy.reciprocity,
        newValue: recentEmpathy.reciprocity,
        delta: reciprocityDelta,
        evidenceIds: recent.map(r => r.id),
        confidence: 0.8,
      });
    }

    // Check validation accuracy shift
    const validationDelta = recentEmpathy.validationAccuracy - historicEmpathy.validationAccuracy;
    if (Math.abs(validationDelta) > this.SHIFT_THRESHOLD) {
      shifts.push({
        attribute: 'validation_accuracy',
        oldValue: historicEmpathy.validationAccuracy,
        newValue: recentEmpathy.validationAccuracy,
        delta: validationDelta,
        evidenceIds: recent.map(r => r.id),
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
    const age = now - new Date(memory.createdAt).getTime();
    const dayInMs = 24 * 60 * 60 * 1000;
    
    // Time decay: 1.0 at creation, halves every 7 days
    const decay = Math.pow(0.5, age / (7 * dayInMs));
    
    // Intensity boost
    const intensity = memory.emotionalContext?.intensity ?? 0.2;
    
    // Hybrid score
    return (decay * 0.7) + (intensity * 0.3);
  }

  private avgEmpathy(mems: MemoryObject[]) {
    const valid = mems.filter(m => m.empathyMetrics);
    if (valid.length === 0) return { reciprocity: 0.5, validationAccuracy: 0.5 };

    return {
      reciprocity: valid.reduce((acc, m) => acc + (m.empathyMetrics?.reciprocity ?? 0), 0) / valid.length,
      validationAccuracy: valid.reduce((acc, m) => acc + (m.empathyMetrics?.validationAccuracy ?? 0), 0) / valid.length,
    };
  }
}
