import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemorySystem } from '../index';
import { CrisisDetectionService } from '../../services/crisis-detection';

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

describe('MemorySystem', () => {
  let memorySystem: MemorySystem;
  let mockCrisisService: any;

  beforeEach(() => {
    mockCrisisService = {
      detectCrisis: vi.fn(),
    };
    memorySystem = new MemorySystem(mockCrisisService as unknown as CrisisDetectionService);
  });

  it('should ingest normal content and return "auto" decision', async () => {
    mockCrisisService.detectCrisis.mockResolvedValue({
      isCrisis: false,
      confidence: 0.1,
      category: 'general_concern',
      riskLevel: 'low',
      urgency: 'low',
      detectedTerms: [],
    });

    const content = 'The trainee is showing progress in empathetic listening.';
    const result = await memorySystem.ingest(content);

    expect(result.gateResult.decision).toBe('auto');
    expect(result.memory.content).toBe(content);
    expect(result.memory.tags).toEqual([]);
  });

  it('should detect crisis and return "active" decision', async () => {
    mockCrisisService.detectCrisis.mockResolvedValue({
      isCrisis: true,
      confidence: 0.9,
      category: 'suicide',
      riskLevel: 'high',
      urgency: 'high',
      detectedTerms: ['suicide'],
    });

    const content = 'The client mentioned they want to end it all.';
    const result = await memorySystem.ingest(content);

    expect(result.gateResult.decision).toBe('active');
    expect(result.gateResult.crisis_detected).toBe(true);
    expect(result.memory.tags).toContain('CRISIS_SIGNAL');
    expect(result.memory.tags).toContain('TERM_SUICIDE');
  });

  it('should flag "trait" scope memories for "active" confirmation', async () => {
    mockCrisisService.detectCrisis.mockResolvedValue({
      isCrisis: false,
      confidence: 0.1,
      category: 'general_concern',
      riskLevel: 'low',
      urgency: 'low',
      detectedTerms: [],
    });

    const content = 'Update: Client is now more open to shadow work.';
    const result = await memorySystem.ingest(content, 'trait');

    expect(result.gateResult.decision).toBe('active');
    expect(result.gateResult.reason).toContain('Permanent trait modification');
  });

  it('should flag large content for "passive" confirmation', async () => {
    mockCrisisService.detectCrisis.mockResolvedValue({
      isCrisis: false,
      confidence: 0.1,
      category: 'general_concern',
      riskLevel: 'low',
      urgency: 'low',
      detectedTerms: [],
    });

    const longContent = 'A'.repeat(501);
    const result = await memorySystem.ingest(longContent);

    expect(result.gateResult.decision).toBe('passive');
    expect(result.gateResult.reason).toContain('Large data volume');
  });

  describe('Reconciliation & Synthesis', () => {
    it('should detect a stance shift when metrics deviate significantly', async () => {
      const historicMemories = Array(8).fill(null).map((_, i) => ({
        id: `00000000-0000-4000-a000-00000000000${i}`,
        timestamp: new Date(Date.now() - 1000000 - i * 1000).toISOString(),
        content: 'Good baseline.',
        scope: 'session' as any,
        retention: 'short_term' as any,
        tags: [],
        synthesized_from: [],
        is_ghost: false,
        metrics: { reciprocity: 0.8, validation_accuracy: 0.8, resistance_level: 0.1 }
      }));

      const recentMemories = Array(2).fill(null).map((_, i) => ({
        id: `00000000-0000-4000-b000-00000000000${i}`,
        timestamp: new Date().toISOString(),
        content: 'Drop in empathy.',
        scope: 'session' as any,
        retention: 'short_term' as any,
        tags: [],
        synthesized_from: [],
        is_ghost: false,
        metrics: { reciprocity: 0.2, validation_accuracy: 0.2, resistance_level: 0.9 }
      }));

      const synthesis = await memorySystem.reconcile([...historicMemories, ...recentMemories]);

      expect(synthesis?.stance_shifts.length).toBeGreaterThan(0);
      const reciprocityShift = synthesis?.stance_shifts.find(s => s.attribute === 'reciprocity');
      expect(reciprocityShift?.delta).toBeLessThan(-0.5);
    });

    it('should identify candidates for merging based on importance/decay', async () => {
      const oldMemories = Array(5).fill(null).map((_, i) => ({
        id: `00000000-0000-4000-c000-00000000000${i}`,
        timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days old
        content: 'Vague old memory.',
        scope: 'session' as any,
        retention: 'short_term' as any,
        tags: [],
        synthesized_from: [],
        is_ghost: false,
        emotional_context: { intensity: 0.1, valence: 0, arousal: 0, dominance: 0.5, primary_emotion: 'none' }
      }));

      const newImportantMemory = {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', // Valid UUID
        timestamp: new Date().toISOString(),
        content: 'Very important and intense!',
        scope: 'session' as any,
        retention: 'short_term' as any,
        tags: ['CRISIS_SIGNAL'],
        synthesized_from: [],
        is_ghost: false,
        emotional_context: { intensity: 1.0, valence: -1, arousal: 1, dominance: 0.8, primary_emotion: 'panic' }
      };

      const synthesis = await memorySystem.reconcile([...oldMemories, newImportantMemory]);

      expect(synthesis?.merged_ids.length).toBe(5);
      expect(synthesis?.merged_ids).not.toContain('new1');
      expect(synthesis?.compression_ratio).toBeGreaterThan(1);
    });
  });
});
