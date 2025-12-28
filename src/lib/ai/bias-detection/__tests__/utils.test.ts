/**
 * Unit tests for bias detection utility functions
 */

import { describe, it, expect, vi } from 'vitest'
import {
  validateParticipantDemographics,
  validateTherapeuticSession,
  validateBiasDetectionConfig,
  sanitizeTextContent,
  extractDemographicGroups,
  calculateDemographicRepresentation,
  calculateOverallBiasScore,
  calculateConfidenceScore,
  determineAlertLevel,
  calculateFairnessMetrics,
  createBiasDetectionError,
  isBiasDetectionError,
  handleBiasDetectionError,
  transformSessionForPython,
  transformPythonResponse,
  createAuditLogEntry,
  requiresAdditionalAuth,
  generateAnonymizedId,
  deepClone,
  debounce,
  retryWithBackoff,
  formatBiasScore,
  formatTimestamp,
  isWithinRange,
  calculatePercentageChange,
  generateAnalysisSummary,
} from '../utils'
import type {
  ParticipantDemographics,
  TherapeuticSession,
  BiasAnalysisResult,
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

describe('Data Validation', () => {
  describe('validateParticipantDemographics', () => {
    it('should validate correct demographics data', () => {
      const validDemographics = {
        age: '25-35',
        gender: 'female' as const,
        ethnicity: 'hispanic',
        primaryLanguage: 'en',
        socioeconomicStatus: 'middle' as const,
        education: 'bachelor',
        region: 'west-coast',
      }

      const result = validateParticipantDemographics(validDemographics)
      expect(result).toEqual(validDemographics)
    })

    it('should throw error for invalid gender', () => {
      const invalidDemographics = {
        age: '25-35',
        gender: 'invalid',
        ethnicity: 'hispanic',
        primaryLanguage: 'en',
      }

      expect(() =>
        validateParticipantDemographics(invalidDemographics),
      ).toThrow('Invalid participant demographics data')
    })

    it('should throw error for missing required fields', () => {
      const incompleteDemographics = {
        age: '25-35',
        // Missing required fields
      }

      expect(() =>
        validateParticipantDemographics(incompleteDemographics),
      ).toThrow('Invalid participant demographics data')
    })
  })

  describe('validateTherapeuticSession', () => {
    const validSession = {
      sessionId: '123e4567-e89b-12d3-a456-426614174000',
      timestamp: new Date(),
      participantDemographics: {
        age: '25-35',
        gender: 'female' as const,
        ethnicity: 'hispanic',
        primaryLanguage: 'en',
      },
      scenario: {
        scenarioId: 'scenario-1',
        type: 'depression' as const,
        complexity: 'intermediate' as const,
        tags: ['mood', 'therapy'],
        description: 'Depression scenario',
        learningObjectives: ['Assess mood', 'Provide support'],
      },
      content: {
        patientPresentation: 'Patient presents with low mood',
        therapeuticInterventions: ['Active listening'],
        patientResponses: ['Feels understood'],
        sessionNotes: 'Good progress',
      },
      aiResponses: [
        {
          responseId: 'resp-1',
          timestamp: new Date(),
          type: 'diagnostic' as const,
          content: 'Assessment complete',
          confidence: 0.8,
          modelUsed: 'gpt-4',
        },
      ],
      expectedOutcomes: [],
      transcripts: [],
      metadata: {
        trainingInstitution: 'University Hospital',
        traineeId: 'trainee-123',
        sessionDuration: 60,
        completionStatus: 'completed' as const,
      },
    }

    it('should validate correct session data', () => {
      const result = validateTherapeuticSession(validSession)
      expect(result['sessionId']).toBe(validSession.sessionId)
    })

    it('should throw error for invalid session ID', () => {
      const invalidSession = {
        ...validSession,
        sessionId: 'invalid-uuid',
      }

      expect(() => validateTherapeuticSession(invalidSession)).toThrow(
        'Invalid therapeutic session data',
      )
    })
  })

  describe('validateBiasDetectionConfig', () => {
    const validConfig = {
      pythonServiceUrl: 'http://localhost:5000',
      pythonServiceTimeout: 30000,
      thresholds: {
        warningLevel: 0.3,
        highLevel: 0.6,
        criticalLevel: 0.8,
      },
      layerWeights: {
        preprocessing: 0.2,
        modelLevel: 0.3,
        interactive: 0.2,
        evaluation: 0.3,
      },
      evaluationMetrics: ['accuracy', 'fairness'],
      metricsConfig: {},
      alertConfig: {},
      reportConfig: {},
      explanationConfig: {},
      hipaaCompliant: true,
      dataMaskingEnabled: true,
      auditLogging: true,
    }

    it('should validate correct config', () => {
      const result = validateBiasDetectionConfig(validConfig)
      expect(result['pythonServiceUrl']).toBe(validConfig.pythonServiceUrl)
    })

    it('should throw error for invalid threshold order', () => {
      const invalidConfig = {
        ...validConfig,
        thresholds: {
          warningLevel: 0.8,
          highLevel: 0.6,
          criticalLevel: 0.3,
        },
      }

      expect(() => validateBiasDetectionConfig(invalidConfig)).toThrow(
        'Invalid bias detection configuration',
      )
    })

    it('should throw error for layer weights not summing to 1', () => {
      const invalidConfig = {
        ...validConfig,
        layerWeights: {
          preprocessing: 0.1,
          modelLevel: 0.2,
          interactive: 0.2,
          evaluation: 0.2,
        },
      }

      expect(() => validateBiasDetectionConfig(invalidConfig)).toThrow(
        'Invalid bias detection configuration',
      )
    })
  })
})

describe('Data Sanitization', () => {
  describe('sanitizeTextContent', () => {
    it('should mask email addresses', () => {
      const content = 'Contact me at john.doe@example.com for more info'
      const result = sanitizeTextContent(content)
      expect(result).toBe('Contact me at [EMAIL] for more info')
    })

    it('should mask phone numbers', () => {
      const content = 'Call me at 555-123-4567 or 555.987.6543'
      const result = sanitizeTextContent(content)
      expect(result).toBe('Call me at [PHONE] or [PHONE]')
    })

    it('should mask SSN patterns', () => {
      const content = 'SSN: 123-45-6789'
      const result = sanitizeTextContent(content)
      expect(result).toBe('SSN: [SSN]')
    })

    it('should mask potential names', () => {
      const content = 'Patient John Smith reported symptoms'
      const result = sanitizeTextContent(content)
      expect(result).toBe('Patient [NAME] reported symptoms')
    })

    it('should not mask when masking is disabled', () => {
      const content = 'john.doe@example.com and 555-123-4567'
      const result = sanitizeTextContent(content, false)
      expect(result).toBe(content)
    })
  })
})

describe('Demographic Processing', () => {
  const sampleDemographics: ParticipantDemographics = {
    age: '25-35',
    gender: 'female',
    ethnicity: 'hispanic',
    primaryLanguage: 'en',
    socioeconomicStatus: 'middle',
    education: 'bachelor',
    region: 'west-coast',
  }

  describe('extractDemographicGroups', () => {
    it('should extract all demographic groups', () => {
      const groups = extractDemographicGroups(sampleDemographics)

      expect(groups).toHaveLength(7)
      expect(groups.find((g) => g['type'] === 'age')?.['value']).toBe('25-35')
      expect(groups.find((g) => g['type'] === 'gender')?.['value']).toBe(
        'female',
      )
      expect(groups.find((g) => g['type'] === 'ethnicity')?.['value']).toBe(
        'hispanic',
      )
      expect(groups.find((g) => g['type'] === 'language')?.['value']).toBe('en')
      expect(groups.find((g) => g['type'] === 'socioeconomic')?.['value']).toBe(
        'middle',
      )
      expect(groups.find((g) => g['type'] === 'education')?.['value']).toBe(
        'bachelor',
      )
      expect(groups.find((g) => g['type'] === 'region')?.['value']).toBe(
        'west-coast',
      )
    })

    it('should handle optional fields', () => {
      const minimalDemographics: ParticipantDemographics = {
        age: '25-35',
        gender: 'male',
        ethnicity: 'white',
        primaryLanguage: 'en',
      }

      const groups = extractDemographicGroups(minimalDemographics)
      expect(groups).toHaveLength(4)
    })
  })

  describe('calculateDemographicRepresentation', () => {
    it('should calculate representation correctly', () => {
      const sessions = [
        { participantDemographics: { ...sampleDemographics, gender: 'male' } },
        {
          participantDemographics: { ...sampleDemographics, gender: 'female' },
        },
        {
          participantDemographics: { ...sampleDemographics, gender: 'female' },
        },
      ] as TherapeuticSession[]

      const representation = calculateDemographicRepresentation(sessions)

      expect(representation['gender']['male']).toBeCloseTo(0.333, 2)
      expect(representation['gender']['female']).toBeCloseTo(0.667, 2)
    })

    it('should handle empty sessions array', () => {
      const representation = calculateDemographicRepresentation([])
      expect(representation).toEqual({})
    })
  })
})

describe('Bias Score Calculations', () => {
  const layerResults = {
    preprocessing: { biasScore: 0.2 },
    modelLevel: { biasScore: 0.4 },
    interactive: { biasScore: 0.3 },
    evaluation: { biasScore: 0.5 },
  }

  const weights = {
    preprocessing: 0.2,
    modelLevel: 0.3,
    interactive: 0.2,
    evaluation: 0.3,
  }

  describe('calculateOverallBiasScore', () => {
    it('should calculate weighted average correctly', () => {
      const score = calculateOverallBiasScore(layerResults, weights)
      const expected = 0.2 * 0.2 + 0.4 * 0.3 + 0.3 * 0.2 + 0.5 * 0.3
      expect(score).toBeCloseTo(expected, 3)
    })

    it('should clamp values to [0, 1]', () => {
      const extremeResults = {
        preprocessing: { biasScore: -0.5 },
        modelLevel: { biasScore: 1.5 },
        interactive: { biasScore: 0.5 },
        evaluation: { biasScore: 0.5 },
      }

      const score = calculateOverallBiasScore(extremeResults, weights)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
    })
  })

  describe('calculateConfidenceScore', () => {
    it('should return high confidence for consistent scores', () => {
      const consistentResults = {
        preprocessing: { biasScore: 0.5 },
        modelLevel: { biasScore: 0.5 },
        interactive: { biasScore: 0.5 },
        evaluation: { biasScore: 0.5 },
      }

      const confidence = calculateConfidenceScore(consistentResults)
      expect(confidence).toBeGreaterThan(0.9)
    })

    it('should return lower confidence for inconsistent scores', () => {
      const inconsistentResults = {
        preprocessing: { biasScore: 0.1 },
        modelLevel: { biasScore: 0.9 },
        interactive: { biasScore: 0.2 },
        evaluation: { biasScore: 0.8 },
      }

      const confidence = calculateConfidenceScore(inconsistentResults)
      expect(confidence).toBeLessThan(0.5)
    })
  })

  describe('determineAlertLevel', () => {
    const thresholds = {
      warningLevel: 0.3,
      highLevel: 0.6,
      criticalLevel: 0.8,
    }

    it('should return correct alert levels', () => {
      expect(determineAlertLevel(0.1, thresholds)).toBe('low')
      expect(determineAlertLevel(0.4, thresholds)).toBe('medium')
      expect(determineAlertLevel(0.7, thresholds)).toBe('high')
      expect(determineAlertLevel(0.9, thresholds)).toBe('critical')
    })

    it('should handle boundary values', () => {
      expect(determineAlertLevel(0.3, thresholds)).toBe('medium')
      expect(determineAlertLevel(0.6, thresholds)).toBe('high')
      expect(determineAlertLevel(0.8, thresholds)).toBe('critical')
    })
  })

  describe('calculateFairnessMetrics', () => {
    const groupPerformances = {
      group1: { tp: 80, fp: 10, tn: 85, fn: 25 },
      group2: { tp: 70, fp: 20, tn: 75, fn: 35 },
    }

    it('should calculate fairness metrics', () => {
      const metrics = calculateFairnessMetrics(groupPerformances)

      expect(metrics.demographicParity).toBeGreaterThanOrEqual(0)
      expect(metrics.equalizedOdds).toBeGreaterThanOrEqual(0)
      expect(metrics.equalOpportunity).toBeGreaterThanOrEqual(0)
      expect(metrics.calibration).toBeGreaterThanOrEqual(0)
    })

    it('should throw error for insufficient groups', () => {
      const singleGroup = { group1: { tp: 80, fp: 10, tn: 85, fn: 25 } }

      expect(() => calculateFairnessMetrics(singleGroup)).toThrow(
        'At least two demographic groups required',
      )
    })
  })
})

describe('Error Handling', () => {
  describe('createBiasDetectionError', () => {
    it('should create error with correct properties', () => {
      const error = createBiasDetectionError(
        'TEST_ERROR',
        'Test error message',
        { sessionId: 'test-session' },
        false,
      )

      expect((error as Error)?.name).toBe('BiasDetectionError')
      expect(error.code).toBe('TEST_ERROR')
      expect(String(error)).toBe('Test error message')
      expect(error.sessionId).toBe('test-session')
      expect(error.recoverable).toBe(false)
    })
  })

  describe('isBiasDetectionError', () => {
    it('should identify bias detection errors', () => {
      const biasError = createBiasDetectionError('TEST', 'Test')
      const regularError = new Error('Regular error')

      expect(isBiasDetectionError(biasError)).toBe(true)
      expect(isBiasDetectionError(regularError)).toBe(false)
    })
  })

  describe('handleBiasDetectionError', () => {
    it('should handle bias detection errors correctly', () => {
      const biasError = createBiasDetectionError('TEST', 'Test', {}, true)
      const result = handleBiasDetectionError(biasError, { operation: 'test' })

      expect(result.shouldRetry).toBe(true)
      expect(result.alertLevel).toBe('medium')
    })

    it('should handle unknown errors', () => {
      const unknownError = new Error('Unknown error')
      const result = handleBiasDetectionError(unknownError, {
        operation: 'test',
      })

      expect(result.shouldRetry).toBe(false)
      expect(result.alertLevel).toBe('critical')
    })
  })
})

describe('Data Transformation', () => {
  const sampleSession: TherapeuticSession = {
    sessionId: '123e4567-e89b-12d3-a456-426614174000',
    timestamp: new Date('2023-01-01T12:00:00Z'),
    participantDemographics: {
      age: '25-35',
      gender: 'female',
      ethnicity: 'hispanic',
      primaryLanguage: 'en',
    },
    scenario: {
      scenarioId: 'scenario-1',
      type: 'depression',
      complexity: 'intermediate',
      tags: ['mood'],
      description: 'Test scenario',
      learningObjectives: ['Assess mood'],
    },
    content: {
      patientPresentation: 'Patient presents with symptoms',
      therapeuticInterventions: ['Active listening'],
      patientResponses: ['Positive response'],
      sessionNotes: 'Session notes',
    },
    aiResponses: [
      {
        responseId: 'resp-1',
        timestamp: new Date('2023-01-01T12:30:00Z'),
        type: 'diagnostic',
        content: 'Assessment',
        confidence: 0.8,
        modelUsed: 'gpt-4',
      },
    ],
    expectedOutcomes: [],
    transcripts: [
      {
        speakerId: 'therapist',
        timestamp: new Date('2023-01-01T12:15:00Z'),
        content: 'How are you feeling?',
        emotionalTone: 'neutral',
        confidenceLevel: 0.9,
      },
    ],
    metadata: {
      trainingInstitution: 'University',
      traineeId: 'trainee-123',
      sessionDuration: 60,
      completionStatus: 'completed',
    },
  }

  describe('transformSessionForPython', () => {
    it('should transform session to Python format', () => {
      const result = transformSessionForPython(sampleSession)

      expect(result.session_id).toBe(sampleSession.sessionId)
      expect(result.participant_demographics.age).toBe('25-35')
      expect(result.ai_responses[0].response_id).toBe('resp-1')
      expect(result.transcripts[0].speaker_id).toBe('therapist')
    })
  })

  describe('transformPythonResponse', () => {
    it('should transform Python response to TypeScript format', () => {
      const pythonResponse = {
        overall_bias_score: 0.4,
        confidence: 0.8,
        alert_level: 'medium',
        recommendations: ['Improve data diversity'],
      }

      const result = transformPythonResponse(pythonResponse)

      expect(result.overallBiasScore).toBe(0.4)
      expect(result.confidence).toBe(0.8)
      expect(result.alertLevel).toBe('medium')
      expect(result.recommendations).toEqual(['Improve data diversity'])
    })
  })
})

describe('HIPAA Compliance', () => {
  describe('createAuditLogEntry', () => {
    it('should create complete audit log entry', () => {
      const entry = createAuditLogEntry(
        'user-123',
        'user@example.com',
        {
          type: 'read',
          category: 'bias-analysis',
          description: 'Viewed bias analysis',
          sensitivityLevel: 'medium',
        },
        'bias-analysis-resource',
        { resourceId: 'analysis-456' },
        { ipAddress: '192.168.1.1', userAgent: 'Mozilla/5.0' },
        'session-789',
      )

      expect(entry.userId).toBe('user-123')
      expect(entry.userEmail).toBe('user@example.com')
      expect(entry.action.type).toBe('read')
      expect(entry.resource).toBe('bias-analysis-resource')
      expect(entry.sessionId).toBe('session-789')
      expect(entry.success).toBe(true)
    })
  })

  describe('requiresAdditionalAuth', () => {
    it('should require auth for high sensitivity data', () => {
      expect(requiresAdditionalAuth('session-data', 'admin', 'high')).toBe(true)
      expect(requiresAdditionalAuth('session-data', 'admin', 'critical')).toBe(
        true,
      )
    })

    it('should require auth for demographics for non-admin', () => {
      expect(requiresAdditionalAuth('demographics', 'viewer', 'low')).toBe(true)
      expect(requiresAdditionalAuth('demographics', 'admin', 'low')).toBe(false)
    })

    it('should require auth for session data for viewers', () => {
      expect(requiresAdditionalAuth('session-data', 'viewer', 'low')).toBe(true)
      expect(requiresAdditionalAuth('session-data', 'analyst', 'low')).toBe(
        false,
      )
    })
  })

  describe('generateAnonymizedId', () => {
    it('should generate consistent anonymized IDs', () => {
      const id1 = generateAnonymizedId('user-123', 'salt1')
      const id2 = generateAnonymizedId('user-123', 'salt1')
      const id3 = generateAnonymizedId('user-123', 'salt2')

      expect(id1).toBe(id2)
      expect(id1).not.toBe(id3)
      expect(id1).toMatch(/^anon_[a-z0-9]+$/)
    })
  })
})

describe('Utility Helpers', () => {
  describe('deepClone', () => {
    it('should deep clone objects', () => {
      const original = {
        a: 1,
        b: { c: 2, d: [3, 4] },
        e: new Date('2023-01-01'),
      }

      const cloned = deepClone(original)

      expect(cloned).toEqual(original)
      expect(cloned).not.toBe(original)
      expect(cloned.b).not.toBe(original.b)
      expect(cloned.b.d).not.toBe(original.b.d)
    })

    it('should handle primitive values', () => {
      expect(deepClone(42)).toBe(42)
      expect(deepClone('hello')).toBe('hello')
      expect(deepClone(null)).toBe(null)
    })
  })

  describe('debounce', () => {
    it('should debounce function calls', async () => {
      const mockFn = vi.fn()
      const debouncedFn = debounce(mockFn, 100)

      debouncedFn('arg1')
      debouncedFn('arg2')
      debouncedFn('arg3')

      expect(mockFn).not.toHaveBeenCalled()

      await new Promise((resolve) => setTimeout(resolve, 150))

      expect(mockFn).toHaveBeenCalledTimes(1)
      expect(mockFn).toHaveBeenCalledWith('arg3')
    })
  })

  describe('retryWithBackoff', () => {
    it('should retry failed operations', async () => {
      let attempts = 0
      const operation = vi.fn().mockImplementation(() => {
        attempts++
        if (attempts < 3) {
          throw new Error('Operation failed')
        }
        return 'success'
      })

      const result = await retryWithBackoff(operation, 3, 10)

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(3)
    })

    it('should throw after max retries', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Always fails'))

      await expect(retryWithBackoff(operation, 2, 10)).rejects.toThrow(
        'Always fails',
      )

      expect(operation).toHaveBeenCalledTimes(3) // Initial + 2 retries
    })
  })

  describe('formatBiasScore', () => {
    it('should format bias scores as percentages', () => {
      expect(formatBiasScore(0.123)).toBe('12.3%')
      expect(formatBiasScore(0.5)).toBe('50.0%')
      expect(formatBiasScore(1)).toBe('100.0%')
    })
  })

  describe('formatTimestamp', () => {
    it('should format timestamps correctly', () => {
      const date = new Date('2023-01-01T12:30:45.123Z')
      const result = formatTimestamp(date)
      expect(result).toBe('2023-01-01 12:30:45')
    })
  })

  describe('isWithinRange', () => {
    it('should check inclusive ranges correctly', () => {
      expect(isWithinRange(5, 1, 10, true)).toBe(true)
      expect(isWithinRange(1, 1, 10, true)).toBe(true)
      expect(isWithinRange(10, 1, 10, true)).toBe(true)
      expect(isWithinRange(0, 1, 10, true)).toBe(false)
    })

    it('should check exclusive ranges correctly', () => {
      expect(isWithinRange(5, 1, 10, false)).toBe(true)
      expect(isWithinRange(1, 1, 10, false)).toBe(false)
      expect(isWithinRange(10, 1, 10, false)).toBe(false)
    })
  })

  describe('calculatePercentageChange', () => {
    it('should calculate percentage changes correctly', () => {
      expect(calculatePercentageChange(100, 150)).toBe(50)
      expect(calculatePercentageChange(100, 50)).toBe(-50)
      expect(calculatePercentageChange(0, 100)).toBe(100)
      expect(calculatePercentageChange(0, 0)).toBe(0)
    })
  })

  describe('generateAnalysisSummary', () => {
    it('should generate summary from analysis results', () => {
      const results: BiasAnalysisResult[] = [
        {
          sessionId: 'session-1',
          timestamp: new Date(),
          overallBiasScore: 0.3,
          layerResults: {} as unknown,
          demographics: {} as unknown,
          recommendations: ['Improve diversity', 'Add training'],
          alertLevel: 'medium',
          confidence: 0.8,
        },
        {
          sessionId: 'session-2',
          timestamp: new Date(),
          overallBiasScore: 0.7,
          layerResults: {} as unknown,
          demographics: {} as unknown,
          recommendations: ['Improve diversity', 'Review model'],
          alertLevel: 'high',
          confidence: 0.9,
        },
      ]

      const summary = generateAnalysisSummary(results)

      expect(summary.totalSessions).toBe(2)
      expect(summary.averageBiasScore).toBe(0.5)
      expect(summary.alertDistribution['medium']).toBe(1)
      expect(summary.alertDistribution['high']).toBe(1)
      expect(summary.topRecommendations).toContain('Improve diversity')
    })

    it('should handle empty results array', () => {
      const summary = generateAnalysisSummary([])

      expect(summary.totalSessions).toBe(0)
      expect(summary.averageBiasScore).toBe(0)
      expect(summary.alertDistribution).toEqual({})
      expect(summary.topRecommendations).toEqual([])
    })
  })
})
