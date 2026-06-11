import { createBuildSafeLogger } from '../../logging/build-safe-logger';
import type { GatingMetadata } from '@pixelated/memory-schema';
import type { MemoryObject, GateResult, GateDecision } from './types';
import { MemoryCrisisTagger } from './tagger';
import { piiRedactor } from '../../memory/gates/pii-redactor';
import { crisisDetector } from '../../memory/gates/crisis-detector';
import { traumaFilter } from '../../memory/gates/trauma-filter';
import { consentGate } from '../../memory/gates/consent-gate';

const appLogger = createBuildSafeLogger('socratic-gate');

// Re-export GatingMetadata under its local name for backwards compatibility
// with the gate tests and any other consumers that imported it from here.
export type { GatingMetadata };

export class SocraticGate {
  private readonly tagger: MemoryCrisisTagger;

  constructor(tagger: MemoryCrisisTagger) {
    this.tagger = tagger;
  }

  async evaluate(memory: MemoryObject, userId: string): Promise<GateResult> {
    try {
      const gatingMeta = this.runGates(memory.content, userId);

      const tags = await this.tagger.tagMemory(memory, userId);
      const isCrisis = tags.includes('CRISIS_SIGNAL') || gatingMeta.crisisFlag;

      let decision: GateDecision = 'auto';
      let reason = 'Normal information flow.';

      if (gatingMeta.crisisTier === 'critical') {
        decision = 'block';
        reason = 'Critical crisis detected. Blocking ingestion.';
      } else if (isCrisis) {
        decision = 'active';
        reason = 'Crisis signal detected. Requires immediate professional review.';
      } else if (tags.some((t) => t.startsWith('CONCERN'))) {
        decision = 'passive';
        reason = 'Moderate concern detected. Flagged for review in post-session summary.';
      } else if (memory.content.length > 500) {
        decision = 'passive';
        reason = 'Large data volume. Ingesting passively to maintain performance.';
      }

      if (memory.scope === 'trait') {
        decision = 'active';
        reason = 'Permanent trait modification requires explicit supervisor confirmation.';
      }

      if (!gatingMeta.consentAllowed) {
        decision = 'block';
        reason = 'Consent not granted. Blocking ingestion.';
      }

      return {
        decision,
        reason,
        suggestedTags: tags,
        anomalyDetected: isCrisis,
        gating: gatingMeta,
      };
    } catch (error: unknown) {
      appLogger.error('Socratic Gate evaluation failed', {
        memoryId: memory.id,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        decision: 'block',
        reason: 'Internal safety gate error. Blocking ingestion for security.',
        suggestedTags: ['ERROR_GATE_FAILURE'],
        anomalyDetected: true,
      };
    }
  }

  private runGates(content: string, userId: string): GatingMetadata {
    const piiResult = piiRedactor.redact(content);
    const crisisResult = crisisDetector.detect(content);
    const traumaResult = traumaFilter.filter(content, userId);
    const consentResult = consentGate.checkConsent(userId);

    return {
      piiRedacted: piiResult.wasRedacted,
      piiTypes: piiResult.piiTypesFound,
      crisisTier: crisisResult.tier,
      crisisFlag: crisisResult.crisisFlag,
      traumaIndicators: traumaResult.indicators,
      traumaSeverity: traumaResult.severity,
      consentTier: consentResult.consentTier,
      consentAllowed: consentResult.allowed,
      scrubbedContent: piiResult.scrubbedText,
    };
  }
}
