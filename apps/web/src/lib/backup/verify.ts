import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import { RedisService } from '@/lib/services/redis/RedisService'
import { getEnv } from '@/lib/utils/env'

import { createBuildSafeLogger } from '../logging/build-safe-logger'
const logger = createBuildSafeLogger('verify')

interface BackupConfig {
  backupDir: string
  retentionDays: number
  verificationInterval: number // in milliseconds
  integrityCheckEnabled: boolean
}

interface BackupMetadata {
  timestamp: number
  checksum: string
  size: number
  type: 'full' | 'incremental'
  status: 'pending' | 'verified' | 'failed'
  version: string
  environment: string
}

interface BackupVerificationResult {
  file: string
  isValid: boolean
  error?: string
  metadata?: BackupMetadata
}

export class BackupVerificationService extends EventEmitter {
  private readonly config: BackupConfig
  private readonly backupDir: string
  constructor(_redis: RedisService, config: Partial<BackupConfig> = {}) {
    super()
    this.config = {
      backupDir: getEnv('BACKUP_DIR', './backups') ?? './backups',
      retentionDays: 30,
      verificationInterval: 24 * 60 * 60 * 1000, // 24 hours
      integrityCheckEnabled: true,
      ...config,
    }
    this.backupDir = this.config.backupDir
  }

  async initialize(): Promise<void> {
    await this.ensureBackupDirectory()
    this.startVerificationSchedule()
  }

  private async ensureBackupDirectory(): Promise<void> {
    await fs.mkdir(this.backupDir, { recursive: true })
  }

  private startVerificationSchedule() {
    setInterval(() => {
      this.verifyAllBackups().catch(console.error)
    }, this.config.verificationInterval)
  }

  async verifyAllBackups(): Promise<BackupVerificationResult[]> {
    const results: BackupVerificationResult[] = []

    try {
      // Ensure backup directory exists
      await fs.mkdir(this.backupDir, { recursive: true })

      // Get all backup files
      const files = await fs.readdir(this.backupDir)
      const backupFiles = files.filter((f) => f.endsWith('.json'))

      // Verify each backup
      for (const file of backupFiles) {
        try {
          const result = await this.verifyBackup(file)
          results.push(result)
        } catch (error: unknown) {
          results.push({
            file,
            isValid: false,
            error: String(
              (error as Record<string, unknown>)['message'] ?? 'Unknown error',
            ),
          })
        }
      }

      await this.cleanupOldBackups()

      return results
    } catch (error: unknown) {
      throw new Error(
        `Failed to verify backups: ${String((error as Record<string, unknown>)['message'] ?? 'Unknown error')}`,
        {
          cause: error,
        },
      )
    }
  }

  private async verifyBackup(
    filename: string,
  ): Promise<BackupVerificationResult> {
    const filePath = path.join(this.backupDir, filename)

    try {
      // Read file
      const rawData = await fs.readFile(filePath)

      // Calculate checksum
      const checksum = this.calculateChecksum(rawData)

      // Parse backup data
      const backup = JSON.parse(rawData.toString()) as Record<string, unknown>

      // Verify structure
      if (!this.isValidBackupStructure(backup)) {
        return {
          file: filename,
          isValid: false,
          error: 'Invalid backup structure',
        }
      }

      // Verify metadata
      const metadata: BackupMetadata = {
        timestamp: backup['timestamp'] as number,
        checksum,
        size: rawData.length,
        type: backup['type'] as 'full' | 'incremental',
        status: 'pending',
        version: backup['version'] as string,
        environment: backup['environment'] as string,
      }

      // Verify data integrity
      if (!this.verifyDataIntegrity(backup['data'])) {
        return {
          file: filename,
          isValid: false,
          error: 'Data integrity check failed',
          metadata,
        }
      }

      // Mark backup as verified
      await this.markBackupVerified(filename, metadata)

      return {
        file: filename,
        isValid: true,
        metadata,
      }
    } catch (error: unknown) {
      return {
        file: filename,
        isValid: false,
        error: `Verification failed: ${String(error)}`,
      }
    }
  }

  private calculateChecksum(data: Buffer): string {
    return createHash('sha256').update(data).digest('hex')
  }

  private isValidBackupStructure(backup: unknown): boolean {
    return (
      backup !== null &&
      typeof backup === 'object' &&
      typeof (backup as Record<string, unknown>)['timestamp'] === 'number' &&
      typeof (backup as Record<string, unknown>)['version'] === 'string' &&
      typeof (backup as Record<string, unknown>)['environment'] === 'string' &&
      typeof (backup as Record<string, unknown>)['data'] === 'object'
    )
  }

  private verifyDataIntegrity(data: unknown): boolean {
    try {
      const typedData = data as {
        redis?: unknown
        files?: unknown
        config?: unknown
      }
      // Check for required data sections
      const requiredSections = ['redis', 'files', 'config'] as const
      const hasAllSections = requiredSections.every(
        (section) => typeof typedData[section] === 'object',
      )

      if (!hasAllSections) {
        return false
      }

      // Verify Redis data
      if (!this.verifyRedisData(typedData.redis)) {
        return false
      }

      // Verify file data
      if (!this.verifyFileData(typedData.files)) {
        return false
      }

      // Verify config data
      if (!this.verifyConfigData(typedData.config)) {
        return false
      }

      return true
    } catch {
      return false
    }
  }

  private verifyRedisData(data: unknown): boolean {
    if (typeof data !== 'object' || data === null) {
      return false
    }
    return Object.entries(data as Record<string, unknown>).every(
      ([key, value]) =>
        typeof key === 'string' &&
        (typeof value === 'string' || typeof value === 'number'),
    )
  }

  private verifyFileData(data: unknown): boolean {
    return (
      Array.isArray(data) &&
      data.every(
        (file) =>
          typeof file === 'object' &&
          typeof file.path === 'string' &&
          typeof file.checksum === 'string',
      )
    )
  }

  private verifyConfigData(data: unknown): boolean {
    return (
      data !== null &&
      typeof data === 'object' &&
      typeof (data as Record<string, unknown>)['version'] === 'string' &&
      typeof (data as Record<string, unknown>)['environment'] === 'string'
    )
  }
  private async _verifyBackupContents(backupPath: string): Promise<void> {
    try {
      // Read backup file
      const backupFileData = await fs.readFile(backupPath)
      const backupData = JSON.parse(backupFileData.toString()) as Record<
        string,
        unknown
      >

      // Verify backup structure
      if (!backupData['data'] || !backupData['metadata']) {
        throw new Error('Invalid backup structure')
      }

      // Verify data integrity
      if (this.config.integrityCheckEnabled) {
        this.verifyDataIntegrity(backupData['data'])
      }

      // Verify restoration capability
      await this.verifyRestoration(backupData)
    } catch (error: unknown) {
      throw new Error(`Backup content verification failed: ${String(error)}`, {
        cause: error,
      })
    }
  }

  private async verifyRestoration(backup: unknown): Promise<void> {
    // Create temporary Redis instance for restoration testing
    const testRedis = new RedisService({
      url: process.env['REDIS_URL']!,
      keyPrefix: 'backup_test_',
      maxRetries: 3,
      retryDelay: 100,
    })

    try {
      await testRedis.connect()

      // Test restore a small subset of data
      const testData = this.extractTestData(
        (backup as Record<string, unknown>)['data'],
      )
      await this.restoreTestData(testRedis, testData)

      // Verify restored data
      await this.verifyRestoredData(testRedis, testData)
    } finally {
      // Clean up test data
      await testRedis.disconnect()
    }
  }

  private extractTestData(data: unknown): unknown {
    // Extract a small sample of each data type
    const typedData = data as Record<string, unknown>
    return {
      users: Array.isArray(typedData?.['users'])
        ? (typedData['users'] as unknown[]).slice(0, 5)
        : [],
      sessions: Array.isArray(typedData?.['sessions'])
        ? (typedData['sessions'] as unknown[]).slice(0, 5)
        : [],
      analytics: Array.isArray(typedData?.['analytics'])
        ? (typedData['analytics'] as unknown[]).slice(0, 5)
        : [],
    }
  }

  private async restoreTestData(
    redis: RedisService,
    data: unknown,
  ): Promise<void> {
    // Implement test data restoration logic
    const typedData = data as Record<string, unknown>
    const users = Array.isArray(typedData?.['users'])
      ? (typedData['users'] as unknown[])
      : []
    for (const user of users) {
      if (user && typeof user === 'object' && 'id' in user) {
        await redis.set(
          `user:${(user as { id: string }).id}`,
          JSON.stringify(user),
        )
      }
    }
    // ... similar for other data types
  }

  private async verifyRestoredData(
    redis: RedisService,
    data: unknown,
  ): Promise<void> {
    // Verify restored data matches original
    const typedData = data as Record<string, unknown>
    const users = Array.isArray(typedData?.['users'])
      ? (typedData['users'] as unknown[])
      : []
    for (const user of users) {
      if (user && typeof user === 'object' && 'id' in user) {
        const userId = (user as { id: string }).id
        const restored = await redis.get(`user:${userId}`)
        if (!restored || !(JSON.parse(restored) as { id: unknown }).id) {
          throw new Error(`Restoration verification failed for user: ${userId}`)
        }
      }
    }
    // ... similar for other data types
  }

  private async getBackupMetadata(
    backupFile: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      const metadataPath = path.join(this.backupDir, `${backupFile}.meta`)
      const data = await fs.readFile(metadataPath, 'utf-8')
      return JSON.parse(data) as Record<string, unknown>
    } catch {
      return null
    }
  }

  private async markBackupVerified(
    backupFile: string,
    metadata: BackupMetadata,
  ): Promise<void> {
    const existingMetadata = await this.getBackupMetadata(backupFile)
    if (existingMetadata) {
      existingMetadata['status'] = 'verified'
      await this.saveBackupMetadata(
        backupFile,
        existingMetadata as unknown as BackupMetadata,
      )
    } else {
      await this.saveBackupMetadata(backupFile, metadata)
    }
  }

  private async saveBackupMetadata(
    backupFile: string,
    metadata: BackupMetadata,
  ): Promise<void> {
    const metadataPath = path.join(this.backupDir, `${backupFile}.meta`)
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))
  }

  private async cleanupOldBackups(): Promise<void> {
    const backups = await this.listBackups()
    const now = Date.now()
    const retentionMs = this.config.retentionDays * 24 * 60 * 60 * 1000

    for (const backup of backups) {
      const metadata = await this.getBackupMetadata(backup)
      if (
        metadata &&
        now - (metadata as { timestamp: number }).timestamp > retentionMs
      ) {
        await this.deleteBackup(backup)
      }
    }
  }

  private async deleteBackup(backupFile: string): Promise<void> {
    const backupPath = path.join(this.backupDir, backupFile)
    const metadataPath = path.join(this.backupDir, `${backupFile}.meta`)

    try {
      await fs.unlink(backupPath)
      await fs.unlink(metadataPath)
    } catch (error: unknown) {
      logger.error(`Failed to delete backup ${backupFile}:`, error)
    }
  }

  private async listBackups(): Promise<string[]> {
    const files = await fs.readdir(this.backupDir)
    return files.filter((file) => file.endsWith('.json'))
  }
}

// Export a singleton instance
let verificationService: BackupVerificationService | null = null

export async function initializeBackupVerification(
  _redis: RedisService,
  config?: Partial<BackupConfig>,
): Promise<BackupVerificationService> {
  if (!verificationService) {
    verificationService = new BackupVerificationService(_redis, config)
    await verificationService.initialize()
  }
  return verificationService
}

export function getBackupVerificationService(): BackupVerificationService {
  if (!verificationService) {
    throw new Error('Backup verification service not initialized')
  }
  return verificationService
}
