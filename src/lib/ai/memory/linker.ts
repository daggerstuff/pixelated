import { createBuildSafeLogger } from '../../logging/build-safe-logger';
import type { MemoryObject } from './types';

const appLogger = createBuildSafeLogger('memory-linker');

/**
 * Memory Linker
 * Manages relationships between active memories and their vector representations.
 */
export class MemoryLinker {
  /**
   * Links a memory object to a vector ID.
   * This is called after the memory content is embedded and stored in the vector database.
   */
  linkVector(memory: MemoryObject, vectorId: string): MemoryObject {
    return {
      ...memory,
      vectorId,
    };
  }

  /**
   * Archives a memory into a "Ghost Node".
   * Redacts the content (relying only on the vector DB for retrieval) 
   * and preserves the summary (gist).
   */
  toGhost(memory: MemoryObject): MemoryObject {
    if (!memory.vectorId) {
      throw new Error(`Cannot archive memory ${memory.id} without a vectorId.`);
    }

    appLogger.info('Archiving ghost node', { id: memory.id });

    return {
      ...memory,
      content: '[ARCHIVED_GHOST_NODE]', // Redact primary content
      isGhost: true,
      gist: memory.gist ?? this.generateGist(memory.content),
    };
  }

  /**
   * Generates a short gist for the ghost node if not provided.
   */
  private generateGist(content: string): string {
    const words = content.split(/\s+/);
    if (words.length <= 10) return content;
    return words.slice(0, 10).join(' ') + '...';
  }
}
