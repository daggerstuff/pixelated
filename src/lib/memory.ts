// src/lib/memory.ts
// Simple in-memory MemoryService for demonstration. Replace with persistent storage as needed.

export interface Memory {
  id: string;
  userId: string;
  content: string;
  createdAt: Date;
}

export interface ListMemoriesOptions {
  limit?: number;
  offset?: number;
  sortBy?: keyof Memory;
  sortOrder?: 'asc' | 'desc';
}

export class MemoryService {
  private memories: Memory[] = [];

  async listMemories(
    userId: string,
    options: ListMemoriesOptions = {}
  ): Promise<{ memories: Memory[]; total: number }> {
    const { limit = 50, offset = 0, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const userMemories = this.memories.filter(m => m.userId === userId);
    const sorted = userMemories.sort((a, b) => {
      if (sortOrder === 'asc') {
        return a[sortBy] > b[sortBy] ? 1 : -1;
      } else {
        return a[sortBy] < b[sortBy] ? 1 : -1;
      }
    });
    return {
      memories: sorted.slice(offset, offset + limit),
      total: userMemories.length,
    };
  }

  // For demonstration: add a memory
  async addMemory(memory: Memory) {
    this.memories.push(memory);
  }
}
