import { MemoryLinker } from '../linker';
import type { MemoryObject } from '../types';

describe('MemoryLinker', () => {
  let linker: MemoryLinker;

  beforeEach(() => {
    linker = new MemoryLinker();
  });

  const mockMemory: MemoryObject = {
    id: '00000000-0000-4000-a000-000000000000',
    timestamp: new Date().toISOString(),
    content: 'The user is talking about shadow work.',
    scope: 'session',
    retention: 'short_term',
    tags: [],
    synthesized_from: [],
    is_ghost: false,
  };

  it('should link a vector ID to a memory object', () => {
    const linked = linker.linkVector(mockMemory, 'V-123');
    expect(linked.vector_id).toBe('V-123');
    expect(linked.id).toBe(mockMemory.id);
  });

  it('should transition a linked memory to a ghost node', () => {
    const linked = linker.linkVector(mockMemory, 'V-123');
    const ghost = linker.toGhost(linked);

    expect(ghost.is_ghost).toBe(true);
    expect(ghost.content).toBe('[ARCHIVED_GHOST_NODE]');
    expect(ghost.vector_id).toBe('V-123');
    expect(ghost.gist).toContain('shadow work');
  });

  it('should fail to archive a memory without a vector ID', () => {
    expect(() => linker.toGhost(mockMemory)).toThrow('Cannot archive memory');
  });

  it('should limit gist length for ghost nodes', () => {
    const longMemory = {
      ...mockMemory,
      vector_id: 'V-456',
      content: 'One two three four five six seven eight nine ten eleven twelve thirteen.'
    };
    const ghost = linker.toGhost(longMemory);
    const words = ghost.gist?.split(' ');
    expect(words?.length).toBeLessThanOrEqual(11); // 10 words + ...
    expect(ghost.gist).toContain('...');
  });
});
