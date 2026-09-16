/* @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// All paths resolve relative to this test file:
//   src/lib/services/__tests__/emotion-tracking.service.test.ts
//   ../ → services/, ../../ → lib/

// Stable collection mock shared across every db.collection() call
const emotionCollectionMock = {
  find: vi.fn(),
  sort: vi.fn(),
  limit: vi.fn(),
  toArray: vi.fn(),
  insertOne: vi.fn(),
}

function resetCollectionMock() {
  emotionCollectionMock.find.mockReset()
  emotionCollectionMock.sort.mockReset()
  emotionCollectionMock.limit.mockReset()
  emotionCollectionMock.toArray.mockReset()
  emotionCollectionMock.insertOne.mockReset()

  emotionCollectionMock.find.mockReturnValue(emotionCollectionMock)
  emotionCollectionMock.sort.mockReturnValue(emotionCollectionMock)
  emotionCollectionMock.limit.mockReturnValue(emotionCollectionMock)
  emotionCollectionMock.toArray.mockResolvedValue([])
  emotionCollectionMock.insertOne.mockResolvedValue({ acknowledged: true })
}

vi.mock('../../db/mongoClient', () => ({
  default: {
    get db() {
      return {
        collection: vi.fn().mockReturnValue(emotionCollectionMock),
      }
    },
  },
}))

vi.mock('../../db/ai', () => ({
  aiRepository: {
    getEmotionsForSession: vi.fn(),
  },
}))

vi.mock('../../audit', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  AuditEventType: { CREATE: 'CREATE', SECURITY: 'SECURITY' },
}))

vi.mock('../../logging/build-safe-logger', () => ({
  createBuildSafeLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('test-emotion-uuid'),
}))

import { aiRepository } from '../../db/ai'
import { createAuditLog } from '../../audit'
import {
  recordEmotion,
  fetchSessionEmotionData,
  calculateEmotionSummary,
  type EmotionDataPoint,
} from '../emotion-tracking.service'

const mockGetEmotionsForSession = aiRepository
  .getEmotionsForSession as unknown as ReturnType<typeof vi.fn>

function makeDataPoint(overrides: Partial<EmotionDataPoint> = {}): EmotionDataPoint {
  return {
    timestamp: '2026-09-16T10:00:00.000Z',
    valence: 5,
    arousal: 5,
    dominance: 5,
    ...overrides,
  }
}

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rec-1',
    sessionId: 'session-001',
    userId: 'user-001',
    timestamp: new Date('2026-09-16T10:00:00.000Z'),
    valence: 7,
    arousal: 3,
    dominance: 6,
    label: 'calm',
    source: 'user_reported',
    ...overrides,
  }
}

describe('emotion-tracking.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetCollectionMock()
    mockGetEmotionsForSession.mockResolvedValue([])
  })

  describe('recordEmotion', () => {
    it('persists the data point and returns an id', async () => {
      const result = await recordEmotion(makeDataPoint(), 'user-001', 'session-001')

      expect(result.success).toBe(true)
      expect(result.dataPointId).toBe('test-emotion-uuid')
      expect(emotionCollectionMock.insertOne).toHaveBeenCalledOnce()
    })

    it('writes an audit log entry', async () => {
      await recordEmotion(makeDataPoint(), 'user-001', 'session-001')

      expect(createAuditLog).toHaveBeenCalledExactlyOnceWith(
        'CREATE',
        'emotion_recorded',
        'user-001',
        'emotion_record',
        expect.objectContaining({
          dataPointId: 'test-emotion-uuid',
          sessionId: 'session-001',
        }),
      )
    })

    it('returns failure without throwing on insert error', async () => {
      emotionCollectionMock.insertOne.mockRejectedValueOnce(new Error('insert failed'))

      const result = await recordEmotion(makeDataPoint(), 'user-001')

      expect(result.success).toBe(false)
      expect(result.message).toContain('Failed')
      expect(result.dataPointId).toBe('')
    })
  })

  describe('fetchSessionEmotionData', () => {
    it('returns persisted records mapped to data points', async () => {
      emotionCollectionMock.toArray.mockResolvedValueOnce([makeRecord()])

      const result = await fetchSessionEmotionData('session-001')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        valence: 7,
        arousal: 3,
        dominance: 6,
        label: 'calm',
      })
      expect(result[0].timestamp).toBe('2026-09-16T10:00:00.000Z')
    })

    it('merges AI-detected analyses from the repository', async () => {
      mockGetEmotionsForSession.mockResolvedValue([
        {
          id: 'ai-1',
          sessionId: 'session-001',
          timestamp: '2026-09-16T11:00:00.000Z',
          emotions: { joy: 0.8, sadness: 0.1, anger: 0, fear: 0, surprise: 0, disgust: 0, trust: 0.2, anticipation: 0.1 },
          dimensions: { valence: 0.6, arousal: 0.4, dominance: -0.2 },
          confidence: 0.9,
        },
      ])

      const result = await fetchSessionEmotionData('session-001')

      expect(mockGetEmotionsForSession).toHaveBeenCalledWith('session-001')
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        valence: 8,
        arousal: 4,
        dominance: 4,
      })
    })

    it('continues with only persisted records if AI merge fails', async () => {
      emotionCollectionMock.toArray.mockResolvedValueOnce([makeRecord({ label: undefined })])
      mockGetEmotionsForSession.mockRejectedValue(new Error('db down'))

      const result = await fetchSessionEmotionData('session-001')

      expect(result).toHaveLength(1)
      expect(result[0].valence).toBe(7)
    })

    it('applies time range filter in the mongo query', async () => {
      const start = new Date('2026-09-01T00:00:00.000Z')
      const end = new Date('2026-09-15T00:00:00.000Z')
      await fetchSessionEmotionData('session-001', { timeRange: [start, end] })

      expect(emotionCollectionMock.find).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-001',
          timestamp: { $gte: start, $lte: end },
        }),
      )
    })

    it('applies limit when specified', async () => {
      await fetchSessionEmotionData('session-001', { limit: 10 })

      expect(emotionCollectionMock.limit).toHaveBeenCalledWith(10)
    })

    it('returns empty array on query error', async () => {
      emotionCollectionMock.toArray.mockRejectedValueOnce(new Error('query failed'))

      const result = await fetchSessionEmotionData('session-001')

      expect(result).toEqual([])
    })
  })

  describe('calculateEmotionSummary', () => {
    it('returns zeros for empty data', () => {
      const summary = calculateEmotionSummary([])

      expect(summary.averageValence).toBe(0)
      expect(summary.peaks).toEqual([])
    })

    it('computes averages and variances', () => {
      const data = [
        makeDataPoint({ valence: 2, arousal: 4, dominance: 6 }),
        makeDataPoint({ valence: 4, arousal: 6, dominance: 8 }),
      ]

      const summary = calculateEmotionSummary(data)

      expect(summary.averageValence).toBe(3)
      expect(summary.averageArousal).toBe(5)
      expect(summary.averageDominance).toBe(7)
      expect(summary.varianceValence).toBe(1)
    })

    it('detects peaks 1.5 std above mean', () => {
      const data = [
        makeDataPoint({ valence: 5, arousal: 5, dominance: 5 }),
        makeDataPoint({ valence: 5, arousal: 5, dominance: 5 }),
        makeDataPoint({ valence: 5, arousal: 5, dominance: 5 }),
        makeDataPoint({ valence: 10, arousal: 5, dominance: 5 }),
      ]

      const summary = calculateEmotionSummary(data)

      expect(summary.peaks.length).toBeGreaterThan(0)
      expect(summary.peaks.some((p) => p.dimension === 'valence')).toBe(true)
    })
  })
})
