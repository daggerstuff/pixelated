import { v4 as uuidv4 } from 'uuid';
import { createBuildSafeLogger } from '../../logging/build-safe-logger';
import type { MemoryObject, MemoryScope, RetentionPolicy, GateResult, SynthesisResult } from './types';
import { SocraticGate } from './gate';
import { MemoryCrisisTagger } from './tagger';
import { MemorySynthesizer } from './synthesizer';
import { CrisisDetectionService } from '../services/crisis-detection';

const appLogger = createBuildSafeLogger('memory-system');

/**
 * Omni-State Memory System
 * Coordinates ingestion, tagging, and gatekeeping of memories.
 */
export class MemorySystem {
  private gate: SocraticGate;
  private tagger: MemoryCrisisTagger;
  private synthesizer: MemorySynthesizer;

  constructor(crisisDetectionService: CrisisDetectionService) {
    this.tagger = new MemoryCrisisTagger(crisisDetectionService);
    this.gate = new SocraticGate(this.tagger);
    this.synthesizer = new MemorySynthesizer();
  }

  /**
   * Processes a raw observation into a structured memory object.
   */
  async ingest(
    content: string,
    scope: MemoryScope = 'session',
    retention: RetentionPolicy = 'short_term',
    metadata?: Partial<MemoryObject>
  ): Promise<{ memory: MemoryObject; gateResult: GateResult }> {
    const memory: MemoryObject = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      content,
      scope,
      retention,
      tags: [],
      synthesized_from: [],
      is_ghost: false,
      ...metadata,
    };

    const gateResult = await this.gate.evaluate(memory);
    
    // Apply tags suggested by the gate/tagger
    memory.tags = [...new Set([...(memory.tags || []), ...gateResult.suggested_tags])];

    appLogger.info('Memory ingested', {
      id: memory.id,
      decision: gateResult.decision,
      tags: memory.tags,
    });

    return { memory, gateResult };
  }

  /**
   * Reconciles and synthesizes memories to detect shifts and manage context volume.
   */
  async reconcile(memories: MemoryObject[]): Promise<SynthesisResult | null> {
    return this.synthesizer.synthesize(memories);
  }
}
