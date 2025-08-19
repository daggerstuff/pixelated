import { createHash } from 'node:crypto'
import { SecurityError } from './errors/security.error'

export interface AuditLogConfig {
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  includeTimestamp: boolean
  includePII: boolean
  redactFields: string[]
}

export interface AuditLogEntry {
  timestamp: string
  eventType: string
  userId?: string
  resourceType?: string
  resourceId?: string
  action: string
  status: 'success' | 'failure'
  details: Record<string, unknown>
  metadata: {
    ip?: string
    userAgent?: string
    sessionId?: string
  }
}

export class AuditLoggingService {
  private readonly config: AuditLogConfig
  private readonly logger: Console
  private readonly context: string

  constructor(
    config: AuditLogConfig = {
      logLevel: 'info',
      includeTimestamp: true,
      includePII: false,
      redactFields: ['password', 'token', 'secret', 'ssn', 'dob'],
    },
    logger: Console = console,
  ) {
    this.context = 'audit'
    this.config = config
    this.logger = logger
  }

  log(entry: {
    action: string
    resource: string
    resourceId: string
    userId: string
    details: Record<string, unknown>
  }): Promise<void> {
    return this.logEvent({
      eventType: this.context,
      action: entry.action,
      resourceType: entry.resource,
      resourceId: entry.resourceId,
      userId: entry.userId,
      details: entry.details,
      status: 'success',
      metadata: {},
    })
  }

  async logEvent(entry: Omit<AuditLogEntry, 'timestamp'>): Promise<void> {
    try {
      const timestamp = new Date().toISOString()
      const sanitizedEntry = this.sanitizeEntry({ ...entry, timestamp })

      // Log based on configured level
      switch (this.config.logLevel) {
        case 'debug':
          this.logger.debug(JSON.stringify(sanitizedEntry))
          break
        case 'info':
          this.logger.info(JSON.stringify(sanitizedEntry))
          break
        case 'warn':
          this.logger.warn(JSON.stringify(sanitizedEntry))
          break
        case 'error':
          this.logger.error(JSON.stringify(sanitizedEntry))
          break
      }

      // Store the log entry (implement your storage mechanism here)
      await this.storeLogEntry(sanitizedEntry)
    } catch (error: unknown) {
      this.logger.error('Failed to log audit event:', error)
      throw new SecurityError('Failed to log audit event')
    }
  }

  private sanitizeEntry(entry: AuditLogEntry): AuditLogEntry {
    const sanitized = { ...entry }

    if (!this.config.includePII) {
      // Hash sensitive identifiers
      if (sanitized.userId) {
        sanitized.userId = this.hashValue(sanitized.userId)
      }
      if (sanitized.metadata?.sessionId) {
        sanitized.metadata.sessionId = this.hashValue(
          sanitized.metadata.sessionId,
        )
      }
    }

    // Redact specified fields in details
    if (sanitized.details) {
      for (const field of this.config.redactFields) {
        if (field in sanitized.details) {
          sanitized.details[field] = '[REDACTED]'
        }
      }
    }

    return sanitized
  }

  private hashValue(value: string): string {
    return createHash('sha256').update(value).digest('hex')
  }

  private async storeLogEntry(entry: AuditLogEntry): Promise<void> {
    // Implement your storage mechanism here
    // This could be writing to a file, sending to a logging service,
    // storing in a database, etc.

    // For now, we'll just log to console
    if (process.env['NODE_ENV'] === 'development') {
      this.logger.debug('Storing audit log entry:', entry)
    }
  }

  async queryLogs(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    __filters: {
      startDate?: Date
      endDate?: Date
      eventType?: string
      userId?: string
      status?: 'success' | 'failure'
    },
  ): Promise<AuditLogEntry[]> {
    // Implement your log querying mechanism here
    // This could be reading from a file, querying a database,
    // or fetching from a logging service

    throw new Error('Log querying not implemented')
  }

  async exportLogs(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    __format: 'json' | 'csv',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    __filters?: {
      startDate?: Date
      endDate?: Date
      eventType?: string
      userId?: string
      status?: 'success' | 'failure'
    },
  ): Promise<string> {
    // Implement your log export mechanism here
    // This could be generating a file in the specified format
    // with the filtered log entries

    throw new Error('Log export not implemented')
  }

  async cleanup(): Promise<void> {
    // Implement any necessary cleanup
    // This could be closing file handles, database connections, etc.
    this.logger.info('Audit logging service cleaned up')
  }
}

// Factory function to create and return audit loggers
export function getAuditLogger(): AuditLoggingService {
  return new AuditLoggingService()
}
