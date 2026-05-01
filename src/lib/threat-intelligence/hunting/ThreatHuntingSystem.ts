/**
 * Threat Hunting System
 * Proactive threat hunting capabilities across global infrastructure
 */

import { EventEmitter } from 'events'

import { Redis } from 'ioredis'
import { Document, MongoClient, Db, WithId } from 'mongodb'

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import {
  HuntingConfig,
  HuntQuery,
  HuntResult,
  HuntPattern,
  HuntSchedule,
  HuntExecution,
  HuntFinding,
  GlobalThreatIntelligence,
  ThreatIndicator,
} from '../global/types'

const logger = createBuildSafeLogger('threat-hunting-system')

export interface ThreatHuntingSystem {
  initialize(): Promise<void>
  executeHunt(query: HuntQuery): Promise<HuntResult>
  scheduleHunt(schedule: HuntSchedule): Promise<string>
  cancelHunt(huntId: string): Promise<boolean>
  getHuntResults(huntId: string, limit?: number): Promise<HuntResult[]>
  getActiveHunts(): Promise<HuntExecution[]>
  updateHuntPattern(pattern: HuntPattern): Promise<boolean>
  getHuntMetrics(): Promise<HuntMetrics>
  getHealthStatus(): Promise<HealthStatus>
  shutdown(): Promise<void>
}

export interface HuntMetrics {
  totalHunts: number
  successfulHunts: number
  failedHunts: number
  averageExecutionTime: number
  threatsDiscovered: number
  falsePositives: number
  huntByType: Record<string, number>
  huntBySeverity: Record<string, number>
}

export interface HealthStatus {
  healthy: boolean
  message: string
  responseTime?: number
  activeHunts?: number
  successRate?: number
}

type DocumentRecord = Record<string, unknown>
type TimeRange = { startTime: string; endTime: string }

interface RawHuntFinding {
  type: string
  severity: string
  confidence: number
  data: DocumentRecord
  timestamp: Date
  [key: string]: unknown
}

interface PortScanAggregateResult extends DocumentRecord {
  _id: { sourceIp?: string; hour?: string }
  uniquePorts: unknown[]
  connectionCount: number
  timestamps: unknown[]
}

interface LoginAggregateResult extends DocumentRecord {
  _id: string
  loginCount: number
  uniqueLocations: unknown[]
  failureCount: number
  timestamps: unknown[]
}

interface AccessAggregateResult extends DocumentRecord {
  _id: string
  accessCount: number
  uniqueResources: unknown[]
  accessTimes: unknown[]
}

interface LateralAggregateResult extends DocumentRecord {
  _id: {
    sourceIp?: string
    destinationIp?: string
    destinationPort?: number
    hour?: string
  }
  sourceIp?: string
  destinationIp?: string
  destinationPort?: number
  connectionCount: number
  timestamps: unknown[]
  totalBytes?: number
  uniqueDestinations?: unknown[]
  portsScanned?: unknown[]
}

interface PatternTypeCount {
  patternType: string
  count: number
}

interface MalwareSignature extends Document {
  hash?: string
}

interface SeverityCount {
  severity: string
  count: number
}

interface ThreatNotification {
  type: string
  threatId: string
  severity: string
  confidence: number
  indicatorCount: number
  timestamp: Date
}

export class ThreatHuntingSystemCore
  extends EventEmitter
  implements ThreatHuntingSystem
{
  private redis!: Redis
  private mongoClient!: MongoClient
  private db!: Db
  private readonly huntPatterns: Map<string, HuntPattern> = new Map()
  private readonly activeHunts: Map<string, HuntExecution> = new Map()
  private readonly scheduledHunts: Map<string, NodeJS.Timeout> = new Map()

  private getCollection<T extends Document = Document>(collectionName: string) {
    return this.db.collection<T>(collectionName)
  }

  private mapStoredDocument<T extends Document>(
    document: WithId<T>,
  ): Omit<WithId<T>, '_id'> {
    const { _id: _omitId, ...rest } = document
    return rest
  }

  private toDate(value: unknown, fallback: Date = new Date()): Date {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value
    }

    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value)
      if (!Number.isNaN(parsed.getTime())) {
        return parsed
      }
    }

    return fallback
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    if (!this.isRecord(obj)) {
      return undefined
    }

    return path.split('.').reduce<unknown>((current, key) => {
      if (!this.isRecord(current)) {
        return undefined
      }

      return current[key]
    }, obj)
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    )
  }

  private toDocumentRecord(value: Document): DocumentRecord {
    const result: DocumentRecord = {}
    for (const [key, entry] of Object.entries(value)) {
      result[key] = entry as unknown
    }

    return result
  }

  private parseDate(value: unknown): Date | undefined {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value
    }

    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value)
      return Number.isNaN(parsed.getTime()) ? undefined : parsed
    }

    return undefined
  }

  private parseTimeRange(value: unknown): TimeRange | undefined {
    if (!this.isRecord(value)) {
      return undefined
    }

    const startTime = this.parseDate(value.startTime)
    const endTime = this.parseDate(value.endTime)

    if (!startTime || !endTime) {
      return undefined
    }

    return {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    }
  }

  private getExecutionTimeRange(execution: HuntExecution): TimeRange {
    const configuredTimeRange = this.parseTimeRange(
      this.getNestedValue(execution.parameters, 'timeRange'),
    )
    if (configuredTimeRange) {
      return configuredTimeRange
    }

    const directTimeRange = this.parseTimeRange(execution.parameters)
    if (directTimeRange) {
      return directTimeRange
    }

    return this.getDefaultTimeRange()
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return []
    }

    return value.filter((entry): entry is string => typeof entry === 'string')
  }

  private toStringValue(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined
  }

  private toConfidence(value: unknown): number {
    return typeof value === 'number' ? value : 0.5
  }

  constructor(private readonly config: HuntingConfig) {
    super()
    this.initializePatterns()
  }

  private initializePatterns(): void {
    const patterns = this.config.huntPatterns ?? []
    for (const pattern of patterns) {
      this.huntPatterns.set(pattern.patternId, pattern)
    }
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Threat Hunting System')

      // Initialize Redis connection
      await this.initializeRedis()

      // Initialize MongoDB connection
      await this.initializeMongoDB()

      // Load hunt patterns from database
      await this.loadHuntPatterns()

      // Start hunt scheduler
      await this.startHuntScheduler()

      // Start metrics collection
      await this.startMetricsCollection()

      this.emit('hunting_system_initialized')
      logger.info('Threat Hunting System initialized successfully')
    } catch (error: unknown) {
      logger.error('Failed to initialize Threat Hunting System:', { error })
      this.emit('initialization_error', { error })
      throw error
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')
      await this.redis.ping()
      logger.info('Redis connection established for threat hunting')
    } catch (error: unknown) {
      logger.error('Failed to connect to Redis:', { error })
      throw new Error('Redis connection failed', { cause: error })
    }
  }

  private async initializeMongoDB(): Promise<void> {
    try {
      this.mongoClient = new MongoClient(
        process.env.MONGODB_URI ?? 'mongodb://localhost:27017/threat_hunting',
      )
      await this.mongoClient.connect()
      this.db = this.mongoClient.db('threat_hunting')
      logger.info('MongoDB connection established for threat hunting')
    } catch (error: unknown) {
      logger.error('Failed to connect to MongoDB:', { error })
      throw new Error('MongoDB connection failed', { cause: error })
    }
  }

  private async loadHuntPatterns(): Promise<void> {
    try {
      const patternsCollection = this.getCollection<HuntPattern>('hunt_patterns')
      const patterns = await patternsCollection.find({}).toArray()
      const mappedPatterns = patterns.map((pattern) =>
        this.mapStoredDocument(pattern),
      )

      for (const pattern of mappedPatterns) {
        this.huntPatterns.set(pattern.patternId, pattern)
      }

      logger.info(`Loaded ${patterns.length} hunt patterns from database`)
    } catch (error: unknown) {
      logger.error('Failed to load hunt patterns:', { error })
    }
  }

  private async startHuntScheduler(): Promise<void> {
    // Check for scheduled hunts every minute
    setInterval(async () => {
      try {
        await this.checkScheduledHunts()
      } catch (error: unknown) {
        logger.error('Scheduled hunt check error:', { error })
      }
    }, 60000)
  }

  private async startMetricsCollection(): Promise<void> {
    // Collect metrics every 10 minutes
    setInterval(async () => {
      try {
        await this.collectMetrics()
      } catch (error: unknown) {
        logger.error('Metrics collection error:', { error })
      }
    }, 600000)
  }

  async executeHunt(query: HuntQuery): Promise<HuntResult> {
    try {
      logger.info('Executing threat hunt', {
        huntId: query.huntId,
        patternId: query.patternId,
        scope: query.scope,
      })

      // Step 1: Validate hunt query
      const validatedQuery = await this.validateHuntQuery(query)

      // Step 2: Select hunt pattern
      const pattern = await this.selectHuntPattern(validatedQuery)

      // Step 3: Prepare hunt execution
      const execution = await this.prepareHuntExecution(validatedQuery, pattern)

      // Step 4: Execute hunt based on pattern type
      const huntResults = await this.executeHuntByPattern(execution, pattern)

      // Step 5: Analyze and correlate results
      const analyzedResults = await this.analyzeHuntResults(
        huntResults,
        pattern,
      )

      // Step 6: Generate threat intelligence from findings
      const threats = await this.generateThreatIntelligence(
        analyzedResults,
        pattern,
        execution,
      )

      // Step 7: Update hunt execution status
      execution.status = 'completed'
      execution.completedTime = new Date()
      await this.updateHuntExecution(execution)

      const huntResult: HuntResult = {
        resultId: `result_${execution.executionId}_${Date.now()}`,
        timestamp: this.toDate(execution.completedTime, execution.startTime),
        huntId: execution.huntId,
        executionId: execution.executionId,
        patternId: pattern.patternId,
        startTime: execution.startTime,
        endTime: execution.completedTime,
        status: 'completed',
        findings: analyzedResults.map((result) => this.mapToHuntFinding(result)),
        threatsDiscovered: threats.length,
        confidence: this.calculateOverallConfidence(analyzedResults),
        metadata: {
          executionTime:
            this.toDate(execution.completedTime).getTime() -
            this.toDate(execution.startTime).getTime(),
          dataSources: execution.dataSources,
          regions: execution.regions,
        },
      }

      // Step 8: Store hunt summary and discovered threats
      await this.storeHuntResults(huntResult, threats)

      // Step 9: Send notifications for discovered threats
      if (threats.length > 0) {
        await this.sendThreatNotifications(threats)
      }

      // Step 10: Integrate with global threat intelligence
      await this.integrateWithGlobalIntelligence(threats)

      this.emit('hunt_completed', {
        huntId: huntResult.huntId,
        executionId: huntResult.executionId,
        threatsDiscovered: huntResult.threatsDiscovered,
        confidence: huntResult.confidence,
      })

      return huntResult
    } catch (error: unknown) {
      logger.error('Failed to execute threat hunt:', {
        error,
        huntId: query.huntId,
      })
      this.emit('hunt_execution_error', { error, huntId: query.huntId })
      throw error
    }
  }

  private async validateHuntQuery(query: HuntQuery): Promise<HuntQuery> {
    try {
      // Validate required fields
      if (!query.huntId) {
        throw new Error('Hunt ID is required')
      }

      if (!query.patternId && !query.customQuery) {
        throw new Error('Either patternId or customQuery must be provided')
      }

      // Validate scope
      if (query.scope?.length === 0) {
        throw new Error('Hunt scope cannot be empty')
      }

      // Validate time range
      if (query.timeRange) {
        const startTime = new Date(query.timeRange.startTime)
        const endTime = new Date(query.timeRange.endTime)

        if (startTime >= endTime) {
          throw new Error(
            'Invalid time range: startTime must be before endTime',
          )
        }

        if (endTime.getTime() - startTime.getTime() > 7 * 24 * 60 * 60 * 1000) {
          // 7 days
          throw new Error('Time range cannot exceed 7 days')
        }
      }

      // Set default values
      const validatedQuery: HuntQuery = {
        ...query,
        priority: query.priority ?? 'medium',
        timeout: query.timeout ?? 300000, // 5 minutes default
        maxResults: query.maxResults ?? 1000,
      }

      return validatedQuery
    } catch (error: unknown) {
      logger.error('Hunt query validation failed:', { error })
      throw error
    }
  }

  private async selectHuntPattern(query: HuntQuery): Promise<HuntPattern> {
    try {
      if (query.customQuery) {
        // Create custom pattern from query
        return this.createCustomPattern(query)
      }

      // Find pattern by ID
      if (!query.patternId) {
        throw new Error('Hunt pattern ID is required')
      }

      const pattern = this.huntPatterns.get(query.patternId)
      if (!pattern) {
        throw new Error(`Hunt pattern not found: ${query.patternId}`)
      }

      return pattern
    } catch (error: unknown) {
      logger.error('Failed to select hunt pattern:', { error })
      throw error
    }
  }

  private createCustomPattern(query: HuntQuery): HuntPattern {
    return {
      patternId: `custom_${Date.now()}`,
      type: 'anomaly',
      name: 'Custom Hunt Pattern',
      description: 'User-defined custom hunt pattern',
      patternType: 'custom',
      query: query.customQuery!,
      severity: 'medium',
      confidence: 0.7,
      indicators: [],
      conditions: [],
      actions: [],
      metadata: {
        custom: true,
        createdBy: 'user',
        createdAt: new Date(),
      },
    }
  }

  private async prepareHuntExecution(
    query: HuntQuery,
    pattern: HuntPattern,
  ): Promise<HuntExecution> {
    try {
      const execution: HuntExecution = {
        executionId: this.generateExecutionId(),
        huntId: query.huntId,
        patternId: pattern.patternId,
        startTime: new Date(),
        status: 'preparing',
        scope: query.scope ?? ['global'],
        dataSources: this.determineDataSources(pattern, query),
        regions: query.regions ?? ['all'],
        parameters: query.parameters ?? {},
        metadata: {
          patternType: pattern.patternType,
          severity: pattern.severity,
          confidence: pattern.confidence,
        },
      }

      // Store execution in database
      await this.storeHuntExecution(execution)

      this.activeHunts.set(execution.executionId, execution)

      return execution
    } catch (error: unknown) {
      logger.error('Failed to prepare hunt execution:', { error })
      throw error
    }
  }

  private determineDataSources(
    pattern: HuntPattern,
    query: HuntQuery,
  ): string[] {
    const dataSources: string[] = []

    // Add pattern-specific data sources
    const resolvedPatternType = pattern.patternType ?? 'anomaly'
    switch (resolvedPatternType) {
      case 'network':
        dataSources.push('network_logs', 'firewall_logs', 'dns_logs')
        break
      case 'endpoint':
        dataSources.push('endpoint_logs', 'process_logs', 'file_system_logs')
        break
      case 'user_behavior':
        dataSources.push(
          'user_activity_logs',
          'authentication_logs',
          'access_logs',
        )
        break
      case 'malware':
        dataSources.push('file_hashes', 'process_hashes', 'network_connections')
        break
      case 'lateral_movement':
        dataSources.push(
          'network_connections',
          'authentication_logs',
          'process_creation',
        )
        break
      case 'anomaly':
      case 'custom':
        dataSources.push('security_logs', 'system_logs')
    }

    // Add query-specific data sources
    if (query.dataSources) {
      dataSources.push(...query.dataSources)
    }

    // Remove duplicates
    return [...new Set(dataSources)]
  }

  private async executeHuntByPattern(
    execution: HuntExecution,
    pattern: HuntPattern,
  ): Promise<RawHuntFinding[]> {
    try {
      logger.info('Executing hunt by pattern', {
        executionId: execution.executionId,
        patternType: pattern.patternType,
      })

      let results: RawHuntFinding[] = []

      const resolvedPatternType = pattern.patternType ?? 'anomaly'
      switch (resolvedPatternType) {
        case 'network':
          results = await this.executeNetworkHunt(execution, pattern)
          break
        case 'endpoint':
          results = await this.executeEndpointHunt(execution, pattern)
          break
        case 'user_behavior':
          results = await this.executeUserBehaviorHunt(execution, pattern)
          break
        case 'malware':
          results = await this.executeMalwareHunt(execution, pattern)
          break
        case 'lateral_movement':
          results = await this.executeLateralMovementHunt(execution, pattern)
          break
        case 'custom':
        case 'anomaly':
          results = await this.executeCustomHunt(execution, pattern)
          break
        default:
          logger.warn('Unknown pattern type, executing default hunt', {
            patternType: pattern.patternType,
          })
          results = await this.executeDefaultHunt(execution, pattern)
      }

      return results
    } catch (error: unknown) {
      logger.error('Failed to execute hunt by pattern:', { error })
      throw error
    }
  }

  private async executeNetworkHunt(
    execution: HuntExecution,
    _pattern: HuntPattern,
  ): Promise<RawHuntFinding[]> {
    try {
      logger.info('Executing network hunt', {
        executionId: execution.executionId,
      })

      const results: RawHuntFinding[] = []

      // Hunt for suspicious network connections
      const networkResults = await this.huntSuspiciousConnections(execution)
      results.push(...networkResults)

      // Hunt for unusual DNS queries
      const dnsResults = await this.huntUnusualDNSQueries(execution)
      results.push(...dnsResults)

      // Hunt for port scanning activities
      const portScanResults = await this.huntPortScanning(execution)
      results.push(...portScanResults)

      // Hunt for data exfiltration patterns
      const exfilResults = await this.huntDataExfiltration(execution)
      results.push(...exfilResults)

      return results
    } catch (error: unknown) {
      logger.error('Network hunt execution failed:', { error })
      throw error
    }
  }

  private async executeEndpointHunt(
    execution: HuntExecution,
    _pattern: HuntPattern,
  ): Promise<RawHuntFinding[]> {
    try {
      logger.info('Executing endpoint hunt', {
        executionId: execution.executionId,
      })

      const results: RawHuntFinding[] = []

      // Hunt for suspicious processes
      const processResults = await this.huntSuspiciousProcesses(execution)
      results.push(...processResults)

      // Hunt for file system anomalies
      const fileResults = await this.huntFileSystemAnomalies(execution)
      results.push(...fileResults)

      // Hunt for registry modifications
      const registryResults = await this.huntRegistryModifications(execution)
      results.push(...registryResults)

      // Hunt for persistence mechanisms
      const persistenceResults = await this.huntPersistenceMechanisms(execution)
      results.push(...persistenceResults)

      return results
    } catch (error: unknown) {
      logger.error('Endpoint hunt execution failed:', { error })
      throw error
    }
  }

  private async executeUserBehaviorHunt(
    execution: HuntExecution,
    _pattern: HuntPattern,
  ): Promise<RawHuntFinding[]> {
    try {
      logger.info('Executing user behavior hunt', {
        executionId: execution.executionId,
      })

      const results: RawHuntFinding[] = []

      // Hunt for unusual login patterns
      const loginResults = await this.huntUnusualLoginPatterns(execution)
      results.push(...loginResults)

      // Hunt for privilege escalation attempts
      const privilegeResults = await this.huntPrivilegeEscalation(execution)
      results.push(...privilegeResults)

      // Hunt for unusual access patterns
      const accessResults = await this.huntUnusualAccessPatterns(execution)
      results.push(...accessResults)

      // Hunt for account compromise indicators
      const compromiseResults = await this.huntAccountCompromise(execution)
      results.push(...compromiseResults)

      return results
    } catch (error: unknown) {
      logger.error('User behavior hunt execution failed:', { error })
      throw error
    }
  }

  private async executeMalwareHunt(
    execution: HuntExecution,
    _pattern: HuntPattern,
  ): Promise<RawHuntFinding[]> {
    try {
      logger.info('Executing malware hunt', {
        executionId: execution.executionId,
      })

      const results: RawHuntFinding[] = []

      // Hunt for known malware signatures
      const signatureResults = await this.huntKnownMalwareSignatures(execution)
      results.push(...signatureResults)

      // Hunt for suspicious file hashes
      const hashResults = await this.huntSuspiciousFileHashes(execution)
      results.push(...hashResults)

      // Hunt for behavioral indicators
      const behavioralResults =
        await this.huntMalwareBehavioralIndicators(execution)
      results.push(...behavioralResults)

      // Hunt for C2 communications
      const c2Results = await this.huntC2Communications(execution)
      results.push(...c2Results)

      return results
    } catch (error: unknown) {
      logger.error('Malware hunt execution failed:', { error })
      throw error
    }
  }

  private async executeLateralMovementHunt(
    execution: HuntExecution,
    _pattern: HuntPattern,
  ): Promise<RawHuntFinding[]> {
    try {
      logger.info('Executing lateral movement hunt', {
        executionId: execution.executionId,
      })

      const results: RawHuntFinding[] = []

      // Hunt for credential dumping
      const credentialResults = await this.huntCredentialDumping(execution)
      results.push(...credentialResults)

      // Hunt for network enumeration
      const enumerationResults = await this.huntNetworkEnumeration(execution)
      results.push(...enumerationResults)

      // Hunt for service exploitation
      const exploitationResults = await this.huntServiceExploitation(execution)
      results.push(...exploitationResults)

      // Hunt for remote access tools
      const remoteResults = await this.huntRemoteAccessTools(execution)
      results.push(...remoteResults)

      return results
    } catch (error: unknown) {
      logger.error('Lateral movement hunt execution failed:', { error })
      throw error
    }
  }

  private async executeCustomHunt(
    execution: HuntExecution,
    pattern: HuntPattern,
  ): Promise<RawHuntFinding[]> {
    try {
      logger.info('Executing custom hunt', {
        executionId: execution.executionId,
      })

      // Execute custom query logic
      const results = await this.executeCustomQuery(execution, pattern.query)

      return results
    } catch (error: unknown) {
      logger.error('Custom hunt execution failed:', { error })
      throw error
    }
  }

  private async executeDefaultHunt(
    execution: HuntExecution,
    _pattern: HuntPattern,
  ): Promise<RawHuntFinding[]> {
    try {
      logger.info('Executing default hunt', {
        executionId: execution.executionId,
      })

      // Execute basic security log analysis
      const results = await this.executeBasicSecurityAnalysis(execution)

      return results
    } catch (error: unknown) {
      logger.error('Default hunt execution failed:', { error })
      throw error
    }
  }

  // Individual hunt methods for specific patterns
  private async huntSuspiciousConnections(
    execution: HuntExecution,
  ): Promise<RawHuntFinding[]> {
    try {
      const networkLogs = this.getCollection('network_logs')
      const timeRange =
        this.getExecutionTimeRange(execution)

      const suspiciousConnections = await networkLogs
        .find({
          timestamp: {
            $gte: new Date(timeRange.startTime),
            $lte: new Date(timeRange.endTime),
          },
          $or: [
            { destinationPort: { $in: [22, 23, 135, 139, 445, 1433, 3389] } }, // Common attack ports
            {
              connectionState: 'ESTABLISHED',
              bytesTransferred: { $gt: 1000000 },
            }, // Large transfers
            {
              sourceIp: { $regex: /^10\.|^172\.|^192\.168\./ },
              destinationIp: { $not: { $regex: /^10\.|^172\.|^192\.168\./ } },
            }, // Internal to external
          ],
        })
        .limit(execution.maxResults ?? 1000)
        .toArray()

      return suspiciousConnections.map((conn) => ({
        type: 'suspicious_connection',
        severity: 'medium',
        confidence: 0.7,
        data: conn,
        timestamp: this.toDate(conn.timestamp),
      }))
    } catch (error: unknown) {
      logger.error('Suspicious connections hunt failed:', { error })
      return []
    }
  }

  private async huntUnusualDNSQueries(
    execution: HuntExecution,
  ): Promise<RawHuntFinding[]> {
    try {
      const dnsLogs = this.getCollection('dns_logs')
      const timeRange =
        this.getExecutionTimeRange(execution)

      const unusualQueries = await dnsLogs
        .find({
          timestamp: {
            $gte: new Date(timeRange.startTime),
            $lte: new Date(timeRange.endTime),
          },
          $or: [
            { queryType: 'TXT', responseLength: { $gt: 100 } }, // Potential DNS tunneling
            { domainName: { $regex: /[0-9]{4,}\./ } }, // Numeric domains
            { domainName: { $regex: /base64|hex|encode/ } }, // Encoded domains
          ],
        })
        .limit(execution.maxResults ?? 1000)
        .toArray()

      return unusualQueries.map((query) => ({
        type: 'unusual_dns_query',
        severity: 'high',
        confidence: 0.8,
        data: query,
        timestamp: this.toDate(query.timestamp),
      }))
    } catch (error: unknown) {
      logger.error('Unusual DNS queries hunt failed:', { error })
      return []
    }
  }

  private async huntPortScanning(execution: HuntExecution): Promise<RawHuntFinding[]> {
    try {
      const networkLogs = this.getCollection('network_logs')
      const timeRange =
        this.getExecutionTimeRange(execution)

      // Look for rapid connection attempts to different ports from same source
      const portScanCandidates = await networkLogs
        .aggregate<PortScanAggregateResult>([
          {
            $match: {
              timestamp: {
                $gte: new Date(timeRange.startTime),
                $lte: new Date(timeRange.endTime),
              },
            },
          },
          {
            $group: {
              _id: {
                sourceIp: '$sourceIp',
                hour: {
                  $dateToString: {
                    format: '%Y-%m-%d %H:00',
                    date: '$timestamp',
                  },
                },
              },
              uniquePorts: { $addToSet: '$destinationPort' },
              connectionCount: { $sum: 1 },
              timestamps: { $push: '$timestamp' },
            },
          },
          {
            $match: {
              $expr: { $gte: [{ $size: '$uniquePorts' }, 10] }, // 10+ unique ports
            },
          },
        ])
        .limit(execution.maxResults ?? 100)
        .toArray()

      return portScanCandidates.map((scan) => ({
        type: 'port_scanning',
        severity: 'high',
        confidence: 0.9,
        data: this.toDocumentRecord(scan),
        timestamp: this.toDate(scan["_id"].hour),
      }))
    } catch (error: unknown) {
      logger.error('Port scanning hunt failed:', { error })
      return []
    }
  }

  private async huntDataExfiltration(
    execution: HuntExecution,
  ): Promise<RawHuntFinding[]> {
    try {
      const networkLogs = this.getCollection('network_logs')
      const timeRange =
        this.getExecutionTimeRange(execution)

      const exfilPatterns = await networkLogs
        .find({
          timestamp: {
            $gte: new Date(timeRange.startTime),
            $lte: new Date(timeRange.endTime),
          },
          bytesTransferred: { $gt: 10000000 }, // 10MB+
          destinationIp: { $not: { $regex: /^10\.|^172\.|^192\.168\./ } }, // External destination
        })
        .sort({ bytesTransferred: -1 })
        .limit(execution.maxResults ?? 100)
        .toArray()

      return exfilPatterns.map((exfil) => ({
        type: 'data_exfiltration',
        severity: 'critical',
        confidence: 0.8,
        data: exfil,
        timestamp: this.toDate(exfil.timestamp),
      }))
    } catch (error: unknown) {
      logger.error('Data exfiltration hunt failed:', { error })
      return []
    }
  }

  private async huntSuspiciousProcesses(
    execution: HuntExecution,
  ): Promise<RawHuntFinding[]> {
    try {
      const processLogs = this.getCollection('process_logs')
      const timeRange =
        this.getExecutionTimeRange(execution)

      const suspiciousProcesses = await processLogs
        .find({
          timestamp: {
            $gte: new Date(timeRange.startTime),
            $lte: new Date(timeRange.endTime),
          },
          $or: [
            { processName: { $regex: /powershell|cmd\.exe|wscript|cscript/i } }, // Scripting tools
            { commandLine: { $regex: /-enc |base64|bypass|hidden/i } }, // Suspicious parameters
            {
              parentProcess: 'explorer.exe',
              processName: { $regex: /\.exe$/i },
            }, // Executables from explorer
          ],
        })
        .limit(execution.maxResults ?? 1000)
        .toArray()

      return suspiciousProcesses.map((proc) => ({
        type: 'suspicious_process',
        severity: 'high',
        confidence: 0.8,
        data: proc,
        timestamp: this.toDate(proc.timestamp),
      }))
    } catch (error: unknown) {
      logger.error('Suspicious processes hunt failed:', { error })
      return []
    }
  }

  private async huntFileSystemAnomalies(
    execution: HuntExecution,
  ): Promise<RawHuntFinding[]> {
    try {
      const fileLogs = this.getCollection('file_system_logs')
      const timeRange =
        this.getExecutionTimeRange(execution)

      const fileAnomalies = await fileLogs
        .find({
          timestamp: {
            $gte: new Date(timeRange.startTime),
            $lte: new Date(timeRange.endTime),
          },
          $or: [
            {
              filePath: { $regex: /temp|tmp|appdata/i },
              operation: 'CREATE',
              fileSize: { $gt: 1000000 },
            }, // Large temp files
            {
              filePath: { $regex: /system32|syswow64/i },
              operation: 'MODIFY',
              user: { $ne: 'SYSTEM' },
            }, // System file modifications
            {
              fileExtension: { $in: ['.exe', '.dll', '.sys'] },
              operation: 'CREATE',
              digitalSignature: { $exists: false },
            }, // Unsigned executables
          ],
        })
        .limit(execution.maxResults ?? 1000)
        .toArray()

      return fileAnomalies.map((file) => ({
        type: 'file_system_anomaly',
        severity: 'medium',
        confidence: 0.7,
        data: file,
        timestamp: this.toDate(file.timestamp),
      }))
    } catch (error: unknown) {
      logger.error('File system anomalies hunt failed:', { error })
      return []
    }
  }

  private async huntRegistryModifications(
    execution: HuntExecution,
  ): Promise<RawHuntFinding[]> {
    try {
      const registryLogs = this.getCollection('registry_logs')
      const timeRange =
        this.getExecutionTimeRange(execution)

      const registryMods = await registryLogs
        .find({
          timestamp: {
            $gte: new Date(timeRange.startTime),
            $lte: new Date(timeRange.endTime),
          },
          $or: [
            { keyPath: { $regex: /run|runonce|services/i } }, // Auto-start locations
            { keyPath: { $regex: /security|policy|audit/i } }, // Security settings
            {
              operation: 'CREATE',
              valueData: { $regex: /http|ftp|powershell/i },
            }, // Suspicious values
          ],
        })
        .limit(execution.maxResults ?? 1000)
        .toArray()

      return registryMods.map((reg) => ({
        type: 'registry_modification',
        severity: 'high',
        confidence: 0.8,
        data: reg,
        timestamp: this.toDate(reg.timestamp),
      }))
    } catch (error: unknown) {
      logger.error('Registry modifications hunt failed:', { error })
      return []
    }
  }

  private async huntPersistenceMechanisms(
    execution: HuntExecution,
  ): Promise<RawHuntFinding[]> {
    try {
      const persistenceLogs = this.getCollection('persistence_logs')
      const timeRange =
        this.getExecutionTimeRange(execution)

      const persistenceMechanisms = await persistenceLogs
        .find({
          timestamp: {
            $gte: new Date(timeRange.startTime),
            $lte: new Date(timeRange.endTime),
          },
          mechanismType: {
            $in: ['service', 'scheduled_task', 'registry', 'startup_folder'],
          },
        })
        .limit(execution.maxResults ?? 500)
        .toArray()

      return persistenceMechanisms.map((persist) => ({
        type: 'persistence_mechanism',
        severity: 'high',
        confidence: 0.9,
        data: persist,
        timestamp: this.toDate(persist.timestamp),
      }))
    } catch (error: unknown) {
      logger.error('Persistence mechanisms hunt failed:', { error })
      return []
    }
  }

  private async huntUnusualLoginPatterns(
    execution: HuntExecution,
  ): Promise<RawHuntFinding[]> {
    try {
      const authLogs = this.getCollection('authentication_logs')
      const timeRange =
        this.getExecutionTimeRange(execution)

      const unusualLogins = await authLogs
        .aggregate<LoginAggregateResult>([
          {
            $match: {
              timestamp: {
                $gte: new Date(timeRange.startTime),
                $lte: new Date(timeRange.endTime),
              },
              eventType: 'login',
            },
          },
          {
            $group: {
              _id: '$userId',
              loginCount: { $sum: 1 },
              uniqueLocations: { $addToSet: '$sourceIp' },
              failureCount: {
                $sum: { $cond: [{ $eq: ['$status', 'failure'] }, 1, 0] },
              },
              timestamps: { $push: '$timestamp' },
            },
          },
          {
            $match: {
              $or: [
                { failureCount: { $gte: 5 } }, // Multiple failures
                { uniqueLocations: { $size: { $gte: 3 } } }, // Multiple locations
              ],
            },
          },
        ])
        .limit(execution.maxResults ?? 100)
        .toArray()

      return unusualLogins.map((login) => ({
        type: 'unusual_login_pattern',
        severity: 'medium',
        confidence: 0.7,
        data: this.toDocumentRecord(login),
        timestamp: new Date(),
      }))
    } catch (error: unknown) {
      logger.error('Unusual login patterns hunt failed:', { error })
      return []
    }
  }

  private async huntPrivilegeEscalation(
    execution: HuntExecution,
  ): Promise<RawHuntFinding[]> {
    try {
      const authLogs = this.getCollection('authentication_logs')
      const timeRange =
        this.getExecutionTimeRange(execution)

      const privilegeEscalations = await authLogs
        .find({
          timestamp: {
            $gte: new Date(timeRange.startTime),
            $lte: new Date(timeRange.endTime),
          },
          eventType: 'privilege_change',
          $or: [
            { oldRole: 'user', newRole: { $in: ['admin', 'root'] } },
            { oldRole: { $in: ['guest', 'limited'] }, newRole: 'user' },
          ],
        })
        .limit(execution.maxResults ?? 500)
        .toArray()

      return privilegeEscalations.map((escalation) => ({
        type: 'privilege_escalation',
        severity: 'high',
        confidence: 0.8,
        data: escalation,
        timestamp: this.toDate(escalation.timestamp),
      }))
    } catch (error: unknown) {
      logger.error('Privilege escalation hunt failed:', { error })
      return []
    }
  }

  private async huntUnusualAccessPatterns(
    execution: HuntExecution,
  ): Promise<RawHuntFinding[]> {
    try {
      const accessLogs = this.getCollection('access_logs')
      const timeRange =
        this.getExecutionTimeRange(execution)

      const unusualAccess = await accessLogs
        .aggregate<AccessAggregateResult>([
          {
            $match: {
              timestamp: {
                $gte: new Date(timeRange.startTime),
                $lte: new Date(timeRange.endTime),
              },
            },
          },
          {
            $group: {
              _id: '$userId',
              accessCount: { $sum: 1 },
              uniqueResources: { $addToSet: '$resource' },
              accessTimes: { $push: { $hour: '$timestamp' } },
            },
          },
          {
            $match: {
              $or: [
                { accessCount: { $gte: 100 } }, // High access volume
                { uniqueResources: { $size: { $gte: 20 } } }, // Many different resources
              ],
            },
          },
        ])
        .limit(execution.maxResults ?? 100)
        .toArray()

      return unusualAccess.map((access) => ({
        type: 'unusual_access_pattern',
        severity: 'low',
        confidence: 0.6,
        data: this.toDocumentRecord(access),
        timestamp: new Date(),
      }))
    } catch (error: unknown) {
      logger.error('Unusual access patterns hunt failed:', { error })
      return []
    }
  }

  private async huntAccountCompromise(
    execution: HuntExecution,
  ): Promise<RawHuntFinding[]> {
    try {
      const authLogs = this.getCollection('authentication_logs')
      const timeRange =
        this.getExecutionTimeRange(execution)

      const compromisedAccounts = await authLogs
        .aggregate([
          {
            $match: {
              timestamp: {
                $gte: new Date(timeRange.startTime),
                $lte: new Date(timeRange.endTime),
              },
              eventType: 'login',
              status: 'success',
            },
          },
          {
            $group: {
              _id: '$userId',
              loginLocations: { $addToSet: '$sourceIp' },
              loginTimes: { $push: '$timestamp' },
              deviceTypes: { $addToSet: '$deviceType' },
            },
          },
          {
            $match: {
              $or: [
                { loginLocations: { $size: { $gte: 5 } } }, // Multiple locations
                { deviceTypes: { $size: { $gte: 3 } } }, // Multiple device types
              ],
            },
          },
        ])
        .limit(execution.maxResults ?? 100)
        .toArray()

      return compromisedAccounts.map((account) => ({
        type: 'account_compromise',
        severity: 'critical',
        confidence: 0.9,
        data: account,
        timestamp: new Date(),
      }))
    } catch (error: unknown) {
      logger.error('Account compromise hunt failed:', { error })
      return []
    }
  }

  private async huntKnownMalwareSignatures(
    execution: HuntExecution,
  ): Promise<RawHuntFinding[]> {
    try {
      const fileLogs = this.getCollection('file_system_logs')
      const timeRange =
        this.getExecutionTimeRange(execution)

      // Get known malware signatures from threat intelligence
      const malwareCollection = this.getCollection('malware_signatures')
      const knownSignatures = await malwareCollection.find({}).toArray()
      const signatureHashes = knownSignatures
        .map((sig) => this.toStringValue(sig.hash))
        .filter((hash): hash is string => typeof hash === 'string' && hash.length > 0)

      const malwareFiles = await fileLogs
        .find({
          timestamp: {
            $gte: new Date(timeRange.startTime),
            $lte: new Date(timeRange.endTime),
          },
          fileHash: { $in: signatureHashes },
          operation: 'CREATE',
        })
        .limit(execution.maxResults ?? 100)
        .toArray()

      return malwareFiles.map((file) => ({
        type: 'known_malware_signature',
        severity: 'critical',
        confidence: 1.0,
        data: file,
        timestamp: this.toDate(file.timestamp),
      }))
    } catch (error: unknown) {
      logger.error('Known malware signatures hunt failed:', { error })
      return []
    }
  }

  private async huntSuspiciousFileHashes(
    execution: HuntExecution,
  ): Promise<RawHuntFinding[]> {
    try {
      const fileLogs = this.getCollection('file_system_logs')
      const timeRange =
        this.getExecutionTimeRange(execution)

      const suspiciousHashes = await fileLogs
        .find({
          timestamp: {
            $gte: new Date(timeRange.startTime),
            $lte: new Date(timeRange.endTime),
          },
          fileHash: { $exists: true },
          $or: [
            { digitalSignature: { $exists: false } }, // Unsigned files
            { fileSize: { $gt: 50000000 } }, // Large files (50MB+)
            { fileExtension: '.exe', filePath: { $regex: /temp|tmp/i } }, // Executables in temp
          ],
        })
        .limit(execution.maxResults ?? 500)
        .toArray()

      return suspiciousHashes.map((file) => ({
        type: 'suspicious_file_hash',
        severity: 'medium',
        confidence: 0.6,
        data: file,
        timestamp: this.toDate(file.timestamp),
      }))
    } catch (error: unknown) {
      logger.error('Suspicious file hashes hunt failed:', { error })
      return []
    }
  }

  private async huntMalwareBehavioralIndicators(
    execution: HuntExecution,
  ): Promise<RawHuntFinding[]> {
    try {
      const processLogs = this.getCollection('process_logs')
      const timeRange =
        this.getExecutionTimeRange(execution)

      const behavioralIndicators = await processLogs
        .find({
          timestamp: {
            $gte: new Date(timeRange.startTime),
            $lte: new Date(timeRange.endTime),
          },
          $or: [
            {
              processName: { $regex: /svchost|lsass|winlogon/i },
              parentProcess: { $ne: 'services.exe' },
            }, // Masquerading
            { commandLine: { $regex: /-nop|-windowstyle hidden|bypass/i } }, // PowerShell evasion
            {
              processName: { $regex: /\.exe$/i },
              digitalSignature: { $exists: false },
            }, // Unsigned executables
          ],
        })
        .limit(execution.maxResults ?? 1000)
        .toArray()

      return behavioralIndicators.map((indicator) => ({
        type: 'malware_behavioral_indicator',
        severity: 'high',
        confidence: 0.8,
        data: this.toDocumentRecord(indicator),
        timestamp: this.toDate(indicator.timestamp),
      }))
    } catch (error: unknown) {
      logger.error('Malware behavioral indicators hunt failed:', { error })
      return []
    }
  }

  private async huntC2Communications(
    execution: HuntExecution,
  ): Promise<RawHuntFinding[]> {
    try {
      const networkLogs = this.getCollection('network_logs')
      const timeRange =
        this.getExecutionTimeRange(execution)

      // Look for periodic beacons to external IPs
      const c2Communications = await networkLogs
        .aggregate<LateralAggregateResult>([
          {
            $match: {
              timestamp: {
                $gte: new Date(timeRange.startTime),
                $lte: new Date(timeRange.endTime),
              },
              destinationIp: { $not: { $regex: /^10\.|^172\.|^192\.168\./ } },
            },
          },
          {
            $group: {
              _id: {
                sourceIp: '$sourceIp',
                destinationIp: '$destinationIp',
                destinationPort: '$destinationPort',
              },
              connectionCount: { $sum: 1 },
              timestamps: { $push: '$timestamp' },
              totalBytes: { $sum: '$bytesTransferred' },
            },
          },
          {
            $match: {
              connectionCount: { $gte: 10 }, // Multiple connections
              totalBytes: { $lt: 10000 }, // Small data transfers (beacons)
            },
          },
        ])
        .limit(execution.maxResults ?? 100)
        .toArray()

      return c2Communications.map((comm) => ({
        type: 'c2_communication',
        severity: 'critical',
        confidence: 0.9,
        data: this.toDocumentRecord(comm),
        timestamp: new Date(),
      }))
    } catch (error: unknown) {
      logger.error('C2 communications hunt failed:', { error })
      return []
    }
  }

  private async huntCredentialDumping(
    execution: HuntExecution,
  ): Promise<RawHuntFinding[]> {
    try {
      const processLogs = this.getCollection('process_logs')
      const timeRange =
        this.getExecutionTimeRange(execution)

      const credentialDumping = await processLogs
        .find({
          timestamp: {
            $gte: new Date(timeRange.startTime),
            $lte: new Date(timeRange.endTime),
          },
          $or: [
            { processName: { $regex: /mimikatz|sekurlsa|lsadump/i } },
            { commandLine: { $regex: /sekurlsa::|lsadump::|hashdump/i } },
            { processName: 'lsass.exe', accessType: { $regex: /read|full/i } },
          ],
        })
        .limit(execution.maxResults ?? 100)
        .toArray()

      return credentialDumping.map((dump) => ({
        type: 'credential_dumping',
        severity: 'critical',
        confidence: 0.95,
        data: dump,
        timestamp: this.toDate(dump.timestamp),
      }))
    } catch (error: unknown) {
      logger.error('Credential dumping hunt failed:', { error })
      return []
    }
  }

  private async huntNetworkEnumeration(
    execution: HuntExecution,
  ): Promise<RawHuntFinding[]> {
    try {
      const networkLogs = this.getCollection('network_logs')
      const timeRange =
        this.getExecutionTimeRange(execution)

      const networkEnumeration = await networkLogs
        .aggregate<LateralAggregateResult>([
          {
            $match: {
              timestamp: {
                $gte: new Date(timeRange.startTime),
                $lte: new Date(timeRange.endTime),
              },
            },
          },
          {
            $group: {
              _id: {
                sourceIp: '$sourceIp',
                hour: {
                  $dateToString: {
                    format: '%Y-%m-%d %H:00',
                    date: '$timestamp',
                  },
                },
              },
              uniqueDestinations: { $addToSet: '$destinationIp' },
              connectionCount: { $sum: 1 },
              portsScanned: { $addToSet: '$destinationPort' },
            },
          },
          {
            $match: {
              $or: [
                { uniqueDestinations: { $size: { $gte: 20 } } }, // Many destinations
                { portsScanned: { $size: { $gte: 15 } } }, // Many ports
              ],
            },
          },
        ])
        .limit(execution.maxResults ?? 100)
        .toArray()

      return networkEnumeration.map((enumeration) => ({
        type: 'network_enumeration',
        severity: 'medium',
        confidence: 0.7,
        data: this.toDocumentRecord(enumeration),
        timestamp: this.toDate(enumeration._id.hour),
      }))
    } catch (error: unknown) {
      logger.error('Network enumeration hunt failed:', { error })
      return []
    }
  }

  private async huntServiceExploitation(
    execution: HuntExecution,
  ): Promise<RawHuntFinding[]> {
    try {
      const systemLogs = this.getCollection('system_logs')
      const timeRange =
        this.getExecutionTimeRange(execution)

      const serviceExploitation = await systemLogs
        .find({
          timestamp: {
            $gte: new Date(timeRange.startTime),
            $lte: new Date(timeRange.endTime),
          },
          eventType: 'service',
          $or: [
            { message: { $regex: /exploit|buffer overflow|injection/i } },
            {
              serviceName: { $in: ['smb', 'rdp', 'ssh', 'ftp'] },
              status: 'crashed',
            },
          ],
        })
        .limit(execution.maxResults ?? 200)
        .toArray()

      return serviceExploitation.map((exploit) => ({
        type: 'service_exploitation',
        severity: 'critical',
        confidence: 0.85,
        data: exploit,
        timestamp: this.toDate(exploit.timestamp),
      }))
    } catch (error: unknown) {
      logger.error('Service exploitation hunt failed:', { error })
      return []
    }
  }

  private async huntRemoteAccessTools(
    execution: HuntExecution,
  ): Promise<RawHuntFinding[]> {
    try {
      const processLogs = this.getCollection('process_logs')
      const timeRange =
        this.getExecutionTimeRange(execution)

      const remoteAccessTools = await processLogs
        .find({
          timestamp: {
            $gte: new Date(timeRange.startTime),
            $lte: new Date(timeRange.endTime),
          },
          processName: {
            $in: [
              'teamviewer.exe',
              'anydesk.exe',
              'logmein.exe',
              'gotomypc.exe',
              'vncserver.exe',
              'radmin.exe',
              'dameware.exe',
            ],
          },
        })
        .limit(execution.maxResults ?? 100)
        .toArray()

      return remoteAccessTools.map((tool) => ({
        type: 'remote_access_tool',
        severity: 'medium',
        confidence: 0.8,
        data: tool,
        timestamp: this.toDate(tool.timestamp),
      }))
    } catch (error: unknown) {
      logger.error('Remote access tools hunt failed:', { error })
      return []
    }
  }

  private async executeCustomQuery(
    execution: HuntExecution,
    query: string,
  ): Promise<RawHuntFinding[]> {
    try {
      logger.info('Executing custom query', {
        executionId: execution.executionId,
        queryLength: query.length,
      })

      // Parse and execute custom query
      // This would typically involve a query parser and execution engine
      // For now, we'll simulate results

      const results = [
        {
          type: 'custom_query_result',
          severity: 'medium',
          confidence: 0.7,
          data: { query, result: 'custom_result' },
          timestamp: new Date(),
        },
      ]

      return results
    } catch (error: unknown) {
      logger.error('Custom query execution failed:', { error })
      return []
    }
  }

  private async executeBasicSecurityAnalysis(
    execution: HuntExecution,
  ): Promise<RawHuntFinding[]> {
    try {
      const securityLogs = this.getCollection('security_logs')
      const timeRange =
        this.getExecutionTimeRange(execution)

      const securityEvents = await securityLogs
        .find({
          timestamp: {
            $gte: new Date(timeRange.startTime),
            $lte: new Date(timeRange.endTime),
          },
          severity: { $in: ['high', 'critical'] },
        })
        .limit(execution.maxResults ?? 1000)
        .toArray()

      return securityEvents.map((event) => ({
        type: 'security_event',
        severity: this.normalizeSeverity(event.severity),
        confidence: 0.8,
        data: this.toDocumentRecord(event),
        timestamp: this.toDate(event.timestamp),
      }))
    } catch (error: unknown) {
      logger.error('Basic security analysis failed:', { error })
      return []
    }
  }

  private async analyzeHuntResults(
    results: RawHuntFinding[],
    pattern: HuntPattern,
  ): Promise<RawHuntFinding[]> {
    try {
      logger.info('Analyzing hunt results', {
        resultCount: results.length,
        patternId: pattern.patternId,
      })

      const analyzedResults: RawHuntFinding[] = []

      for (const result of results) {
        const analyzedResult = await this.analyzeIndividualResult(
          result,
          pattern,
        )
      analyzedResults.push(analyzedResult)
      }

      // Apply pattern-specific analysis
      const patternAnalyzedResults = await this.applyPatternAnalysis(
        analyzedResults,
        pattern,
      )

      return patternAnalyzedResults
    } catch (error: unknown) {
      logger.error('Hunt result analysis failed:', { error })
      return results
    }
  }

  private async analyzeIndividualResult(
    result: RawHuntFinding,
    pattern: HuntPattern,
  ): Promise<RawHuntFinding> {
    try {
      // Calculate confidence based on pattern and result characteristics
      let confidence = result.confidence

      // Adjust confidence based on severity
      if (result.severity === 'critical') {
        confidence = Math.min(confidence * 1.2, 1.0)
      } else if (result.severity === 'high') {
        confidence = Math.min(confidence * 1.1, 1.0)
      }

      // Add analysis metadata
      const analyzedResult = {
        ...result,
        confidence,
        analysisTimestamp: new Date(),
        patternId: pattern.patternId,
        analysisMethod: 'automated',
      }

      return analyzedResult
    } catch (error: unknown) {
      logger.error('Individual result analysis failed:', { error })
      return result
    }
  }

  private async applyPatternAnalysis(
    results: RawHuntFinding[],
    pattern: HuntPattern,
  ): Promise<RawHuntFinding[]> {
    try {
      // Apply pattern-specific analysis logic
    const resolvedPatternType = pattern.patternType ?? 'anomaly'
    switch (resolvedPatternType) {
        case 'network':
          return await this.analyzeNetworkResults(results)
        case 'endpoint':
          return await this.analyzeEndpointResults(results)
        case 'user_behavior':
          return await this.analyzeUserBehaviorResults(results)
        case 'malware':
          return await this.analyzeMalwareResults(results)
        case 'lateral_movement':
          return await this.analyzeLateralMovementResults(results)
        case 'anomaly':
        case 'custom':
          return results
      }
    return results
    } catch (error: unknown) {
      logger.error('Pattern analysis failed:', { error })
      return results
    }
  }

  private async analyzeNetworkResults(
    results: RawHuntFinding[],
  ): Promise<RawHuntFinding[]> {
    try {
      // Group by source IP and analyze patterns
      const groupedBySource = this.groupBy(results, 'data.sourceIp')

      for (const [_sourceIp, sourceResults] of Object.entries(
        groupedBySource,
      )) {
        if (sourceResults.length >= 5) {
          // Mark as suspicious if many results from same source
          sourceResults.forEach((result) => {
            result.confidence = Math.min(result.confidence * 1.3, 1.0)
            result.severity = this.increaseSeverity(result.severity)
          })
        }
      }

      return results
    } catch (error: unknown) {
      logger.error('Network results analysis failed:', { error })
      return results
    }
  }

  private async analyzeEndpointResults(
    results: RawHuntFinding[],
  ): Promise<RawHuntFinding[]> {
    try {
      // Look for process chains and file system patterns
      const processResults = results.filter(
        (r) => r.type === 'suspicious_process',
      )
      const fileResults = results.filter(
        (r) => r.type === 'file_system_anomaly',
      )

      // Correlate processes with file activities
      for (const processResult of processResults) {
        const relatedFiles = fileResults.filter(
          (file) =>
            Math.abs(
              this.toDate(file.timestamp).getTime() - this.toDate(processResult.timestamp).getTime(),
            ) < 60000, // Within 1 minute
        )

        if (relatedFiles.length > 0) {
          processResult.confidence = Math.min(
            processResult.confidence * 1.2,
            1.0,
          )
          processResult.relatedFindings = relatedFiles
            .map((f) => this.toStringValue(f.data.filePath))
            .filter((path): path is string => path !== undefined)
        }
      }

      return results
    } catch (error: unknown) {
      logger.error('Endpoint results analysis failed:', { error })
      return results
    }
  }

  private async analyzeUserBehaviorResults(
    results: RawHuntFinding[],
  ): Promise<RawHuntFinding[]> {
    try {
      // Look for behavioral patterns across time
      const loginResults = results.filter(
        (r) => r.type === 'unusual_login_pattern',
      )
      const accessResults = results.filter(
        (r) => r.type === 'unusual_access_pattern',
      )

      for (const loginResult of loginResults) {
        const loginDataId = this.toStringValue(loginResult.data._id)
        const userAccess = accessResults.filter(
          (access) => this.toStringValue(access.data._id) === loginDataId,
        )

        if (userAccess.length > 0) {
          loginResult.confidence = Math.min(loginResult.confidence * 1.2, 1.0)
          loginResult.relatedFindings = userAccess.map((a) => a.type)
        }
      }

      return results
    } catch (error: unknown) {
      logger.error('User behavior results analysis failed:', { error })
      return results
    }
  }

  private async analyzeMalwareResults(
    results: RawHuntFinding[],
  ): Promise<RawHuntFinding[]> {
    try {
      // Prioritize known malware signatures
      const signatureResults = results.filter(
        (r) => r.type === 'known_malware_signature',
      )
      const behavioralResults = results.filter(
        (r) => r.type === 'malware_behavioral_indicator',
      )

      // Increase confidence for known malware
      signatureResults.forEach((result) => {
        result.confidence = 1.0
        result.severity = 'critical'
      })

      // Correlate behavioral indicators with signatures
      for (const behavioralResult of behavioralResults) {
        const behavioralSourceIp = this.toStringValue(
          behavioralResult.data.sourceIp,
        )
        const behavioralProcessId = this.toStringValue(
          behavioralResult.data.processId,
        )

        const relatedSignatures = signatureResults.filter((sig) => {
          if (this.toStringValue(sig.data.sourceIp) === behavioralSourceIp) {
            return true
          }
          return this.toStringValue(sig.data.processId) === behavioralProcessId
        })

        if (relatedSignatures.length > 0) {
          behavioralResult.confidence = Math.min(
            behavioralResult.confidence * 1.3,
            1.0,
          )
        }
      }

      return results
    } catch (error: unknown) {
      logger.error('Malware results analysis failed:', { error })
      return results
    }
  }

  private async analyzeLateralMovementResults(
    results: RawHuntFinding[],
  ): Promise<RawHuntFinding[]> {
    try {
      // Look for chains of lateral movement indicators
      const credentialResults = results.filter(
        (r) => r.type === 'credential_dumping',
      )
      const enumerationResults = results.filter(
        (r) => r.type === 'network_enumeration',
      )
      const remoteResults = results.filter(
        (r) => r.type === 'remote_access_tool',
      )

      // Correlate different lateral movement stages
      for (const credentialResult of credentialResults) {
        const relatedEnumeration = enumerationResults.filter(
          (enumResult) =>
            this.toStringValue(
              this.getNestedValue(enumResult.data, '_id.sourceIp'),
            ) === this.toStringValue(credentialResult.data.sourceIp),
        )

        const relatedRemote = remoteResults.filter(
          (remoteResult) =>
            this.toStringValue(remoteResult.data.sourceIp) ===
              this.toStringValue(credentialResult.data.sourceIp),
        )

        if (relatedEnumeration.length > 0 || relatedRemote.length > 0) {
          credentialResult.confidence = Math.min(
            credentialResult.confidence * 1.4,
            1.0,
          )
          credentialResult.severity = 'critical'
        }
      }

      return results
    } catch (error: unknown) {
      logger.error('Lateral movement results analysis failed:', { error })
      return results
    }
  }

  private groupBy(
    array: RawHuntFinding[],
    keyPath: string,
  ): Record<string, RawHuntFinding[]> {
    const groups: Record<string, RawHuntFinding[]> = {}

    for (const item of array) {
      const key = this.getNestedValue(item, keyPath)
      if (typeof key !== 'string') {
        continue
      }

      ;(groups[key] ??= []).push(item)
    }

    return groups
  }

  private increaseSeverity(severity: string): string {
    const severityLevels = ['low', 'medium', 'high', 'critical']
    const currentIndex = severityLevels.indexOf(severity)
    if (currentIndex < severityLevels.length - 1) {
      return severityLevels[currentIndex + 1]
    }
    return severity
  }

  private async generateThreatIntelligence(
    results: RawHuntFinding[],
    pattern: HuntPattern,
    execution: HuntExecution,
  ): Promise<GlobalThreatIntelligence[]> {
    try {
      logger.info('Generating threat intelligence from hunt results', {
        resultCount: results.length,
        patternId: pattern.patternId,
      })

      const threats: GlobalThreatIntelligence[] = []

      for (const result of results) {
        if (result.confidence >= 0.7) {
          // Only high-confidence results
          const threat = await this.createThreatFromResult(result, pattern, execution)
          if (threat) {
            threats.push(threat)
          }
        }
      }

      // Deduplicate threats
      const uniqueThreats = this.deduplicateThreats(threats)

      logger.info(
        `Generated ${uniqueThreats.length} unique threats from hunt results`,
      )

      return uniqueThreats
    } catch (error: unknown) {
      logger.error('Threat intelligence generation failed:', { error })
      return []
    }
  }

  private async createThreatFromResult(
    result: RawHuntFinding,
    pattern: HuntPattern,
    execution: HuntExecution,
  ): Promise<GlobalThreatIntelligence | null> {
    try {
      const threatId = this.generateThreatId()

      // Extract indicators from result
      const indicators = this.extractIndicatorsFromResult(result)

      if (indicators.length === 0) {
        return null
      }

      const threat: GlobalThreatIntelligence = {
        intelligenceId: threatId,
        threatId,
        threatType: this.mapResultToThreatType(result),
        severity: this.normalizeSeverity(result.severity),
        confidence: result.confidence,
        indicators,
        firstSeen: this.toDate(result.timestamp),
        lastSeen: this.toDate(result.timestamp),
        regions: execution.regions,
        impactAssessment: {
          geographicSpread: execution.regions.length,
          affectedRegions: execution.regions,
          affectedSectors: [],
          potentialImpact: result.confidence * 100,
        },
        correlationData: {
          correlationId: execution.executionId,
          correlatedThreats: [],
          correlationStrength: result.confidence,
          correlationType: 'hunting',
          confidence: result.confidence,
          analysisMethod: 'pattern_match',
          timestamp: this.toDate(result.timestamp),
        },
        validationStatus: {
          validationId: `validation_${execution.executionId}`,
          status: 'pending',
          accuracy: result.confidence,
          completeness: result.confidence,
          consistency: 1,
          timeliness: 1,
          relevance: result.confidence,
          validator: 'system',
          validationDate: this.toDate(result.timestamp),
          feedback: [],
        },
        attribution: {
          family: pattern.name,
          campaign: `hunt_${pattern.patternId}`,
          confidence: result.confidence,
        },
        metadata: {
          source: 'threat_hunting',
          huntId: execution.huntId,
          patternId: pattern.patternId,
          resultType: result.type,
          analysisMethod: 'automated',
        },
      }

      return threat
    } catch (error: unknown) {
      logger.error('Failed to create threat from result:', { error })
      return null
    }
  }

  private extractIndicatorsFromResult(result: RawHuntFinding): ThreatIndicator[] {
    const indicators: ThreatIndicator[] = []

    try {
      // Extract IP addresses
      const sourceIp = this.toStringValue(result.data.sourceIp)
      if (sourceIp) {
        indicators.push({
          indicatorType: 'ip',
          value: sourceIp,
          confidence: result.confidence,
          firstSeen: this.toDate(result.timestamp),
          lastSeen: this.toDate(result.timestamp),
        })
      }

      const destinationIp = this.toStringValue(result.data.destinationIp)
      if (destinationIp) {
        indicators.push({
          indicatorType: 'ip',
          value: destinationIp,
          confidence: result.confidence,
          firstSeen: this.toDate(result.timestamp),
          lastSeen: this.toDate(result.timestamp),
        })
      }

      // Extract file hashes
      const fileHash = this.toStringValue(result.data.fileHash)
      if (fileHash) {
        indicators.push({
          indicatorType: 'file_hash',
          value: fileHash,
          confidence: result.confidence,
          firstSeen: this.toDate(result.timestamp),
          lastSeen: this.toDate(result.timestamp),
        })
      }

      // Extract domain names
      const domainName = this.toStringValue(result.data.domainName)
      if (domainName) {
        indicators.push({
          indicatorType: 'domain',
          value: domainName,
          confidence: result.confidence,
          firstSeen: this.toDate(result.timestamp),
          lastSeen: this.toDate(result.timestamp),
        })
      }

      // Extract URLs
      const url = this.toStringValue(result.data.url)
      if (url) {
        indicators.push({
          indicatorType: 'url',
          value: url,
          confidence: result.confidence,
          firstSeen: this.toDate(result.timestamp),
          lastSeen: this.toDate(result.timestamp),
        })
      }

      // Extract process names
      const processName = this.toStringValue(result.data.processName)
      if (processName) {
        indicators.push({
          indicatorType: 'process',
          value: processName,
          confidence: result.confidence,
          firstSeen: this.toDate(result.timestamp),
          lastSeen: this.toDate(result.timestamp),
        })
      }

      return indicators
    } catch (error: unknown) {
      logger.error('Failed to extract indicators from result:', { error })
      return []
    }
  }

  private mapResultToThreatType(result: RawHuntFinding): string {
    const typeMap: Record<string, string> = {
      suspicious_connection: 'network_intrusion',
      unusual_dns_query: 'dns_tunneling',
      port_scanning: 'reconnaissance',
      data_exfiltration: 'data_breach',
      suspicious_process: 'malware',
      file_system_anomaly: 'persistence',
      registry_modification: 'persistence',
      persistence_mechanism: 'persistence',
      unusual_login_pattern: 'account_compromise',
      privilege_escalation: 'privilege_escalation',
      unusual_access_pattern: 'insider_threat',
      account_compromise: 'account_compromise',
      known_malware_signature: 'malware',
      suspicious_file_hash: 'malware',
      malware_behavioral_indicator: 'malware',
      c2_communication: 'c2',
      credential_dumping: 'credential_access',
      network_enumeration: 'discovery',
      service_exploitation: 'exploitation',
      remote_access_tool: 'remote_access',
    }

    return typeMap[result.type] ?? 'general'
  }

  private mapToHuntFinding(result: RawHuntFinding): HuntFinding {
    const findingId =
      this.toStringValue(result.data.findingId) ?? `finding_${Date.now()}`
    const evidence = this.toStringArray(result.data.evidence)
    const description = this.toStringValue(result.data.description)

    return {
      findingId,
      severity: this.normalizeSeverity(result.severity),
      confidence: this.toConfidence(result.confidence),
      description:
        `${result.type}: ${description ?? 'Threat hunting anomaly detected'}`,
      evidence,
      remediation:
        this.toStringValue(result.data.remediation) ??
        'Investigate and validate the alert.',
    }
  }

  private normalizeSeverity(
    severity: unknown,
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (
      severity === 'low' ||
      severity === 'medium' ||
      severity === 'high' ||
      severity === 'critical'
    ) {
      return severity
    }

    return 'medium'
  }

  private deduplicateThreats(
    threats: GlobalThreatIntelligence[],
  ): GlobalThreatIntelligence[] {
    const seen = new Set<string>()
    const uniqueThreats: GlobalThreatIntelligence[] = []

    for (const threat of threats) {
      const key = this.generateThreatKey(threat)
      if (!seen.has(key)) {
        seen.add(key)
        uniqueThreats.push(threat)
      }
    }

    return uniqueThreats
  }

  private generateThreatKey(threat: GlobalThreatIntelligence): string {
    const indicatorKeys = threat.indicators
      .map((ind) => `${ind.indicatorType}:${ind.value}`)
      .sort()
      .join('|')

    return `${threat.threatType}:${indicatorKeys}`
  }

  private generateThreatId(): string {
    return `threat_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  }

  private async storeHuntResults(
    huntResult: HuntResult,
    threats: GlobalThreatIntelligence[],
  ): Promise<void> {
    try {
      // Store hunt execution results
      const resultsCollection = this.getCollection<HuntResult>('hunt_results')
      await resultsCollection.insertOne(huntResult)

      // Store discovered threats
      if (threats.length > 0) {
        const threatsCollection = this.getCollection('discovered_threats')
        const mappedThreats = threats.map((threat) => {
          return {
            ...threat,
            discoveryMethod: 'hunting',
            executionId: huntResult.executionId,
            storedAt: new Date(),
          }
        })
        await threatsCollection.insertMany(mappedThreats)
      }

      logger.info('Hunt results stored successfully', {
        executionId: huntResult.executionId,
        resultCount: 1,
        threatCount: threats.length,
      })
    } catch (error: unknown) {
      logger.error('Failed to store hunt results:', { error })
      throw error
    }
  }

  private async storeHuntExecution(execution: HuntExecution): Promise<void> {
    try {
      const executionsCollection =
        this.getCollection<HuntExecution>('hunt_executions')
      await executionsCollection.insertOne(execution)

      this.activeHunts.set(execution.executionId, execution)
    } catch (error: unknown) {
      logger.error('Failed to store hunt execution:', { error })
      throw error
    }
  }

  private async updateHuntExecution(execution: HuntExecution): Promise<void> {
    try {
      const executionsCollection =
        this.getCollection<HuntExecution>('hunt_executions')
      await executionsCollection.updateOne(
        { executionId: execution.executionId },
        { $set: execution },
      )

      this.activeHunts.set(execution.executionId, execution)
    } catch (error: unknown) {
      logger.error('Failed to update hunt execution:', { error })
      throw error
    }
  }

  private async sendThreatNotifications(
    threats: GlobalThreatIntelligence[],
  ): Promise<void> {
    try {
      for (const threat of threats) {
        const notification = {
          type: 'threat_discovered',
          threatId: threat.threatId,
          severity: threat.severity,
          confidence: threat.confidence,
          indicatorCount: threat.indicators.length,
          timestamp: new Date(),
        }

        // Send notification based on severity
        if (threat.severity === 'critical' || threat.severity === 'high') {
          await this.sendHighPriorityNotification(notification)
        } else {
          await this.sendStandardNotification(notification)
        }
      }
    } catch (error: unknown) {
      logger.error('Failed to send threat notifications:', { error })
    }
  }

  private async sendHighPriorityNotification(
    notification: ThreatNotification,
  ): Promise<void> {
    logger.info('Sending high priority threat notification', notification)
    // Implement high priority notification logic (email, SMS, etc.)
  }

  private async sendStandardNotification(
    notification: ThreatNotification,
  ): Promise<void> {
    logger.info('Sending standard threat notification', notification)
    // Implement standard notification logic
  }

  private async integrateWithGlobalIntelligence(
    threats: GlobalThreatIntelligence[],
  ): Promise<void> {
    try {
      // Send threats to global threat intelligence system
      for (const threat of threats) {
        await this.redis.publish('threat_intelligence', JSON.stringify(threat))
      }

      logger.info('Threats integrated with global intelligence', {
        threatCount: threats.length,
      })
    } catch (error: unknown) {
      logger.error('Failed to integrate with global intelligence:', { error })
    }
  }

  private calculateOverallConfidence(results: RawHuntFinding[]): number {
    if (results.length === 0) return 0

    const totalConfidence = results.reduce(
      (sum, result) => sum + result.confidence,
      0,
    )
    return totalConfidence / results.length
  }

  private getDefaultTimeRange(): { startTime: string; endTime: string } {
    const endTime = new Date()
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000) // 24 hours ago

    return {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    }
  }

  async scheduleHunt(schedule: HuntSchedule): Promise<string> {
    try {
      logger.info('Scheduling hunt', {
        scheduleId: schedule.scheduleId,
        patternId: schedule.patternId,
        frequency: schedule.frequency,
      })

      // Validate schedule
      this.validateHuntSchedule(schedule)

      // Store schedule in database
      await this.storeHuntSchedule(schedule)

      // Set up scheduled execution
      const interval = this.calculateScheduleInterval(schedule.frequency)
      const timeout = setInterval(async () => {
        try {
          await this.executeScheduledHunt(schedule)
        } catch (error: unknown) {
          logger.error('Scheduled hunt execution failed:', {
            error,
            scheduleId: schedule.scheduleId,
          })
        }
      }, interval)

      this.scheduledHunts.set(schedule.scheduleId, timeout)

      this.emit('hunt_scheduled', { scheduleId: schedule.scheduleId })

      return schedule.scheduleId
    } catch (error: unknown) {
      logger.error('Failed to schedule hunt:', { error })
      throw error
    }
  }

  private validateHuntSchedule(schedule: HuntSchedule): void {
    if (!schedule.scheduleId) {
      throw new Error('Schedule ID is required')
    }

    if (!schedule.patternId) {
      throw new Error('Pattern ID is required')
    }

    if (!schedule.frequency) {
      throw new Error('Frequency is required')
    }

    const validFrequencies = ['hourly', 'daily', 'weekly', 'monthly']
    if (!validFrequencies.includes(schedule.frequency)) {
      throw new Error(`Invalid frequency: ${schedule.frequency}`)
    }
  }

  private calculateScheduleInterval(frequency: string): number {
    const intervals: Record<string, number> = {
      hourly: 60 * 60 * 1000, // 1 hour
      daily: 24 * 60 * 60 * 1000, // 24 hours
      weekly: 7 * 24 * 60 * 60 * 1000, // 7 days
      monthly: 30 * 24 * 60 * 60 * 1000, // 30 days
    }

    return intervals[frequency] ?? 24 * 60 * 60 * 1000
  }

  private async storeHuntSchedule(schedule: HuntSchedule): Promise<void> {
    try {
      const schedulesCollection = this.getCollection<HuntSchedule>('hunt_schedules')
      await schedulesCollection.replaceOne(
        { scheduleId: schedule.scheduleId },
        schedule,
        { upsert: true },
      )
    } catch (error: unknown) {
      logger.error('Failed to store hunt schedule:', { error })
      throw error
    }
  }

  private async executeScheduledHunt(schedule: HuntSchedule): Promise<void> {
    try {
      logger.info('Executing scheduled hunt', {
        scheduleId: schedule.scheduleId,
      })

      const huntQuery: HuntQuery = {
        huntId: `scheduled_${schedule.scheduleId}_${Date.now()}`,
        patternId: schedule.patternId,
        scope: schedule.scope,
        regions: schedule.regions,
        parameters: schedule.parameters,
        priority: 'medium',
      }

      await this.executeHunt(huntQuery)
    } catch (error: unknown) {
      logger.error('Scheduled hunt execution failed:', {
        error,
        scheduleId: schedule.scheduleId,
      })
      throw error
    }
  }

  async cancelHunt(huntId: string): Promise<boolean> {
    try {
      logger.info('Cancelling hunt', { huntId })

      // Find active hunt execution
      let executionToCancel: HuntExecution | null = null

      for (const [_executionId, execution] of this.activeHunts) {
        if (execution.huntId === huntId && execution.status === 'executing') {
          executionToCancel = execution
          break
        }
      }

      if (!executionToCancel) {
        logger.warn('No active hunt execution found to cancel', { huntId })
        return false
      }

      // Update execution status
      executionToCancel.status = 'cancelled'
      executionToCancel.completedTime = new Date()
      await this.updateHuntExecution(executionToCancel)

      // Remove from active hunts
      this.activeHunts.delete(executionToCancel.executionId)

      this.emit('hunt_cancelled', {
        huntId,
        executionId: executionToCancel.executionId,
      })

      return true
    } catch (error: unknown) {
      logger.error('Failed to cancel hunt:', { error, huntId })
      return false
    }
  }

  async getHuntResults(
    huntId: string,
    limit: number = 100,
  ): Promise<HuntResult[]> {
    try {
      const resultsCollection = this.getCollection<HuntResult>('hunt_results')
      const results = await resultsCollection
        .find({ huntId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray()

      return results.map((result) => this.mapStoredDocument(result))
    } catch (error: unknown) {
      logger.error('Failed to get hunt results:', { error, huntId })
      throw error
    }
  }

  async getActiveHunts(): Promise<HuntExecution[]> {
    try {
      const executionsCollection =
        this.getCollection<HuntExecution>('hunt_executions')
      const activeHunts = await executionsCollection
        .find({ status: { $in: ['preparing', 'executing'] } })
        .sort({ startTime: -1 })
        .toArray()

      return activeHunts
    } catch (error: unknown) {
      logger.error('Failed to get active hunts:', { error })
      throw error
    }
  }

  async updateHuntPattern(pattern: HuntPattern): Promise<boolean> {
    try {
      logger.info('Updating hunt pattern', { patternId: pattern.patternId })

      // Validate pattern
      this.validateHuntPattern(pattern)

      // Update in memory
      this.huntPatterns.set(pattern.patternId, pattern)

      // Update in database
      const patternsCollection = this.getCollection<HuntPattern>('hunt_patterns')
      await patternsCollection.replaceOne(
        { patternId: pattern.patternId },
        pattern,
        { upsert: true },
      )

      this.emit('pattern_updated', { patternId: pattern.patternId })
      return true
    } catch (error: unknown) {
      logger.error('Failed to update hunt pattern:', { error })
      return false
    }
  }

  private validateHuntPattern(pattern: HuntPattern): void {
    if (!pattern.patternId || !pattern.name || !pattern.patternType) {
      throw new Error('Invalid hunt pattern: missing required fields')
    }

    if (pattern.confidence < 0 || pattern.confidence > 1) {
      throw new Error(
        'Invalid hunt pattern: confidence must be between 0 and 1',
      )
    }
  }

  async getHuntMetrics(): Promise<HuntMetrics> {
    try {
      const executionsCollection =
        this.getCollection<HuntExecution>('hunt_executions')

      const threatsCollection = this.getCollection<GlobalThreatIntelligence>(
        'discovered_threats',
      )

      const [
        totalHunts,
        successfulHunts,
        averageExecutionTime,
        threatsDiscovered,
        falsePositives,
        huntsByType,
        huntsBySeverity,
      ] = await Promise.all([
        executionsCollection.countDocuments(),
        executionsCollection.countDocuments({ status: 'completed' }),
        this.calculateAverageExecutionTime(),
        threatsCollection.countDocuments(),
        this.calculateFalsePositives(),
        this.getHuntsByType(),
        this.getHuntsBySeverity(),
      ])

      return {
        totalHunts,
        successfulHunts,
        failedHunts: totalHunts - successfulHunts,
        averageExecutionTime,
        threatsDiscovered,
        falsePositives,
        huntByType: huntsByType,
        huntBySeverity: huntsBySeverity,
      }
    } catch (error: unknown) {
      logger.error('Failed to get hunt metrics:', { error })
      return {
        totalHunts: 0,
        successfulHunts: 0,
        failedHunts: 0,
        averageExecutionTime: 0,
        threatsDiscovered: 0,
        falsePositives: 0,
        huntByType: {},
        huntBySeverity: {},
      }
    }
  }

  private async calculateAverageExecutionTime(): Promise<number> {
    try {
      const executionsCollection =
        this.getCollection<HuntExecution>('hunt_executions')
      const completedExecutions = await executionsCollection
        .find({
          status: 'completed',
          startTime: { $exists: true },
          completedTime: { $exists: true },
        })
        .project({ startTime: 1, completedTime: 1 })
        .limit(100)
        .toArray()

      if (completedExecutions.length === 0) {
        return 0
      }

      let totalTime = 0
      for (const execution of completedExecutions) {
        const startTime = this.toDate(execution.startTime)
        const completedTime = this.toDate(execution.completedTime)
        const timeDiff = completedTime.getTime() - startTime.getTime()
        totalTime += timeDiff
      }

      return totalTime / completedExecutions.length
    } catch (error: unknown) {
      logger.error('Failed to calculate average execution time:', { error })
      return 0
    }
  }

  private async calculateFalsePositives(): Promise<number> {
    try {
      const resultsCollection = this.getCollection('hunt_results')
      const falsePositives = await resultsCollection.countDocuments({
        confidence: { $lt: 0.5 },
        timestamp: {
          $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      })

      return falsePositives
    } catch (error: unknown) {
      logger.error('Failed to calculate false positives:', { error })
      return 0
    }
  }

  private async getHuntsByType(): Promise<Record<string, number>> {
    try {
      const executionsCollection =
        this.getCollection<HuntExecution>('hunt_executions')
      const pipeline = [
        { $group: { _id: '$metadata.patternType', count: { $sum: 1 } } },
        { $project: { patternType: '$_id', count: 1, _id: 0 } },
      ]

      const results = await executionsCollection
        .aggregate<PatternTypeCount>(pipeline)
        .toArray()

      const huntsByType: Record<string, number> = {}
      for (const result of results) {
        huntsByType[result.patternType] = result.count
      }

      return huntsByType
    } catch (error: unknown) {
      logger.error('Failed to get hunts by type:', { error })
      return {}
    }
  }

  private async getHuntsBySeverity(): Promise<Record<string, number>> {
    try {
      const resultsCollection =
        this.getCollection('hunt_results')
      const pipeline = [
        { $group: { _id: '$severity', count: { $sum: 1 } } },
        { $project: { severity: '$_id', count: 1, _id: 0 } },
      ]

      const results = await resultsCollection
        .aggregate<SeverityCount>(pipeline)
        .toArray()

      const huntsBySeverity: Record<string, number> = {}
      for (const result of results) {
        huntsBySeverity[result.severity] = result.count
      }

      return huntsBySeverity
    } catch (error: unknown) {
      logger.error('Failed to get hunts by severity:', { error })
      return {}
    }
  }

  private async checkScheduledHunts(): Promise<void> {
    try {
      const schedulesCollection = this.getCollection<HuntSchedule>('hunt_schedules')
      const activeSchedules = await schedulesCollection
        .find({ enabled: true })
        .toArray()

      for (const schedule of activeSchedules) {
        const shouldExecute = await this.shouldExecuteScheduledHunt(schedule)
        if (shouldExecute) {
          await this.executeScheduledHunt(schedule)
        }
      }
    } catch (error: unknown) {
      logger.error('Scheduled hunt check failed:', { error })
    }
  }

  private async shouldExecuteScheduledHunt(
    schedule: HuntSchedule,
  ): Promise<boolean> {
    try {
      const now = new Date()
      const lastExecution = schedule.lastExecution
        ? new Date(schedule.lastExecution)
        : null

      if (!lastExecution) {
        return true // Never executed, should execute now
      }

      const interval = this.calculateScheduleInterval(schedule.frequency)
      const timeSinceLastExecution = now.getTime() - lastExecution.getTime()

      return timeSinceLastExecution >= interval
    } catch (error: unknown) {
      logger.error('Failed to check if scheduled hunt should execute:', {
        error,
      })
      return false
    }
  }

  private async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.getHuntMetrics()

      this.emit('metrics_collected', metrics)
    } catch (error: unknown) {
      logger.error('Metrics collection failed:', { error })
    }
  }

  async getHealthStatus(): Promise<HealthStatus> {
    try {
      const startTime = Date.now()

      // Check Redis connection
      const redisHealthy = await this.checkRedisHealth()
      if (!redisHealthy) {
        return {
          healthy: false,
          message: 'Redis connection failed',
        }
      }

      // Check MongoDB connection
      const mongodbHealthy = await this.checkMongoDBHealth()
      if (!mongodbHealthy) {
        return {
          healthy: false,
          message: 'MongoDB connection failed',
        }
      }

      // Calculate success rate
      const metrics = await this.getHuntMetrics()
      const successRate =
        metrics.totalHunts > 0
          ? (metrics.successfulHunts / metrics.totalHunts) * 100
          : 0

      const responseTime = Date.now() - startTime

      return {
        healthy: true,
        message: 'Threat Hunting System is healthy',
        responseTime,
        activeHunts: this.activeHunts.size,
        successRate,
      }
    } catch (error: unknown) {
      logger.error('Health check failed:', { error })
      const message =
        error instanceof Error ? error.message : 'Unknown health check failure'
      return {
        healthy: false,
        message: `Health check failed: ${message}`,
      }
    }
  }

  private async checkRedisHealth(): Promise<boolean> {
    try {
      await this.redis.ping()
      return true
    } catch (error: unknown) {
      logger.error('Redis health check failed:', { error })
      return false
    }
  }

  private async checkMongoDBHealth(): Promise<boolean> {
    try {
      await this.db.admin().ping()
      return true
    } catch (error: unknown) {
      logger.error('MongoDB health check failed:', { error })
      return false
    }
  }

  private generateExecutionId(): string {
    return `hunt_exec_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  }

  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Threat Hunting System')

      // Cancel all scheduled hunts
      for (const [scheduleId, timeout] of this.scheduledHunts) {
        clearInterval(timeout)
        this.scheduledHunts.delete(scheduleId)
      }

      // Close database connections
      await this.mongoClient.close()

      await this.redis.quit()

      this.emit('hunting_system_shutdown')
      logger.info('Threat Hunting System shutdown completed')
    } catch (error: unknown) {
      logger.error('Error during shutdown:', { error })
      throw error
    }
  }
}
