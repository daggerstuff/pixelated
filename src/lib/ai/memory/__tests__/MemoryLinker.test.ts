import { MemoryLinker } from '../linker';
import type { MemoryObject } from '../types';

describe('MemoryLinker', () => {
  let linker: MemoryLinker;

  beforeEach(() => {
    linker = new MemoryLinker();
  });

  // UnifiedMemory has many required fields. The linker tests only
  // exercise id/content/scope/retention/tags/vectorId/isGhost/gist, so
  // we fill the rest with package defaults via buildMemorySkeleton.
  const mockMemory: MemoryObject = {
    ...({
      id: '00000000-0000-4000-a000-000000000000',
      content: 'The user is talking about shadow work.',
      scope: 'session',
      retention: 'short_term',
    } as Partial<MemoryObject>),
    tenantId: 'test',
    userId: 'test-user',
    bankId: 'test',
    category: 'conversation',
    version: 1,
    schemaVersion: '1.0.0',
    sourceService: 'unknown',
    importance: 0.5,
    decayRate: 0.01,
    strengthTrend: 'stable',
    activationCount: 0,
    retrievalCount: 0,
    isGhost: false,
    gist: null,
    synthesizedFrom: [],
    vectorId: null,
    emotionalContext: null,
    empathyMetrics: null,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    accessedAt: null,
    lastRetrievedAt: null,
    tags: [],
  } as MemoryObject;

  it('should link a vector ID to a memory object', () => {
    const linked = linker.linkVector(mockMemory, 'V-123');
    expect(linked.vectorId).toBe('V-123');
    expect(linked.id).toBe(mockMemory.id);
  });

  it('should transition a linked memory to a ghost node', () => {
    const linked = linker.linkVector(mockMemory, 'V-123');
    const ghost = linker.toGhost(linked);

    expect(ghost.isGhost).toBe(true);
    expect(ghost.content).toBe('[ARCHIVED_GHOST_NODE]');
    expect(ghost.vectorId).toBe('V-123');
    expect(ghost.gist).toContain('shadow work');
  });

  it('should fail to archive a memory without a vector ID', () => {
    expect(() => linker.toGhost(mockMemory)).toThrow('Cannot archive memory');
  });

  it('should limit gist length for ghost nodes', () => {
    const longMemory = {
      ...mockMemory,
      vectorId: 'V-456',
      content: 'One two three four five six seven eight nine ten eleven twelve thirteen.'
    };
    const ghost = linker.toGhost(longMemory);
    const words = ghost.gist?.split(' ');
    expect(words?.length).toBeLessThanOrEqual(11); // 10 words + ...
    expect(ghost.gist).toContain('...');
  });
});
