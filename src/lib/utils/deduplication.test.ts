import { describe, expect, it, vi } from 'vitest'

import {
  BLOOM_FILTER_THRESHOLD,
  BloomFilter,
  BloomFilterDeduplication,
  HybridDeduplication,
  SetDeduplication,
} from './deduplication'

describe('BloomFilter', () => {
  it('should add and check items', () => {
    const filter = new BloomFilter(1000)

    filter.add('item1')
    filter.add('item2')
    filter.add('item3')

    expect(filter.mightContain('item1')).toBe(true)
    expect(filter.mightContain('item2')).toBe(true)
    expect(filter.mightContain('item3')).toBe(true)
  })

  it('should return false for non-existent items (most of the time)', () => {
    const filter = new BloomFilter(1000)

    filter.add('exists1')
    filter.add('exists2')

    // Test many non-existent items - with 1% FPR, very unlikely all return true
    let falsePositives = 0
    for (let i = 0; i < 100; i++) {
      if (filter.mightContain(`nonexistent-${i}`)) {
        falsePositives++
      }
    }

    // Should have very few false positives (1% FPR means ~1 out of 100)
    expect(falsePositives).toBeLessThan(10)
  })

  it('should calculate byte size based on expected items', () => {
    const small = new BloomFilter(100)
    const large = new BloomFilter(10000)

    expect(large.getByteSize()).toBeGreaterThan(small.getByteSize())
  })

  it('should handle empty filter', () => {
    const filter = new BloomFilter(100)

    expect(filter.mightContain('anything')).toBe(false)
  })
})

describe('SetDeduplication', () => {
  it('should track unique items exactly', () => {
    const dedup = new SetDeduplication()

    expect(dedup.has('id1')).toBe(false)
    dedup.add('id1')
    expect(dedup.has('id1')).toBe(true)

    expect(dedup.has('id2')).toBe(false)
    dedup.add('id2')
    expect(dedup.has('id2')).toBe(true)
  })

  it('should track size correctly', () => {
    const dedup = new SetDeduplication()

    expect(dedup.size()).toBe(0)

    dedup.add('id1')
    expect(dedup.size()).toBe(1)

    dedup.add('id2')
    expect(dedup.size()).toBe(2)

    // Adding same ID again shouldn't increase size
    dedup.add('id1')
    expect(dedup.size()).toBe(2)
  })

  it('should report memory usage', () => {
    const dedup = new SetDeduplication()

    expect(dedup.getMemoryUsage()).toBe('0 entries in Set')

    dedup.add('id1')
    dedup.add('id2')
    expect(dedup.getMemoryUsage()).toBe('2 entries in Set')
  })

  it('should expose seenIds for migration', () => {
    const dedup = new SetDeduplication()

    dedup.add('id1')
    dedup.add('id2')
    dedup.add('id3')

    const seenIds = dedup.getSeenIds()
    expect(seenIds.size).toBe(3)
    expect(seenIds.has('id1')).toBe(true)
    expect(seenIds.has('id2')).toBe(true)
    expect(seenIds.has('id3')).toBe(true)
  })
})

describe('BloomFilterDeduplication', () => {
  it('should track items with Bloom filter', () => {
    const dedup = new BloomFilterDeduplication(1000)

    expect(dedup.has('id1')).toBe(false)
    dedup.add('id1')
    expect(dedup.has('id1')).toBe(true)
  })

  it('should track itemCount', () => {
    const dedup = new BloomFilterDeduplication(1000)

    expect(dedup.size()).toBe(0)

    dedup.add('id1')
    expect(dedup.size()).toBe(1)

    dedup.add('id2')
    expect(dedup.size()).toBe(2)

    // Bloom filter doesn't detect duplicates, so this increments
    dedup.add('id1')
    expect(dedup.size()).toBe(3)
  })

  it('should report memory usage', () => {
    const dedup = new BloomFilterDeduplication(10000)

    const usage = dedup.getMemoryUsage()
    expect(usage).toMatch(/MB Bloom filter/)
  })

  it('should track capacity', () => {
    const dedup = new BloomFilterDeduplication(100)

    expect(dedup.getCapacity()).toBe(100)
  })

  it('should detect when near capacity', () => {
    const dedup = new BloomFilterDeduplication(100)

    expect(dedup.isNearCapacity(0.8)).toBe(false)

    // Add 90 items (> 80% of 100)
    for (let i = 0; i < 90; i++) {
      dedup.add(`id-${i}`)
    }

    expect(dedup.isNearCapacity(0.8)).toBe(true)
    expect(dedup.isNearCapacity(0.95)).toBe(false)
  })
})

describe('HybridDeduplication', () => {
  it('should use Set for small datasets', () => {
    const dedup = new HybridDeduplication(10)

    expect(dedup.isExact()).toBe(true)

    dedup.add('id1')
    dedup.add('id2')

    expect(dedup.has('id1')).toBe(true)
    expect(dedup.has('id2')).toBe(true)
    expect(dedup.has('id3')).toBe(false)
    expect(dedup.isExact()).toBe(true)
  })

  it('should switch to Bloom filter at threshold', () => {
    const dedup = new HybridDeduplication(5)

    // Add items below threshold
    for (let i = 0; i < 4; i++) {
      dedup.add(`id-${i}`)
    }
    expect(dedup.isExact()).toBe(true)

    // Add one more to trigger switch
    dedup.add('id-trigger')
    expect(dedup.isExact()).toBe(false)
    expect(dedup.getEstimatedCapacity()).toBe(50) // threshold * 10
  })

  it('should migrate existing IDs when switching to Bloom', () => {
    const dedup = new HybridDeduplication(3)

    // Add some IDs before switch
    dedup.add('pre-switch-1')
    dedup.add('pre-switch-2')
    expect(dedup.has('pre-switch-1')).toBe(true)
    expect(dedup.has('pre-switch-2')).toBe(true)

    // Trigger switch
    dedup.add('trigger-switch')

    // Pre-switch IDs should still be detected
    expect(dedup.has('pre-switch-1')).toBe(true)
    expect(dedup.has('pre-switch-2')).toBe(true)
    expect(dedup.has('trigger-switch')).toBe(true)

    // New IDs should work
    dedup.add('post-switch-1')
    expect(dedup.has('post-switch-1')).toBe(true)
  })

  it('should track uniqueCount correctly through transition', () => {
    const dedup = new HybridDeduplication(3)

    // Add 5 unique items (triggers switch at 3)
    dedup.add('id1')
    dedup.add('id2')
    dedup.add('id3') // Triggers switch
    dedup.add('id4')
    dedup.add('id5')

    expect(dedup.size()).toBe(5)
  })

  it('should handle duplicate detection before switch', () => {
    const dedup = new HybridDeduplication(100)

    dedup.add('unique1')
    dedup.add('unique2')
    dedup.add('unique1') // Duplicate

    // uniqueCount only increments for new items
    expect(dedup.size()).toBe(2)
  })

  it('should call onCapacityWarning when approaching capacity', () => {
    const warningFn = vi.fn()
    const dedup = new HybridDeduplication(5, { onCapacityWarning: warningFn })

    // Trigger switch to Bloom
    for (let i = 0; i < 6; i++) {
      dedup.add(`id-${i}`)
    }
    expect(dedup.isExact()).toBe(false)

    // Add items to reach 80% of estimated capacity (50 * 0.8 = 40)
    for (let i = 6; i < 45; i++) {
      dedup.add(`id-${i}`)
    }

    expect(warningFn).toHaveBeenCalled()
    expect(warningFn.mock.calls[0][0]).toContain('approaching capacity')
  })

  it('should report memory usage correctly', () => {
    const dedup = new HybridDeduplication(100)

    // Before switch
    const beforeUsage = dedup.getMemoryUsage()
    expect(beforeUsage).toContain('entries in Set')

    // Trigger switch
    for (let i = 0; i < 101; i++) {
      dedup.add(`id-${i}`)
    }

    // After switch
    const afterUsage = dedup.getMemoryUsage()
    expect(afterUsage).toContain('MB Bloom filter')
    expect(afterUsage).toContain('unique items')
  })

  it('should use default threshold constant', () => {
    const dedup = new HybridDeduplication()
    expect(dedup.isExact()).toBe(true)

    // Default threshold is BLOOM_FILTER_THRESHOLD (500000)
    // We won't test actual switch for performance reasons
    expect(BLOOM_FILTER_THRESHOLD).toBe(500000)
  })
})
