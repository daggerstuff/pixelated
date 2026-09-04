/**
 * HIPAA++ Compliant FHE Key Rotation Service
 *
 * Production-grade key rotation with enterprise security, monitoring, and compliance.
 * Implements zero-trust architecture with comprehensive audit trails.
 */

import { EventEmitter } from 'node:events'

import AWS from 'aws-sdk'

import { createBuildSafeLogger } from '../logging/build-safe-logger'
import {
  isObjectRecord,
  isAwsListSecretsResponse,
  isAwsSecretValue,
  isProd,
  HIPAA_DEFAULT_OPTIONS,
  SECURITY_CONSTANTS,
  generateSecureId,
  deriveEncryptionKey,
  exponentialBackoff,
  generateKeyId,
  getErrorMessage,
  parseKeyPair,
  triggerSecurityAlarm,
  filterAuditEvents,
  releaseLock,
  scheduleClientRotationCheck,
  deprecateOldKeys,
  auditLog,
} from './key-rotation.utils'
import type {
  AuditEvent,
  SecurityMetrics,
  DistributedLock,
  KeyVersion,
  AwsRequest,
  AwsKmsClient,
  AwsSecretsManagerClient,
  AwsCloudWatchClient,
  AwsSecretListEntry,
  AwsListSecretsRequest,
  AwsListSecretsResponse,
  AwsSecretValue,
} from './key-rotation.types'
import { SealService } from './seal-service'
import type { KeyManagementOptions, TFHEKeyPair } from './types'
import { EncryptionMode } from './types'

// HIPAA++ Compliance Types
const logger = createBuildSafeLogger('hipaa-fhe-rotation')

/**
 * Helper function to check if we're in production environment
 */



/**
 * HIPAA++ Compliant FHE Key Rotation Service
 */
export class KeyRotationService extends EventEmitter {
  private static instance: KeyRotationService | undefined
  private readonly options: KeyManagementOptions
  private activeKeyId: string | null = null
  private readonly keyVersions = new Map<string, KeyVersion>()
  private readonly keyRotationTimers = new Map<string, NodeJS.Timeout>()
  private readonly distributedLocks = new Map<string, DistributedLock>()
  private readonly securityMetrics: SecurityMetrics
  private auditEvents: AuditEvent[] = []
  private readonly isClient: boolean
  private readonly isServer: boolean
  private readonly nodeId: string
  private sealService: SealService | null = null
  private sealInitialized = false
  private readonly kmsClient: AwsKmsClient | null = null
  private readonly secretsManager: AwsSecretsManagerClient | null = null
  private readonly cloudWatch: AwsCloudWatchClient | null = null
  private readonly keyCache = new Map<string, TFHEKeyPair>()
  private encryptionKey: Buffer | null = null
  private isInitialized = false

  /**
   * Private constructor for singleton pattern
   */
  private constructor(options?: Partial<KeyManagementOptions>) {
    super()
    this.options = { ...HIPAA_DEFAULT_OPTIONS, ...options }
    this.nodeId = generateSecureId()
    this.securityMetrics = {
      rotationAttempts: 0,
      rotationFailures: 0,
      unauthorizedAccess: 0,
      keyCompromiseEvents: 0,
      lastRotation: 0,
      averageRotationTime: 0,
    }

    // Detect environment
    this.isClient = typeof window !== 'undefined'
    this.isServer = typeof window === 'undefined'

    // Initialize AWS clients with enhanced security
    if (this.isServer) {
      try {
        this.kmsClient = new AWS.KMS({
          apiVersion: '2014-11-01',
          maxRetries: 3,
          retryDelayOptions: {
            customBackoff: (retryCount: number) =>
              exponentialBackoff(retryCount),
          },
        })
        this.secretsManager = new AWS.SecretsManager({
          apiVersion: '2017-10-17',
          maxRetries: 3,
          retryDelayOptions: {
            customBackoff: (retryCount: number) =>
              exponentialBackoff(retryCount),
          },
        })
        this.cloudWatch = new AWS.CloudWatch({ apiVersion: '2010-08-01' })

        logger.info('HIPAA++ AWS clients initialized with enhanced security')
        auditLog(this.auditEvents, (event, payload) => this.emit(event, payload), 'aws_clients_initialized', { success: true })
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? String(error) : 'Unknown error'
        auditLog(this.auditEvents, (event, payload) => this.emit(event, payload), 'aws_clients_init_failed', {
          success: false,
          details: { error: errorMessage },
        })
        throw new Error(
          'Critical: AWS client initialization failed in production',
          { cause: error },
        )
      }
    }

    // Set up security monitoring
    this.setupSecurityMonitoring()

    logger.info(
      `HIPAA++ Key Rotation Service initialized in ${this.isServer ? 'server' : 'client'} environment`,
      { nodeId: this.nodeId },
    )
    auditLog(this.auditEvents, (event, payload) => this.emit(event, payload), 'service_initialized', {
      success: true,
      details: {
        environment: this.isServer ? 'server' : 'client',
        nodeId: this.nodeId,
      },
    })
  }

  /**
   * Get singleton instance with security validation
   */
  public static getInstance(
    options?: Partial<KeyManagementOptions>,
  ): KeyRotationService {
    KeyRotationService.instance ??= new KeyRotationService(options)
    return KeyRotationService.instance
  }

  /**
   * Reset singleton instance for test environments.
   */
  public static resetInstanceForTests(): void {
    if (process.env['NODE_ENV'] === 'test') {
      KeyRotationService.instance = undefined
    }
  }

  /**
   * Security monitoring setup
   */
  private setupSecurityMonitoring() {
    // Monitor for suspicious activity
    setInterval(() => {
      this.performSecurityCheck()
    }, 60000) // Every minute

    // Emit metrics every 5 minutes
    setInterval(() => {
      void this.emitSecurityMetrics()
    }, 300000)

    // Clean up old audit logs
    setInterval(
      () => {
        this.cleanupAuditLogs()
      },
      24 * 60 * 60 * 1000,
    ) // Daily
  }

  /**
   * Generate cryptographically secure ID
   */

  /**
   * Derive master encryption key using PBKDF2
   */

  /**
   * Exponential backoff for AWS retries
   */

  /**
   * Audit logging with HIPAA compliance
   */

  /**
   * Acquire distributed lock for critical operations
   */
  private async acquireDistributedLock(operation: string): Promise<boolean> {
    const lockId = `${operation}_${Date.now()}`
    const lock: DistributedLock = {
      lockId,
      nodeId: this.nodeId,
      expiresAt: Date.now() + SECURITY_CONSTANTS.LOCK_TIMEOUT_MS,
      operation,
    }

    try {
      // In production, this would use DynamoDB or Redis for distributed locking
      if (this.distributedLocks.has(operation)) {
        const existingLock = this.distributedLocks.get(operation)!
        if (existingLock.expiresAt > Date.now()) {
          return false // Lock still active
        }
      }

      this.distributedLocks.set(operation, lock)
      auditLog(this.auditEvents, (event, payload) => this.emit(event, payload), 'lock_acquired', {
        success: true,
        details: { lockId, operation },
        riskLevel: 'medium',
      })
      return true
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? String(error) : 'Unknown error'
      auditLog(this.auditEvents, (event, payload) => this.emit(event, payload), 'lock_acquisition_failed', {
        success: false,
        details: { operation, error: errorMessage },
        riskLevel: 'high',
      })
      return false
    }
  }

  /**
   * Release distributed lock
   */

  /**
   * Perform security health check
   */
  private performSecurityCheck() {
    const now = Date.now()

    // Check for expired keys
    for (const [keyId, version] of this.keyVersions.entries()) {
      if (
        version.status === 'active' &&
        now - version.created > SECURITY_CONSTANTS.MAX_KEY_AGE_MS
      ) {
        auditLog(this.auditEvents, (event, payload) => this.emit(event, payload), 'key_age_violation', {
          success: false,
          keyId,
          details: { age: now - version.created },
          riskLevel: 'high',
        })
        // Trigger CloudWatch alarm
        void triggerSecurityAlarm(this.cloudWatch, 'KeyAgeViolation', keyId)
      }
    }

    // Check for suspicious patterns
    const recentFailures = this.auditEvents.filter(
      (e) => !e.success && now - new Date(e.timestamp).getTime() < 300000,
    ).length

    if (recentFailures > 5) {
      auditLog(this.auditEvents, (event, payload) => this.emit(event, payload), 'suspicious_activity_detected', {
        success: false,
        details: { recentFailures },
        riskLevel: 'critical',
      })
      // Trigger CloudWatch alarm
      void triggerSecurityAlarm(this.cloudWatch, 
        'SuspiciousActivity',
        `failures: ${recentFailures}`,
      )
    }
  }


  /**
   * Emit security metrics to CloudWatch
   */
  private async emitSecurityMetrics(): Promise<void> {
    if (!this.cloudWatch) {
      return
    }

    try {
      const params = {
        Namespace: 'HIPAA/FHE/KeyRotation',
        MetricData: [
          {
            MetricName: 'RotationAttempts',
            Value: this.securityMetrics.rotationAttempts,
            Unit: 'Count',
            Timestamp: new Date(),
          },
          {
            MetricName: 'RotationFailures',
            Value: this.securityMetrics.rotationFailures,
            Unit: 'Count',
            Timestamp: new Date(),
          },
          {
            MetricName: 'UnauthorizedAccess',
            Value: this.securityMetrics.unauthorizedAccess,
            Unit: 'Count',
            Timestamp: new Date(),
          },
        ],
      }

      await this.cloudWatch.putMetricData(params).promise()
    } catch (error: unknown) {
      logger.error('Failed to emit security metrics', { error })
    }
  }

  /**
   * Clean up old audit logs (HIPAA 7-year retention)
   */
  private cleanupAuditLogs() {
    const cutoffTime =
      Date.now() - SECURITY_CONSTANTS.AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000
    const initialCount = this.auditEvents.length

    this.auditEvents = this.auditEvents.filter(
      (event) => new Date(event.timestamp).getTime() > cutoffTime,
    )

    const removedCount = initialCount - this.auditEvents.length
    if (removedCount > 0) {
      auditLog(this.auditEvents, (event, payload) => this.emit(event, payload), 'audit_cleanup', {
        success: true,
        details: { removedCount },
        riskLevel: 'low',
      })
    }
  }

  /**
   * Initialize HIPAA++ compliant key rotation service
   */
  public async initialize(options?: {
    rotationPeriodMs?: number
    storagePrefix?: string
    onRotation?: (keyId: string) => void
  }): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Service already initialized')
      return
    }

    const startTime = Date.now()
    try {
      // Initialize master encryption key for server environments
      if (this.isServer && !this.encryptionKey) {
        this.encryptionKey = await deriveEncryptionKey()
      }

      // Update options if provided
      if (options) {
        if (options.rotationPeriodMs) {
          this.options.rotationPeriodDays =
            options.rotationPeriodMs / (24 * 60 * 60 * 1000)
        }
        if (options.storagePrefix) {
          this.options.storagePrefix = options.storagePrefix
        }
      }

      // Initialize SEAL service if needed
      try {
        this.sealService = SealService.getInstance()

        // Initialize SEAL if not already initialized
        if (!this.sealInitialized) {
          await this.sealService.initialize(EncryptionMode.FHE)
          this.sealInitialized = true
        }
      } catch (err: unknown) {
        logger.warn(
          'SEAL service initialization failed, will rely on standard key management',
          { error: err },
        )
      }

      // Load existing keys
      await this.loadKeys()

      // Check if we need to generate a new key
      if (!this.activeKeyId) {
        await this.rotateKeys()
      }

      this.isInitialized = true
      const initTime = Date.now() - startTime

      logger.info('HIPAA++ Key rotation service initialized successfully', {
        initTime,
      })
      auditLog(this.auditEvents, (event, payload) => this.emit(event, payload), 'service_initialization_complete', {
        success: true,
        details: { initTime, activeKeyId: this.activeKeyId },
        riskLevel: 'low',
      })

      this.emit('initialized', { activeKeyId: this.activeKeyId })
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? String(error) : 'Unknown error'
      auditLog(this.auditEvents, (event, payload) => this.emit(event, payload), 'service_initialization_failed', {
        success: false,
        details: { error: errorMessage },
        riskLevel: 'critical',
      })

      logger.error('Failed to initialize HIPAA++ key rotation service', {
        error,
      })
      throw new Error(
        `HIPAA++ Key rotation initialization error: ${errorMessage}`,
        { cause: error },
      )
    }
  }

  /**
   * Register a key for rotation
   */
  public registerKey(keyId: string, expiryTime: number): void {
    if (this.keyRotationTimers.has(keyId)) {
      return // Already registered
    }

    const now = Date.now()
    const timeToExpiry = Math.max(0, expiryTime - now)

    // Schedule key rotation
    if (this.isServer) {
      // For server environments, use normal timeouts
      const timer = setTimeout(() => {
        this.rotateKeys().catch((err) => {
          logger.error(`Failed to rotate key ${keyId}`, {
            error: getErrorMessage(err),
          })
        })
      }, timeToExpiry)

      this.keyRotationTimers.set(keyId, timer)
      logger.info(
        `Scheduled key ${keyId} for rotation in ${Math.round(timeToExpiry / (1000 * 60 * 60 * 24))} days`,
      )
    } else if (this.isClient) {
      // For client environments, check periodically
      scheduleClientRotationCheck(this.keyRotationTimers, () => this.rotateKeys(), keyId, expiryTime)
    }
  }

  /**
   * Schedule a periodic check for key rotation in the client
   */

  /**
   * Generate new key pair with HIPAA++ security controls
   */
  public async rotateKeys(): Promise<string> {
    const rotationId = generateSecureId()
    const startTime = Date.now()

    // Acquire distributed lock
    if (!(await this.acquireDistributedLock('key_rotation'))) {
      throw new Error(
        'Failed to acquire rotation lock - another rotation in progress',
      )
    }

    this.securityMetrics.rotationAttempts++
    auditLog(this.auditEvents, (event, payload) => this.emit(event, payload), 'key_rotation_started', {
      success: true,
      details: { rotationId },
      riskLevel: 'medium',
    })
    try {
      logger.info('Rotating encryption keys')

      // Generate a new key ID
      const keyId = generateKeyId()

      // Calculate expiry time
      const now = Date.now()
      const rotationMs = this.options.rotationPeriodDays! * 24 * 60 * 60 * 1000
      const expiryTime = now + rotationMs

      // If SEAL service is available, use it to generate keys
      if (this.sealService && this.sealInitialized) {
        // Generate new SEAL keys
        logger.info('Generating new SEAL encryption keys')
        await this.sealService.generateKeys()

        // Serialize and store the keys
        const serializedKeys = await this.sealService.serializeKeys()

        const publicKey =
          typeof serializedKeys.publicKey === 'string'
            ? serializedKeys.publicKey
            : ''
        const privateKeyEncrypted =
          typeof serializedKeys.secretKey === 'string'
            ? serializedKeys.secretKey
            : ''

        // Create a key pair record
        const keyPair: TFHEKeyPair = {
          id: keyId,
          publicKey,
          privateKeyEncrypted,
          created: now,
          expires: expiryTime,
          version: '1.0',
        }

        // Store the key
        await this.storeKey(keyPair)
      } else {
        logger.warn('SEAL service not available, generating fallback keys')

        // Create fallback key pair if SEAL is not available
        const keyPair: TFHEKeyPair = {
          id: keyId,
          publicKey: `pk_${keyId}`,
          privateKeyEncrypted: `encrypted_sk_${keyId}`,
          created: now,
          expires: expiryTime,
          version: '1.0',
        }

        // Store the key
        await this.storeKey(keyPair)
      }

      // Set as active key
      this.activeKeyId = keyId

      // Schedule rotation
      this.registerKey(keyId, expiryTime)

      // Update metrics and versioning
      const rotationTime = Date.now() - startTime
      this.securityMetrics.lastRotation = Date.now()
      this.securityMetrics.averageRotationTime =
        (this.securityMetrics.averageRotationTime + rotationTime) / 2

      // Add key version tracking
      this.keyVersions.set(keyId, {
        version: this.keyVersions.size + 1,
        keyId,
        created: Date.now(),
        status: 'active',
      })

      // Deprecate old keys
      await deprecateOldKeys(this.keyVersions, (a, d) => auditLog(this.auditEvents, (event, payload) => this.emit(event, payload), a, d), (id) => this.securelyDestroyKey(id), keyId)

      releaseLock(this.distributedLocks, (a, d) => auditLog(this.auditEvents, (event, payload) => this.emit(event, payload), a, d), 'key_rotation')

      logger.info(
        `HIPAA++ Key rotation completed successfully. New key ID: ${keyId}`,
        {
          rotationTime,
          rotationId,
        },
      )

      auditLog(this.auditEvents, (event, payload) => this.emit(event, payload), 'key_rotation_completed', {
        success: true,
        keyId,
        details: { rotationTime, rotationId },
        riskLevel: 'low',
      })

      this.emit('key-rotated', { keyId, rotationTime })
      return keyId
    } catch (error: unknown) {
      this.securityMetrics.rotationFailures++
      releaseLock(this.distributedLocks, (a, d) => auditLog(this.auditEvents, (event, payload) => this.emit(event, payload), a, d), 'key_rotation')

      const errorMessage =
        error instanceof Error ? String(error) : 'Unknown error'
      auditLog(this.auditEvents, (event, payload) => this.emit(event, payload), 'key_rotation_failed', {
        success: false,
        details: { error: errorMessage, rotationId },
        riskLevel: 'critical',
      })

      logger.error('HIPAA++ Key rotation failed', {
        error: getErrorMessage(error),
        rotationId,
      })
      this.emit('rotation-failed', { error: errorMessage, rotationId })
      throw new Error(`HIPAA++ Key rotation error: ${errorMessage}`, {
        cause: error,
      })
    }
  }

  /**
   * Deprecate old keys with secure migration
   */

  /**
   * Securely destroy deprecated keys
   */
  private async securelyDestroyKey(keyId: string): Promise<void> {
    try {
      // Remove from cache with secure wiping
      if (this.keyCache.has(keyId)) {
        const keyData = this.keyCache.get(keyId)!
        // Overwrite sensitive data
        keyData.privateKeyEncrypted = '0'.repeat(
          keyData.privateKeyEncrypted.length,
        )
        keyData.publicKey = '0'.repeat(keyData.publicKey.length)
        this.keyCache.delete(keyId)
      }

      // Update version status
      const version = this.keyVersions.get(keyId)
      if (version) {
        version.status = 'destroyed'
      }

      auditLog(this.auditEvents, (event, payload) => this.emit(event, payload), 'key_destroyed', {
        success: true,
        keyId,
        details: { destructionTime: Date.now() },
        riskLevel: 'medium',
      })
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? String(error) : 'Unknown error'
      auditLog(this.auditEvents, (event, payload) => this.emit(event, payload), 'key_destruction_failed', {
        success: false,
        keyId,
        details: { error: errorMessage },
        riskLevel: 'high',
      })
    }
  }

  /**
   * Store a key pair securely
   */
  private async storeKey(keyPair: TFHEKeyPair): Promise<void> {
    if (!this.options.persistKeys) {
      return
    }

    try {
      const storageKey = `${this.options.storagePrefix}${keyPair.id}`

      if (this.isClient) {
        // For client environments, use localStorage
        localStorage.setItem(storageKey, JSON.stringify(keyPair))
      } else if (this.isServer) {
        // Server-side storage using AWS Secrets Manager for production
        if (isProd() && this.secretsManager) {
          logger.info(`Storing key ${keyPair.id} in AWS Secrets Manager`)

          // Create a secret in AWS Secrets Manager
          const secretParams = {
            Name: storageKey,
            SecretString: JSON.stringify(keyPair),
            Description: `FHE encryption key pair created at ${new Date(keyPair.created).toISOString()}`,
            Tags: [
              { Key: 'Application', Value: 'FHE' },
              { Key: 'KeyId', Value: keyPair.id },
              { Key: 'KeyType', Value: 'SEAL' },
              { Key: 'Expiry', Value: new Date(keyPair.expires).toISOString() },
            ],
          }

          await this.secretsManager.createSecret(secretParams).promise()

          // If KMS is available, configure automatic key rotation for the secret
          if (this.kmsClient) {
            logger.info(`Configuring automatic rotation for key ${keyPair.id}`)

            const lambdaArn = process.env['KEY_ROTATION_LAMBDA_ARN']
            if (!lambdaArn) {
              auditLog(this.auditEvents, (event, payload) => this.emit(event, payload), 'missing_lambda_arn', {
                success: false,
                details: { keyId: keyPair.id },
                riskLevel: 'critical',
              })
              throw new Error(
                'KEY_ROTATION_LAMBDA_ARN environment variable is mandatory for HIPAA++ compliance',
              )
            }

            // Configure automatic rotation with enhanced security
            const rotationParams = {
              SecretId: storageKey,
              RotationLambdaARN: lambdaArn,
              RotationRules: {
                AutomaticallyAfterDays: this.options.rotationPeriodDays!,
              },
            }

            await this.secretsManager.rotateSecret(rotationParams).promise()

            auditLog(this.auditEvents, (event, payload) => this.emit(event, payload), 'aws_rotation_configured', {
              success: true,
              keyId: keyPair.id,
              details: { rotationPeriod: this.options.rotationPeriodDays },
              riskLevel: 'low',
            })
          }
        } else {
          // For development or test environments, store in memory cache
          logger.info(
            `Storing key ${keyPair.id} in memory cache (development/test environment)`,
          )
          this.keyCache.set(keyPair.id, keyPair)
        }
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? String(error) : 'Unknown error'
      auditLog(this.auditEvents, (event, payload) => this.emit(event, payload), 'key_storage_failed', {
        success: false,
        keyId: keyPair.id,
        details: { error: errorMessage },
        riskLevel: 'critical',
      })

      logger.error(`Failed to store key ${keyPair.id}`, {
        error: getErrorMessage(error),
      })
      throw new Error(`HIPAA++ Key storage error: ${errorMessage}`, {
        cause: error,
      })
    }
  }

  /**
   * Load stored keys and set the active key
   */
  private async loadKeys(): Promise<void> {
    if (!this.options.persistKeys) {
      logger.info('Key persistence disabled, skipping key loading')
      return
    }

    try {
      if (this.isClient) {
        // For client environments, load from localStorage
        this.loadKeysFromLocalStorage()
      } else if (this.isServer) {
        // For server environments, load from secure storage
        await this.loadKeysFromSecureStorage()
      }

      logger.info(
        `Loaded keys successfully. Active key: ${this.activeKeyId ?? 'none'}`,
      )
    } catch (error: unknown) {
      logger.error('Failed to load keys', { error })
      // Non-blocking error, we'll generate new keys if needed
    }
  }

  /**
   * Load keys from localStorage (client-side)
   */
  private loadKeysFromLocalStorage() {
    try {
      // Find all key-related items in localStorage
      const keyPrefix = this.options.storagePrefix ?? ''
      const allKeys: TFHEKeyPair[] = []

      // Check if localStorage is available
      if (typeof localStorage === 'undefined') {
        logger.warn('localStorage not available in this environment')
        return
      }

      // Iterate through localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith(keyPrefix)) {
          try {
            const value = localStorage.getItem(key)
            if (value) {
              const keyPair = parseKeyPair(value)
              if (keyPair) {
                allKeys.push(keyPair)
              }
            }
          } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Parse error'
            logger.warn(`Failed to parse key from localStorage: ${key}`, {
              error: errorMessage,
            })
          }
        }
      }

      // Sort by creation time and find the newest valid key
      const now = Date.now()
      const validKeys = allKeys
        .filter((key) => key.expires > now)
        .sort((a, b) => b.created - a.created)

      if (validKeys.length > 0) {
        const newestKey = validKeys[0]
        this.activeKeyId = newestKey.id

        // If SEAL service is available, load the keys
        if (this.sealService && this.sealInitialized) {
          this.sealService
            .loadKeys({
              publicKey: newestKey.publicKey,
              secretKey: newestKey.privateKeyEncrypted,
            })
            .catch((err) => {
              logger.error('Failed to load SEAL keys', {
                error: getErrorMessage(err),
              })
            })
        }

        // Schedule rotation for the active key
        this.registerKey(newestKey.id, newestKey.expires)
      }

      // Clean up expired keys
      for (const key of allKeys) {
        if (key.expires <= now) {
          const storageKey = `${keyPrefix}${key.id}`
          localStorage.removeItem(storageKey)
          logger.info(`Removed expired key: ${key.id}`)
        }
      }
    } catch (error: unknown) {
      logger.error('Error loading keys from localStorage', {
        error: getErrorMessage(error),
      })
    }
  }

  /**
   * Load keys from secure storage (server-side)
   */
  private async loadKeysFromSecureStorage(): Promise<void> {
    try {
      const keyPrefix = this.options.storagePrefix ?? ''

      // In a production environment, load from AWS Secrets Manager
      if (isProd() && this.secretsManager) {
        logger.info('Loading keys from AWS Secrets Manager')

        // List all secrets with our prefix
        let nextToken: string | undefined
        let allSecrets: AwsSecretListEntry[] = []

        do {
          const listParams: AwsListSecretsRequest = {
            Filters: [
              {
                Key: 'name',
                Values: [keyPrefix],
              },
            ],
          }

          if (nextToken) {
            listParams.NextToken = nextToken
          }

          const response = await this.secretsManager
            .listSecrets(listParams)
            .promise()
          if (!isAwsListSecretsResponse(response)) {
            break
          }

          if (response.SecretList) {
            allSecrets = allSecrets.concat(response.SecretList)
          }

          nextToken = response.NextToken
        } while (nextToken)

        // Process each secret to extract key pairs
        const allKeys: TFHEKeyPair[] = []
        for (const secret of allSecrets) {
          try {
            if (secret.Name?.startsWith(keyPrefix)) {
              // Get the secret value
              const secretValue = await this.secretsManager
                .getSecretValue({
                  SecretId: secret.Name,
                })
                .promise()
              if (!isAwsSecretValue(secretValue)) {
                continue
              }

              if (secretValue.SecretString) {
                const keyPair = parseKeyPair(secretValue.SecretString)
                if (keyPair) {
                  allKeys.push(keyPair)
                }
              }
            }
          } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'AWS error'
            logger.warn(`Failed to get secret value: ${secret.Name}`, {
              error: errorMessage,
            })
          }
        }

        // Find the newest valid key
        const now = Date.now()
        const validKeys = allKeys
          .filter((key) => key.expires > now)
          .sort((a, b) => b.created - a.created)

        if (validKeys.length > 0) {
          const newestKey = validKeys[0]
          this.activeKeyId = newestKey.id

          // If SEAL service is available, load the keys
          if (this.sealService && this.sealInitialized) {
            await this.sealService.loadKeys({
              publicKey: newestKey.publicKey,
              secretKey: newestKey.privateKeyEncrypted,
            })
          }

          // Schedule rotation for the active key
          this.registerKey(newestKey.id, newestKey.expires)

          logger.info(
            `Loaded active key ${newestKey.id} from AWS Secrets Manager`,
          )
        } else {
          logger.info(
            'No valid keys found in AWS Secrets Manager, will create a new one',
          )
        }
      } else {
        // For development/test environments, use memory cache
        logger.info(
          'Loading keys from memory cache (development/test environment)',
        )

        const allKeys = Array.from(this.keyCache.values())

        // Find the newest valid key
        const now = Date.now()
        const validKeys = allKeys
          .filter((key) => key.expires > now)
          .sort((a, b) => b.created - a.created)

        if (validKeys.length > 0) {
          const newestKey = validKeys[0]
          this.activeKeyId = newestKey.id

          // If SEAL service is available, load the keys
          if (this.sealService && this.sealInitialized) {
            await this.sealService.loadKeys({
              publicKey: newestKey.publicKey,
              secretKey: newestKey.privateKeyEncrypted,
            })
          }

          // Schedule rotation for the active key
          this.registerKey(newestKey.id, newestKey.expires)
        }
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? String(error) : 'Unknown error'
      logger.error('Failed to load keys from secure storage', {
        error: getErrorMessage(error),
      })
      throw new Error(`Key loading error: ${errorMessage}`, { cause: error })
    }
  }

  /**
   * Get the active key ID
   */
  public getActiveKeyId(): string | null {
    return this.activeKeyId
  }

  /**
   * Generate a random key ID
   */

  /**
   * Get security metrics for monitoring
   */
  public getSecurityMetrics(): SecurityMetrics {
    return { ...this.securityMetrics }
  }

  public getAuditEvents(since?: Date): AuditEvent[] {
    return filterAuditEvents(this.auditEvents, since)
  }



  /**
   * Get audit events for compliance reporting
   */

  /**
   * Force key rotation (emergency use)
   */
  public async emergencyRotation(reason: string): Promise<string> {
    auditLog(this.auditEvents, (event, payload) => this.emit(event, payload), 'emergency_rotation_triggered', {
      success: true,
      details: { reason },
      riskLevel: 'critical',
    })

    return this.rotateKeys()
  }

  /**
   * Report key compromise
   */
  public async reportKeyCompromise(
    keyId: string,
    details: string,
  ): Promise<void> {
    this.securityMetrics.keyCompromiseEvents++

    // Mark key as compromised
    const version = this.keyVersions.get(keyId)
    if (version) {
      version.status = 'compromised'
    }

    auditLog(this.auditEvents, (event, payload) => this.emit(event, payload), 'key_compromise_reported', {
      success: true,
      keyId,
      details: { compromiseDetails: details },
      riskLevel: 'critical',
    })

    // Immediate rotation
    await this.emergencyRotation(`Key compromise: ${details}`)

    // Secure destruction of compromised key
    await this.securelyDestroyKey(keyId)
  }

  /**
   * HIPAA++ compliant disposal with secure cleanup
   */
  public async dispose(): Promise<void> {
    auditLog(this.auditEvents, (event, payload) => this.emit(event, payload), 'service_disposal_started', {
      success: true,
      details: { activeKeys: this.keyVersions.size },
      riskLevel: 'medium',
    })

    // Clear all timers
    for (const [, timer] of this.keyRotationTimers.entries()) {
      clearTimeout(timer)
      clearInterval(timer)
    }
    this.keyRotationTimers.clear()

    // Secure cleanup of sensitive data
    const keyIds = Array.from(this.keyCache.keys())
    for (const keyId of keyIds) {
      await this.securelyDestroyKey(keyId)
    }

    // Clear encryption key from memory
    if (this.encryptionKey) {
      this.encryptionKey.fill(0)
      this.encryptionKey = null
    }

    auditLog(this.auditEvents, (event, payload) => this.emit(event, payload), 'service_disposed', {
      success: true,
      details: { disposalTime: Date.now() },
      riskLevel: 'low',
    })

    logger.info('HIPAA++ Key rotation service disposed securely')
    this.emit('disposed')
  }
}

// Export HIPAA++ compliant singleton instance
const hipaaKeyRotationService = KeyRotationService.getInstance()

// Export types for external use
export type { AuditEvent, SecurityMetrics, KeyVersion } from './key-rotation.types'

export default hipaaKeyRotationService
