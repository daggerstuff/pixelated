import { getLogger } from '@/lib/logging/logger'
import {
  AccessControlMatrix,
  AuditLog,
} from '@/lib/research/types/research-types'
import crypto from 'crypto'
import { createHash } from 'crypto'

const logger = getLogger('HIPAADataService')

export interface HIPAAConfig {
  encryptionAlgorithm: string
  keyRotationDays: number
  auditRetentionDays: number
  accessControlMatrix: AccessControlMatrix
  dataRetentionPolicies: {
    [key: string]: {
      retentionDays: number
      anonymizationRequired: boolean
      deletionRequired: boolean
    }
  }
}

export interface DataAccessRequest {
  userId: string
  role: string
  dataType: string
  purpose: string
  clientIds?: string[]
  expirationDate?: Date
}

export interface DataAccessResult {
  granted: boolean
  data?: unknown
  accessToken?: string
  expirationDate?: Date
  restrictions?: string[]
}

export class HIPAADataService {
  private config: HIPAAConfig
  private encryptionKeys: Map<string, Buffer> = new Map()
  private auditLog: AuditLog[] = []
  private activeSessions: Map<string, { userId: string; expiration: Date }> =
    new Map()

  constructor(
    config: HIPAAConfig = {
      encryptionAlgorithm: 'aes-256-gcm',
      keyRotationDays: 90,
      auditRetentionDays: 2555, // 7 years for HIPAA
      accessControlMatrix: {
        roles: {
          'researcher': {
            permissions: ['read-anonymized', 'aggregate-analysis'],
            restrictions: ['no-identifiable', 'no-raw-phi'],
          },
          'data-scientist': {
            permissions: [
              'read-anonymized',
              'read-pseudonymized',
              'aggregate-analysis',
              'pattern-discovery',
            ],
            restrictions: ['no-identifiable', 'audit-required'],
          },
          'therapist': {
            permissions: [
              'read-own-clients',
              'write-notes',
              'clinical-analysis',
            ],
            restrictions: ['own-clients-only', 'no-research-export'],
          },
          'admin': {
            permissions: ['full-access', 'user-management', 'audit-review'],
            restrictions: ['audit-required', 'dual-authorization'],
          },
        },
      },
      dataRetentionPolicies: {
        'session-data': {
          retentionDays: 2555,
          anonymizationRequired: true,
          deletionRequired: false,
        },
        'clinical-notes': {
          retentionDays: 2555,
          anonymizationRequired: false,
          deletionRequired: false,
        },
        'research-data': {
          retentionDays: 2555,
          anonymizationRequired: true,
          deletionRequired: false,
        },
        'audit-logs': {
          retentionDays: 2555,
          anonymizationRequired: false,
          deletionRequired: false,
        },
      },
    },
  ) {
    this.config = config
    this.initializeEncryptionKeys()
  }

  /**
   * Initialize encryption keys for field-level encryption
   */
  private initializeEncryptionKeys(): void {
    const masterKey = process.env.HIPAA_MASTER_KEY || this.generateMasterKey()
    this.encryptionKeys.set('master', Buffer.from(masterKey, 'hex'))

    // Generate data-specific keys
    const dataTypes = [
      'session-data',
      'clinical-notes',
      'research-data',
      'audit-logs',
    ]
    dataTypes.forEach((dataType) => {
      const key = crypto.randomBytes(32)
      this.encryptionKeys.set(dataType, key)
    })
  }

  /**
   * Generate master encryption key
   */
  private generateMasterKey(): string {
    const key = crypto.randomBytes(32)
    logger.warn('Generated new master key - store securely!', {
      key: key.toString('hex'),
    })
    return key.toString('hex')
  }

  /**
   * Encrypt sensitive data with field-level encryption
   */
  async encryptData(
    data: unknown,
    dataType: string,
    clientId?: string,
  ): Promise<{
    encryptedData: string
    metadata: {
      algorithm: string
      keyId: string
      iv: string
      tag: string
      timestamp: string
    }
  }> {
    try {
      const key =
        this.encryptionKeys.get(dataType) || this.encryptionKeys.get('master')!
      const _iv = crypto.randomBytes(16)

      const cipher = crypto.createCipher(this.config.encryptionAlgorithm, key)
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex')
      encrypted += cipher.final('hex')

      const tag = cipher.getAuthTag ? cipher.getAuthTag().toString('hex') : ''

      const metadata = {
        algorithm: this.config.encryptionAlgorithm,
        keyId: dataType,
        iv: _iv.toString('hex'),
        tag,
        timestamp: new Date().toISOString(),
      }

      // Log encryption event
      this.logAudit({
        action: 'encrypt',
        userId: 'system',
        dataType,
        clientId,
        timestamp: new Date().toISOString(),
        details: { keyId: dataType },
      })

      return { encryptedData: encrypted, metadata }
    } catch (error) {
      logger.error('Encryption failed', { error, dataType })
      throw new Error(
        `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { cause: error },
      )
    }
  }

  /**
   * Decrypt sensitive data
   */
  async decryptData(
    encryptedData: string,
    metadata: unknown,
    dataType: string,
    clientId?: string,
  ): Promise<unknown> {
    try {
      const metadataObj = metadata as {
        keyId: string
        iv: string
        tag?: string
        algorithm: string
      }
      const key =
        this.encryptionKeys.get(metadataObj.keyId) ||
        this.encryptionKeys.get('master')!
      const _iv = Buffer.from(metadataObj.iv, 'hex')

      const decipher = crypto.createDecipher(metadataObj.algorithm, key)
      if (metadataObj.tag && decipher.setAuthTag) {
        decipher.setAuthTag(Buffer.from(metadataObj.tag, 'hex'))
      }

      let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
      decrypted += decipher.final('utf8')

      const data = JSON.parse(decrypted)

      // Log decryption event
      this.logAudit({
        action: 'decrypt',
        userId: 'system',
        dataType,
        clientId,
        timestamp: new Date().toISOString(),
        details: { keyId: metadataObj.keyId },
      })

      return data
    } catch (error) {
      logger.error('Decryption failed', { error, dataType })
      throw new Error(
        `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { cause: error },
      )
    }
  }

  /**
   * Validate data access request against access control matrix
   */
  async validateAccess(request: DataAccessRequest): Promise<DataAccessResult> {
    const { userId, role, dataType, clientIds } = request

    logger.info('Validating data access request', {
      userId,
      role,
      dataType,
      purpose: request.purpose,
    })

    try {
      // Check role permissions
      const rolePermissions = this.config.accessControlMatrix.roles[role]
      if (!rolePermissions) {
        return { granted: false }
      }

      // Check if requested data type is allowed for this role
      const isAllowed = this.isDataTypeAllowed(role, dataType)
      if (!isAllowed) {
        this.logAudit({
          action: 'access-denied',
          userId,
          dataType,
          clientIds,
          timestamp: new Date().toISOString(),
          details: { reason: 'role-restriction', role },
        })
        return { granted: false, restrictions: ['role-restriction'] }
      }

      // Generate access token
      const accessToken = this.generateAccessToken(
        userId,
        role,
        dataType,
        clientIds,
      )
      const expirationDate =
        request.expirationDate || new Date(Date.now() + 24 * 60 * 60 * 1000)

      // Log successful access
      this.logAudit({
        action: 'access-granted',
        userId,
        dataType,
        clientIds,
        timestamp: new Date().toISOString(),
        details: { accessToken, expirationDate },
      })

      return {
        granted: true,
        accessToken,
        expirationDate,
        restrictions: rolePermissions.restrictions,
      }
    } catch (error) {
      logger.error('Access validation failed', { error })
      return { granted: false }
    }
  }

  /**
   * Check if data type is allowed for the given role
   */
  private isDataTypeAllowed(role: string, dataType: string): boolean {
    const rolePermissions = this.config.accessControlMatrix.roles[role]
    if (!rolePermissions) return false

    // Check specific data type restrictions
    const dataTypeRestrictions = {
      'session-data': ['researcher', 'data-scientist', 'therapist', 'admin'],
      'clinical-notes': ['therapist', 'admin'],
      'research-data': ['researcher', 'data-scientist', 'admin'],
      'audit-logs': ['admin'],
    }

    const allowedRoles = dataTypeRestrictions[dataType] || []
    return allowedRoles.includes(role)
  }

  /**
   * Generate secure access token
   */
  private generateAccessToken(
    userId: string,
    role: string,
    dataType: string,
    clientIds?: string[],
  ): string {
    const payload = {
      userId,
      role,
      dataType,
      clientIds,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex'),
    }

    const token = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex')

    // Store active session
    this.activeSessions.set(token, {
      userId,
      expiration: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })

    return token
  }

  /**
   * Validate access token
   */
  async validateAccessToken(token: string): Promise<{
    valid: boolean
    userId?: string
    role?: string
    expiration?: Date
  }> {
    const session = this.activeSessions.get(token)
    if (!session) {
      return { valid: false }
    }

    if (session.expiration < new Date()) {
      this.activeSessions.delete(token)
      return { valid: false }
    }

    return {
      valid: true,
      userId: session.userId,
      expiration: session.expiration,
    }
  }

  /**
   * Revoke access token
   */
  async revokeAccessToken(token: string): Promise<boolean> {
    const existed = this.activeSessions.has(token)
    this.activeSessions.delete(token)

    if (existed) {
      this.logAudit({
        action: 'token-revoked',
        userId: 'system',
        timestamp: new Date().toISOString(),
        details: { token },
      })
    }

    return existed
  }

  /**
   * Apply data retention policies
   */
  async applyRetentionPolicies(): Promise<{
    processed: number
    anonymized: number
    deleted: number
    errors: string[]
  }> {
    const results = {
      processed: 0,
      anonymized: 0,
      deleted: 0,
      errors: [] as string[],
    }

    try {
      const now = new Date()

      for (const [dataType, policy] of Object.entries(
        this.config.dataRetentionPolicies,
      )) {
        const cutoffDate = new Date(
          now.getTime() - policy.retentionDays * 24 * 60 * 60 * 1000,
        )

        // Apply anonymization if required
        if (policy.anonymizationRequired) {
          try {
            const anonymized = await this.anonymizeOldData(dataType, cutoffDate)
            results.anonymized += anonymized
            results.processed += anonymized
          } catch (error) {
            results.errors.push(
              `Anonymization failed for ${dataType}: ${error.message}`,
            )
          }
        }

        // Apply deletion if required
        if (policy.deletionRequired) {
          try {
            const deleted = await this.deleteOldData(dataType, cutoffDate)
            results.deleted += deleted
            results.processed += deleted
          } catch (error) {
            results.errors.push(
              `Deletion failed for ${dataType}: ${error.message}`,
            )
          }
        }
      }

      this.logAudit({
        action: 'retention-policy-applied',
        userId: 'system',
        timestamp: new Date().toISOString(),
        details: results,
      })
    } catch (error) {
      logger.error('Retention policy application failed', { error })
      results.errors.push(`Policy application failed: ${error.message}`)
    }

    return results
  }

  /**
   * Anonymize old data
   */
  private async anonymizeOldData(
    dataType: string,
    cutoffDate: Date,
  ): Promise<number> {
    // Implementation would anonymize data older than cutoffDate
    logger.info('Anonymizing old data', { dataType, cutoffDate })
    return 0 // Placeholder
  }

  /**
   * Delete old data
   */
  private async deleteOldData(
    dataType: string,
    cutoffDate: Date,
  ): Promise<number> {
    // Implementation would delete data older than cutoffDate
    logger.info('Deleting old data', { dataType, cutoffDate })
    return 0 // Placeholder
  }

  /**
   * Rotate encryption keys
   */
  async rotateEncryptionKeys(): Promise<{
    rotated: string[]
    errors: string[]
  }> {
    const results = {
      rotated: [] as string[],
      errors: [] as string[],
    }

    try {
      const dataTypes = Array.from(this.encryptionKeys.keys())

      for (const dataType of dataTypes) {
        if (dataType !== 'master') {
          const newKey = crypto.randomBytes(32)
          this.encryptionKeys.set(dataType, newKey)
          results.rotated.push(dataType)

          this.logAudit({
            action: 'key-rotated',
            userId: 'system',
            timestamp: new Date().toISOString(),
            details: { dataType },
          })
        }
      }
    } catch (error) {
      logger.error('Key rotation failed', { error })
      results.errors.push(`Key rotation failed: ${error.message}`)
    }

    return results
  }

  /**
   * Get audit trail
   */
  async getAuditTrail(userId?: string, dataType?: string): Promise<AuditLog[]> {
    let trail = this.auditLog

    if (userId) {
      trail = trail.filter((log) => log.userId === userId)
    }

    if (dataType) {
      trail = trail.filter((log) => log.dataType === dataType)
    }

    return trail
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(): Promise<{
    encryptionStatus: unknown
    accessControlStatus: unknown
    retentionPolicyStatus: unknown
    auditTrailStatus: unknown
    recommendations: string[]
  }> {
    const report = {
      encryptionStatus: {
        algorithm: this.config.encryptionAlgorithm,
        keyRotationDays: this.config.keyRotationDays,
        fieldLevelEncryption: true,
        keysManaged: this.encryptionKeys.size,
      },
      accessControlStatus: {
        rolesConfigured: Object.keys(this.config.accessControlMatrix.roles)
          .length,
        matrixValid: this.validateAccessControlMatrix(),
        activeSessions: this.activeSessions.size,
      },
      retentionPolicyStatus: {
        policiesConfigured: Object.keys(this.config.dataRetentionPolicies)
          .length,
        lastApplied: new Date().toISOString(),
      },
      auditTrailStatus: {
        logsAvailable: this.auditLog.length,
        retentionDays: this.config.auditRetentionDays,
      },
      recommendations: [
        'Regular key rotation recommended every 90 days',
        'Review access control matrix quarterly',
        'Validate retention policies against regulatory changes',
        'Conduct annual security audit',
      ],
    }

    return report
  }

  /**
   * Validate access control matrix
   */
  private validateAccessControlMatrix(): boolean {
    const roles = this.config.accessControlMatrix.roles
    const requiredRoles = ['researcher', 'data-scientist', 'therapist', 'admin']

    return requiredRoles.every((role) => roles[role] && roles[role].permissions)
  }

  /**
   * Log audit event
   */
  private logAudit(event: AuditLog): void {
    this.auditLog.push(event)

    // Trim audit log to retention period
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.config.auditRetentionDays)

    this.auditLog = this.auditLog.filter(
      (log) => new Date(log.timestamp) >= cutoffDate,
    )
  }
}
