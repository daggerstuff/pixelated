/**
 * Threat Hunting System
 * Proactive threat hunting capabilities across global infrastructure
 */

import { EventEmitter } from 'events'
import { Redis } from 'ioredis'
import { MongoClient, Db } from 'mongodb'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

import {
  HuntingConfig,
  HuntQuery,
  HuntResult,
  HuntPattern,
  HuntSchedule,
  HuntExecution,
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

export class ThreatHuntingSystemCore
  extends EventEmitter
  implements ThreatHuntingSystem
{
  private redis: Redis
  private mongoClient: MongoClient
  private db: Db
  private huntPatterns: Map<string, HuntPattern> = new Map()
  private activeHunts: Map<string, HuntExecution> = new Map()
  private scheduledHunts: Map<string, NodeJS.Timeout> = new Map()

  constructor(private config: HuntingConfig) {
    super()
    this.initializePatterns()
  }

  private initializePatterns(): void {
    for (const pattern of this.config.huntPatterns) {
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
    } catch (error) {
      logger.error('Failed to initialize Threat Hunting System:', { error })
      this.emit('initialization_error', { error })
      throw error
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
      await this.redis.ping()
      logger.info('Redis connection established for threat hunting')
    } catch (error) {
      logger.error('Failed to connect to Redis:', { error })
      throw new Error('Redis connection failed', { cause: error })
    }
  }

  private async initializeMongoDB(): Promise<void> {
    try {
      this.mongoClient = new MongoClient(
        process.env.MONGODB_URI || 'mongodb://localhost:27017/threat_hunting',
      )
      await this.mongoClient.connect()
      this.db = this.mongoClient.db('threat_hunting')
      logger.info('MongoDB connection established for threat hunting')
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', { error })
      throw new Error('MongoDB connection failed', { cause: error })
    }
  }

  private async loadHuntPatterns(): Promise<void> {
    try {
      const patternsCollection = this.db.collection('hunt_patterns')
      const patterns = await patternsCollection.find({}).toArray()

      for (const pattern of patterns) {
        this.huntPatterns.set(pattern.patternId, pattern)
      }

      logger.info(`Loaded ${patterns.length} hunt patterns from database`)
    } catch (error) {
      logger.error('Failed to load hunt patterns:', { error })
    }
  }

  private async startHuntScheduler(): Promise<void> {
    // Check for scheduled hunts every minute
    setInterval(async () => {
      try {
        await this.checkScheduledHunts()
      } catch (error) {
        logger.error('Scheduled hunt check error:', { error })
      }
    }, 60000)
  }

  private async startMetricsCollection(): Promise<void> {
    // Collect metrics every 10 minutes
    setInterval(async () => {
      try {
        await this.collectMetrics()
      } catch (error) {
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
      )

      // Step 7: Store hunt results
      await this.storeHuntResults(execution, analyzedResults, threats)

      // Step 8: Update hunt execution status
      execution.status = 'completed'
      execution.completedTime = new Date()
      await this.updateHuntExecution(execution)

      // Step 9: Send notifications for discovered threats
      if (threats.length > 0) {
        await this.sendThreatNotifications(threats)
      }

      // Step 10: Integrate with global threat intelligence
      await this.integrateWithGlobalIntelligence(threats)

      const huntResult: HuntResult = {
        huntId: execution.huntId,
        executionId: execution.executionId,
        patternId: pattern.patternId,
        startTime: execution.startTime,
        endTime: execution.completedTime,
        status: 'completed',
        findings: analyzedResults,
        threatsDiscovered: threats.length,
        confidence: this.calculateOverallConfidence(analyzedResults),
        metadata: {
          executionTime:
            execution.completedTime.getTime() - execution.startTime.getTime(),
          dataSources: execution.dataSources,
          regions: execution.regions,
        },
      }

      this.emit('hunt_completed', {
        huntId: huntResult.huntId,
        executionId: huntResult.executionId,
        threatsDiscovered: huntResult.threatsDiscovered,
        confidence: huntResult.confidence,
      })

      return huntResult
    } catch (error) {
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
      if (query.scope && query.scope.length === 0) {
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
        priority: query.priority || 'medium',
        timeout: query.timeout || 300000, // 5 minutes default
        maxResults: query.maxResults || 1000,
      }

      return validatedQuery
    } catch (error) {
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
      const pattern = this.huntPatterns.get(query.patternId!)
      if (!pattern) {
        throw new Error(`Hunt pattern not found: ${query.patternId}`)
      }

      return pattern
    } catch (error) {
      logger.error('Failed to select hunt pattern:', { error })
      throw error
    }
  }

  private createCustomPattern(query: HuntQuery): HuntPattern {
    return {
      patternId: `custom_${Date.now()}`,
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
        scope: query.scope || ['global'],
        dataSources: this.determineDataSources(pattern, query),
        regions: query.regions || ['all'],
        parameters: query.parameters || {},
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
    } catch (error) {
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
    switch (pattern.patternType) {
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
      default:
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
  ): Promise<any[]> {
    try {
      logger.info('Executing hunt by pattern', {
        executionId: execution.executionId,
        patternType: pattern.patternType,
      })

      let results: any[] = []

      switch (pattern.patternType) {
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
          results = await this.executeCustomHunt(execution, pattern)
          break
        default:
          logger.warn('Unknown pattern type, executing default hunt', {
            patternType: pattern.patternType,
          })
          results = await this.executeDefaultHunt(execution, pattern)
      }

      return results
    } catch (error) {
      logger.error('Failed to execute hunt by pattern:', { error })
      throw error
    }
  }

  private async executeNetworkHunt(
    execution: HuntExecution,
    _pattern: HuntPattern,
  ): Promise<any[]> {
    try {
      logger.info('Executing network hunt', {
        executionId: execution.executionId,
      })

      const results: any[] = []

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
    } catch (error) {
      logger.error('Network hunt execution failed:', { error })
      throw error
    }
  }

  private async executeEndpointHunt(
    execution: HuntExecution,
    _pattern: HuntPattern,
  ): Promise<any[]> {
    try {
      logger.info('Executing endpoint hunt', {
        executionId: execution.executionId,
      })

      const results: any[] = []

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
    } catch (error) {
      logger.error('Endpoint hunt execution failed:', { error })
      throw error
    }
  }

  private async executeUserBehaviorHunt(
    execution: HuntExecution,
    _pattern: HuntPattern,
  ): Promise<any[]> {
    try {
      logger.info('Executing user behavior hunt', {
        executionId: execution.executionId,
      })

      const results: any[] = []

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
    } catch (error) {
      logger.error('User behavior hunt execution failed:', { error })
      throw error
    }
  }

  private async executeMalwareHunt(
    execution: HuntExecution,
    _pattern: HuntPattern,
  ): Promise<any[]> {
    try {
      logger.info('Executing malware hunt', {
        executionId: execution.executionId,
      })

      const results: any[] = []

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
    } catch (error) {
      logger.error('Malware hunt execution failed:', { error })
      throw error
    }
  }

  private async executeLateralMovementHunt(
    execution: HuntExecution,
    _pattern: HuntPattern,
  ): Promise<any[]> {
    try {
      logger.info('Executing lateral movement hunt', {
        executionId: execution.executionId,
      })

      const results: any[] = []

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
    } catch (error) {
      logger.error('Lateral movement hunt execution failed:', { error })
      throw error
    }
  }

  private async executeCustomHunt(
    execution: HuntExecution,
    pattern: HuntPattern,
  ): Promise<any[]> {
    try {
      logger.info('Executing custom hunt', {
        executionId: execution.executionId,
      })

      // Execute custom query logic
      const results = await this.executeCustomQuery(execution, pattern.query)

      return results
    } catch (error) {
      logger.error('Custom hunt execution failed:', { error })
      throw error
    }
  }

  private async executeDefaultHunt(
    execution: HuntExecution,
    _pattern: HuntPattern,
  ): Promise<any[]> {
    try {
      logger.info('Executing default hunt', {
        executionId: execution.executionId,
      })

      // Execute basic security log analysis
      const results = await this.executeBasicSecurityAnalysis(execution)

      return results
    } catch (error) {
      logger.error('Default hunt execution failed:', { error })
      throw error
    }
  }

  // Individual hunt methods for specific patterns
  private async huntSuspiciousConnections(
    execution: HuntExecution,
  ): Promise<any[]> {
    try {
      const networkLogs = this.db.collection('network_logs')
      const timeRange =
        execution.parameters.timeRange || this.getDefaultTimeRange()

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
        .limit(execution.maxResults || 1000)
        .toArray()

      return suspiciousConnections.map((conn) => ({
        type: 'suspicious_connection',
        severity: 'medium',
        confidence: 0.7,
        data: conn,
        timestamp: conn.timestamp,
      }))
    } catch (error) {
      logger.error('Suspicious connections hunt failed:', { error })
      return []
    }
  }

  private async huntUnusualDNSQueries(
    execution: HuntExecution,
  ): Promise<any[]> {
    try {
      const dnsLogs = this.db.collection('dns_logs')
      const timeRange =
        execution.parameters.timeRange || this.getDefaultTimeRange()

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
        .limit(execution.maxResults || 1000)
        .toArray()

      return unusualQueries.map((query) => ({
        type: 'unusual_dns_query',
        severity: 'high',
        confidence: 0.8,
        data: query,
        timestamp: query.timestamp,
      }))
    } catch (error) {
      logger.error('Unusual DNS queries hunt failed:', { error })
      return []
    }
  }

  private async huntPortScanning(execution: HuntExecution): Promise<any[]> {
    try {
      const networkLogs = this.db.collection('network_logs')
      const timeRange =
        execution.parameters.timeRange || this.getDefaultTimeRange()

      // Look for rapid connection attempts to different ports from same source
      const portScanCandidates = await networkLogs
        .aggregate([
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
        .limit(execution.maxResults || 100)
        .toArray()

      return portScanCandidates.map((scan) => ({
        type: 'port_scanning',
        severity: 'high',
        confidence: 0.9,
        data: scan,
        timestamp: new Date(scan._id.hour),
      }))
    } catch (error) {
      logger.error('Port scanning hunt failed:', { error })
      return []
    }
  }

  private async huntDataExfiltration(execution: HuntExecution): Promise<any[]> {
    try {
      const networkLogs = this.db.collection('network_logs')
      const timeRange =
        execution.parameters.timeRange || this.getDefaultTimeRange()

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
        .limit(execution.maxResults || 100)
        .toArray()

      return exfilPatterns.map((exfil) => ({
        type: 'data_exfiltration',
        severity: 'critical',
        confidence: 0.8,
        data: exfil,
        timestamp: exfil.timestamp,
      }))
    } catch (error) {
      logger.error('Data exfiltration hunt failed:', { error })
      return []
    }
  }

  private async huntSuspiciousProcesses(
    execution: HuntExecution,
  ): Promise<any[]> {
    try {
      const processLogs = this.db.collection('process_logs')
      const timeRange =
        execution.parameters.timeRange || this.getDefaultTimeRange()

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
        .limit(execution.maxResults || 1000)
        .toArray()

      return suspiciousProcesses.map((proc) => ({
        type: 'suspicious_process',
        severity: 'high',
        confidence: 0.8,
        data: proc,
        timestamp: proc.timestamp,
      }))
    } catch (error) {
      logger.error('Suspicious processes hunt failed:', { error })
      return []
    }
  }

  private async huntFileSystemAnomalies(
    execution: HuntExecution,
  ): Promise<any[]> {
    try {
      const fileLogs = this.db.collection('file_system_logs')
      const timeRange =
        execution.parameters.timeRange || this.getDefaultTimeRange()

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
        .limit(execution.maxResults || 1000)
        .toArray()

      return fileAnomalies.map((file) => ({
        type: 'file_system_anomaly',
        severity: 'medium',
        confidence: 0.7,
        data: file,
        timestamp: file.timestamp,
      }))
    } catch (error) {
      logger.error('File system anomalies hunt failed:', { error })
      return []
    }
  }

  private async huntRegistryModifications(
    execution: HuntExecution,
  ): Promise<any[]> {
    try {
      const registryLogs = this.db.collection('registry_logs')
      const timeRange =
        execution.parameters.timeRange || this.getDefaultTimeRange()

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
        .limit(execution.maxResults || 1000)
        .toArray()

      return registryMods.map((reg) => ({
        type: 'registry_modification',
        severity: 'high',
        confidence: 0.8,
        data: reg,
        timestamp: reg.timestamp,
      }))
    } catch (error) {
      logger.error('Registry modifications hunt failed:', { error })
      return []
    }
  }

  private async huntPersistenceMechanisms(
    execution: HuntExecution,
  ): Promise<any[]> {
    try {
      const persistenceLogs = this.db.collection('persistence_logs')
      const timeRange =
        execution.parameters.timeRange || this.getDefaultTimeRange()

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
        .limit(execution.maxResults || 500)
        .toArray()

      return persistenceMechanisms.map((persist) => ({
        type: 'persistence_mechanism',
        severity: 'high',
        confidence: 0.9,
        data: persist,
        timestamp: persist.timestamp,
      }))
    } catch (error) {
      logger.error('Persistence mechanisms hunt failed:', { error })
      return []
    }
  }

  private async huntUnusualLoginPatterns(
    execution: HuntExecution,
  ): Promise<any[]> {
    try {
      const authLogs = this.db.collection('authentication_logs')
      const timeRange =
        execution.parameters.timeRange || this.getDefaultTimeRange()

      const unusualLogins = await authLogs
        .aggregate([
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
        .limit(execution.maxResults || 100)
        .toArray()

      return unusualLogins.map((login) => ({
        type: 'unusual_login_pattern',
        severity: 'medium',
        confidence: 0.7,
        data: login,
        timestamp: new Date(),
      }))
    } catch (error) {
      logger.error('Unusual login patterns hunt failed:', { error })
      return []
    }
  }

  private async huntPrivilegeEscalation(
    execution: HuntExecution,
  ): Promise<any[]> {
    try {
      const authLogs = this.db.collection('authentication_logs')
      const timeRange =
        execution.parameters.timeRange || this.getDefaultTimeRange()

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
        .limit(execution.maxResults || 500)
        .toArray()

      return privilegeEscalations.map((escalation) => ({
        type: 'privilege_escalation',
        severity: 'high',
        confidence: 0.8,
        data: escalation,
        timestamp: escalation.timestamp,
      }))
    } catch (error) {
      logger.error('Privilege escalation hunt failed:', { error })
      return []
    }
  }

  private async huntUnusualAccessPatterns(
    execution: HuntExecution,
  ): Promise<any[]> {
    try {
      const accessLogs = this.db.collection('access_logs')
      const timeRange =
        execution.parameters.timeRange || this.getDefaultTimeRange()

      const unusualAccess = await accessLogs
        .aggregate([
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
        .limit(execution.maxResults || 100)
        .toArray()

      return unusualAccess.map((access) => ({
        type: 'unusual_access_pattern',
        severity: 'low',
        confidence: 0.6,
        data: access,
        timestamp: new Date(),
      }))
    } catch (error) {
      logger.error('Unusual access patterns hunt failed:', { error })
      return []
    }
  }

  private async huntAccountCompromise(
    execution: HuntExecution,
  ): Promise<any[]> {
    try {
      const authLogs = this.db.collection('authentication_logs')
      const timeRange =
        execution.parameters.timeRange || this.getDefaultTimeRange()

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
        .limit(execution.maxResults || 100)
        .toArray()

      return compromisedAccounts.map((account) => ({
        type: 'account_compromise',
        severity: 'critical',
        confidence: 0.9,
        data: account,
        timestamp: new Date(),
      }))
    } catch (error) {
      logger.error('Account compromise hunt failed:', { error })
      return []
    }
  }

  private async huntKnownMalwareSignatures(
    execution: HuntExecution,
  ): Promise<any[]> {
    try {
      const fileLogs = this.db.collection('file_system_logs')
      const timeRange =
        execution.parameters.timeRange || this.getDefaultTimeRange()

      // Get known malware signatures from threat intelligence
      const malwareCollection = this.db.collection('malware_signatures')
      const knownSignatures = await malwareCollection.find({}).toArray()
      const signatureHashes = knownSignatures.map((sig) => sig.hash)

      const malwareFiles = await fileLogs
        .find({
          timestamp: {
            $gte: new Date(timeRange.startTime),
            $lte: new Date(timeRange.endTime),
          },
          fileHash: { $in: signatureHashes },
          operation: 'CREATE',
        })
        .limit(execution.maxResults || 100)
        .toArray()

      return malwareFiles.map((file) => ({
        type: 'known_malware_signature',
        severity: 'critical',
        confidence: 1.0,
        data: file,
        timestamp: file.timestamp,
      }))
    } catch (error) {
      logger.error('Known malware signatures hunt failed:', { error })
      return []
    }
  }

  private async huntSuspiciousFileHashes(
    execution: HuntExecution,
  ): Promise<any[]> {
    try {
      const fileLogs = this.db.collection('file_system_logs')
      const timeRange =
        execution.parameters.timeRange || this.getDefaultTimeRange()

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
        .limit(execution.maxResults || 500)
        .toArray()

      return suspiciousHashes.map((file) => ({
        type: 'suspicious_file_hash',
        severity: 'medium',
        confidence: 0.6,
        data: file,
        timestamp: file.timestamp,
      }))
    } catch (error) {
      logger.error('Suspicious file hashes hunt failed:', { error })
      return []
    }
  }

  private async huntMalwareBehavioralIndicators(
    execution: HuntExecution,
  ): Promise<any[]> {
    try {
      const processLogs = this.db.collection('process_logs')
      const timeRange =
        execution.parameters.timeRange || this.getDefaultTimeRange()

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
        .limit(execution.maxResults || 1000)
        .toArray()

      return behavioralIndicators.map((indicator) => ({
        type: 'malware_behavioral_indicator',
        severity: 'high',
        confidence: 0.8,
        data: indicator,
        timestamp: indicator.timestamp,
      }))
    } catch (error) {
      logger.error('Malware behavioral indicators hunt failed:', { error })
      return []
    }
  }

  private async huntC2Communications(execution: HuntExecution): Promise<any[]> {
    try {
      const networkLogs = this.db.collection('network_logs')
      const timeRange =
        execution.parameters.timeRange || this.getDefaultTimeRange()

      // Look for periodic beacons to external IPs
      const c2Communications = await networkLogs
        .aggregate([
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
        .limit(execution.maxResults || 100)
        .toArray()

      return c2Communications.map((comm) => ({
        type: 'c2_communication',
        severity: 'critical',
        confidence: 0.9,
        data: comm,
        timestamp: new Date(),
      }))
    } catch (error) {
      logger.error('C2 communications hunt failed:', { error })
      return []
    }
  }

  private async huntCredentialDumping(
    execution: HuntExecution,
  ): Promise<any[]> {
    try {
      const processLogs = this.db.collection('process_logs')
      const timeRange =
        execution.parameters.timeRange || this.getDefaultTimeRange()

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
        .limit(execution.maxResults || 100)
        .toArray()

      return credentialDumping.map((dump) => ({
        type: 'credential_dumping',
        severity: 'critical',
        confidence: 0.95,
        data: dump,
        timestamp: dump.timestamp,
      }))
    } catch (error) {
      logger.error('Credential dumping hunt failed:', { error })
      return []
    }
  }

  private async huntNetworkEnumeration(
    execution: HuntExecution,
  ): Promise<any[]> {
    try {
      const networkLogs = this.db.collection('network_logs')
      const timeRange =
        execution.parameters.timeRange || this.getDefaultTimeRange()

      const networkEnumeration = await networkLogs
        .aggregate([
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
        .limit(execution.maxResults || 100)
        .toArray()

      return networkEnumeration.map((enumeration) => ({
        type: 'network_enumeration',
        severity: 'medium',
        confidence: 0.7,
        data: enumeration,
        timestamp: new Date(enumeration._id.hour),
      }))
    } catch (error) {
      logger.error('Network enumeration hunt failed:', { error })
      return []
    }
  }

  private async huntServiceExploitation(
    execution: HuntExecution,
  ): Promise<any[]> {
    try {
      const systemLogs = this.db.collection('system_logs')
      const timeRange =
        execution.parameters.timeRange || this.getDefaultTimeRange()

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
        .limit(execution.maxResults || 200)
        .toArray()

      return serviceExploitation.map((exploit) => ({
        type: 'service_exploitation',
        severity: 'critical',
        confidence: 0.85,
        data: exploit,
        timestamp: exploit.timestamp,
      }))
    } catch (error) {
      logger.error('Service exploitation hunt failed:', { error })
      return []
    }
  }

  private async huntRemoteAccessTools(
    execution: HuntExecution,
  ): Promise<any[]> {
    try {
      const processLogs = this.db.collection('process_logs')
      const timeRange =
        execution.parameters.timeRange || this.getDefaultTimeRange()

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
        .limit(execution.maxResults || 100)
        .toArray()

      return remoteAccessTools.map((tool) => ({
        type: 'remote_access_tool',
        severity: 'medium',
        confidence: 0.8,
        data: tool,
        timestamp: tool.timestamp,
      }))
    } catch (error) {
      logger.error('Remote access tools hunt failed:', { error })
      return []
    }
  }

  private async executeCustomQuery(
    execution: HuntExecution,
    query: string,
  ): Promise<any[]> {
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
    } catch (error) {
      logger.error('Custom query execution failed:', { error })
      return []
    }
  }

  private async executeBasicSecurityAnalysis(
    execution: HuntExecution,
  ): Promise<any[]> {
    try {
      const securityLogs = this.db.collection('security_logs')
      const timeRange =
        execution.parameters.timeRange || this.getDefaultTimeRange()

      const securityEvents = await securityLogs
        .find({
          timestamp: {
            $gte: new Date(timeRange.startTime),
            $lte: new Date(timeRange.endTime),
          },
          severity: { $in: ['high', 'critical'] },
        })
        .limit(execution.maxResults || 1000)
        .toArray()

      return securityEvents.map((event) => ({
        type: 'security_event',
        severity: event.severity,
        confidence: 0.8,
        data: event,
        timestamp: event.timestamp,
      }))
    } catch (error) {
      logger.error('Basic security analysis failed:', { error })
      return []
    }
  }

  private async analyzeHuntResults(
    results: any[],
    pattern: HuntPattern,
  ): Promise<any[]> {
    try {
      logger.info('Analyzing hunt results', {
        resultCount: results.length,
        patternId: pattern.patternId,
      })

      const analyzedResults: any[] = []

      for (const result of results) {
        const analyzedResult = await this.analyzeIndividualResult(
          result,
          pattern,
        )
        if (analyzedResult) {
          analyzedResults.push(analyzedResult)
        }
      }

      // Apply pattern-specific analysis
      const patternAnalyzedResults = await this.applyPatternAnalysis(
        analyzedResults,
        pattern,
      )

      return patternAnalyzedResults
    } catch (error) {
      logger.error('Hunt result analysis failed:', { error })
      return results
    }
  }

  private async analyzeIndividualResult(
    result: any,
    pattern: HuntPattern,
  ): Promise<any> {
    try {
      // Calculate confidence based on pattern and result characteristics
      let confidence = result.confidence || 0.5

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
    } catch (error) {
      logger.error('Individual result analysis failed:', { error })
      return result
    }
  }

  private async applyPatternAnalysis(
    results: any[],
    pattern: HuntPattern,
  ): Promise<any[]> {
    try {
      // Apply pattern-specific analysis logic
      switch (pattern.patternType) {
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
        default:
          return results
      }
    } catch (error) {
      logger.error('Pattern analysis failed:', { error })
      return results
    }
  }

  private async analyzeNetworkResults(results: any[]): Promise<any[]> {
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
    } catch (error) {
      logger.error('Network results analysis failed:', { error })
      return results
    }
  }

  private async analyzeEndpointResults(results: any[]): Promise<any[]> {
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
              file.timestamp.getTime() - processResult.timestamp.getTime(),
            ) < 60000, // Within 1 minute
        )

        if (relatedFiles.length > 0) {
          processResult.confidence = Math.min(
            processResult.confidence * 1.2,
            1.0,
          )
          processResult.relatedFindings = relatedFiles.map(
            (f) => f.data.filePath,
          )
        }
      }

      return results
    } catch (error) {
      logger.error('Endpoint results analysis failed:', { error })
      return results
    }
  }

  private async analyzeUserBehaviorResults(results: any[]): Promise<any[]> {
    try {
      // Look for behavioral patterns across time
      const loginResults = results.filter(
        (r) => r.type === 'unusual_login_pattern',
      )
      const accessResults = results.filter(
        (r) => r.type === 'unusual_access_pattern',
      )

      // Correlate login anomalies with access anomalies
      for (const loginResult of loginResults) {
        const userAccess = accessResults.filter(
          (access) => access.data._id === loginResult.data._id,
        )

        if (userAccess.length > 0) {
          loginResult.confidence = Math.min(loginResult.confidence * 1.2, 1.0)
          loginResult.relatedFindings = userAccess.map((a) => a.type)
        }
      }

      return results
    } catch (error) {
      logger.error('User behavior results analysis failed:', { error })
      return results
    }
  }

  private async analyzeMalwareResults(results: any[]): Promise<any[]> {
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
        const relatedSignatures = signatureResults.filter(
          (sig) =>
            sig.data.sourceIp === behavioralResult.data.sourceIp ||
            sig.data.processId === behavioralResult.data.processId,
        )

        if (relatedSignatures.length > 0) {
          behavioralResult.confidence = Math.min(
            behavioralResult.confidence * 1.3,
            1.0,
          )
        }
      }

      return results
    } catch (error) {
      logger.error('Malware results analysis failed:', { error })
      return results
    }
  }

  private async analyzeLateralMovementResults(results: any[]): Promise<any[]> {
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
            enumResult.data._id.sourceIp === credentialResult.data.sourceIp,
        )

        const relatedRemote = remoteResults.filter(
          (remoteResult) =>
            remoteResult.data.sourceIp === credentialResult.data.sourceIp,
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
    } catch (error) {
      logger.error('Lateral movement results analysis failed:', { error })
      return results
    }
  }

  private groupBy(array: any[], keyPath: string): Record<string, any[]> {
    return array.reduce(
      (groups, item) => {
        const key = this.getNestedValue(item, keyPath)
        if (!groups[key]) {
          groups[key] = []
        }
        groups[key].push(item)
        return groups
      },
      {} as Record<string, any[]>,
    )
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
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
    results: any[],
    pattern: HuntPattern,
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
          const threat = await this.createThreatFromResult(result, pattern)
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
    } catch (error) {
      logger.error('Threat intelligence generation failed:', { error })
      return []
    }
  }

  private async createThreatFromResult(
    result: any,
    pattern: HuntPattern,
  ): Promise<GlobalThreatIntelligence | null> {
    try {
      const threatId = this.generateThreatId()

      // Extract indicators from result
      const indicators = this.extractIndicatorsFromResult(result)

      if (indicators.length === 0) {
        return null
      }

      const threat: GlobalThreatIntelligence = {
        threatId,
        threatType: this.mapResultToThreatType(result),
        severity: result.severity || 'medium',
        confidence: result.confidence,
        indicators,
        firstSeen: result.timestamp || new Date(),
        lastSeen: result.timestamp || new Date(),
        regions: execution.regions || ['global'],
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
    } catch (error) {
      logger.error('Failed to create threat from result:', { error })
      return null
    }
  }

  private extractIndicatorsFromResult(result: any): ThreatIndicator[] {
    const indicators: ThreatIndicator[] = []

    try {
      // Extract IP addresses
      if (result.data.sourceIp) {
        indicators.push({
          indicatorType: 'ip',
          value: result.data.sourceIp,
          confidence: result.confidence,
          firstSeen: result.timestamp,
          lastSeen: result.timestamp,
        })
      }

      if (result.data.destinationIp) {
        indicators.push({
          indicatorType: 'ip',
          value: result.data.destinationIp,
          confidence: result.confidence,
          firstSeen: result.timestamp,
          lastSeen: result.timestamp,
        })
      }

      // Extract file hashes
      if (result.data.fileHash) {
        indicators.push({
          indicatorType: 'file_hash',
          value: result.data.fileHash,
          confidence: result.confidence,
          firstSeen: result.timestamp,
          lastSeen: result.timestamp,
        })
      }

      // Extract domain names
      if (result.data.domainName) {
        indicators.push({
          indicatorType: 'domain',
          value: result.data.domainName,
          confidence: result.confidence,
          firstSeen: result.timestamp,
          lastSeen: result.timestamp,
        })
      }

      // Extract URLs
      if (result.data.url) {
        indicators.push({
          indicatorType: 'url',
          value: result.data.url,
          confidence: result.confidence,
          firstSeen: result.timestamp,
          lastSeen: result.timestamp,
        })
      }

      // Extract process names
      if (result.data.processName) {
        indicators.push({
          indicatorType: 'process',
          value: result.data.processName,
          confidence: result.confidence,
          firstSeen: result.timestamp,
          lastSeen: result.timestamp,
        })
      }

      return indicators
    } catch (error) {
      logger.error('Failed to extract indicators from result:', { error })
      return []
    }
  }

  private mapResultToThreatType(result: any): string {
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

    return typeMap[result.type] || 'general'
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
    execution: HuntExecution,
    results: any[],
    threats: GlobalThreatIntelligence[],
  ): Promise<void> {
    try {
      // Store hunt execution results
      const resultsCollection = this.db.collection('hunt_results')
      await resultsCollection.insertMany(
        results.map((result) => ({
          ...result,
          executionId: execution.executionId,
          huntId: execution.huntId,
          patternId: execution.patternId,
          storedAt: new Date(),
        })),
      )

      // Store discovered threats
      if (threats.length > 0) {
        const threatsCollection = this.db.collection('discovered_threats')
        await threatsCollection.insertMany(
          threats.map((threat) => ({
            ...threat,
            discoveryMethod: 'hunting',
            executionId: execution.executionId,
            storedAt: new Date(),
          })),
        )
      }

      logger.info('Hunt results stored successfully', {
        executionId: execution.executionId,
        resultCount: results.length,
        threatCount: threats.length,
      })
    } catch (error) {
      logger.error('Failed to store hunt results:', { error })
      throw error
    }
  }

  private async storeHuntExecution(execution: HuntExecution): Promise<void> {
    try {
      const executionsCollection = this.db.collection('hunt_executions')
      await executionsCollection.insertOne(execution)

      this.activeHunts.set(execution.executionId, execution)
    } catch (error) {
      logger.error('Failed to store hunt execution:', { error })
      throw error
    }
  }

  private async updateHuntExecution(execution: HuntExecution): Promise<void> {
    try {
      const executionsCollection = this.db.collection('hunt_executions')
      await executionsCollection.updateOne(
        { executionId: execution.executionId },
        { $set: execution },
      )

      this.activeHunts.set(execution.executionId, execution)
    } catch (error) {
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
    } catch (error) {
      logger.error('Failed to send threat notifications:', { error })
    }
  }

  private async sendHighPriorityNotification(notification: any): Promise<void> {
    logger.info('Sending high priority threat notification', notification)
    // Implement high priority notification logic (email, SMS, etc.)
  }

  private async sendStandardNotification(notification: any): Promise<void> {
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
    } catch (error) {
      logger.error('Failed to integrate with global intelligence:', { error })
    }
  }

  private calculateOverallConfidence(results: any[]): number {
    if (results.length === 0) return 0

    const totalConfidence = results.reduce(
      (sum, result) => sum + (result.confidence || 0),
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
        } catch (error) {
          logger.error('Scheduled hunt execution failed:', {
            error,
            scheduleId: schedule.scheduleId,
          })
        }
      }, interval)

      this.scheduledHunts.set(schedule.scheduleId, timeout)

      this.emit('hunt_scheduled', { scheduleId: schedule.scheduleId })

      return schedule.scheduleId
    } catch (error) {
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

    return intervals[frequency] || 24 * 60 * 60 * 1000
  }

  private async storeHuntSchedule(schedule: HuntSchedule): Promise<void> {
    try {
      const schedulesCollection = this.db.collection('hunt_schedules')
      await schedulesCollection.replaceOne(
        { scheduleId: schedule.scheduleId },
        schedule,
        { upsert: true },
      )
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      logger.error('Failed to cancel hunt:', { error, huntId })
      return false
    }
  }

  async getHuntResults(
    huntId: string,
    limit: number = 100,
  ): Promise<HuntResult[]> {
    try {
      const resultsCollection = this.db.collection('hunt_results')
      const results = await resultsCollection
        .find({ huntId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray()

      return results
    } catch (error) {
      logger.error('Failed to get hunt results:', { error, huntId })
      throw error
    }
  }

  async getActiveHunts(): Promise<HuntExecution[]> {
    try {
      const executionsCollection = this.db.collection('hunt_executions')
      const activeHunts = await executionsCollection
        .find({ status: { $in: ['preparing', 'executing'] } })
        .sort({ startTime: -1 })
        .toArray()

      return activeHunts
    } catch (error) {
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
      const patternsCollection = this.db.collection('hunt_patterns')
      await patternsCollection.replaceOne(
        { patternId: pattern.patternId },
        pattern,
        { upsert: true },
      )

      this.emit('pattern_updated', { patternId: pattern.patternId })
      return true
    } catch (error) {
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
      const executionsCollection = this.db.collection('hunt_executions')

      const threatsCollection = this.db.collection('discovered_threats')

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
    } catch (error) {
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
      const executionsCollection = this.db.collection('hunt_executions')
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
        const timeDiff =
          execution.completedTime.getTime() - execution.startTime.getTime()
        totalTime += timeDiff
      }

      return totalTime / completedExecutions.length
    } catch (error) {
      logger.error('Failed to calculate average execution time:', { error })
      return 0
    }
  }

  private async calculateFalsePositives(): Promise<number> {
    try {
      const resultsCollection = this.db.collection('hunt_results')
      const falsePositives = await resultsCollection.countDocuments({
        confidence: { $lt: 0.5 },
        timestamp: {
          $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      })

      return falsePositives
    } catch (error) {
      logger.error('Failed to calculate false positives:', { error })
      return 0
    }
  }

  private async getHuntsByType(): Promise<Record<string, number>> {
    try {
      const executionsCollection = this.db.collection('hunt_executions')
      const pipeline = [
        { $group: { _id: '$metadata.patternType', count: { $sum: 1 } } },
        { $project: { patternType: '$_id', count: 1, _id: 0 } },
      ]

      const results = await executionsCollection.aggregate(pipeline).toArray()

      const huntsByType: Record<string, number> = {}
      for (const result of results) {
        huntsByType[result.patternType] = result.count
      }

      return huntsByType
    } catch (error) {
      logger.error('Failed to get hunts by type:', { error })
      return {}
    }
  }

  private async getHuntsBySeverity(): Promise<Record<string, number>> {
    try {
      const resultsCollection = this.db.collection('hunt_results')
      const pipeline = [
        { $group: { _id: '$severity', count: { $sum: 1 } } },
        { $project: { severity: '$_id', count: 1, _id: 0 } },
      ]

      const results = await resultsCollection.aggregate(pipeline).toArray()

      const huntsBySeverity: Record<string, number> = {}
      for (const result of results) {
        huntsBySeverity[result.severity] = result.count
      }

      return huntsBySeverity
    } catch (error) {
      logger.error('Failed to get hunts by severity:', { error })
      return {}
    }
  }

  private async checkScheduledHunts(): Promise<void> {
    try {
      const schedulesCollection = this.db.collection('hunt_schedules')
      const activeSchedules = await schedulesCollection
        .find({ enabled: true })
        .toArray()

      for (const schedule of activeSchedules) {
        const shouldExecute = await this.shouldExecuteScheduledHunt(schedule)
        if (shouldExecute) {
          await this.executeScheduledHunt(schedule)
        }
      }
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      logger.error('Health check failed:', { error })
      return {
        healthy: false,
        message: `Health check failed: ${error}`,
      }
    }
  }

  private async checkRedisHealth(): Promise<boolean> {
    try {
      const result = await this.redis.ping()
      return result === 'PONG'
    } catch (error) {
      logger.error('Redis health check failed:', { error })
      return false
    }
  }

  private async checkMongoDBHealth(): Promise<boolean> {
    try {
      await this.db.admin().ping()
      return true
    } catch (error) {
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
      if (this.mongoClient) {
        await this.mongoClient.close()
      }

      if (this.redis) {
        await this.redis.quit()
      }

      this.emit('hunting_system_shutdown')
      logger.info('Threat Hunting System shutdown completed')
    } catch (error) {
      logger.error('Error during shutdown:', { error })
      throw error
    }
  }
}
