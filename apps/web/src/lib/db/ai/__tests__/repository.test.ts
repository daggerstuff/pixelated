/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  collection: vi.fn(),
}))

const fakeDb = {
  collection: mocks.collection,
}

vi.mock('../../../../config/mongodb.config', () => ({
  default: {
    connect: vi.fn(async () => fakeDb),
    getDb: mocks.getDb,
  },
}))

import { AIRepository } from '../repository'

describe('AIRepository.getUsageStats', () => {
  let repository: AIRepository
  let pipeline: unknown[]
  let collectionMock: { aggregate: (p: unknown[]) => { toArray: () => Promise<unknown[]> } }

  const makeCollection = (rows: unknown[]) => ({
    aggregate: (p: unknown[]) => {
      pipeline = p
      return { toArray: async () => rows }
    },
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    pipeline = []
    mocks.getDb.mockReturnValue(fakeDb)
    collectionMock = makeCollection([])
    mocks.collection.mockImplementation((name: string) => (name === 'ai_response_generation' ? collectionMock : {}))
    repository = new AIRepository()
    // The repository module wires its mongodb bridge in a fire-and-forget
    // module-load IIFE; flush it (a real call resolves once the bridge lands).
    await vi.waitFor(async () => {
      await repository.getUsageStats({})
    }, { timeout: 2000 })
  })

  it('aggregates all users over an explicit time window', async () => {
    const since = new Date('2026-01-01T00:00:00Z')
    const until = new Date('2026-01-15T00:00:00Z')
    collectionMock = makeCollection([{ _id: null, total: 5, successful: 3, latencySum: 1500 }])
    mocks.collection.mockImplementation((name: string) => (name === 'ai_response_generation' ? collectionMock : {}))

    const stats = await repository.getUsageStats({ since, until })

    expect(stats).toEqual({
      totalRequests: 5,
      successfulRequests: 3,
      failedRequests: 2,
      averageResponseTime: 300,
    })

    expect(pipeline).toEqual([
      { $match: { createdAt: { $gte: since, $lte: until } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          successful: { $sum: { $cond: ['$success', 1, 0] } },
          latencySum: { $sum: '$latencyMs' },
        },
      },
    ])
  })

  it('narrows the aggregation to a single user', async () => {
    collectionMock = makeCollection([{ _id: null, total: 1, successful: 0, latencySum: 0 }])
    mocks.collection.mockImplementation((name: string) => (name === 'ai_response_generation' ? collectionMock : {}))

    const stats = await repository.getUsageStats({
      userId: 'user-1',
      since: new Date('2026-01-01T00:00:00Z'),
    })

    expect(stats).toEqual({
      totalRequests: 1,
      successfulRequests: 0,
      failedRequests: 1,
      averageResponseTime: 0,
    })

    const [matchStage] = pipeline as Array<Record<string, unknown>>
    expect(matchStage).toEqual(
      expect.objectContaining({
        $match: expect.objectContaining({ userId: 'user-1' }),
      }),
    )
  })

  it('returns zeros when no results were recorded', async () => {
    const stats = await repository.getUsageStats({})

    expect(stats).toEqual({
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
    })

    const [matchStage] = pipeline as Array<Record<string, unknown>>
    expect(matchStage).toEqual({ $match: {} })
  })
})
