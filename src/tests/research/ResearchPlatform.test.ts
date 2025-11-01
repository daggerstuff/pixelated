import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ResearchPlatform } from '@/lib/research/ResearchPlatform'
import { AnonymizationService } from '@/lib/research/services/AnonymizationService'
import { ConsentManagementService } from '@/lib/research/services/ConsentManagementService'
import { HIPAADataService } from '@/lib/research/services/HIPAADataService'

// Mock environment variables
vi.stubEnv('HIPAA_MASTER_KEY', 'test-master-key-32-chars-long-12345')
vi.stubEnv('RESEARCH_ENCRYPTION_KEY', 'test-research-key-32-chars-long-123')

describe('Research Platform', () => {
  let platform: ResearchPlatform

  beforeEach(() => {
    platform = new ResearchPlatform()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize successfully with default configuration', async () => {
      const result = await platform.initialize()
      
      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('status', 'initialized')
    })

    it('should fail initialization with invalid configuration', async () => {
      const invalidPlatform = new ResearchPlatform({
        anonymization: {
          kAnonymity: 1, // Invalid: too low
          differentialPrivacyEpsilon: 0.1,
          noiseInjection: true,
          temporalObfuscation: true
        },
        consent: {
          defaultLevel: 'minimal',
          expirationDays: 365,
          withdrawalGracePeriodHours: 24
        },
        queryEngine: {
          maxComplexity: 1000,
          maxResultSize: 10000,
          approvalRequired: true,
          cacheEnabled: true
        },
        hipaa: {
          encryptionAlgorithm: 'aes-256-gcm',
          keyRotationDays: 90,
          auditRetentionDays: 2555
        }
      })

      const result = await invalidPlatform.initialize()
      
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('Status and Health Checks', () => {
    it('should return platform status', async () => {
      await platform.initialize()
      
      const result = await platform.getStatus()
      
      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('healthy')
      expect(result.data).toHaveProperty('services')
      expect(result.data).toHaveProperty('metrics')
      expect(result.data).toHaveProperty('alerts')
    })

    it('should indicate healthy status when all services are operational', async () => {
      await platform.initialize()
      
      const result = await platform.getStatus()
      
      expect(result.data.healthy).toBe(true)
      expect(result.data.services.anonymization).toBe(true)
      expect(result.data.services.consent).toBe(true)
      expect(result.data.services.hipaa).toBe(true)
    })
  })

  describe('Data Submission and Anonymization', () => {
    it('should submit and anonymize research data successfully', async () => {
      await platform.initialize()
      
      const testData = [
        {
          clientId: 'client-1',
          sessionId: 'session-1',
          emotionScores: { happiness: 0.8, sadness: 0.2 },
          techniqueEffectiveness: { 'cognitive_restructuring': 0.9 },
          sessionDuration: 3600
        }
      ]

      const result = await platform.submitResearchData(testData, 'high', 'test-user')
      
      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('anonymizedCount')
      expect(result.data).toHaveProperty('privacyMetrics')
      expect(result.data).toHaveProperty('encryptedData')
    })

    it('should fail submission without proper consent', async () => {
      await platform.initialize()
      
      const testData = [
        {
          clientId: 'client-without-consent',
          sessionId: 'session-1',
          emotionScores: { happiness: 0.8, sadness: 0.2 },
          techniqueEffectiveness: { 'cognitive_restructuring': 0.9 },
          sessionDuration: 3600
        }
      ]

      const result = await platform.submitResearchData(testData, 'high', 'test-user')
      
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('CONSENT_ERROR')
    })
  })

  describe('Query Execution', () => {
    it('should execute research queries successfully', async () => {
      await platform.initialize()
      
      const query = {
        id: 'test-query-1',
        type: 'sql',
        sql: 'SELECT COUNT(*) as count FROM research_data',
        parameters: {},
        description: 'Test query',
        requiresApproval: false,
        anonymizationLevel: 'high',
        createdAt: new Date().toISOString(),
        createdBy: 'test-user'
      }

      const result = await platform.executeResearchQuery(query, 'test-user', 'researcher')
      
      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('queryId')
      expect(result.data).toHaveProperty('status')
    })

    it('should deny access for unauthorized users', async () => {
      await platform.initialize()
      
      const query = {
        id: 'test-query-1',
        type: 'sql',
        sql: 'SELECT COUNT(*) as count FROM research_data',
        parameters: {},
        description: 'Test query',
        requiresApproval: false,
        anonymizationLevel: 'high',
        createdAt: new Date().toISOString(),
        createdBy: 'test-user'
      }

      const result = await platform.executeResearchQuery(query, 'unauthorized-user', 'invalid-role')
      
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('ACCESS_DENIED')
    })
  })

  describe('Pattern Discovery', () => {
    it('should discover patterns successfully', async () => {
      await platform.initialize()
      
      const request = {
        patternTypes: ['correlation', 'trend'],
        metrics: ['emotion_scores', 'technique_effectiveness'],
        timeRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-12-31')
        }
      }

      const result = await platform.discoverPatterns(request, 'test-user', 'data-scientist')
      
      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('patterns')
      expect(result.data).toHaveProperty('metadata')
    })
  })

  describe('Evidence Generation', () => {
    it('should generate evidence reports successfully', async () => {
      await platform.initialize()
      
      const request = {
        hypotheses: [
          {
            id: 'test-hypothesis-1',
            statement: 'Cognitive restructuring improves emotional outcomes',
            variables: ['technique', 'emotion_score'],
            expectedDirection: 'positive',
            nullHypothesis: 'No effect of cognitive restructuring on emotions',
            alternativeHypothesis: 'Cognitive restructuring improves emotional outcomes'
          }
        ]
      }

      const result = await platform.generateEvidenceReport(request, 'test-user', 'researcher')
      
      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('id')
      expect(result.data).toHaveProperty('findings')
      expect(result.data).toHaveProperty('conclusions')
    })
  })

  describe('Consent Management', () => {
    it('should initialize consent successfully', async () => {
      await platform.initialize()
      
      const result = await platform.manageConsent(
        'initialize',
        'test-client-1',
        { level: 'full', metadata: { ipAddress: '127.0.0.1' } },
        'test-user'
      )
      
      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('clientId', 'test-client-1')
      expect(result.data).toHaveProperty('currentLevel', 'full')
    })

    it('should update consent level successfully', async () => {
      await platform.initialize()
      
      // Initialize first
      await platform.manageConsent(
        'initialize',
        'test-client-1',
        { level: 'minimal' },
        'test-user'
      )
      
      // Then update
      const result = await platform.manageConsent(
        'update',
        'test-client-1',
        { level: 'full', reason: 'User requested upgrade' },
        'test-user'
      )
      
      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('currentLevel', 'full')
    })

    it('should handle consent withdrawal', async () => {
      await platform.initialize()
      
      const result = await platform.manageConsent(
        'withdraw',
        'test-client-1',
        { reason: 'Privacy concerns', immediate: false },
        'test-user'
      )
      
      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('consentRecord')
      expect(result.data).toHaveProperty('dataPurgeScheduled', true)
    })
  })

  describe('Audit and Compliance', () => {
    it('should retrieve audit trail', async () => {
      await platform.initialize()
      
      const result = await platform.getAuditTrail('test-user')
      
      expect(result.success).toBe(true)
      expect(Array.isArray(result.data)).toBe(true)
    })

    it('should generate compliance report', async () => {
      await platform.initialize()
      
      const result = await platform.generateComplianceReport()
      
      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('encryptionStatus')
      expect(result.data).toHaveProperty('accessControlStatus')
      expect(result.data).toHaveProperty('retentionPolicyStatus')
    })
  })

  describe('Error Handling', () => {
    it('should handle uninitialized platform gracefully', async () => {
      const result = await platform.getStatus()
      
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('STATUS_ERROR')
    })

    it('should handle invalid queries gracefully', async () => {
      await platform.initialize()
      
      const invalidQuery = {
        id: 'invalid-query',
        type: 'invalid-type',
        sql: 'INVALID SQL',
        parameters: {},
        description: 'Invalid query',
        requiresApproval: false,
        anonymizationLevel: 'high',
        createdAt: new Date().toISOString(),
        createdBy: 'test-user'
      }

      const result = await platform.executeResearchQuery(invalidQuery, 'test-user', 'researcher')
      
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('Security and Privacy', () => {
    it('should enforce role-based access control', async () => {
      await platform.initialize()
      
      const query = {
        id: 'test-query-1',
        type: 'sql',
        sql: 'SELECT * FROM sensitive_data',
        parameters: {},
        description: 'Sensitive query',
        requiresApproval: true,
        anonymizationLevel: 'high',
        createdAt: new Date().toISOString(),
        createdBy: 'test-user'
      }

      // Therapist role should not have access to research data
      const result = await platform.executeResearchQuery(query, 'therapist-user', 'therapist')
      
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('ACCESS_DENIED')
    })

    it('should maintain audit trail for all operations', async () => {
      await platform.initialize()
      
      // Perform some operations
      await platform.submitResearchData([{ clientId: 'test-client', data: 'test' }], 'high', 'test-user')
      
      const audit = await platform.getAuditTrail('test-user')
      
      expect(audit.success).toBe(true)
      expect(audit.data.length).toBeGreaterThan(0)
    })
  })
})

describe('Research Platform Services', () => {
  describe('AnonymizationService', () => {
    let service: AnonymizationService

    beforeEach(() => {
      service = new AnonymizationService()
    })

    it('should anonymize data with k-anonymity', async () => {
      const testData = [
        { clientId: '1', age: 25, gender: 'M', emotionScores: { happiness: 0.8 } },
        { clientId: '2', age: 26, gender: 'M', emotionScores: { happiness: 0.7 } },
        { clientId: '3', age: 27, gender: 'M', emotionScores: { happiness: 0.9 } }
      ]

      const result = await service.anonymizeResearchData(testData, 'full')
      
      expect(result.anonymizedData).toBeDefined()
      expect(result.privacyMetrics).toBeDefined()
      expect(result.privacyMetrics.kValue).toBeGreaterThanOrEqual(3)
    })

    it('should validate anonymization effectiveness', async () => {
      const testData = [
        { clientId: '1', age: 25, gender: 'M', emotionScores: { happiness: 0.8 } }
      ]

      const result = await service.validateAnonymization(testData)
      
      expect(result.valid).toBe(false)
      expect(result.issues).toContain(expect.stringContaining('k-anonymity'))
    })
  })

  describe('ConsentManagementService', () => {
    let service: ConsentManagementService

    beforeEach(() => {
      service = new ConsentManagementService()
    })

    it('should initialize consent for new clients', async () => {
      const result = await service.initializeConsent('test-client', 'full')
      
      expect(result.clientId).toBe('test-client')
      expect(result.currentLevel).toBe('full')
      expect(result.consentHistory).toHaveLength(1)
    })

    it('should track consent changes', async () => {
      await service.initializeConsent('test-client', 'minimal')
      
      const updated = await service.updateConsent({
        clientId: 'test-client',
        newLevel: 'full',
        reason: 'User requested upgrade'
      })
      
      expect(updated.currentLevel).toBe('full')
      expect(updated.consentHistory).toHaveLength(2)
    })

    it('should handle consent withdrawal', async () => {
      await service.initializeConsent('test-client', 'full')
      
      const result = await service.requestWithdrawal('test-client', 'Privacy concerns')
      
      expect(result.consentRecord.withdrawalRequested).toBe(true)
      expect(result.dataPurgeScheduled).toBe(true)
    })
  })

  describe('HIPAADataService', () => {
    let service: HIPAADataService

    beforeEach(() => {
      service = new HIPAADataService()
    })

    it('should validate access requests', async () => {
      const request = {
        userId: 'test-user',
        role: 'researcher',
        dataType: 'research-data',
        purpose: 'analysis'
      }

      const result = await service.validateAccess(request)
      
      expect(result.granted).toBe(true)
      expect(result.accessToken).toBeDefined()
    })

    it('should deny access for unauthorized roles', async () => {
      const request = {
        userId: 'test-user',
        role: 'invalid-role',
        dataType: 'research-data',
        purpose: 'analysis'
      }

      const result = await service.validateAccess(request)
      
      expect(result.granted).toBe(false)
    })

    it('should generate compliance reports', async () => {
      const report = await service.generateComplianceReport()
      
      expect(report.encryptionStatus).toBeDefined()
      expect(report.accessControlStatus).toBeDefined()
      expect(report.retentionPolicyStatus).toBeDefined()
    })
  })
})