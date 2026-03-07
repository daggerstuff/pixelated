/**
 * Mock FHE Service Implementation
 *
 * This file provides a mock implementation of the FHE service interface for
 * development, testing, and environments where actual FHE is not available.
 */

import { nanoid } from 'nanoid'
import { EncryptionMode, FHEOperation } from '../types'
import type {
  EncryptedData,
  FHEConfig,
  FHEKeys,
  FHEOperationResult,
  FHEScheme,
  FHEService,
} from '../types'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('mock-fhe')

/**
 * Mock implementation of the FHE scheme
 */
export class MockFHEScheme implements FHEScheme {
  name = 'MockFHE'
  version = '1.0.0'

  getOperations(): FHEOperation[] {
    return [
      FHEOperation.Addition,
      FHEOperation.Subtraction,
      FHEOperation.Multiplication,
      FHEOperation.Negation,
      FHEOperation.SENTIMENT,
      FHEOperation.CATEGORIZE,
    ]
  }

  supportsOperation(operation: FHEOperation): boolean {
    return this.getOperations().includes(operation)
  }
}

/**
 * Mock implementation of FHEKeys for the mock service
 */
export interface MockFHEKeys extends FHEKeys {
  mockKeyId: string
  mockCreated: number
}

/**
 * Mock encrypted data structure
 * Implements the EncryptedData interface from ../types.ts
 */
export interface MockEncryptedData<T = unknown> extends EncryptedData<T> {
  // In a real FHE system, this would be encrypted ciphertext
  // For the mock, we store the actual data with a marker
  mockId: string
  originalType: string
  originalValue: string // JSON stringified original value
  mockEncrypted: boolean
  timestamp: number
}

/**
 * Mock implementation of FHEService for testing
 * Implements the FHEService interface from ../types.ts
 */
export class MockFHEService implements FHEService {
  private initialized = false
  public scheme: MockFHEScheme
  private keyPair: MockFHEKeys | null = null

  constructor() {
    this.scheme = new MockFHEScheme()
    logger.info('Mock FHE service created')
  }

  /**
   * Initialize the mock FHE service
   */
  public async initialize(_options?: unknown): Promise<void> {
    logger.info('Initializing mock FHE service')
    // Simulate delay for initialization
    await new Promise((resolve) => setTimeout(resolve, 100))
    this.initialized = true
  }

  /**
   * Check if the service is initialized
   */
  public isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Check if an operation is supported
   */
  public supportsOperation(operation: FHEOperation): boolean {
    return this.scheme.supportsOperation(operation)
  }

  /**
   * Generate mock encryption keys
   * Implements the generateKeys method from FHEService interface
   */
  public async generateKeys(_config?: FHEConfig): Promise<MockFHEKeys> {
    logger.info('Generating mock encryption keys')
    // Simulate delay for key generation
    await new Promise((resolve) => setTimeout(resolve, 200))

    // Return mock keys that implement FHEKeys interface
    const created = new Date()
    const keyId = nanoid()

    this.keyPair = {
      keyId,
      createdAt: created,
      scheme: this.scheme.name,
      status: 'active',
      mockKeyId: keyId,
      mockCreated: Date.now(),
    }

    return this.keyPair
  }

  /**
   * Mock encrypt data
   * Implements the encrypt method from FHEService interface
   */
  public async encrypt<T>(
    value: T,
    _options?: unknown,
  ): Promise<EncryptedData<unknown>> {
    this.checkInitialized()
    logger.info('Mock encrypting data', { dataType: typeof value })

    // Get the type of the value
    const type = typeof value
    let dataType: 'number' | 'string' | 'boolean' | 'array' | 'object'

    if (type === 'number' || type === 'string' || type === 'boolean') {
      dataType = type as 'number' | 'string' | 'boolean'
    } else if (Array.isArray(value)) {
      dataType = 'array'
    } else {
      dataType = 'object'
    }

    // Create mock encrypted data
    const encrypted: MockEncryptedData<T> = {
      id: nanoid(),
      mockId: nanoid(6),
      data: value,
      dataType,
      originalType: type,
      originalValue: JSON.stringify(value),
      mockEncrypted: true,
      timestamp: Date.now(),
      metadata: {
        encryptedAt: Date.now(),
        mode: EncryptionMode.FHE,
      },
    }

    return encrypted
  }

  /**
   * Mock decrypt data
   * Implements the decrypt method from FHEService interface
   */
  public async decrypt<T>(
    encryptedData: EncryptedData<unknown>,
    _options?: unknown,
  ): Promise<T> {
    this.checkInitialized()

    // Handle both MockEncryptedData and standard EncryptedData
    const mockData = encryptedData as unknown as MockEncryptedData<T>

    if (!mockData || !mockData.originalValue) {
      // Try to extract data from standard EncryptedData
      if (encryptedData && encryptedData.data) {
        try {
          return encryptedData.data as T
        } catch {
          throw new Error('Invalid encrypted data format')
        }
      }
      throw new Error('Invalid mock encrypted data')
    }

    logger.info('Mock decrypting data')

    // Parse the original value
    try {
      // Use the mockData which has been cast to MockEncryptedData<T>
      return JSON.parse(mockData.originalValue) as unknown as T
    } catch {
      throw new Error('Failed to decrypt data')
    }
  }

  /**
   * Process encrypted data with a homomorphic operation
   * Implements the processEncrypted method from FHEService interface
   */
  public async processEncrypted(
    encryptedData: string,
    operation: FHEOperation | string,
    params?: Record<string, unknown>,
  ): Promise<FHEOperationResult<string>> {
    this.checkInitialized()
    logger.info(`Processing encrypted data with operation ${operation}`)

    // Parse the encrypted data
    let data: MockEncryptedData
    try {
      data = JSON.parse(encryptedData) as unknown as MockEncryptedData
    } catch {
      throw new Error('Invalid encrypted data format')
    }

    // Process based on operation
    switch (operation) {
      case FHEOperation.SENTIMENT:
        return this.mockSentimentAnalysis(data)

      case FHEOperation.CATEGORIZE:
        return this.mockCategorization(data, params)

      default:
        throw new Error(
          `Operation ${operation} not implemented in mock service`,
        )
    }
  }

  /**
   * Mock sentiment analysis
   */
  private async mockSentimentAnalysis(
    data: MockEncryptedData,
  ): Promise<FHEOperationResult<string>> {
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 150))

    // Parse original text if it's a string
    try {
      const originalText = JSON.parse(data.originalValue) as unknown
      if (typeof originalText === 'string') {
        // Simple sentiment detection based on keywords
        const positiveWords = ['good', 'great', 'excellent', 'happy', 'joy']
        const negativeWords = ['bad', 'poor', 'sad', 'unhappy', 'terrible']

        const text = originalText.toLowerCase()
        let sentiment = 'neutral'

        const positiveCount = positiveWords.filter((word) =>
          text.includes(word),
        ).length
        const negativeCount = negativeWords.filter((word) =>
          text.includes(word),
        ).length

        if (positiveCount > negativeCount) {
          sentiment = 'positive'
        } else if (negativeCount > positiveCount) {
          sentiment = 'negative'
        }

        // Return encrypted result
        return {
          success: true,
          result: JSON.stringify({
            id: nanoid(),
            result: sentiment,
            confidence: 0.85,
            processed: true,
          }),
          operation: FHEOperation.SENTIMENT,
          metadata: {
            timestamp: Date.now(),
          },
        }
      }
    } catch {
      // Ignore parsing errors and fall through to default response
    }

    // Default response if processing fails
    return {
      success: true,
      result: JSON.stringify({
        id: nanoid(),
        result: 'neutral',
        confidence: 0.5,
        processed: true,
      }),
      operation: FHEOperation.SENTIMENT,
      metadata: {
        timestamp: Date.now(),
      },
    }
  }

  /**
   * Mock categorization
   */
  private async mockCategorization(
    data: MockEncryptedData,
    params?: Record<string, unknown>,
  ): Promise<FHEOperationResult<string>> {
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 200))

    // Default categories
    const categories = {
      health: ['health', 'medical', 'doctor', 'hospital', 'wellness'],
      finance: ['money', 'finance', 'bank', 'investment', 'budget'],
      tech: ['computer', 'technology', 'software', 'hardware', 'digital'],
      personal: ['family', 'friend', 'relationship', 'personal', 'home'],
    }

    // Use provided categories if available
    const categoryMap =
      (params?.['categories'] as Record<string, string[]>) || categories

    try {
      const originalText = JSON.parse(data.originalValue) as unknown
      if (typeof originalText === 'string') {
        const text = originalText.toLowerCase()

        // Find matching categories
        const matches: Record<string, number> = {}

        for (const [category, keywords] of Object.entries(categoryMap)) {
          let count = 0
          for (const keyword of keywords) {
            if (text.includes(keyword.toLowerCase())) {
              count++
            }
          }
          if (count > 0) {
            matches[category] = count
          }
        }

        // Sort categories by match count
        const sortedCategories = Object.entries(matches)
          .sort((a, b) => b[1] - a[1])
          .map(([category]) => category)

        // Return encrypted result
        return {
          success: true,
          result: JSON.stringify({
            id: nanoid(),
            categories:
              sortedCategories.length > 0
                ? sortedCategories
                : ['uncategorized'],
            confidence: sortedCategories.length > 0 ? 0.7 : 0.3,
            processed: true,
          }),
          operation: FHEOperation.CATEGORIZE,
          metadata: {
            timestamp: Date.now(),
          },
        }
      }
    } catch {
      // Ignore parsing errors and fall through to default response
    }

    // Default response if processing fails
    return {
      success: true,
      result: JSON.stringify({
        id: nanoid(),
        categories: ['uncategorized'],
        confidence: 0.3,
        processed: true,
      }),
      operation: FHEOperation.CATEGORIZE,
      metadata: {
        timestamp: Date.now(),
      },
    }
  }

  /**
   * Check if the service is initialized
   */
  private checkInitialized() {
    if (!this.initialized) {
      throw new Error(
        'Mock FHE service not initialized. Call initialize() first.',
      )
    }
  }
}

/**
 * Singleton instance
 */
export const mockFHEService = new MockFHEService()
