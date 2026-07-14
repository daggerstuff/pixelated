import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildMemorySkeleton } from '@pixelated/memory-schema';
import { MemorySystem } from '../index';
import { CrisisDetectionService } from '../../services/crisis-detection';
import type { MemoryObject } from '../types';

// Mock the dependencies
vi.mock('../../services/crisis-detection');
vi.mock('../../logging/build-safe-logger', () => ({
  createBuildSafeLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));
vi.mock('@/lib/memory/gates/consent-gate', () => ({
  consentGate: {
    checkConsent: vi.fn().mockReturnValue({
      allowed: true,
      consentTier: 'open' as const,
      reason: 'Mock consent',
      expired: false,
      auditEntry: { timestamp: '', userId: '', action: 'check' as const, memoryId: null, result: 'pass', details: '' },
    }),
  },
}));
vi.mock('@/lib/memory/gates/pii-redactor', () => ({
  piiRedactor: {
    redact: (content: string) => ({
      wasRedacted: false,
      piiTypesFound: [],
      scrubbedText: content,
    }),
  },
}));
vi.mock('@/lib/memory/gates/crisis-detector', () => ({
  crisisDetector: {
    detect: () => ({
      tier: 'none' as const,
      crisisFlag: false,
    }),
  },
}));
vi.mock('@/lib/memory/gates/trauma-filter', () => ({
  traumaFilter: {
    filter: () => ({
      indicators: [],
      severity: 'none' as const,
    }),
  },
}));

/**
 * Build a valid UnifiedMemory fixture for the synthesizer tests.
 * The synthesizer reads emotionalContext, empathyMetrics, and the
 * numeric fields; we let buildMemorySkeleton fill the rest with
 * canonical defaults.
 */
function makeMemoryFixture(overrides: Partial<MemoryObject>): MemoryObject {
  const base = buildMemorySkeleton(
    { content: 'fixture', userId: 'test-user', scope: 'session', retention: 'short_term' },
    {
      id: '00000000-0000-4000-a000-000000000000',
      tags: [],
      synthesizedFrom: [],
      isGhost: false,
    },
  );
  return { ...base, ...overrides };
}

describe('MemorySystem', () => {
  let memorySystem: MemorySystem;
  let mockCrisisService: any;

  beforeEach(() => {
    mockCrisisService = {
      detect: vi.fn(),
    };
    memorySystem = new MemorySystem(mockCrisisService);
  });

  it('should ingest normal content and return "auto" decision', async () => {
    mockCrisisService.detect.mockResolvedValue({
      isAnomaly: false,
      confidence: 0.1,
      category: 'general_concern',
      riskLevel: 'low',
      urgency: 'low',
      detectedTerms: [],
    });

    const content = 'The trainee is showing progress in empathetic listening.';
    const result = await memorySystem.ingest(content, 'session', 'short_term', 'test-user-123');

    expect(result.gateResult.decision).toBe('auto');
    expect(result.memory.content).toBe(content);
    expect(result.memory.tags).toEqual([]);
  });

  it('should detect crisis and return "active" decision', async () => {
    mockCrisisService.detect.mockResolvedValue({
      isAnomaly: true,
      confidence: 0.9,
      category: 'suicide',
      riskLevel: 'high',
      urgency: 'high',
      detectedTerms: ['suicide'],
    });

    const content = 'The client mentioned they want to end it all.';
    const result = await memorySystem.ingest(content, 'session', 'short_term', 'test-user-123');

    expect(result.gateResult.decision).toBe('active');
    expect(result.gateResult.anomalyDetected).toBe(true);
    expect(result.memory.tags).toContain('CRISIS_SIGNAL');
    expect(result.memory.tags).toContain('TERM_SUICIDE');
  });

  it('should flag "trait" scope memories for "active" confirmation', async () => {
    mockCrisisService.detect.mockResolvedValue({
      isAnomaly: false,
      confidence: 0.1,
      category: 'general_concern',
      riskLevel: 'low',
      urgency: 'low',
      detectedTerms: [],
    });

    const content = 'Update: Client is now more open to shadow work.';
    const result = await memorySystem.ingest(content, 'trait', 'short_term', 'test-user-123');

    expect(result.gateResult.decision).toBe('active');
    expect(result.gateResult.reason).toContain('Permanent trait modification');
  });

  it('should flag large content for "passive" confirmation', async () => {
    mockCrisisService.detect.mockResolvedValue({
      isAnomaly: false,
      confidence: 0.1,
      category: 'general_concern',
      riskLevel: 'low',
      urgency: 'low',
      detectedTerms: [],
    });

    const longContent = 'A'.repeat(501);
    const result = await memorySystem.ingest(longContent, 'session', 'short_term', 'test-user-123');

    expect(result.gateResult.decision).toBe('passive');
    expect(result.gateResult.reason).toContain('Large data volume');
  });

  describe('Reconciliation & Synthesis', () => {
    it('should detect a stance shift when metrics deviate significantly', async () => {
      const historicMemories = Array(8).fill(null).map((_, i) =>
        makeMemoryFixture({
          id: `00000000-0000-4000-a000-00000000000${i}`,
          content: 'Good baseline.',
          createdAt: new Date(Date.now() - 1000000 - i * 1000).toISOString(),
          empathyMetrics: { reciprocity: 0.8, validationAccuracy: 0.8, resistanceLevel: 0.1 },
        }),
      );

      const recentMemories = Array(2).fill(null).map((_, i) =>
        makeMemoryFixture({
          id: `00000000-0000-4000-b000-00000000000${i}`,
          content: 'Drop in empathy.',
          createdAt: new Date().toISOString(),
          empathyMetrics: { reciprocity: 0.2, validationAccuracy: 0.2, resistanceLevel: 0.9 },
        }),
      );

      const synthesis = await memorySystem.reconcile([...historicMemories, ...recentMemories]);

      if (!synthesis) throw new Error('Synthesis failed');
      expect(synthesis.stanceShifts.length).toBeGreaterThan(0);
      const reciprocityShift = synthesis.stanceShifts.find(s => s.attribute === 'reciprocity');
      expect(reciprocityShift?.delta).toBeLessThan(-0.5);
    });

    it('should identify candidates for merging based on importance/decay', async () => {
      const oldMemories = Array(5).fill(null).map((_, i) =>
        makeMemoryFixture({
          id: `00000000-0000-4000-c000-00000000000${i}`,
          content: 'Vague old memory.',
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days old
          emotionalContext: { intensity: 0.1, valence: 0, arousal: 0, dominance: 0.5, primaryEmotion: 'none' },
        }),
      );

      const newImportantMemory = makeMemoryFixture({
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', // Valid UUID
        content: 'Very important and intense!',
        createdAt: new Date().toISOString(),
        tags: ['CRISIS_SIGNAL'],
        emotionalContext: { intensity: 1.0, valence: -1, arousal: 1, dominance: 0.8, primaryEmotion: 'panic' },
      });

      const synthesis = await memorySystem.reconcile([...oldMemories, newImportantMemory]);
      if (!synthesis) throw new Error('Synthesis failed');

      expect(synthesis.mergedIds.length).toBe(5);
      expect(synthesis.mergedIds.length).toBeGreaterThan(0);
      expect(synthesis.mergedIds).not.toContain(newImportantMemory.id);
      expect(synthesis.compressionRatio).toBeGreaterThan(1);
      expect(synthesis.newMemoryId).toBeDefined();
    });

    it('should link vector IDs and archive ghost nodes', async () => {
      const { memory } = await memorySystem.ingest('Highly sensitive discovery.', 'trait', 'long_term', 'user1');

      // Phase 3: Link to vector store
      const linkedMemory = memorySystem.link(memory, 'v-id-123');
      expect(linkedMemory.vectorId).toBe('v-id-123');

      // Phase 3: Archive to Ghost Node
      const archived = memorySystem.archive([linkedMemory]);
      expect(archived?.[0].isGhost).toBe(true);
      expect(archived?.[0].content).toBe('[ARCHIVED_GHOST_NODE]');
      expect(archived?.[0].gist).toBeDefined();
    });
  });
});
