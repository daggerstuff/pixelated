/**
 * Unit tests for HIPAA-compliant audit logging functionality
 */
import {
  BiasDetectionAuditLogger,
  getAuditLogger,
  resetAuditLogger,
  logBiasAnalysisAction,
  logDataExport,
  type AuditStorage,
  type AuditLogFilters,
} from '../audit'
import type {
  AuditLogEntry,
  AuditAction,
  UserContext,
  ParticipantDemographics,
  ConfigurationUpdate,
  RetentionPolicy,
} from '../types'

// Mock logger
vi.mock('../../utils/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

// Mock storage for testing
class MockAuditStorage implements AuditStorage {
  private entries: AuditLogEntry[] = []

  async store(entry: AuditLogEntry): Promise<void> {
    this.entries.push(entry)
  }

  async retrieve(filters: AuditLogFilters): Promise<AuditLogEntry[]> {
    let filtered = [...this.entries]

    if (filters.userId) {
      filtered = filtered.filter((e) => e.userId === filters.userId)
    }
    if (filters.actionType) {
      filtered = filtered.filter((e) => e.action.type === filters.actionType)
    }
    if (filters.timeRange) {
      filtered = filtered.filter(
        (e) =>
          e.timestamp >= filters.timeRange!.start &&
          e.timestamp <= filters.timeRange!.end,
      )
    }

    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    const offset = filters.offset || 0
    const limit = filters.limit || 100
    return filtered.slice(offset, offset + limit)
  }

  async count(filters: AuditLogFilters): Promise<number> {
    const entries = await this.retrieve({
      ...filters,
      // Remove explicit undefined values to satisfy exactOptionalPropertyTypes
      ...(filters.limit !== undefined ? {} : {}),
      ...(filters.offset !== undefined ? {} : {}),
    })
    return entries.length
  }

  async delete(entryIds: string[]): Promise<void> {
    this.entries = this.entries.filter((e) => !entryIds.includes(e.id))
  }

  async archive(beforeDate: Date): Promise<number> {
    const toArchive = this.entries.filter((e) => e.timestamp < beforeDate)
    this.entries = this.entries.filter((e) => e.timestamp >= beforeDate)
    return toArchive.length
  }

  // Test helper methods
  getEntries(): AuditLogEntry[] {
    return [...this.entries]
  }

  clear() {
    this.entries = []
  }
}

describe('BiasDetectionAuditLogger', () => {
  let mockStorage: MockAuditStorage
  let auditLogger: BiasDetectionAuditLogger
  let mockUser: UserContext
  let mockRequest: { ipAddress: string; userAgent: string }

  beforeEach(() => {
    mockStorage = new MockAuditStorage()
    auditLogger = new BiasDetectionAuditLogger(mockStorage, true)

    mockUser = {
      userId: 'user-123',
      email: 'test@example.com',
      role: {
        id: 'admin',
        name: 'admin',
        description: 'Administrator',
        level: 5,
      },
      permissions: [],
    }

    mockRequest = {
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0 Test Browser',
    }
  })

  afterEach(() => {
    mockStorage.clear()
  })

  describe('Basic Audit Logging', () => {
    it('should log a basic action successfully', async () => {
      const action: AuditAction = {
        type: 'read',
        category: 'bias-analysis',
        description: 'Viewed bias analysis results',
        sensitivityLevel: 'medium',
      }

      await auditLogger.logAction(
        mockUser,
        action,
        'bias-analysis-results',
        { resourceId: 'analysis-456' },
        mockRequest,
        'session-789',
      )

      const entries = mockStorage.getEntries()
      expect(entries).toHaveLength(1)

      const entry = entries[0]
      expect(entry).toBeDefined()
      expect(entry!.userId).toBe('user-123')
      expect(entry!.userEmail).toBe('test@example.com')
      expect(entry!.action.type).toBe('read')
      expect(entry!.resource).toBe('bias-analysis-results')
      expect(entry!.sessionId).toBe('session-789')
      expect(entry!.success).toBe(true)
      expect(entry!.ipAddress).toBe('192.168.1.1')
    })

    it('should log failed actions with error messages', async () => {
      const action: AuditAction = {
        type: 'create',
        category: 'bias-analysis',
        description: 'Failed bias analysis',
        sensitivityLevel: 'high',
      }

      await auditLogger.logAction(
        mockUser,
        action,
        'bias-analysis',
        { sessionId: 'session-123' },
        mockRequest,
        'session-123',
        false,
        'Analysis service unavailable',
      )

      const entries = mockStorage.getEntries()
      expect(entries).toHaveLength(1)

      const entry = entries[0]
      expect(entry).toBeDefined()
      expect(entry!.success).toBe(false)
      expect(entry!.errorMessage).toBe('Analysis service unavailable')
    })

    it('should generate unique audit IDs', async () => {
      const action: AuditAction = {
        type: 'read',
        category: 'bias-analysis',
        description: 'Test action',
        sensitivityLevel: 'low',
      }

      await auditLogger.logAction(mockUser, action, 'test', {}, mockRequest)
      await auditLogger.logAction(mockUser, action, 'test', {}, mockRequest)

      const entries = mockStorage.getEntries()
      expect(entries).toHaveLength(2)
      expect(entries[0]).toBeDefined()
      expect(entries[1]).toBeDefined()
      expect(entries[0]!.id).not.toBe(entries[1]!.id)
      expect(entries[0]!.id).toMatch(/^audit_\d+_[a-z0-9]+$/)
    })
  })

  describe('Data Access Logging', () => {
    it('should log data access with proper sensitivity levels', async () => {
      await auditLogger.logDataAccess(
        mockUser,
        'demographics',
        ['demo-1', 'demo-2'],
        'Research analysis',
        mockRequest,
        'supervisor-456',
        90,
        false,
      )

      const entries = mockStorage.getEntries()
      expect(entries).toHaveLength(1)

      const entry = entries[0]
      expect(entry).toBeDefined()
      expect(entry!.action.type).toBe('read')
      expect(entry!.action.category).toBe('user-data')
      expect(entry!.action.sensitivityLevel).toBe('medium') // 2 records = medium
      expect(entry!.details['dataAccessLog']).toBeDefined()
      const dataAccessLog = entry!.details['dataAccessLog'] as unknown
      expect(dataAccessLog.dataType).toBe('demographics')
      expect(dataAccessLog.dataIds).toEqual(['demo-1', 'demo-2'])
      expect(dataAccessLog.approvedBy).toBe('supervisor-456')
    })

    it('should determine correct sensitivity levels based on data type and count', async () => {
      // Test session-data with high count
      await auditLogger.logDataAccess(
        mockUser,
        'session-data',
        Array.from({ length: 150 }, (_, i) => `session-${i}`),
        'Bulk analysis',
        mockRequest,
      )

      const entries = mockStorage.getEntries()
      expect(entries).toHaveLength(1)
      expect(entries[0]).toBeDefined()
      expect(entries[0]!.action.sensitivityLevel).toBe('critical') // >100 session records

      mockStorage.clear()

      // Test analysis-results with medium count
      await auditLogger.logDataAccess(
        mockUser,
        'analysis-results',
        Array.from({ length: 50 }, (_, i) => `result-${i}`),
        'Report generation',
        mockRequest,
      )

      const newEntries = mockStorage.getEntries()
      expect(newEntries).toHaveLength(1)
      expect(newEntries[0]).toBeDefined()
      expect(newEntries[0]!.action.sensitivityLevel).toBe('medium') // 50 analysis records
    })
  })

  describe('Bias Analysis Logging', () => {
    it('should log bias analysis with anonymized demographics', async () => {
      const demographics: ParticipantDemographics = {
        age: '25-35',
        gender: 'female',
        ethnicity: 'hispanic',
        primaryLanguage: 'en',
        socioeconomicStatus: 'middle',
        education: 'bachelor',
        region: 'california',
      }

      await auditLogger.logBiasAnalysis(
        mockUser,
        'session-123',
        demographics,
        0.75,
        'high',
        mockRequest,
      )

      const entries = mockStorage.getEntries()
      expect(entries).toHaveLength(1)

      const entry = entries[0]
      expect(entry).toBeDefined()
      expect(entry!.action.type).toBe('create')
      expect(entry!.action.sensitivityLevel).toBe('high') // high alert level
      expect(entry!.details['sessionId']).toBe('session-123')
      expect(entry!.details['biasScore']).toBe(0.75)
      expect(entry!.details['alertLevel']).toBe('high')

      // Check demographics anonymization
      const loggedDemographics = entry!.details['demographics'] as unknown
      expect(loggedDemographics).toBeDefined()
      expect(loggedDemographics.age).toBe('25-35')
      expect(loggedDemographics.gender).toBe('female')
      expect(loggedDemographics.region).toBe('REDACTED') // Should be redacted
    })

    it('should set appropriate sensitivity level based on alert level', async () => {
      const demographics: ParticipantDemographics = {
        age: '25-35',
        gender: 'male',
        ethnicity: 'white',
        primaryLanguage: 'en',
      }

      // Test critical alert level
      await auditLogger.logBiasAnalysis(
        mockUser,
        'session-critical',
        demographics,
        0.9,
        'critical',
        mockRequest,
      )

      // Test low alert level
      await auditLogger.logBiasAnalysis(
        mockUser,
        'session-low',
        demographics,
        0.2,
        'low',
        mockRequest,
      )

      const entries = mockStorage.getEntries()
      expect(entries).toHaveLength(2)

      // Critical should be high sensitivity
      const criticalEntry = entries.find(
        (e) => e.details['sessionId'] === 'session-critical',
      )
      expect(criticalEntry?.action.sensitivityLevel).toBe('high')

      // Low should be medium sensitivity
      const lowEntry = entries.find(
        (e) => e.details['sessionId'] === 'session-low',
      )
      expect(lowEntry?.action.sensitivityLevel).toBe('medium')
    })
  })

  describe('Configuration Change Logging', () => {
    it('should log configuration changes with impact assessment', async () => {
      const configUpdate: ConfigurationUpdate = {
        id: 'config-update-123',
        timestamp: new Date(),
        userId: 'user-123',
        section: 'thresholds',
        changes: [
          {
            field: 'criticalLevel',
            oldValue: 0.8,
            newValue: 0.7,
            impact: 'high',
            requiresRestart: false,
          },
          {
            field: 'pythonServiceUrl',
            oldValue: 'http://localhost:5000',
            newValue: 'http://new-service:5000',
            impact: 'critical',
            requiresRestart: true,
          },
        ],
        reason: 'Improving bias detection sensitivity',
        rollbackAvailable: true,
      }

      await auditLogger.logConfigurationChange(
        mockUser,
        configUpdate,
        mockRequest,
      )

      const entries = mockStorage.getEntries()
      expect(entries).toHaveLength(1)

      const entry = entries[0]
      expect(entry).toBeDefined()
      expect(entry!.action.type).toBe('update')
      expect(entry!.action.category).toBe('configuration')
      expect(entry!.action.sensitivityLevel).toBe('high') // Has critical impact change
      expect(entry!.details['configUpdate']).toEqual(configUpdate)
      expect(entry!.details['changesCount']).toBe(2)
      expect(entry!.details['requiresRestart']).toBe(true)
    })
  })

  describe('Authentication Logging', () => {
    it('should log successful login', async () => {
      await auditLogger.logAuthentication(
        'user-456',
        'user456@example.com',
        'login',
        mockRequest,
        true,
      )

      const entries = mockStorage.getEntries()
      expect(entries).toHaveLength(1)

      const entry = entries[0]
      expect(entry).toBeDefined()
      expect(entry!.userId).toBe('user-456')
      expect(entry!.userEmail).toBe('user456@example.com')
      expect(entry!.action.type).toBe('login')
      expect(entry!.action.category).toBe('authentication')
      expect(entry!.success).toBe(true)
    })

    it('should log failed login with error message', async () => {
      await auditLogger.logAuthentication(
        'user-789',
        'user789@example.com',
        'login',
        mockRequest,
        false,
        'Invalid credentials',
      )

      const entries = mockStorage.getEntries()
      expect(entries).toHaveLength(1)

      const entry = entries[0]
      expect(entry).toBeDefined()
      expect(entry!.success).toBe(false)
      expect(entry!.errorMessage).toBe('Invalid credentials')
    })
  })

  describe('Audit Log Retrieval', () => {
    beforeEach(async () => {
      // Add test data
      const action: AuditAction = {
        type: 'read',
        category: 'bias-analysis',
        description: 'Test action',
        sensitivityLevel: 'medium',
      }

      await auditLogger.logAction(mockUser, action, 'test-1', {}, mockRequest)
      await auditLogger.logAction(
        { ...mockUser, userId: 'user-456' },
        { ...action, type: 'create' },
        'test-2',
        {},
        mockRequest,
      )
      await auditLogger.logAction(mockUser, action, 'test-3', {}, mockRequest)
    })

    it('should retrieve all logs without filters', async () => {
      const logs = await auditLogger.getAuditLogs({})
      expect(logs).toHaveLength(3)
    })

    it('should filter logs by user ID', async () => {
      const logs = await auditLogger.getAuditLogs({ userId: 'user-123' })
      expect(logs).toHaveLength(2)
      expect(logs.every((log) => log.userId === 'user-123')).toBe(true)
    })

    it('should filter logs by action type', async () => {
      const logs = await auditLogger.getAuditLogs({ actionType: 'create' })
      expect(logs).toHaveLength(1)
      expect(logs[0]!.action.type).toBe('create')
    })

    it('should apply pagination', async () => {
      const logs = await auditLogger.getAuditLogs({ limit: 2, offset: 1 })
      expect(logs).toHaveLength(2)
    })
  })

  describe('Compliance Reporting', () => {
    beforeEach(async () => {
      // Add test data with some violations

      // Add failed login attempts
      for (let i = 0; i < 15; i++) {
        await auditLogger.logAuthentication(
          `user-${i}`,
          `user${i}@example.com`,
          'login',
          mockRequest,
          false,
          'Invalid credentials',
        )
      }

      // Add successful actions
      const action: AuditAction = {
        type: 'read',
        category: 'bias-analysis',
        description: 'Successful action',
        sensitivityLevel: 'medium',
      }

      await auditLogger.logAction(mockUser, action, 'test', {}, mockRequest)
    })

    it('should generate compliance report with violations', async () => {
      const period = {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        end: new Date(),
      }

      const report = await auditLogger.generateComplianceReport(period, true)

      expect(report.id).toMatch(/^audit_\d+_[a-z0-9]+$/)
      expect(report.period).toEqual(period)
      expect(report.complianceScore).toBeLessThan(100) // Should be reduced due to violations
      expect(report.violations).toHaveLength(1) // Should detect failed login violation
      expect(report.violations[0]!.type).toBe('unauthorized-access')
      expect(report.recommendations).toHaveLength(1) // Should have recommendations
      expect(report.auditTrail).toHaveLength(16) // 15 failed logins + 1 successful action
    })

    it('should calculate compliance score correctly', async () => {
      // Clear existing data
      mockStorage.clear()

      // Add only successful actions
      const action: AuditAction = {
        type: 'read',
        category: 'bias-analysis',
        description: 'Successful action',
        sensitivityLevel: 'low',
      }

      for (let i = 0; i < 5; i++) {
        await auditLogger.logAction(mockUser, action, 'test', {}, mockRequest)
      }

      const period = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
      }

      const report = await auditLogger.generateComplianceReport(period, true)
      expect(report.complianceScore).toBe(100) // Perfect score with no violations
    })
  })

  describe('Data Sanitization', () => {
    it('should sanitize high-sensitivity data', async () => {
      const action: AuditAction = {
        type: 'read',
        category: 'user-data',
        description: 'Access sensitive data',
        sensitivityLevel: 'critical',
      }

      const sensitiveDetails = {
        demographics: {
          age: '25-35',
          gender: 'female',
          region: 'california',
        },
        sessionContent: 'Detailed therapy session notes...',
      }

      await auditLogger.logAction(
        mockUser,
        action,
        'sensitive-data',
        sensitiveDetails,
        mockRequest,
      )

      const entries = mockStorage.getEntries()
      const entry = entries[0]
      expect(entry).toBeDefined()

      // Should anonymize demographics
      const demographics = entry!.details['demographics'] as unknown
      expect(demographics.region).toBe('REDACTED')

      // Should redact session content
      expect(entry!.details['sessionContent']).toBe('[REDACTED]')
    })

    it('should not sanitize low-sensitivity data', async () => {
      const action: AuditAction = {
        type: 'read',
        category: 'system',
        description: 'System status check',
        sensitivityLevel: 'low',
      }

      const details = {
        systemStatus: 'healthy',
        timestamp: new Date(),
      }

      await auditLogger.logAction(
        mockUser,
        action,
        'system',
        details,
        mockRequest,
      )

      const entries = mockStorage.getEntries()
      const entry = entries[0]
      expect(entry).toBeDefined()

      // Should preserve all details for low sensitivity
      expect(entry!.details).toEqual(details)
    })
  })

  describe('Cleanup and Retention', () => {
    it('should clean up old logs based on retention policies', async () => {
      const retentionPolicies: RetentionPolicy[] = [
        {
          dataType: 'test-logs',
          retentionPeriod: 1, // 1 day
          autoDelete: false,
          archiveBeforeDelete: true,
          approvalRequired: false,
        },
      ]

      const auditLoggerWithRetention = new BiasDetectionAuditLogger(
        mockStorage,
        true,
        retentionPolicies,
      )

      // Add old entry (2 days ago)
      const oldDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      const action: AuditAction = {
        type: 'read',
        category: 'bias-analysis',
        description: 'Old action',
        sensitivityLevel: 'low',
      }

      await auditLoggerWithRetention.logAction(
        mockUser,
        action,
        'test',
        {},
        mockRequest,
      )

      // Manually set timestamp to old date
      const entries = mockStorage.getEntries()
      entries[0]!.timestamp = oldDate

      const result = await auditLoggerWithRetention.cleanupOldLogs()
      expect(result.archived).toBe(1)
      expect(result.deleted).toBe(0)
    })
  })
})

describe('Convenience Functions', () => {
  let mockUser: UserContext
  let mockRequest: { ipAddress: string; userAgent: string }

  beforeEach(() => {
    // Clear singleton instance to avoid test interference
    resetAuditLogger()

    mockUser = {
      userId: 'user-123',
      email: 'test@example.com',
      role: {
        id: 'analyst',
        name: 'analyst',
        description: 'Data Analyst',
        level: 3,
      },
      permissions: [],
    }

    mockRequest = {
      ipAddress: '10.0.0.1',
      userAgent: 'Test Client',
    }
  })

  describe('logBiasAnalysisAction', () => {
    it('should log analyze action correctly', async () => {
      await logBiasAnalysisAction(
        mockUser,
        'session-123',
        'analyze',
        { alertLevel: 'medium', biasScore: 0.5 },
        mockRequest,
      )

      const auditLogger = getAuditLogger()
      const logs = await auditLogger.getAuditLogs({ sessionId: 'session-123' })

      expect(logs).toHaveLength(1)
      expect(logs[0]!.action.type).toBe('create')
      expect(logs[0]!.action.category).toBe('bias-analysis')
      expect(logs[0]!.sessionId).toBe('session-123')
    })

    it('should log export action with critical sensitivity', async () => {
      await logBiasAnalysisAction(
        mockUser,
        'session-456',
        'export',
        { alertLevel: 'critical', format: 'pdf' },
        mockRequest,
      )

      const auditLogger = getAuditLogger()
      const logs = await auditLogger.getAuditLogs({ sessionId: 'session-456' })

      expect(logs).toHaveLength(1)
      expect(logs[0]!.action.type).toBe('export')
      expect(logs[0]!.action.sensitivityLevel).toBe('critical')
    })

    it('should log view action with medium sensitivity', async () => {
      await logBiasAnalysisAction(
        mockUser,
        'session-789',
        'view',
        { alertLevel: 'low' },
        mockRequest,
      )

      const auditLogger = getAuditLogger()
      const logs = await auditLogger.getAuditLogs({ sessionId: 'session-789' })

      expect(logs).toHaveLength(1)
      expect(logs[0]!.action.type).toBe('read')
      expect(logs[0]!.action.sensitivityLevel).toBe('medium')
    })
  })

  describe('logDataExport', () => {
    it('should log small data export with low sensitivity', async () => {
      await logDataExport(mockUser, 'json', 50, mockRequest)

      const auditLogger = getAuditLogger()
      const logs = await auditLogger.getAuditLogs({ actionType: 'export' })

      expect(logs).toHaveLength(1)
      expect(logs[0]!.action.sensitivityLevel).toBe('low') // <100 records
      expect(logs[0]!.details['exportType']).toBe('json')
      expect(logs[0]!.details['recordCount']).toBe(50)
    })

    it('should log medium data export with medium sensitivity', async () => {
      await logDataExport(mockUser, 'csv', 500, mockRequest)

      const auditLogger = getAuditLogger()
      const logs = await auditLogger.getAuditLogs({ actionType: 'export' })

      expect(logs).toHaveLength(1)
      expect(logs[0]!.action.sensitivityLevel).toBe('medium') // 100-1000 records
    })

    it('should log large data export with high sensitivity', async () => {
      await logDataExport(mockUser, 'pdf', 2000, mockRequest)

      const auditLogger = getAuditLogger()
      const logs = await auditLogger.getAuditLogs({ actionType: 'export' })

      expect(logs).toHaveLength(1)
      expect(logs[0]!.action.sensitivityLevel).toBe('high') // >1000 records
    })

    it('should log failed export with error message', async () => {
      await logDataExport(
        mockUser,
        'json',
        100,
        mockRequest,
        false,
        'Export service unavailable',
      )

      const auditLogger = getAuditLogger()
      const logs = await auditLogger.getAuditLogs({ success: false })

      expect(logs).toHaveLength(1)
      expect(logs[0]!.success).toBe(false)
      expect(logs[0]!.errorMessage).toBe('Export service unavailable')
    })
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const logger1 = getAuditLogger()
      const logger2 = getAuditLogger()

      expect(logger1).toBe(logger2)
    })
  })
})
