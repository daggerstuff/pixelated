import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock build-safe-logger
vi.mock('../../logging/build-safe-logger', () => ({
  createBuildSafeLogger: () => ({
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  }),
}))

// Mock ciphertext factory - returns object with save() method
const mockCiphertext = (data: number[]) => ({
  serialized: `enc_${data.join(',')}`,
  data,
  save: () => `enc_${data.join(',')}`,
})

// Mock SealService
const mockSealService = {
  encrypt: (data: number[]) => mockCiphertext(data),
  decrypt: (ct: { data: number[] }) => ct.data,
  hasKeys: () => true,
  isInitialized: () => true,
  initialize: () => Promise.resolve(),
  generateKeys: () => Promise.resolve(),
  getSchemeType: () => 'bfv',
  getBatchEncoder: () => ({ slotCount: 4096 }),
  getCKKSEncoder: () => ({ slotCount: 4096 }),
  getSlotCount: () => 4096,
}

vi.mock('../seal-service', () => ({
  SealService: {
    getInstance: () => mockSealService,
  },
}))

// Mock SealOperations as a class (code calls `new SealOperations(sealService)`)
vi.mock('../seal-operations', () => ({
  SealOperations: class {
    constructor(_sealService: unknown) {}
    // All methods return SealOperationResult { success, result } shape
    // result is the first arg (ciphertext) so chaining works
    async add(a: unknown, _b: unknown) {
      return { success: true, result: a, operation: 'addition' }
    }
    async multiply(a: unknown, _b: unknown) {
      return { success: true, result: a, operation: 'multiplication' }
    }
    async rotate(a: unknown, _steps: number) {
      return { success: true, result: a, operation: 'rotation' }
    }
    async square(a: unknown) {
      return { success: true, result: a, operation: 'square' }
    }
    async negate(a: unknown) {
      return { success: true, result: a, operation: 'negation' }
    }
    async subtract(a: unknown, _b: unknown) {
      return { success: true, result: a, operation: 'subtraction' }
    }
    async polynomial(a: unknown, _coeffs: unknown) {
      return { success: true, result: a, operation: 'polynomial' }
    }
  },
}))

// Mock SealResourceScope
vi.mock('../seal-memory', () => ({
  SealResourceScope: class {
    dispose() {}
  },
}))

import { EncryptedTextProcessor } from '../encrypted-text-processor'

describe('EncryptedTextProcessor', () => {
  let processor: EncryptedTextProcessor

  beforeEach(() => {
    EncryptedTextProcessor.reset()
    processor = EncryptedTextProcessor.getInstance()
  })

  describe('Sentiment', () => {
    it('should return encrypted sentiment score', async () => {
      const result = await processor.encryptedSentiment('I am happy and joyful today')
      expect(result.operation).toBe('sentiment')
      expect(result.fullyHomomorphic).toBe(true)
      expect(result.result).toBeDefined()
      expect(result.metadata.plaintextFallback).toBe(false)
    })

    it('should handle negative sentiment text', async () => {
      const result = await processor.encryptedSentiment('I am sad and angry')
      expect(result.operation).toBe('sentiment')
      expect(result.fullyHomomorphic).toBe(true)
    })

    it('should handle empty text', async () => {
      const result = await processor.encryptedSentiment('')
      expect(result.operation).toBe('sentiment')
      expect(result.fullyHomomorphic).toBe(true)
    })
  })

  describe('Categorize', () => {
    it('should return encrypted category scores', async () => {
      const result = await processor.encryptedCategorize(
        'I feel anxious about the future',
      )
      expect(result.operation).toBe('categorize')
      expect(result.fullyHomomorphic).toBe(true)
      expect(result.result).toBeDefined()
    })
  })

  describe('Word Count', () => {
    it('should return encrypted word count', async () => {
      const result = await processor.encryptedWordCount('one two three four five')
      expect(result.operation).toBe('word_count')
      expect(result.fullyHomomorphic).toBe(true)
    })
  })

  describe('Character Count', () => {
    it('should return encrypted character count', async () => {
      const result = await processor.encryptedCharacterCount('hello world')
      expect(result.operation).toBe('character_count')
      expect(result.fullyHomomorphic).toBe(true)
    })
  })

  describe('Keyword Density', () => {
    it('should return encrypted keyword density pair', async () => {
      const result = await processor.encryptedKeywordDensity(
        'happy sad happy joy happy',
        ['happy', 'joy'],
      )
      expect(result.operation).toBe('keyword_density')
      expect(result.fullyHomomorphic).toBe(true)
    })
  })

  describe('Tokenize', () => {
    it('should return encrypted token statistics', async () => {
      const result = await processor.encryptedTokenize('hello world test')
      expect(result.operation).toBe('tokenize')
      expect(result.fullyHomomorphic).toBe(true)
    })
  })

  describe('Filter', () => {
    it('should return encrypted match count', async () => {
      const result = await processor.encryptedFilter('anxiety depression stress', [
        'anxiety',
      ])
      expect(result.operation).toBe('filter')
      expect(result.fullyHomomorphic).toBe(true)
    })
  })

  describe('Summarize', () => {
    it('should return encrypted sentence scores', async () => {
      const result = await processor.encryptedSummarize(
        'First sentence. Second sentence here. Third one.',
        50,
      )
      expect(result.operation).toBe('summarize')
      expect(result.fullyHomomorphic).toBe(true)
    })
  })

  describe('Reading Level', () => {
    it('should return encrypted reading level metrics', async () => {
      const result = await processor.encryptedReadingLevel(
        'The cat sat on the mat. It was a sunny day.',
      )
      expect(result.operation).toBe('reading_level')
      expect(result.fullyHomomorphic).toBe(true)
    })
  })

  describe('Supported Operations', () => {
    it('should list all 9 operations', () => {
      const ops = processor.getSupportedOperations()
      expect(ops).toHaveLength(9)
      expect(ops).toContain('sentiment')
      expect(ops).toContain('categorize')
      expect(ops).toContain('word_count')
      expect(ops).toContain('character_count')
      expect(ops).toContain('keyword_density')
      expect(ops).toContain('tokenize')
      expect(ops).toContain('filter')
      expect(ops).toContain('summarize')
      expect(ops).toContain('reading_level')
    })
  })

  describe('Availability', () => {
    it('should check isAvailable', () => {
      const available = processor.isAvailable()
      expect(typeof available).toBe('boolean')
    })
  })
})
