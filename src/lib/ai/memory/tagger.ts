import { createBuildSafeLogger } from '../../logging/build-safe-logger';
import { AnomalyDetector } from '../services/anomaly-detector';
import type { MemoryObject } from './types';

const appLogger = createBuildSafeLogger('memory-tagger');

/**
 * Hybrid Crisis Signature Auto-Tagger
 * Combines high-performance keyword scanning with deep AI analysis.
 */
export class MemoryCrisisTagger {
  private readonly anomalyDetector: AnomalyDetector;

  constructor(anomalyDetector: AnomalyDetector) {
    this.anomalyDetector = anomalyDetector;
  }

  /**
   * Analyzes a memory object's content and returns a list of high-risk tags.
   * @param memory - The memory object to analyze
   * @param userId - The user ID associated with this memory (required for crisis tracking)
   */
  async tagMemory(memory: MemoryObject, userId: string): Promise<string[]> {
    const tags: string[] = [];

    try {
      // Use AnomalyDetector for analysis
      const result = await this.anomalyDetector.detect(memory.content, {
        sensitivityLevel: 'high',
        userId,
        source: 'memory_tagger',
      });

      if (result.isAnomaly) {
        tags.push('CRISIS_SIGNAL');
        tags.push(`CRISIS_TYPE_${result.category.toUpperCase()}`);
        tags.push(`RISK_${result.riskLevel.toUpperCase()}`);

        if (result.urgency === 'immediate') {
          tags.push('URGENT_INTERVENTION');
        }
      } else if (result.confidence > 0.3) {
        // Minor concern but not a full crisis
        tags.push('CONCERN_SIGNAL');
        tags.push(`CONCERN_TYPE_${result.category.toUpperCase()}`);
      }

      // Add detected terms as granular tags
      if (result.detectedTerms && result.detectedTerms.length > 0) {
        result.detectedTerms.forEach((term) => {
          tags.push(`TERM_${term.toUpperCase().replace(/\s+/g, '_')}`);
        });
      }

      return [...new Set(tags)];
    } catch (error: unknown) {
      appLogger.error('Crisis tagging failed for memory object', {
        memoryId: memory.id,
        error: error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : String(error),
      });
      return ['ERROR_ANALYSIS_FAILED'];
    }
  }
}
