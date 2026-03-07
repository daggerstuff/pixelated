import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PerformanceOptimizer } from '../performance-optimizer';

describe('PerformanceOptimizer', () => {
  let optimizer: PerformanceOptimizer;

  beforeEach(() => {
    optimizer = new PerformanceOptimizer({
      cache: {
        maxSize: 10,
        ttl: 1000,
        strategy: 'LRU',
      },
      monitoring: {
        metricsInterval: 100000, // Large interval to avoid background noise
      }
    });
  });

  afterEach(() => {
    optimizer.cleanup();
  });

  describe('Cache', () => {
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
      // maxSize is 10
      for (let i = 1; i <= 10; i++) {
        optimizer.set(`key${i}`, `value${i}`);
      }

      // Access key1 to make it most recently used
      optimizer.get('key1');

      // Add key11, should evict key2 (the oldest/LRU)
      optimizer.set('key11', 'value11');

      expect(optimizer.get('key1')).toBe('value1');
      expect(optimizer.get('key2')).toBeNull();
      expect(optimizer.get('key11')).toBe('value11');
    });

    it('should be significantly faster for many sequential writes (LRU O(1))', () => {
      const largeOptimizer = new PerformanceOptimizer({
        cache: { maxSize: 1000, strategy: 'LRU' },
        monitoring: { metricsInterval: 999999 }
      });

      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        largeOptimizer.set(`key-${i}`, i);
      }
      const end = performance.now();
      const duration = end - start;

      // Previously this would take > 500ms due to O(n) search on every set after 1000.
      // Now it should be very fast (< 100ms)
      expect(duration).toBeLessThan(200);
      largeOptimizer.cleanup();
    });

    it('should calculate cache hit rate in O(1)', () => {
      optimizer.set('hit', 'value');
      optimizer.get('hit'); // hit
      optimizer.get('miss'); // miss

      // @ts-ignore
      optimizer.updateMetrics();
      const metrics = optimizer.getMetrics();

      // 1 hit out of 2 accesses = 0.5
      expect(metrics.cacheHitRate).toBe(0.5);
    });
  });
});
