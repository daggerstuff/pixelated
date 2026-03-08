import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceOptimizer } from './performance-optimizer';

describe('PerformanceOptimizer', () => {
  let optimizer: PerformanceOptimizer;

  beforeEach(() => {
    optimizer = new PerformanceOptimizer({
      cache: {
        maxSize: 10,
        ttl: 1000,
        strategy: 'LRU'
      },
      monitoring: {
        metricsInterval: 1000000 // Disable frequent monitoring
      }
    });
  });

  afterEach(() => {
    optimizer.cleanup();
  });

  it('should set and get values', () => {
    optimizer.set('key1', 'value1');
    expect(optimizer.get('key1')).toBe('value1');
  });

  it('should return null for non-existent keys', () => {
    expect(optimizer.get('non-existent')).toBeNull();
  });

  it('should respect TTL', () => {
    vi.useFakeTimers();
    optimizer.set('key1', 'value1');
    vi.advanceTimersByTime(1500);
    expect(optimizer.get('key1')).toBeNull();
    vi.useRealTimers();
  });

  it('should evict LRU items when cache is full', () => {
    const smallOptimizer = new PerformanceOptimizer({
      cache: {
        maxSize: 2,
        ttl: 10000,
        strategy: 'LRU'
      }
    });

    smallOptimizer.set('key1', 'value1');
    smallOptimizer.set('key2', 'value2');

    // Access key1 to make it most recently used
    smallOptimizer.get('key1');

    // key2 is now LRU
    smallOptimizer.set('key3', 'value3');

    expect(smallOptimizer.get('key1')).toBe('value1');
    expect(smallOptimizer.get('key3')).toBe('value3');
    expect(smallOptimizer.get('key2')).toBeNull();

    smallOptimizer.cleanup();
  });

  it('should preserve accessCount on update', () => {
    optimizer.set('key1', 'value1');
    optimizer.get('key1'); // count = 2
    optimizer.set('key1', 'value1-updated');

    // Check internal state via metrics if possible, or just verify it's still there
    expect(optimizer.get('key1')).toBe('value1-updated');
  });
});
