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
});
