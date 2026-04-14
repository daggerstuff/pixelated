const BLOOM_FILTER_DEFAULT_THRESHOLD = 500000
const BLOOM_FILTER_DEFAULT_FPR = 0.01

export class BloomFilter {
  private size: number
  private hashCount: number
  private bitArray: Uint8Array

  constructor(
    expectedItems: number,
    falsePositiveRate: number = BLOOM_FILTER_DEFAULT_FPR,
  ) {
    this.size = Math.ceil(
      (-expectedItems * Math.log(falsePositiveRate)) / Math.pow(Math.log(2), 2),
    )
    this.hashCount = Math.ceil((this.size / expectedItems) * Math.log(2))
    this.bitArray = new Uint8Array(Math.ceil(this.size / 8))
  }

  private hash(item: string, seed: number): number {
    let hash = seed
    for (let i = 0; i < item.length; i++) {
      hash = (hash * 31 + item.charCodeAt(i)) >>> 0
    }
    return hash % this.size
  }

  add(item: string): void {
    for (let i = 0; i < this.hashCount; i++) {
      const index = this.hash(item, i)
      const byteIndex = Math.floor(index / 8)
      const bitIndex = index % 8
      this.bitArray[byteIndex] |= 1 << bitIndex
    }
  }

  mightContain(item: string): boolean {
    for (let i = 0; i < this.hashCount; i++) {
      const index = this.hash(item, i)
      const byteIndex = Math.floor(index / 8)
      const bitIndex = index % 8
      if ((this.bitArray[byteIndex] & (1 << bitIndex)) === 0) {
        return false
      }
    }
    return true
  }

  getByteSize(): number {
    return this.bitArray.length
  }
}

export interface DeduplicationStrategy {
  has(id: string): boolean
  add(id: string): void
  size(): number
  getMemoryUsage(): string
}

export class SetDeduplication implements DeduplicationStrategy {
  private _seenIds = new Set<string>()

  has(id: string): boolean {
    return this._seenIds.has(id)
  }

  add(id: string): void {
    this._seenIds.add(id)
  }

  size(): number {
    return this._seenIds.size
  }

  getMemoryUsage(): string {
    return `${this._seenIds.size.toLocaleString()} entries in Set`
  }

  getSeenIds(): Set<string> {
    return this._seenIds
  }
}

export class BloomFilterDeduplication implements DeduplicationStrategy {
  private bloomFilter: BloomFilter
  private itemCount: number = 0
  private capacity: number

  constructor(expectedItems: number) {
    this.bloomFilter = new BloomFilter(expectedItems)
    this.capacity = expectedItems
  }

  has(id: string): boolean {
    return this.bloomFilter.mightContain(id)
  }

  add(id: string): void {
    this.bloomFilter.add(id)
    this.itemCount++
  }

  size(): number {
    return this.itemCount
  }

  getMemoryUsage(): string {
    return `${(this.bloomFilter.getByteSize() / 1024 / 1024).toFixed(2)} MB Bloom filter`
  }

  getCapacity(): number {
    return this.capacity
  }

  isNearCapacity(threshold: number = 0.8): boolean {
    return this.itemCount / this.capacity > threshold
  }
}

export class HybridDeduplication implements DeduplicationStrategy {
  private setDedup: SetDeduplication | null = null
  private bloomDedup: BloomFilterDeduplication | null = null
  private switchedToBloom = false
  private threshold: number
  private uniqueCount: number = 0
  private estimatedCapacity: number = 0
  private onCapacityWarning?: (message: string) => void

  constructor(
    threshold: number = BLOOM_FILTER_DEFAULT_THRESHOLD,
    options?: { onCapacityWarning?: (message: string) => void },
  ) {
    this.setDedup = new SetDeduplication()
    this.threshold = threshold
    this.onCapacityWarning = options?.onCapacityWarning
  }

  has(id: string): boolean {
    if (this.switchedToBloom && this.bloomDedup) {
      return this.bloomDedup.has(id)
    }
    return this.setDedup?.has(id) ?? false
  }

  add(id: string): void {
    if (this.switchedToBloom && this.bloomDedup) {
      this.bloomDedup.add(id)
      this.uniqueCount++

      if (this.bloomDedup.isNearCapacity(0.8) && this.onCapacityWarning) {
        this.onCapacityWarning(
          `Bloom filter approaching capacity (${this.uniqueCount.toLocaleString()}/${this.estimatedCapacity.toLocaleString()}). ` +
            `False positive rate may increase. Consider increasing estimatedCapacity parameter.`,
        )
      }
      return
    }

    if (this.setDedup) {
      if (!this.setDedup.has(id)) {
        this.uniqueCount++
      }
      this.setDedup.add(id)
    }

    if (
      !this.switchedToBloom &&
      this.setDedup &&
      this.setDedup.size() >= this.threshold
    ) {
      this.switchedToBloom = true
      this.estimatedCapacity = this.threshold * 10
      this.bloomDedup = new BloomFilterDeduplication(this.estimatedCapacity)

      for (const existingId of this.setDedup.getSeenIds()) {
        this.bloomDedup.add(existingId)
      }

      this.setDedup = null
    }
  }

  size(): number {
    return this.uniqueCount
  }

  getMemoryUsage(): string {
    if (this.switchedToBloom && this.bloomDedup) {
      return `${this.bloomDedup.getMemoryUsage()} (estimating ~${Math.round(this.uniqueCount * 0.99).toLocaleString()} unique items at 1% FPR)`
    }
    return this.setDedup?.getMemoryUsage() ?? '0 entries'
  }

  isExact(): boolean {
    return !this.switchedToBloom
  }

  getEstimatedCapacity(): number {
    return this.estimatedCapacity
  }
}

export const BLOOM_FILTER_THRESHOLD = BLOOM_FILTER_DEFAULT_THRESHOLD
