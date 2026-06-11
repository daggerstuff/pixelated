import { buildMemorySkeleton } from '@pixelated/memory-schema';
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
  const mockMemory: MemoryObject = buildMemorySkeleton(
    {
      content: 'The user is talking about shadow work.',
      userId: 'test-user',
      scope: 'session',
      retention: 'short_term',
      tenantId: 'test',
      bankId: 'test',
      tags: [],
    },
    {
      id: '00000000-0000-4000-a000-000000000000',
      isGhost: false,
      gist: null,
      vectorId: null,
      emotionalContext: null,
      empathyMetrics: null,
      updatedAt: null,
      accessedAt: null,
      lastRetrievedAt: null,
    },
  );

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
