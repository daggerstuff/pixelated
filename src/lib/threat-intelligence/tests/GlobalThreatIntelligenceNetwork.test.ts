/* @vitest-environment node */
/**
 * Tests for Global Threat Intelligence Network
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { GlobalThreatIntelligenceNetworkCore } from '../global/GlobalThreatIntelligenceNetwork'
import type {
  RealTimeThreatData,
  EdgeDetectionResult,
  CorrelationData,
  ThreatValidation,
} from '../global/types'
import type { ValidationMetrics } from '../validation/ThreatValidationSystem'

// Mock dependencies
vi.mock('../../logging/build-safe-logger', () => ({
  createBuildSafeLogger: vi.fn<
    () => {
      info: (message: string, ...args: unknown[]) => void
      error: (message: string | Error, ...args: unknown[]) => void
      warn: (message: string, ...args: unknown[]) => void
      debug: (message: string, ...args: unknown[]) => void
    }
  >(() => ({
    info: vi.fn<(message: string, ...args: unknown[]) => void>(),
    error: vi.fn<(message: string | Error, ...args: unknown[]) => void>(),
    warn: vi.fn<(message: string, ...args: unknown[]) => void>(),
    debug: vi.fn<(message: string, ...args: unknown[]) => void>(),
  })),
}))

const redisMockState = {
  failPing: false,
}

vi.mock('@tensorflow/tfjs', () => {
  const mockModel = {
    add: vi.fn(),
    compile: vi.fn(),
    predict: vi.fn(() => ({
      dataSync: () => [0.1],
      dispose: vi.fn(),
    })),
  }

  return {
    sequential: vi.fn(() => mockModel),
    layers: {
      dense: vi.fn(),
      dropout: vi.fn(),
    },
    train: {
      adam: vi.fn(),
    },
    tidy: vi.fn((fn: unknown) => {
      if (typeof fn === 'function') return fn()
    }),
    tensor2d: vi.fn(),
    mean: vi.fn(() => ({ dataSync: () => [0.1] })),
    abs: vi.fn(),
    sub: vi.fn(),
  }
})

vi.mock('ioredis', () => {
  const createMockRedis = function () {
    if (redisMockState.failPing) {
      return {
        ping: vi
          .fn<() => Promise<string>>()
          .mockRejectedValue(new Error('Redis connection failed')),
        setex: vi.fn<() => Promise<string>>().mockResolvedValue('OK'),
        get: vi.fn<() => Promise<string | null>>().mockResolvedValue(null),
        del: vi.fn<() => Promise<number>>().mockResolvedValue(1),
        publish: vi.fn<() => Promise<number>>().mockResolvedValue(1),
        quit: vi.fn<() => Promise<string>>().mockResolvedValue('OK'),
      }
    }

    return {
      ping: vi.fn<() => Promise<string>>().mockResolvedValue('PONG'),
      setex: vi.fn<() => Promise<string>>().mockResolvedValue('OK'),
      get: vi.fn<() => Promise<string | null>>().mockResolvedValue(null),
      del: vi.fn<() => Promise<number>>().mockResolvedValue(1),
      publish: vi.fn<() => Promise<number>>().mockResolvedValue(1),
      quit: vi.fn<() => Promise<string>>().mockResolvedValue('OK'),
    }
  }

  return {
    default: vi.fn(createMockRedis),
    Redis: vi.fn(createMockRedis),
  }
})

vi.mock('mongodb', () => {
  const createMongoClient = function () {
    return {
      connect: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      db: vi.fn(() => ({
        collection: vi.fn(() => ({
          insertOne: vi
            .fn<() => Promise<{ insertedId: string }>>()
            .mockResolvedValue({
              insertedId: 'test-id',
            }),
          updateOne: vi
            .fn<() => Promise<{ modifiedCount: number }>>()
            .mockResolvedValue({
              modifiedCount: 1,
            }),
          findOne: vi.fn<() => Promise<null>>().mockResolvedValue(null),
          find: vi.fn(() => ({
            toArray: vi.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
            sort: vi.fn(() => ({
              toArray: vi.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
            })),
            limit: vi.fn(() => ({
              toArray: vi.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
            })),
          })),
          aggregate: vi.fn(() => ({
            toArray: vi.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
          })),
        })),
        admin: vi.fn(() => ({
          ping: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
        })),
      })),
      close: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    }
  }

  return {
    MongoClient: vi.fn(createMongoClient),
  }
})

const mockEdgeDetectionSystem = vi.hoisted(() => ({
  initialize: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  detectThreat: vi.fn<() => Promise<unknown>>().mockResolvedValue({
    detectionId: 'det-1',
    edgeNodeId: 'edge-us-east-1-a',
    region: 'us-east-1',
    threatType: 'malware',
    severity: 0.5,
    confidence: 0.5,
    indicators: [],
    aiModel: 'threat-model-v1',
    processingTime: 50,
    timestamp: new Date(),
  }),
  getEdgeNodeStatus: vi.fn<() => Promise<unknown>>().mockResolvedValue({
    healthy: true,
    statusMessage: 'ok',
  }),
  deployAIModel: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
  updateDetectionThresholds: vi
    .fn<() => Promise<boolean>>()
    .mockResolvedValue(true),
  getHealthStatus: vi.fn<() => Promise<unknown>>().mockResolvedValue({
    healthy: true,
    message: 'healthy',
  }),
  shutdown: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
}))

vi.mock('../edge/EdgeThreatDetectionSystem', () => ({
  EdgeThreatDetectionSystemCore: vi.fn(function () {
    return mockEdgeDetectionSystem
  }),
}))

const mockThreatStore = vi.hoisted(() => ({
  threats: new Map<string, any>(),
  threatIntelligence: new Map<string, any>(),
  indicators: new Map<string, string>(),
}))

const mockThreatCorrelationEngine = vi.hoisted(() => ({
  initialize: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  correlateThreat: vi.fn<() => Promise<any>>().mockResolvedValue({
    correlationId: 'test-correlation',
    correlationType: 'shared_indicators',
    correlationStrength: 0.85,
    correlatedThreats: [],
    confidence: 0.85,
    analysisMethod: 'unit-test',
    timestamp: new Date(),
  }),
  correlateThreats: vi.fn<() => Promise<any[]>>().mockResolvedValue([]),
  findSimilarThreats: vi.fn<() => Promise<any[]>>().mockResolvedValue([]),
  getCorrelationPatterns: vi.fn<() => Promise<any[]>>().mockResolvedValue([]),
  updateCorrelationAlgorithm: vi
    .fn<() => Promise<boolean>>()
    .mockResolvedValue(true),
  getHealthStatus: vi.fn<() => Promise<any>>().mockResolvedValue({
    healthy: true,
    message: 'healthy',
    responseTime: 12,
    activeCorrelations: 0,
    patternCount: 0,
  }),
  shutdown: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
}))

vi.mock('../correlation/ThreatCorrelationEngine', () => ({
  ThreatCorrelationEngineCore: vi.fn(function () {
    return mockThreatCorrelationEngine
  }),
}))

const mockThreatIntelligenceDatabase = vi.hoisted(() => ({
  initialize: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  storeThreatIntelligence: vi
    .fn<(threat: any) => Promise<void>>()
    .mockImplementation(async (threat: any) => {
      mockThreatStore.threats.set(threat.threatId, threat)
      mockThreatStore.threatIntelligence.set(threat.intelligenceId, threat)
      threat.indicators?.forEach((indicator: any) => {
        mockThreatStore.indicators.set(
          `${indicator.indicatorType}:${indicator.value}`,
          threat.threatId,
        )
      })
    }),
  getThreatById: vi
    .fn<(threatId: string) => Promise<any | null>>()
    .mockImplementation(async (threatId: string) => {
      return mockThreatStore.threats.get(threatId) ?? null
    }),
  getThreatByIndicator: vi
    .fn<(indicatorType: string, value: string) => Promise<any | null>>()
    .mockImplementation(async (indicatorType: string, value: string) => {
      const threatId = mockThreatStore.indicators.get(
        `${indicatorType}:${value}`,
      )
      return threatId ? (mockThreatStore.threats.get(threatId) ?? null) : null
    }),
  getThreatByIntelligenceId: vi
    .fn<(intelligenceId: string) => Promise<any | null>>()
    .mockImplementation(async (intelligenceId: string) => {
      return mockThreatStore.threatIntelligence.get(intelligenceId) ?? null
    }),
  updateThreatIntelligence: vi
    .fn<(threat: any) => Promise<void>>()
    .mockImplementation(async (threat: any) => {
      mockThreatStore.threats.set(threat.threatId, threat)
      mockThreatStore.threatIntelligence.set(threat.intelligenceId, threat)
      threat.indicators?.forEach((indicator: any) => {
        mockThreatStore.indicators.set(
          `${indicator.indicatorType}:${indicator.value}`,
          threat.threatId,
        )
      })
    }),
  getTotalThreatCount: vi.fn<() => Promise<number>>().mockResolvedValue(0),
  getActiveThreatCount: vi.fn<() => Promise<number>>().mockResolvedValue(0),
  getThreatsByRegion: vi
    .fn<() => Promise<Record<string, number>>>()
    .mockResolvedValue({}),
  getThreatsBySeverity: vi
    .fn<() => Promise<Record<string, number>>>()
    .mockResolvedValue({}),
  getRecentThreats: vi.fn<() => Promise<any[]>>().mockResolvedValue([]),
  getCorrelationCount: vi.fn<() => Promise<number>>().mockResolvedValue(0),
  getHealthStatus: vi.fn<() => Promise<any>>().mockResolvedValue({
    healthy: true,
    message: 'healthy',
    responseTime: 11,
  }),
  shutdown: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
}))

vi.mock('../database/ThreatIntelligenceDatabase', () => ({
  ThreatIntelligenceDatabaseCore: vi.fn(function () {
    return mockThreatIntelligenceDatabase
  }),
}))

const mockResponseOrchestrator = vi.hoisted(() => ({
  initialize: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  orchestrateThreatResponse: vi
    .fn<() => Promise<any>>()
    .mockResolvedValue({ responseId: 'response-1', status: 'ok' }),
  getHealthStatus: vi.fn<() => Promise<any>>().mockResolvedValue({
    healthy: true,
    message: 'healthy',
    responseTime: 8,
  }),
  shutdown: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
}))

vi.mock('../orchestration/AutomatedThreatResponseOrchestrator', () => ({
  AutomatedThreatResponseOrchestratorCore: vi.fn(function () {
    return mockResponseOrchestrator
  }),
}))

const mockHuntingSystem = vi.hoisted(() => ({
  initialize: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  getHealthStatus: vi.fn<() => Promise<any>>().mockResolvedValue({
    healthy: true,
    message: 'healthy',
  }),
  shutdown: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
}))

vi.mock('../hunting/ThreatHuntingSystem', () => ({
  ThreatHuntingSystemCore: vi.fn(function () {
    return mockHuntingSystem
  }),
}))

const mockFeedIntegration = vi.hoisted(() => ({
  initialize: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  fetchThreatIntelligence: vi
    .fn<() => Promise<unknown[]>>()
    .mockResolvedValue([]),
  getHealthStatus: vi.fn<() => Promise<any>>().mockResolvedValue({
    healthy: true,
    message: 'healthy',
  }),
  shutdown: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
}))

vi.mock('../feeds/ExternalThreatFeedIntegration', () => ({
  ExternalThreatFeedIntegrationCore: vi.fn(function () {
    return mockFeedIntegration
  }),
}))

const mockValidationSystem = vi.hoisted(() => ({
  initialize: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  validateThreat: vi
    .fn<(threat: unknown) => Promise<any>>()
    .mockImplementation(async (threat: any) => {
      return {
        validationId: `validation-${threat.threatId ?? 'unknown'}`,
        threatId: threat.threatId ?? 'unknown',
        threatType: threat.threatType ?? 'malware',
        severity: threat.severity ?? 'high',
        confidence: threat.confidence ?? 0.9,
        status: 'valid',
        overallScore: 85,
        isValid: true,
        results: [
          {
            ruleId: 'structure_validation',
            ruleName: 'Structure Validation',
            passed: true,
            score: 100,
            issues: [],
            details: {},
          },
        ],
        createdAt: new Date(),
        completedAt: new Date(),
      } as ThreatValidation
    }),
  getValidationMetrics: vi.fn<() => Promise<any>>().mockResolvedValue({
    totalValidations: 1,
    validThreats: 1,
    invalidThreats: 0,
    validationBySeverity: { high: 1 },
    validationByType: { malware: 1 },
    averageValidationTime: 5,
    falsePositives: 0,
    falseNegatives: 0,
  }),
  getHealthStatus: vi.fn<() => Promise<any>>().mockResolvedValue({
    healthy: true,
    message: 'healthy',
    responseTime: 7,
  }),
  shutdown: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
}))

vi.mock('../validation/ThreatValidationSystem', () => ({
  ThreatValidationSystemCore: vi.fn(function () {
    return mockValidationSystem
  }),
}))

describe('GlobalThreatIntelligenceNetworkCore', () => {
  let network: GlobalThreatIntelligenceNetworkCore
  let mockConfig: any

  const createThreatData = (
    overrides: Partial<RealTimeThreatData> = {},
  ): RealTimeThreatData => ({
    threatId: `threat-${Math.random().toString(36).slice(2, 11)}`,
    severity: 0.8,
    confidence: 0.9,
    indicators: [
      {
        indicatorType: 'ip',
        value: '192.168.1.100',
        confidence: 0.9,
        firstSeen: new Date(),
        lastSeen: new Date(),
      },
    ],
    context: {
      geographicLocation: 'us-east-1',
    },
    source: 'test-source',
    timestamp: new Date(),
    region: 'us-east-1',
    ...overrides,
  })

  const resetMockStore = () => {
    mockThreatStore.threats.clear()
    mockThreatStore.threatIntelligence.clear()
    mockThreatStore.indicators.clear()
  }

  beforeEach(() => {
    resetMockStore()
    mockConfig = {
      networkId: 'test-network',
      networkName: 'Test Network',
      primaryRegion: 'us-east-1',
      failoverRegions: ['eu-west-1'],
      syncInterval: 30000,
      healthCheckInterval: 60000,
      maxSyncRetries: 3,
      threatSharingEnabled: true,
      realTimeProcessing: true,
      encryptionEnabled: true,
      compressionEnabled: true,
      regions: [
        {
          regionId: 'us-east-1',
          regionName: 'US East',
          location: {
            latitude: 40.7128,
            longitude: -74.006,
            timezone: 'America/New_York',
          },
          dataCenters: [
            {
              dataCenterId: 'dc-us-east-1-a',
              location: 'NY',
              capacity: {
                maxThreats: 10000,
                maxConnections: 5000,
                storageGB: 5000,
              },
              services: ['database', 'redis', 'ml'],
              status: 'active',
            },
          ],
          edgeNodes: [
            {
              nodeId: 'edge-us-east-1-a',
              location: 'NYC',
              capabilities: ['detection', 'correlation'],
              aiModels: ['threat-model-v1'],
              bandwidth: 1000,
              latency: 20,
            },
          ],
          priority: 1,
          complianceRequirements: ['SOC2'],
        },
      ],
      dataSharing: {
        enabled: true,
        protocols: ['json'],
        encryption: {
          algorithm: 'AES-256-GCM',
          keyRotation: 3600,
        },
        authentication: {
          method: 'token',
          certificates: ['test-cert'],
        },
        rateLimiting: {
          requestsPerSecond: 100,
          burstLimit: 200,
        },
      },
      edgeDetection: {
        aiModels: [
          {
            modelId: 'threat-model-v1',
            modelType: 'classification',
            version: '1.0.0',
            framework: 'tensorflow',
            performance: {
              accuracy: 0.95,
              precision: 0.94,
              recall: 0.93,
              f1Score: 0.93,
            },
            deployment: {
              regions: ['us-east-1'],
              edgeNodes: ['edge-us-east-1-a'],
              resources: {
                cpu: 4,
                memory: 16384,
                gpu: 1,
              },
            },
          },
        ],
        detectionThresholds: {
          anomaly: 0.8,
          threat: 0.75,
          confidence: 0.85,
          severity: {
            low: 0.2,
            medium: 0.5,
            high: 0.75,
            critical: 0.9,
          },
        },
        updateFrequency: 60000,
        modelDeployment: {
          strategy: 'rolling',
          rolloutPercentage: 50,
          rollbackThreshold: 0.15,
          healthChecks: [
            {
              type: 'http',
              endpoint: '/health',
              interval: 5000,
              timeout: 2000,
            },
          ],
        },
      },
      correlation: {
        algorithms: [
          {
            algorithmId: 'shared-indicators-v1',
            algorithmType: 'graph',
            parameters: {},
            performance: {
              accuracy: 0.9,
              speed: 0.9,
              scalability: 0.88,
            },
          },
        ],
        timeWindow: 600000,
        similarityThreshold: 0.85,
        crossRegionWeight: 0.6,
        historicalWeight: 0.4,
      },
      database: {
        primary: {
          host: 'localhost',
          port: 27017,
          database: 'threat-intel',
          username: 'user',
          password: 'password',
          ssl: false,
          connectionPool: {
            min: 1,
            max: 10,
            idleTimeout: 30000,
          },
        },
        replicas: [],
        sharding: {
          enabled: false,
          shards: [],
          shardKey: 'threatId',
          balancingStrategy: 'round_robin',
        },
        backup: {
          enabled: false,
          frequency: 86400,
          retention: 7,
          locations: ['local'],
          encryption: true,
        },
        stixSupport: {
          enabled: false,
          version: '2.1',
          objects: [],
          validation: true,
          exportFormats: ['json'],
        },
        taxiiSupport: {
          enabled: false,
          version: '2.1',
          collections: [],
          authentication: {
            method: 'token',
            certificates: [],
          },
          rateLimiting: {
            requestsPerMinute: 120,
            burstLimit: 200,
          },
        },
      },
      orchestration: {
        responseStrategies: [
          {
            strategyId: 'default',
            name: 'default-response',
            description: 'Default response strategy',
            threatTypes: ['malware', 'c2'],
            severityLevels: ['high', 'critical'],
            responseActions: [
              {
                actionId: 'alert',
                actionType: 'alert',
                priority: 1,
                parameters: {},
                timeout: 5000,
                retryCount: 1,
              },
            ],
            conditions: [
              {
                conditionId: 'default',
                type: 'severity',
                field: 'severity',
                operator: 'gte',
                value: 0.8,
              },
            ],
            priority: 1,
            primaryType: 'alert',
          },
        ],
        automationLevel: 'semi',
        escalationRules: [
          {
            ruleId: 'default',
            triggerCondition: {
              type: 'confidence',
              operator: 'gte',
              threshold: 0.9,
            },
            escalateTo: ['SOC'],
            requiredApprovals: 1,
            timeout: 300,
          },
        ],
        integrationEndpoints: [],
      },
      validation: {
        enabled: true,
        validationRules: [
          {
            ruleId: 'confidence',
            name: 'Confidence threshold',
            ruleType: 'accuracy',
            conditions: [],
            condition: 'confidence >= 0.6',
            severity: 'medium',
            threshold: 0.6,
            action: 'accept',
          },
        ],
        validationThreshold: 0.75,
        qualityThresholds: {
          accuracy: 0.7,
          completeness: 0.7,
          consistency: 0.7,
          timeliness: 0.7,
          relevance: 0.7,
        },
        feedbackLoop: {
          enabled: true,
          sources: ['human'],
          updateFrequency: 86400,
          learningRate: 0.1,
        },
      },
    }

    process.env['MONGODB_URI'] = 'mongodb://localhost:27017/test'
    process.env['REDIS_URL'] = 'redis://localhost:6379'
  })

  afterEach(async () => {
    if (network) {
      await network.shutdown().catch(() => undefined)
    }

    vi.clearAllMocks()
    redisMockState.failPing = false
    resetMockStore()
  })

  it('should initialize successfully with valid configuration', async () => {
    network = new GlobalThreatIntelligenceNetworkCore(mockConfig)

    await expect(network.initialize()).resolves.not.toThrow()
  })

  it('should handle initialization errors gracefully', async () => {
    redisMockState.failPing = true

    network = new GlobalThreatIntelligenceNetworkCore(mockConfig)
    await expect(network.initialize()).rejects.toThrow(
      'Redis connection failed',
    )
  })

  it('should process threat intelligence successfully', async () => {
    network = new GlobalThreatIntelligenceNetworkCore(mockConfig)
    await network.initialize()

    const threatData = createThreatData({ threatId: 'threat-123' })
    const result = await network.processThreatIntelligence(threatData)

    expect(result.threatId).toBe('threat-123')
    expect(result.globalThreatId).toBeTruthy()
  })

  it('should update existing threat on duplicate input', async () => {
    network = new GlobalThreatIntelligenceNetworkCore(mockConfig)
    await network.initialize()

    const threatData = createThreatData({ threatId: 'duplicate-threat' })
    const first = await network.processThreatIntelligence(threatData)
    const second = await network.processThreatIntelligence({
      ...threatData,
      confidence: 0.97,
    })

    expect(first.threatId).toBe(second.threatId)
    expect(second.globalThreatId).toBeTruthy()
  })

  it('should validate threat data before processing', async () => {
    network = new GlobalThreatIntelligenceNetworkCore(mockConfig)
    await network.initialize()

    const invalidThreat = {
      threatId: 'bad-threat',
      severity: 1.2,
      confidence: 1.5,
      indicators: [],
      timestamp: new Date(),
      region: 'us-east-1',
    } as any

    await expect(
      network.processThreatIntelligence(invalidThreat),
    ).rejects.toThrow()
  })

  it('should correlate threat IDs across regions', async () => {
    network = new GlobalThreatIntelligenceNetworkCore(mockConfig)
    await network.initialize()

    const first = await network.processThreatIntelligence(
      createThreatData({ threatId: 'threat-a' }),
    )
    const second = await network.processThreatIntelligence(
      createThreatData({ threatId: 'threat-b' }),
    )

    mockThreatCorrelationEngine.correlateThreats.mockResolvedValueOnce([
      {
        correlationId: 'corr-1',
        correlationType: 'shared_indicators',
        correlationStrength: 0.8,
        correlatedThreats: [first.threatId, second.threatId],
        confidence: 0.8,
        analysisMethod: 'mock',
        timestamp: new Date(),
      },
    ])

    const correlations = await network.correlateThreatsAcrossRegions([
      first.threatId,
      second.threatId,
    ])
    expect(correlations).toHaveLength(1)
    expect(correlations[0]).toMatchObject({
      correlationId: 'corr-1',
      correlationType: 'shared_indicators',
    })
  })

  it('should return empty correlations for empty threat list', async () => {
    network = new GlobalThreatIntelligenceNetworkCore(mockConfig)
    await network.initialize()

    const correlations = await network.correlateThreatsAcrossRegions([])
    expect(correlations).toEqual([])
  })

  it('should return healthy status when all systems are operational', async () => {
    network = new GlobalThreatIntelligenceNetworkCore(mockConfig)
    await network.initialize()

    const status = await network.getHealthStatus()
    expect(status.status).toBe('healthy')
  })

  it('should return a global threat summary', async () => {
    network = new GlobalThreatIntelligenceNetworkCore(mockConfig)
    await network.initialize()

    const summary = await network.getGlobalThreatSummary()
    expect(summary.totalThreats).toBeGreaterThanOrEqual(0)
    expect(summary.correlationCount).toBeGreaterThanOrEqual(0)
    expect(summary.validationMetrics).toBeDefined()
  })

  it('should emit threat_processed events', async () => {
    network = new GlobalThreatIntelligenceNetworkCore(mockConfig)
    await network.initialize()

    const eventHandler = vi.fn()
    network.on('threat_processed', eventHandler)

    const threatData = createThreatData({ threatId: 'event-test-threat' })
    const result = await network.processThreatIntelligence(threatData)

    expect(eventHandler).toHaveBeenCalledWith({
      threatId: threatData.threatId,
      globalThreatId: result.globalThreatId,
    })
  })

  it('should shutdown gracefully', async () => {
    network = new GlobalThreatIntelligenceNetworkCore(mockConfig)
    await network.initialize()

    await expect(network.shutdown()).resolves.not.toThrow()
  })
})
