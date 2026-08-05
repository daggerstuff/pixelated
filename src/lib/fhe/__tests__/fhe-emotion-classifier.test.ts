import { describe, expect, it, beforeAll, vi } from 'vitest'

import {
  FHEEmotionClassifier,
  createEmotionClassifierFHEService,
} from '../fhe-emotion-classifier'
import { getMockFHEService } from '../mock/mock-fhe-service'
import type { FHEService } from '../types'

describe('FHEEmotionClassifier', () => {
  let classifier: FHEEmotionClassifier

  beforeAll(async () => {
    const mockSvc = getMockFHEService()
    await mockSvc.initialize()
    classifier = createEmotionClassifierFHEService(mockSvc)
  })

  it('should classify a single text', async () => {
    const result = await classifier.classify('I am very happy today!')
    expect(result).toBeDefined()
    expect(result.categories).toBeInstanceOf(Array)
    expect(result.valence).toBeGreaterThan(0)
    expect(result.arousal).toBeGreaterThan(0)
    expect(result.dominance).toBeGreaterThan(0)
  })

  it('should classify batch of texts', async () => {
    const texts = [
      'I am very happy today!',
      'I am very sad today!',
      'I am very angry today!',
    ]
    const results = await classifier.classifyBatch(texts)
    expect(results).toHaveLength(3)
    for (const result of results) {
      expect(result.categories).toBeInstanceOf(Array)
      expect(result.valence).toBeGreaterThanOrEqual(0)
      expect(result.valence).toBeLessThanOrEqual(1)
    }
  })

  it('should compute session trajectory', async () => {
    const texts = [
      'I am very happy today!',
      'I am a bit sad now.',
      'I am very angry today!',
    ]
    const results = await classifier.classifyBatch(texts)
    const trajectory = classifier.sessionTrajectory(results)
    expect(trajectory).toBeDefined()
    expect(trajectory.startValence).toBeDefined()
    expect(trajectory.endValence).toBeDefined()
    expect(trajectory.trend).toBeDefined()
  })

  it('should handle empty text', async () => {
    const result = await classifier.classify('')
    expect(result).toBeDefined()
    expect(result.categories).toBeInstanceOf(Array)
  })

  it('should classify with multiLabel=false', async () => {
    const result = await classifier.classify('I am very happy today!', false)
    expect(result).toBeDefined()
    expect(result.categories).toBeInstanceOf(Array)
  })
})

describe('FHEEmotionClassifier error paths', () => {
  it('should throw when FHE service lacks processEncrypted', async () => {
    const badService = {
      encrypt: vi.fn(),
      decrypt: vi.fn(),
      // intentionally missing processEncrypted
    } as unknown as FHEService
    const c = createEmotionClassifierFHEService(badService)
    await expect(c.classify('hello')).rejects.toThrow(
      'does not support encrypted processing',
    )
  })

  it('should throw when processEncrypted returns error result', async () => {
    const errSvc = {
      encrypt: vi.fn(),
      decrypt: vi.fn(),
      processEncrypted: vi.fn().mockResolvedValue({
        success: false,
        error: 'Simulated FHE failure',
        operation: 'emotion_classify',
      }),
    } as unknown as FHEService
    const c = createEmotionClassifierFHEService(errSvc)
    await expect(c.classify('hello')).rejects.toThrow('Simulated FHE failure')
  })

  it('should throw when processEncrypted result has malformed JSON', async () => {
    const errSvc = {
      encrypt: vi.fn(),
      decrypt: vi.fn(),
      processEncrypted: vi.fn().mockResolvedValue({
        success: true,
        result: 'not-valid-json{{{',
        operation: 'emotion_classify',
      }),
    } as unknown as FHEService
    const c = createEmotionClassifierFHEService(errSvc)
    await expect(c.classify('hello')).rejects.toThrow('invalid result format')
  })

  it('should throw when decrypted result is corrupted', async () => {
    const errSvc = {
      encrypt: vi.fn(),
      decrypt: vi.fn(),
      processEncrypted: vi.fn().mockResolvedValue({
        success: true,
        result: JSON.stringify({
          id: 'test',
          data: '{bad json',
          mockEncrypted: true,
        }),
        operation: 'emotion_classify',
      }),
    } as unknown as FHEService
    const c = createEmotionClassifierFHEService(errSvc)
    await expect(c.classify('hello')).rejects.toThrow('corrupted result')
  })

  it('should truncate batch exceeding BATCH_SIZE_LIMIT', async () => {
    const mockSvc = getMockFHEService()
    await mockSvc.initialize()
    const c = createEmotionClassifierFHEService(mockSvc)
    const longBatch = Array.from({ length: 60 }, () => 'I am happy')
    const results = await c.classifyBatch(longBatch)
    expect(results).toHaveLength(50)
  })

  it('should return empty array for empty batch', async () => {
    const mockSvc = getMockFHEService()
    await mockSvc.initialize()
    const c = createEmotionClassifierFHEService(mockSvc)
    const results = await c.classifyBatch([])
    expect(results).toHaveLength(0)
  })

  describe('encryptBatch and decryptBatch', () => {
    it('should encrypt and decrypt batch of values correctly', async () => {
      const mockSvc = getMockFHEService()
      await mockSvc.initialize()

      const values = ['hello', 'world', 42, true, { test: 'value' }, [1, 2, 3]]
      const encrypted = await mockSvc.encryptBatch(values)
      expect(encrypted).toHaveLength(values.length)

      // Check that each encrypted item has the expected structure
      for (const enc of encrypted) {
        expect(enc).toHaveProperty('id')
        expect(enc).toHaveProperty('data')
        expect(enc).toHaveProperty('dataType')
        expect(enc).toHaveProperty('metadata')
      }

      // Decrypt and verify values
      const decrypted = await mockSvc.decryptBatch(encrypted)
      expect(decrypted).toEqual(values)
    })

    it('should handle empty arrays', async () => {
      const mockSvc = getMockFHEService()
      await mockSvc.initialize()

      const encrypted = await mockSvc.encryptBatch([])
      expect(encrypted).toHaveLength(0)

      const decrypted = await mockSvc.decryptBatch([])
      expect(decrypted).toHaveLength(0)
    })
  })
})
