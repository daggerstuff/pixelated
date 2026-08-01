import { describe, it, expect, vi } from 'vitest'
import { SealMemoryManager, SealResourceScope } from '../seal-memory'
import type { Disposable } from '../seal-memory'

function createMockDisposable(name?: string): Disposable & { delete: ReturnType<typeof vi.fn> } {
  return { delete: vi.fn() }
}

describe('SealMemoryManager', () => {
  describe('track', () => {
    it('tracks an object with auto-generated name', () => {
      const manager = new SealMemoryManager()
      const obj = createMockDisposable()
      const result = manager.track(obj)
      expect(result).toBe(obj)
      expect(manager.getObjectCount()).toBe(1)
    })

    it('tracks an object with explicit name', () => {
      const manager = new SealMemoryManager()
      const obj = createMockDisposable()
      manager.track(obj, 'my-obj')
      expect(manager.getObjectCount()).toBe(1)
    })

    it('returns the tracked object for chaining', () => {
      const manager = new SealMemoryManager()
      const obj = createMockDisposable()
      const result = manager.track(obj, 'chain-test')
      expect(result).toBe(obj)
    })

    it('assigns incrementing auto-names', () => {
      const manager = new SealMemoryManager()
      const obj1 = createMockDisposable()
      const obj2 = createMockDisposable()
      manager.track(obj1)
      manager.track(obj2)
      expect(manager.getObjectCount()).toBe(2)
    })
  })

  describe('release', () => {
    it('releases a tracked object by reference', () => {
      const manager = new SealMemoryManager()
      const obj = createMockDisposable()
      manager.track(obj, 'tracked')
      manager.release(obj)
      expect(obj.delete).toHaveBeenCalledOnce()
      expect(manager.getObjectCount()).toBe(0)
    })

    it('releases by name when name is provided', () => {
      const manager = new SealMemoryManager()
      const obj = createMockDisposable()
      manager.track(obj, 'named')
      manager.release(obj, 'named')
      expect(obj.delete).toHaveBeenCalledOnce()
      expect(manager.getObjectCount()).toBe(0)
    })

    it('handles null object gracefully', () => {
      const manager = new SealMemoryManager()
      expect(() => manager.release(null)).not.toThrow()
    })

    it('deletes untracked object directly', () => {
      const manager = new SealMemoryManager()
      const obj = createMockDisposable()
      manager.release(obj)
      expect(obj.delete).toHaveBeenCalledOnce()
    })

    it('handles delete errors without throwing', () => {
      const manager = new SealMemoryManager()
      const obj = { delete: vi.fn(() => { throw new Error('delete failed') }) }
      manager.track(obj, 'failing')
      expect(() => manager.release(obj, 'failing')).not.toThrow()
    })

    it('removes only the released object, keeping others', () => {
      const manager = new SealMemoryManager()
      const obj1 = createMockDisposable()
      const obj2 = createMockDisposable()
      manager.track(obj1, 'first')
      manager.track(obj2, 'second')
      manager.release(obj1, 'first')
      expect(obj1.delete).toHaveBeenCalledOnce()
      expect(obj2.delete).not.toHaveBeenCalled()
      expect(manager.getObjectCount()).toBe(1)
    })
  })

  describe('releaseAll', () => {
    it('releases all tracked objects', () => {
      const manager = new SealMemoryManager()
      const obj1 = createMockDisposable()
      const obj2 = createMockDisposable()
      const obj3 = createMockDisposable()
      manager.track(obj1, 'a')
      manager.track(obj2, 'b')
      manager.track(obj3, 'c')
      manager.releaseAll()
      expect(obj1.delete).toHaveBeenCalledOnce()
      expect(obj2.delete).toHaveBeenCalledOnce()
      expect(obj3.delete).toHaveBeenCalledOnce()
      expect(manager.getObjectCount()).toBe(0)
    })

    it('resets object counter after releaseAll', () => {
      const manager = new SealMemoryManager()
      const obj1 = createMockDisposable()
      manager.track(obj1)
      manager.releaseAll()
      const obj2 = createMockDisposable()
      manager.track(obj2)
      expect(manager.getObjectCount()).toBe(1)
    })

    it('continues releasing even if one delete throws', () => {
      const manager = new SealMemoryManager()
      const good1 = createMockDisposable()
      const bad = { delete: vi.fn(() => { throw new Error('boom') }) }
      const good2 = createMockDisposable()
      manager.track(good1, 'g1')
      manager.track(bad as Disposable, 'bad')
      manager.track(good2, 'g2')
      manager.releaseAll()
      expect(good1.delete).toHaveBeenCalledOnce()
      expect(good2.delete).toHaveBeenCalledOnce()
    })

    it('handles empty manager gracefully', () => {
      const manager = new SealMemoryManager()
      expect(() => manager.releaseAll()).not.toThrow()
      expect(manager.getObjectCount()).toBe(0)
    })
  })

  describe('getObjectCount', () => {
    it('returns 0 for fresh manager', () => {
      const manager = new SealMemoryManager()
      expect(manager.getObjectCount()).toBe(0)
    })

    it('reflects current tracked count', () => {
      const manager = new SealMemoryManager()
      manager.track(createMockDisposable())
      manager.track(createMockDisposable())
      expect(manager.getObjectCount()).toBe(2)
    })
  })

  describe('createTracked', () => {
    it('tracks all objects from factory result', () => {
      const manager = new SealMemoryManager()
      const obj1 = createMockDisposable()
      const obj2 = createMockDisposable()
      const result = manager.createTracked(() => ({
        first: obj1,
        second: obj2,
      }))
      expect(result.first).toBe(obj1)
      expect(result.second).toBe(obj2)
      expect(manager.getObjectCount()).toBe(2)
    })

    it('releases factory-created objects on releaseAll', () => {
      const manager = new SealMemoryManager()
      const obj1 = createMockDisposable()
      const obj2 = createMockDisposable()
      manager.createTracked(() => ({ a: obj1, b: obj2 }))
      manager.releaseAll()
      expect(obj1.delete).toHaveBeenCalledOnce()
      expect(obj2.delete).toHaveBeenCalledOnce()
      expect(manager.getObjectCount()).toBe(0)
    })
  })
})

describe('SealResourceScope', () => {
  describe('track', () => {
    it('tracks an object for later cleanup', () => {
      const scope = new SealResourceScope()
      const obj = createMockDisposable()
      const result = scope.track(obj, 'scoped')
      expect(result).toBe(obj)
    })
  })

  describe('run', () => {
    it('executes function and cleans up resources', async () => {
      const scope = new SealResourceScope()
      const obj = createMockDisposable()
      scope.track(obj, 'temp')
      const result = await scope.run(async () => 'done')
      expect(result).toBe('done')
      expect(obj.delete).toHaveBeenCalledOnce()
    })

    it('cleans up even when function throws', async () => {
      const scope = new SealResourceScope()
      const obj = createMockDisposable()
      scope.track(obj, 'temp')
      await expect(
        scope.run(async () => {
          throw new Error('test error')
        }),
      ).rejects.toThrow('test error')
      expect(obj.delete).toHaveBeenCalledOnce()
    })

    it('returns synchronous function results', async () => {
      const scope = new SealResourceScope()
      const result = await scope.run(() => 42)
      expect(result).toBe(42)
    })

    it('provides scope parameter to the function', async () => {
      const scope = new SealResourceScope()
      const obj = createMockDisposable()
      await scope.run(async (s) => {
        s.track(obj, 'inside')
      })
      expect(obj.delete).toHaveBeenCalledOnce()
    })
  })

  describe('close', () => {
    it('releases all tracked resources', () => {
      const scope = new SealResourceScope()
      const obj1 = createMockDisposable()
      const obj2 = createMockDisposable()
      scope.track(obj1, 'a')
      scope.track(obj2, 'b')
      scope.close()
      expect(obj1.delete).toHaveBeenCalledOnce()
      expect(obj2.delete).toHaveBeenCalledOnce()
    })

    it('handles close on empty scope', () => {
      const scope = new SealResourceScope()
      expect(() => scope.close()).not.toThrow()
    })
  })
})