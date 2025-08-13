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

  async createMemory(content: string, metadata: { userId: string; [key: string]: any }): Promise<Memory> {
    const memory: Memory = {
      id: Math.random().toString(36).substr(2, 9),
      userId: metadata.userId,
      content,
      createdAt: new Date(),
    };
    this.memories.push(memory);
    return memory;
  }

  async updateMemory(memoryId: string, content: string, metadata: { userId: string; [key: string]: any }): Promise<Memory | null> {
    const index = this.memories.findIndex(m => m.id === memoryId && m.userId === metadata.userId);
    if (index === -1) {
      return null;
    }
    this.memories[index] = {
      ...this.memories[index],
      content,
    };
    return this.memories[index];
  }

  async deleteMemory(memoryId: string, userId: string): Promise<boolean> {
    const index = this.memories.findIndex(m => m.id === memoryId && m.userId === userId);
    if (index === -1) {
      return false;
    }
    this.memories.splice(index, 1);
    return true;
  }

  async searchMemories(query: string, metadata: { userId: string; [key: string]: any }): Promise<Memory[]> {
    return this.memories.filter(m => 
      m.userId === metadata.userId && 
      m.content.toLowerCase().includes(query.toLowerCase())
    );
  }

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
