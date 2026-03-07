/**
 * Test suite for Mental Arena production implementation
 */

import {
  MentalArenaAdapter,
  MentalArenaPythonBridge,
  DisorderCategory,
  validateConversation,
  VERSION,
} from '../src/lib/ai/mental-arena'
import type {
  MentalArenaProvider,
  FHEService,
} from '../src/lib/ai/mental-arena/MentalArenaAdapter'

// Mock provider for testing
class TestMentalArenaProvider {
  async analyzeEmotions() {
    return {
      dominant: 'anxiety',
      emotions: { anxiety: 0.8 },
      confidence: 0.9,
      timestamp: new Date().toISOString(),
      overallSentiment: 'negative',
      riskFactors: [],
      contextualFactors: ['therapy-session'],
      requiresAttention: false,
    }
  }

  async generateIntervention() {
    return {
      content: 'Test therapeutic intervention',
      techniques: ['cognitive-reframing'],
    }
  }

  async createChatCompletion() {
    return {
      content: 'Test response',
    }
  }

  async assessRisk() {
    return {
      riskLevel: 'low',
      reasoning: 'Test assessment',
    }
  }

  async handleEmergency() {
    return { response: 'Test emergency response' }
  }

  async generateText() {
    return 'Test generated text'
  }
}

describe('Mental Arena Production Implementation', () => {
  let provider: TestMentalArenaProvider
  let pythonBridge: MentalArenaPythonBridge
  let adapter: MentalArenaAdapter

  beforeEach(() => {
    provider = new TestMentalArenaProvider()
    pythonBridge = new MentalArenaPythonBridge({
      mentalArenaPath: '/tmp/mental-arena',
      pythonPath: 'python3',
      timeout: 5000,
    })
    // Mock FHE service for testing
    const mockFheService = {
      encrypt: async (_value: unknown) => ({ data: 'encrypted', type: 'mock' }),
      decrypt: async (_encrypted: unknown) => 'decrypted',
      encryptText: async (_text: string) => 'encrypted_text',
      decryptText: async (_encrypted: string) => 'decrypted_text',
      generateHash: async (_data: unknown) => 'mock_hash',
      setEncryptionMode: (_mode: 'standard' | 'enhanced') => {},
      scheme: { supportsOperation: (_op: string) => true },
      isInitialized: () => true,
      initialize: async () => {},
    }
    adapter = new MentalArenaAdapter(
      provider as unknown as MentalArenaProvider,
      mockFheService as unknown as FHEService,
      'http://localhost:3000',
      'test-api-key',
      true,
      pythonBridge,
    )
  })

  it('should export version information', () => {
    expect(VERSION).toBe('1.0.0')
  })

  it('should export disorder categories', () => {
    expect(DisorderCategory.Anxiety).toBe('anxiety')
    expect(DisorderCategory.Depression).toBe('depression')
    expect(DisorderCategory.PTSD).toBe('ptsd')
  })

  it('should validate conversations correctly', () => {
    const validConversation = {
      patientText: 'I feel anxious',
      therapistText: 'Can you tell me more?',
      encodedSymptoms: [
        {
          name: 'anxiety',
          severity: 7,
          duration: '2 weeks',
          manifestations: ['worry'],
          cognitions: ['catastrophic thinking'],
        },
      ],
      decodedSymptoms: ['anxiety'],
      accuracyScore: 85,
    }

    expect(validateConversation(validConversation)).toBe(true)

    const invalidConversation = {
      patientText: '',
      therapistText: 'Response',
      encodedSymptoms: [],
      decodedSymptoms: [],
    }

    expect(validateConversation(invalidConversation)).toBe(false)
  })

  it('should create adapter instance', () => {
    expect(adapter).toBeInstanceOf(MentalArenaAdapter)
  })

  it('should create python bridge instance', () => {
    expect(pythonBridge).toBeInstanceOf(MentalArenaPythonBridge)
  })

  it('should generate synthetic data with proper structure', async () => {
    const options = {
      numSessions: 2,
      maxTurns: 4,
      disorders: [DisorderCategory.Anxiety],
      qualityThreshold: 0.7,
      enableValidation: true,
    }

    const result = await adapter.generateSyntheticDataWithMetrics(options)

    expect(result).toHaveProperty('conversations')
    expect(result).toHaveProperty('qualityMetrics')
    expect(result).toHaveProperty('metadata')

    expect(Array.isArray(result.conversations)).toBe(true)
    expect(result.conversations.length).toBeGreaterThan(0)

    // Check quality metrics structure
    expect(result.qualityMetrics).toHaveProperty('coherenceScore')
    expect(result.qualityMetrics).toHaveProperty('clinicalAccuracy')
    expect(result.qualityMetrics).toHaveProperty('conversationalFlow')
    expect(result.qualityMetrics).toHaveProperty('therapeuticValue')

    // Check metadata structure
    expect(result.metadata).toHaveProperty('totalSessions')
    expect(result.metadata).toHaveProperty('successfulGenerations')
    expect(result.metadata).toHaveProperty('processingTime')
    expect(typeof result.metadata.processingTime).toBe('number')
  })

  it('should initialize with default config', () => {
    const bridge = new MentalArenaPythonBridge({
      mentalArenaPath: '/tmp/mental-arena',
      pythonPath: 'python3',
    })
    expect(bridge).toBeInstanceOf(MentalArenaPythonBridge)
  })

  it('should accept custom configuration', () => {
    const config = {
      mentalArenaPath: '/custom/mental-arena-path',
      pythonPath: '/usr/local/bin/python3',
      timeout: 10000,
      enableLogging: true,
      securityMode: 'development' as const,
    }

    const bridge = new MentalArenaPythonBridge(config)
    expect(bridge).toBeInstanceOf(MentalArenaPythonBridge)
  })
})
