import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ThreatHuntingService } from '../threat-hunting-service'
import type {
  IMongoClient,
  IMongoCollection,
  IMongoDatabase,
  IRedisClient,
  Investigation,
  ThreatHuntingConfig,
} from '../types'

vi.mock('../../logging/build-safe-logger', () => ({
  createBuildSafeLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

type InvestigationRecord = Investigation & { [key: string]: unknown }

function createMongoClientMock(): IMongoClient {
  const investigations = new Map<string, InvestigationRecord>()

  const collection: IMongoCollection = {
    insertOne: vi.fn(async (doc: unknown) => {
      const record = doc as InvestigationRecord
      investigations.set(record.investigationId, record)
      return { acknowledged: true }
    }),
    insertMany: vi.fn(async () => ({ acknowledged: true })),
    updateOne: vi.fn(async (filter: unknown, update: unknown) => {
      const investigationId = (filter as { investigationId?: string }).investigationId
      const existing = investigationId ? investigations.get(investigationId) : undefined
      if (investigationId && existing) {
        const payload = (update as { $set?: InvestigationRecord }).$set ?? existing
        investigations.set(investigationId, payload)
      }
      return { acknowledged: true }
    }),
    replaceOne: vi.fn(async () => ({ acknowledged: true })),
    deleteMany: vi.fn(async () => ({ acknowledged: true })),
    findOne: vi.fn(async (filter: unknown) => {
      const investigationId = (filter as { investigationId?: string }).investigationId
      return investigationId ? investigations.get(investigationId) ?? null : null
    }),
    find: vi.fn((filter: unknown) => {
      const filtered = Array.from(investigations.values()).filter((investigation) => {
        if (!filter || typeof filter !== 'object') return true
        const entries = Object.entries(filter as Record<string, unknown>)
        return entries.every(([key, value]) => investigation[key] === value)
      })

      return {
        sort: vi.fn(() => ({
          limit: vi.fn((limit: number) => ({
            toArray: vi.fn(async () => filtered.slice(0, limit)),
          })),
          toArray: vi.fn(async () => filtered),
        })),
        limit: vi.fn((limit: number) => ({
          toArray: vi.fn(async () => filtered.slice(0, limit)),
        })),
        toArray: vi.fn(async () => filtered),
      }
    }),
    countDocuments: vi.fn(async () => investigations.size),
  }

  const database: IMongoDatabase = {
    collection: vi.fn(() => collection),
  }

  return {
    db: vi.fn(() => database),
    connect: vi.fn(async function (this: IMongoClient) {
      return this
    }),
    close: vi.fn(async () => {}),
  }
}

function createRedisMock(): IRedisClient {
  const strings = new Map<string, string>()
  const lists = new Map<string, string[]>()
  let counter = 0

  return {
    get: vi.fn(async (key: string) => strings.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      strings.set(key, value)
      return 'OK'
    }),
    lrange: vi.fn(async (key: string, start: number, stop: number) => {
      const values = lists.get(key) ?? []
      const normalizedStop = stop === -1 ? values.length : stop + 1
      return values.slice(start, normalizedStop)
    }),
    incr: vi.fn(async () => {
      counter += 1
      return counter
    }),
    smembers: vi.fn(async () => []),
    scan: vi.fn(async () => ['0', []]),
    lpush: vi.fn(async (key: string, ...values: string[]) => {
      const current = lists.get(key) ?? []
      current.unshift(...values)
      lists.set(key, current)
      return current.length
    }),
    lrem: vi.fn(async (key: string, _count: number, element: string) => {
      const current = lists.get(key) ?? []
      const next = current.filter((item) => item !== element)
      lists.set(key, next)
      return current.length - next.length
    }),
    mget: vi.fn(async (keys: string[]) =>
      keys.map((key) => strings.get(key) ?? null),
    ),
    quit: vi.fn(async () => 'OK'),
  }
}

describe('ThreatHuntingService', () => {
  let redis: IRedisClient
  let mongoClient: IMongoClient
  let behavioralService: { initializeServices: ReturnType<typeof vi.fn> }
  let config: ThreatHuntingConfig

  beforeEach(() => {
    redis = createRedisMock()
    mongoClient = createMongoClientMock()
    behavioralService = {
      initializeServices: vi.fn(async () => {}),
    }
    config = {
      enabled: true,
      huntingRules: [],
      investigationTemplates: [],
      maxResultsPerQuery: 50,
    }
  })

  function createService(overrides?: {
    queryProvider?: { searchThreatData: ReturnType<typeof vi.fn> }
  }) {
    return new ThreatHuntingService(
      redis,
      { getThreatIntel: vi.fn() },
      mongoClient,
      behavioralService,
      config,
      overrides
        ? ({
            queryProvider: overrides.queryProvider,
          } as ConstructorParameters<typeof ThreatHuntingService>[5])
        : undefined,
    )
  }

  it('requires initialization before protected methods are used', async () => {
    const service = createService()

    await expect(
      service.searchThreatData({ query: 'suspicious activity' }),
    ).rejects.toThrow('ThreatHuntingService is not initialized')
  })

  it('initializes and synchronizes the behavioral service dependencies', async () => {
    const service = createService()

    await service.initialize()

    expect(behavioralService.initializeServices).toHaveBeenCalledWith(
      redis,
      mongoClient,
    )
  })

  it('delegates threat searches after initialization', async () => {
    const queryProvider = {
      searchThreatData: vi.fn(async () => ({
        data: [{ id: 'threat-1', event: 'suspicious_login' }],
        pagination: {
          total: 1,
          page: 1,
          limit: 50,
          isCapped: false,
          processingLimit: 10000,
        },
      })),
    }
    const service = createService({ queryProvider })

    await service.initialize()
    const result = await service.searchThreatData({
      query: 'suspicious_login',
      pagination: { page: 1, limit: 50 },
    })

    expect(queryProvider.searchThreatData).toHaveBeenCalledWith({
      query: 'suspicious_login',
      pagination: { page: 1, limit: 50 },
    })
    expect(result.pagination.total).toBe(1)
    expect(result.data[0].event).toBe('suspicious_login')
  })

  it('creates and retrieves an active investigation through the repository flow', async () => {
    const service = createService()

    await service.initialize()
    const investigationId = await service.createInvestigation({
      title: 'Suspicious activity review',
      priority: 'high',
    })

    expect(investigationId).toMatch(/^inv_/)

    const active = await service.getRecentInvestigations()
    expect(active).toHaveLength(1)
    expect(active[0]?.investigationId).toBe(investigationId)

    const investigation = await service.getInvestigation(investigationId)
    expect(investigation?.status).toBe('active')
    expect(investigation?.priority).toBe('high')
  })

  it('rejects invalid investigation payloads after initialization', async () => {
    const service = createService()

    await service.initialize()

    await expect(
      service.createInvestigation({ title: '', priority: '' }),
    ).rejects.toThrow('Invalid investigation data')
  })

  it('closes an investigation and removes it from the active list', async () => {
    const service = createService()

    await service.initialize()
    const investigationId = await service.createInvestigation({
      title: 'Contain credential stuffing alerts',
      priority: 'critical',
    })

    const closed = await service.closeInvestigation(investigationId, {
      resolution: 'Contained and verified',
    })

    expect(closed?.status).toBe('resolved')

    const active = await service.getRecentInvestigations()
    expect(active).toHaveLength(0)
  })
})
