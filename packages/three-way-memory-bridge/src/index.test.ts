import { describe, it, expect, vi } from 'vitest';
import { MemoryBridge } from './index.js';

describe('MemoryBridge', () => {
  it('assembles combined prompt context correctly', async () => {
    const bridge = new MemoryBridge({
      NEON_DATABASE_URL: '',
      FORESIGHT_API_URL: 'http://localhost:8764'
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        memories: [
          { id: '1', content: 'Always prefer pnpm', category: 'preference' }
        ]
      })
    } as any);

    const context = await bridge.getContext('package manager preferences');
    expect(context.foresightMemories).toHaveLength(1);
    expect(context.combinedPromptContext).toContain('Always prefer pnpm');
  });
});
