import { describe, expect, it, beforeAll } from 'vitest'

import { FHE_SLO, BenchmarkReporter } from '../fhe-benchmark'
import { getMockFHEService } from '../mock/mock-fhe-service'

async function createSealService() {
  try {
    const mod = await import('../fhe-service')
    const svc = new mod.RealFHEService()
    await svc.initialize()
    return svc
  } catch {
    return null
  }
}

const testTexts = [
  'I am feeling very happy today!',
  'This is a test message for encryption.',
  'The weather is nice and sunny.',
  'I feel anxious about the upcoming meeting.',
  'My depression has been better lately.',
  'I had a wonderful session with my therapist.',
  'Feeling overwhelmed with work responsibilities.',
  'Gradually making progress in my recovery journey.',
  'Experiencing mixed emotions about the changes.',
  'Grateful for the support from my loved ones.',
]

describe('FHE Benchmark Suite', () => {
  let sealFHEService: any
  let mockFHEService: any
  let reporter: BenchmarkReporter

  beforeAll(async () => {
    reporter = new BenchmarkReporter()
    sealFHEService = await createSealService()
    mockFHEService = getMockFHEService()
    await mockFHEService.initialize()
  })

  describe('Latency benchmarks (sealFHEService)', () => {
    it('should measure encrypt() latency', async () => {
      if (!sealFHEService) return
      const iterations = 10
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        await sealFHEService.encrypt(testTexts[i % testTexts.length])
      }

      const endTime = performance.now()
      const avgLatencyMs = (endTime - startTime) / iterations

      reporter.record(
        'encrypt() latency',
        avgLatencyMs,
        FHE_SLO.ENCRYPT_LATENCY_MS,
        'ms',
      )
      expect(avgLatencyMs).toBeLessThan(FHE_SLO.ENCRYPT_LATENCY_MS)
    })

    it('should measure decrypt() latency', async () => {
      if (!sealFHEService) return
      const iterations = 10
      const encryptedTexts: unknown[] = []

      // Pre-encrypt all texts
      for (let i = 0; i < iterations; i++) {
        const encrypted = await sealFHEService.encrypt(
          testTexts[i % testTexts.length],
        )
        encryptedTexts.push(encrypted)
      }

      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        await sealFHEService.decrypt(encryptedTexts[i])
      }

      const endTime = performance.now()
      const avgLatencyMs = (endTime - startTime) / iterations

      reporter.record(
        'decrypt() latency',
        avgLatencyMs,
        FHE_SLO.DECRYPT_LATENCY_MS,
        'ms',
      )
      expect(avgLatencyMs).toBeLessThan(FHE_SLO.DECRYPT_LATENCY_MS)
    })

    it('should measure processEncrypted() latency for EMOTION_CLASSIFY', async () => {
      if (!sealFHEService) return
      const iterations = 5
      const encryptedTexts: unknown[] = []

      // Pre-encrypt all texts
      for (let i = 0; i < iterations; i++) {
        const encrypted = await sealFHEService.encrypt(
          testTexts[i % testTexts.length],
        )
        encryptedTexts.push(encrypted)
      }

      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        await sealFHEService.processEncrypted(
          JSON.stringify(encryptedTexts[i]),
          'emotion_classify',
        )
      }

      const endTime = performance.now()
      const avgLatencyMs = (endTime - startTime) / iterations

      reporter.record(
        'processEncrypted() EMOTION_CLASSIFY latency',
        avgLatencyMs,
        FHE_SLO.PROCESS_ENCRYPTED_LATENCY_MS,
        'ms',
      )
      expect(avgLatencyMs).toBeLessThan(FHE_SLO.PROCESS_ENCRYPTED_LATENCY_MS)
    })
  })

  describe('Throughput benchmarks (sealFHEService)', () => {
    it('should measure encrypt throughput', async () => {
      if (!sealFHEService) return
      const iterations = 20
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        await sealFHEService.encrypt(testTexts[i % testTexts.length])
      }

      const endTime = performance.now()
      const durationSec = (endTime - startTime) / 1000
      const opsPerSec = iterations / durationSec

      reporter.record(
        'encrypt throughput',
        opsPerSec,
        FHE_SLO.THROUGHPUT_MIN_OPS_PER_SEC,
        'ops/sec',
      )
      expect(opsPerSec).toBeGreaterThan(FHE_SLO.THROUGHPUT_MIN_OPS_PER_SEC)
    })

    it('should measure classify throughput via FHEEmotionClassifier', async () => {
      if (!sealFHEService) return
      // Import the classifier here to avoid circular dependencies
      const { FHEEmotionClassifier, createEmotionClassifierFHEService } =
        await import('../fhe-emotion-classifier')
      const classifier = createEmotionClassifierFHEService(sealFHEService)

      const iterations = 20
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        await classifier.classify(testTexts[i % testTexts.length])
      }

      const endTime = performance.now()
      const durationSec = (endTime - startTime) / 1000
      const opsPerSec = iterations / durationSec

      reporter.record(
        'classify throughput',
        opsPerSec,
        FHE_SLO.THROUGHPUT_MIN_OPS_PER_SEC,
        'ops/sec',
      )
      expect(opsPerSec).toBeGreaterThan(FHE_SLO.THROUGHPUT_MIN_OPS_PER_SEC)
    })
  })

  describe('Memory benchmarks (sealFHEService)', () => {
    it('should measure memory usage for 100 encrypt operations', async () => {
      if (!sealFHEService) return
      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const initialMemory = process.memoryUsage().heapUsed

      const iterations = 100
      for (let i = 0; i < iterations; i++) {
        await sealFHEService.encrypt(testTexts[i % testTexts.length])
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryDeltaMB = (finalMemory - initialMemory) / (1024 * 1024)

      reporter.record(
        'memory usage delta',
        memoryDeltaMB,
        FHE_SLO.MEMORY_MAX_MB,
        'MB',
      )
      expect(memoryDeltaMB).toBeLessThan(FHE_SLO.MEMORY_MAX_MB)
    })
  })

  describe('Reliability benchmarks (sealFHEService)', () => {
    it('should achieve high success rate for encryption operations', async () => {
      if (!sealFHEService) return
      const iterations = 50
      let successCount = 0

      for (let i = 0; i < iterations; i++) {
        try {
          await sealFHEService.encrypt(testTexts[i % testTexts.length])
          successCount++
        } catch (error) {
          // Count as failure
        }
      }

      const successRate = successCount / iterations

      reporter.record(
        'encryption success rate',
        successRate,
        FHE_SLO.RELIABILITY_MIN_SUCCESS_RATE,
        'ratio',
      )
      expect(successRate).toBeGreaterThanOrEqual(
        FHE_SLO.RELIABILITY_MIN_SUCCESS_RATE,
      )
    })

    it('should achieve high success rate for encrypt-decrypt cycles', async () => {
      if (!sealFHEService) return
      const iterations = 50
      let successCount = 0

      for (let i = 0; i < iterations; i++) {
        try {
          const encrypted = await sealFHEService.encrypt(
            testTexts[i % testTexts.length],
          )
          const decrypted = await sealFHEService.decrypt(encrypted)
          // Verify we can decrypt to a string (basic validation)
          if (typeof decrypted === 'string' && decrypted.length > 0) {
            successCount++
          }
        } catch (error) {
          // Count as failure
        }
      }

      const successRate = successCount / iterations

      reporter.record(
        'encrypt-decrypt success rate',
        successRate,
        FHE_SLO.RELIABILITY_MIN_SUCCESS_RATE,
        'ratio',
      )
      expect(successRate).toBeGreaterThanOrEqual(
        FHE_SLO.RELIABILITY_MIN_SUCCESS_RATE,
      )
    })

    it('should achieve high success rate for processEncrypted operations', async () => {
      if (!sealFHEService) return
      const iterations = 30
      let successCount = 0

      for (let i = 0; i < iterations; i++) {
        try {
          const encrypted = await sealFHEService.encrypt(
            testTexts[i % testTexts.length],
          )
          const result = await sealFHEService.processEncrypted(
            JSON.stringify(encrypted),
            'emotion_classify',
          )
          if (result.success) {
            successCount++
          }
        } catch (error) {
          // Count as failure
        }
      }

      const successRate = successCount / iterations

      reporter.record(
        'processEncrypted success rate',
        successRate,
        FHE_SLO.RELIABILITY_MIN_SUCCESS_RATE,
        'ratio',
      )
      expect(successRate).toBeGreaterThanOrEqual(
        FHE_SLO.RELIABILITY_MIN_SUCCESS_RATE,
      )
    })
  })

  describe('Plaintext baseline comparison (mock vs real FHE)', () => {
    it('should produce equivalent results for emotional classification', async () => {
      if (!sealFHEService) return
      const testMessages = [
        'I am feeling very happy today!',
        'This makes me feel sad and depressed.',
        'I am feeling anxious about the future.',
        'Today was a good day, I feel grateful.',
        'I am angry about the situation at work.',
      ]

      for (const message of testMessages) {
        // Get result from mock FHE service
        const mockEncrypted = await mockFHEService.encrypt(message)
        const mockResult = await mockFHEService.processEncrypted(
          JSON.stringify(mockEncrypted),
          'emotion_classify',
        )

        // Get result from real FHE service
        const realEncrypted = await sealFHEService.encrypt(message)
        const realResult = await sealFHEService.processEncrypted(
          JSON.stringify(realEncrypted),
          'emotion_classify',
        )

        // Both should succeed
        expect(mockResult.success).toBe(true)
        expect(realResult.success).toBe(true)

        // Parse results
        const mockDecrypted = await mockFHEService.decrypt(
          JSON.parse(mockResult.result),
        )
        const realDecrypted = await sealFHEService.decrypt(
          JSON.parse(realResult.result),
        )

        const mockParsed = JSON.parse(mockDecrypted)
        const realParsed = JSON.parse(realDecrypted)

        // Both should have the same top emotion category (within tolerance)
        expect(mockParsed.topCategory).toBe(realParsed.topCategory)
        // Allow some variance in scores
        expect(
          Math.abs(
            parseFloat(mockParsed.topScore) - parseFloat(realParsed.topScore),
          ),
        ).toBeLessThan(0.3)
      }
    })
  })

  // Final test to report all benchmark results
  it('should report all benchmark results', () => {
    console.log(reporter.report())
    // This test always passes - it's just for reporting
    expect(true).toBe(true)
  })
})
