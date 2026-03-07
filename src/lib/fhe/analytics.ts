/**
 * FHE Analytics Module
 *
 * This module provides analytics capabilities that work directly on encrypted data
 * using Fully Homomorphic Encryption with Microsoft SEAL, allowing for insights
 * without compromising privacy.
 */

import type { ChatMessage } from '../../types/chat'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
import {
  EncryptionMode,
  FHEOperation as FHEOpType,
  type FHEServiceOptions,
  type FHEServiceInterface,
} from './types'
import { SealSchemeType } from './seal-types'

// Initialize logger
const logger = createBuildSafeLogger('analytics')

/**
 * Operation types for FHE processing (our local enum)
 */
export enum FHEOperation {
  SENTIMENT = 'sentiment',
  CATEGORIZE = 'categorize',
  CUSTOM = 'custom',
}

/**
 * Maps our enum to the FHEOperation type from types.ts
 */
function mapOperation(operation: FHEOperation): FHEOpType {
  switch (operation) {
    case FHEOperation.SENTIMENT:
      return FHEOpType.SENTIMENT
    case FHEOperation.CATEGORIZE:
      return FHEOpType.CATEGORIZE
    case FHEOperation.CUSTOM:
      return FHEOpType.CUSTOM
    default:
      return FHEOpType.CUSTOM
  }
}

/**
 * Analytics types available for encrypted data
 */
export enum AnalyticsType {
  SENTIMENT_TREND = 'sentiment_trend',
  TOPIC_CLUSTERING = 'topic_clustering',
  EMOTIONAL_PATTERNS = 'emotional_patterns',
  INTERVENTION_EFFECTIVENESS = 'intervention_effectiveness',
  RISK_ASSESSMENT = 'risk_assessment',
}

/**
 * Result of an analytics operation
 */
export interface AnalyticsResult {
  type: AnalyticsType
  timestamp: number
  data: Record<string, unknown>
  encryptionMode: EncryptionMode
  isEncrypted: boolean
}

/**
 * Configuration for analytics operations
 */
export interface AnalyticsConfig {
  encryptResults?: boolean
  sessionId?: string
  timeWindow?: {
    startTime?: number
    endTime?: number
  }
}

/**
 * Default analytics configuration
 */
const DEFAULT_CONFIG: AnalyticsConfig = {
  encryptResults: true,
  timeWindow: {
    startTime: 0,
    endTime: Date.now(),
  },
}

/**
 * FHE Analytics Service
 *
 * Performs analytics operations on encrypted therapy data
 * without decrypting the content, preserving client privacy.
 * Uses Microsoft SEAL for Fully Homomorphic Encryption.
 */
export class FHEAnalyticsService {
  private static instance: FHEAnalyticsService
  private initialized = false
  private fheService!: FHEServiceInterface

  /**
   * Private constructor to enforce singleton pattern
   * Intentionally empty as no initialization is needed in constructor
   */
  private constructor() {
    // Singleton initialization happens in initialize() method
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): FHEAnalyticsService {
    if (!FHEAnalyticsService.instance) {
      FHEAnalyticsService.instance = new FHEAnalyticsService()
    }
    return FHEAnalyticsService.instance
  }

  /**
   * Initialize the analytics service with Microsoft SEAL
   */
  public async initialize(options?: Partial<FHEServiceOptions>): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      // Initialize the FHE service using the factory with SEAL
      const serviceOptions: FHEServiceOptions = {
        mode: EncryptionMode.FHE,
        sealScheme: SealSchemeType.BFV, // Use BFV scheme for analytics
        useMock: process.env['NODE_ENV'] === 'test', // Use mock in test environment
        ...options,
      }

      // Ensure the service is initialized with full options
      if (!this.fheService.isInitialized()) {
        await this.fheService.initialize(serviceOptions)
      }

      this.initialized = true
      logger.info('FHE Analytics service initialized with Microsoft SEAL', {
        mode: this.fheService.getMode(),
        scheme: serviceOptions.sealScheme,
      })
    } catch (error: unknown) {
      logger.error('Failed to initialize FHE Analytics service', { error })
      throw error
    }
  }

  /**
   * Process sentiment trends over a conversation while preserving privacy
   *
   * @param messages - Array of chat messages (encrypted or not)
   * @param config - Analytics configuration
   * @returns Analysis results (can be encrypted based on config)
   */
  public async analyzeSentimentTrend(
    messages: ChatMessage[],
    config: AnalyticsConfig = DEFAULT_CONFIG,
  ): Promise<AnalyticsResult> {
    await this.ensureInitialized()

    try {
      const startTime = performance.now()
      logger.info('Starting encrypted sentiment trend analysis')

      // Filter messages based on time window if provided
      const filteredMessages = this.filterMessagesByTimeWindow(messages, config)

      // Process messages
      const results = await Promise.all(
        filteredMessages
          .filter((m) => m.role === 'user') // Only analyze user messages
          .map(async (message, index) => {
            try {
              // If message is already encrypted, process directly
              if (
                message.encrypted &&
                typeof message.content === 'string' &&
                message.content.startsWith('FHE:')
              ) {
                // Process sentiment analysis on the encrypted message
                const sentimentResult = await this.fheService.processEncrypted!(
                  message.content,
                  mapOperation(FHEOperation.SENTIMENT),
                )

                // We can work with the encrypted result directly in FHE mode
                return {
                  messageIndex: index,
                  sentiment: sentimentResult,
                  timestamp: message.timestamp || Date.now(),
                }
              } else {
                // For unencrypted messages, we need to encrypt first
                const encrypted = await this.fheService.encryptData(
                  message.content,
                )
                const sentimentResult = await this.fheService.processEncrypted!(
                  encrypted,
                  mapOperation(FHEOperation.SENTIMENT),
                )

                return {
                  messageIndex: index,
                  sentiment: sentimentResult,
                  timestamp: message.timestamp || Date.now(),
                }
              }
            } catch (error: unknown) {
              logger.error(`Failed to analyze sentiment for message ${index}`, {
                error,
              })
              return {
                messageIndex: index,
                error: true,
                timestamp: message.timestamp || Date.now(),
              }
            }
          }),
      )

      // Create the result object
      const analyticsData = {
        messageCount: filteredMessages.length,
        userMessageCount: filteredMessages.filter((m) => m.role === 'user')
          .length,
        processedCount: results.filter((r) => !r.error).length,
        errorCount: results.filter((r) => r.error).length,
        sentimentData: results.filter((r) => !r.error),
        timeRange: {
          start: config.timeWindow?.startTime || 0,
          end: config.timeWindow?.endTime || Date.now(),
        },
      }

      const endTime = performance.now()
      logger.info(
        `Sentiment trend analysis completed in ${endTime - startTime}ms`,
      )

      // Encrypt the results if configured
      const finalResult: AnalyticsResult = {
        type: AnalyticsType.SENTIMENT_TREND,
        timestamp: Date.now(),
        data: analyticsData as Record<string, unknown>,
        encryptionMode: this.fheService.getMode() as EncryptionMode,
        isEncrypted: false,
      }

      if (config.encryptResults) {
        // Convert the encrypted string to a record to satisfy the type
        const encryptedDataString = await this.fheService.encryptData(
          JSON.stringify(analyticsData),
        )
        finalResult.data = { encrypted: encryptedDataString } as Record<
          string,
          unknown
        >
        finalResult.isEncrypted = true
      }

      return finalResult
    } catch (error: unknown) {
      logger.error('Failed to analyze sentiment trend', { error })
      throw new Error(`Sentiment analysis error: ${(error as Error).message}`, {
        cause: error,
      })
    }
  }

  /**
   * Analyze topics from encrypted messages using homomorphic clustering
   *
   * @param messages - Array of chat messages
   * @param config - Analytics configuration
   * @returns Topic clusters (can be encrypted)
   */
  public async analyzeTopicClusters(
    messages: ChatMessage[],
    config: AnalyticsConfig = DEFAULT_CONFIG,
  ): Promise<AnalyticsResult> {
    await this.ensureInitialized()

    try {
      logger.info('Starting encrypted topic clustering analysis')

      // Filter messages
      const filteredMessages = this.filterMessagesByTimeWindow(messages, config)

      // Process messages to identify topics homomorphically
      const results = await Promise.all(
        filteredMessages
          .filter((m) => m.role === 'user') // Only analyze user messages
          .map(async (message, index) => {
            try {
              // Handle already encrypted messages
              const messageContent = message.encrypted
                ? message.content
                : await this.fheService.encryptData(message.content)

              // Use FHE to categorize the message
              const topicResult = await this.fheService.processEncrypted!(
                messageContent,
                mapOperation(FHEOperation.CATEGORIZE),
                {
                  categories: {
                    anxiety: ['worried', 'nervous', 'anxious'],
                    depression: ['sad', 'hopeless', 'down'],
                    trauma: ['flashback', 'nightmare', 'triggered'],
                    relationships: ['partner', 'family', 'friend'],
                    work: ['job', 'career', 'boss'],
                    health: ['pain', 'illness', 'doctor'],
                  },
                },
              )

              return {
                messageIndex: index,
                topic: topicResult,
                timestamp: message.timestamp || Date.now(),
              }
            } catch (error: unknown) {
              logger.error(
                `Failed to analyze topics for message ${index}`,
                error as Record<string, unknown>,
              )
              return {
                messageIndex: index,
                error: true,
                timestamp: message.timestamp || Date.now(),
              }
            }
          }),
      )

      // Create result object
      const analyticsData = {
        messageCount: filteredMessages.length,
        topicData: results.filter((r) => !r.error),
        timeRange: {
          start: config.timeWindow?.startTime || 0,
          end: config.timeWindow?.endTime || Date.now(),
        },
      }

      // Encrypt results if configured
      const finalResult: AnalyticsResult = {
        type: AnalyticsType.TOPIC_CLUSTERING,
        timestamp: Date.now(),
        data: analyticsData as Record<string, unknown>,
        encryptionMode: this.fheService.getMode() as EncryptionMode,
        isEncrypted: false,
      }

      if (config.encryptResults) {
        // Convert the encrypted string to a record to satisfy the type
        const encryptedDataString = await this.fheService.encryptData(
          JSON.stringify(analyticsData),
        )
        finalResult.data = { encrypted: encryptedDataString } as Record<
          string,
          unknown
        >
        finalResult.isEncrypted = true
      }

      return finalResult
    } catch (error: unknown) {
      logger.error(
        'Failed to analyze topic clusters',
        error as Record<string, unknown>,
      )
      throw error
    }
  }

  /**
   * Assess risk factors while maintaining complete privacy
   * Critical for identifying potential harm risks
   *
   * @param messages - Array of chat messages
   * @param config - Analytics configuration
   * @returns Risk assessment (can be encrypted)
   */
  public async performRiskAssessment(
    messages: ChatMessage[],
    config: AnalyticsConfig = DEFAULT_CONFIG,
  ): Promise<AnalyticsResult> {
    await this.ensureInitialized()

    try {
      logger.info('Starting encrypted risk assessment analysis')

      // Filter messages
      const filteredMessages = this.filterMessagesByTimeWindow(messages, config)

      // Process messages for risk factors homomorphically
      // This is sensitive analysis that looks for concerning patterns
      const results = await Promise.all(
        filteredMessages
          .filter((m) => m.role === 'user')
          .map(async (message, index) => {
            try {
              // Handle already encrypted messages
              const messageContent = message.encrypted
                ? message.content
                : await this.fheService.encryptData(message.content)

              // Use custom operation to search for risk patterns
              const riskResult = await this.fheService.processEncrypted!(
                messageContent,
                mapOperation(FHEOperation.CUSTOM),
                {
                  operation: 'risk_detection',
                  operationParams: {
                    riskPatterns: ['self_harm', 'suicidal', 'violent', 'abuse'],
                    threshold: 0.7,
                  },
                },
              )

              return {
                messageIndex: index,
                risk: riskResult,
                timestamp: message.timestamp || Date.now(),
              }
            } catch (error: unknown) {
              logger.error(
                `Failed to analyze risk for message ${index}`,
                error as Record<string, unknown>,
              )
              return {
                messageIndex: index,
                error: true,
                timestamp: message.timestamp || Date.now(),
              }
            }
          }),
      )

      // Create the alert level based on risk detection
      // Note: In a real system, high risk results would trigger
      // appropriate clinical protocols while preserving privacy

      // Create result object
      const analyticsData = {
        messageCount: filteredMessages.length,
        riskData: results.filter((r) => !r.error),
        timeRange: {
          start: config.timeWindow?.startTime || 0,
          end: config.timeWindow?.endTime || Date.now(),
        },
      }

      // Encrypt results if configured
      const finalResult: AnalyticsResult = {
        type: AnalyticsType.RISK_ASSESSMENT,
        timestamp: Date.now(),
        data: analyticsData as Record<string, unknown>,
        encryptionMode: this.fheService.getMode() as EncryptionMode,
        isEncrypted: false,
      }

      if (config.encryptResults) {
        // Convert the encrypted string to a record to satisfy the type
        const encryptedDataString = await this.fheService.encryptData(
          JSON.stringify(analyticsData),
        )
        finalResult.data = { encrypted: encryptedDataString } as Record<
          string,
          unknown
        >
        finalResult.isEncrypted = true
      }

      return finalResult
    } catch (error: unknown) {
      logger.error(
        'Failed to perform risk assessment',
        error as Record<string, unknown>,
      )
      throw error
    }
  }

  /**
   * Analyze intervention effectiveness by correlating therapist messages
   * with subsequent client emotional states
   *
   * @param messages - Array of chat messages
   * @param config - Analytics configuration
   * @returns Intervention effectiveness analysis
   */
  public async analyzeInterventionEffectiveness(
    messages: ChatMessage[],
    config: AnalyticsConfig = DEFAULT_CONFIG,
  ): Promise<AnalyticsResult> {
    await this.ensureInitialized()

    try {
      logger.info('Starting encrypted intervention effectiveness analysis')

      // Filter messages
      const filteredMessages = this.filterMessagesByTimeWindow(messages, config)

      // Group messages into therapist-client exchanges
      const exchanges: { therapist: ChatMessage; client: ChatMessage }[] = []

      for (let i = 0; i < filteredMessages.length - 1; i++) {
        if (
          filteredMessages[i].role === 'assistant' &&
          filteredMessages[i + 1].role === 'user'
        ) {
          exchanges.push({
            therapist: filteredMessages[i],
            client: filteredMessages[i + 1],
          })
        }
      }

      // Analyze each exchange
      const results = await Promise.all(
        exchanges.map(async (exchange, index) => {
          try {
            // Encrypt messages if not already encrypted
            const therapistContent = exchange.therapist.encrypted
              ? exchange.therapist.content
              : await this.fheService.encryptData(exchange.therapist.content)

            const clientContent = exchange.client.encrypted
              ? exchange.client.content
              : await this.fheService.encryptData(exchange.client.content)

            // Analyze therapist intervention approach
            const interventionType = await this.fheService.processEncrypted!(
              therapistContent,
              mapOperation(FHEOperation.CATEGORIZE),
              {
                categories: {
                  reflective: ['understand', 'hearing', 'sounds like'],
                  clarifying: ['question', 'wondering', 'could you'],
                  challenging: ['consider', 'alternative', 'perspective'],
                  supportive: ['support', 'with you', 'make sense'],
                  directive: ['suggest', 'could try', 'recommend'],
                },
              },
            )

            // Analyze client response sentiment
            const responseSentiment = await this.fheService.processEncrypted!(
              clientContent,
              mapOperation(FHEOperation.SENTIMENT),
            )

            return {
              exchangeIndex: index,
              interventionType,
              responseSentiment,
              timestamp: exchange.client.timestamp || Date.now(),
            }
          } catch (error: unknown) {
            logger.error(
              `Failed to analyze exchange ${index}`,
              error as Record<string, unknown>,
            )
            return {
              exchangeIndex: index,
              error: true,
              timestamp: Date.now(),
            }
          }
        }),
      )

      // Create result object
      const analyticsData = {
        exchangeCount: exchanges.length,
        interventionData: results.filter((r) => !r.error),
        timeRange: {
          start: config.timeWindow?.startTime || 0,
          end: config.timeWindow?.endTime || Date.now(),
        },
      }

      // Encrypt results if configured
      const finalResult: AnalyticsResult = {
        type: AnalyticsType.INTERVENTION_EFFECTIVENESS,
        timestamp: Date.now(),
        data: analyticsData as Record<string, unknown>,
        encryptionMode: this.fheService.getMode() as EncryptionMode,
        isEncrypted: false,
      }

      if (config.encryptResults) {
        // Convert the encrypted string to a record to satisfy the type
        const encryptedDataString = await this.fheService.encryptData(
          JSON.stringify(analyticsData),
        )
        finalResult.data = { encrypted: encryptedDataString } as Record<
          string,
          unknown
        >
        finalResult.isEncrypted = true
      }

      return finalResult
    } catch (error: unknown) {
      logger.error(
        'Failed to analyze intervention effectiveness',
        error as Record<string, unknown>,
      )
      throw error
    }
  }

  /**
   * Analyze emotional patterns over time
   *
   * @param messages - Array of chat messages
   * @param config - Analytics configuration
   * @returns Emotional pattern analysis
   */
  public async analyzeEmotionalPatterns(
    messages: ChatMessage[],
    config: AnalyticsConfig = DEFAULT_CONFIG,
  ): Promise<AnalyticsResult> {
    await this.ensureInitialized()

    try {
      logger.info('Starting encrypted emotional pattern analysis')

      // Filter messages
      const filteredMessages = this.filterMessagesByTimeWindow(messages, config)
      const userMessages = filteredMessages.filter((m) => m.role === 'user')

      // Create time windows for trend analysis
      const timeWindows: { startTime: number; endTime: number }[] = []
      if (userMessages.length > 0) {
        const firstTimestamp = userMessages[0].timestamp || Date.now()
        const lastTimestamp =
          userMessages[userMessages.length - 1].timestamp || Date.now()
        const duration = lastTimestamp - firstTimestamp

        // Create 5 equal time windows or fewer if not enough messages
        const windowCount = Math.min(5, userMessages.length)
        const windowSize = duration / windowCount

        for (let i = 0; i < windowCount; i++) {
          timeWindows.push({
            startTime: firstTimestamp + i * windowSize,
            endTime: firstTimestamp + (i + 1) * windowSize,
          })
        }
      }

      // Analyze emotional patterns within each time window
      const windowResults = await Promise.all(
        timeWindows.map(async (window, windowIndex) => {
          // Get messages in this time window
          const windowMessages = userMessages.filter(
            (m) =>
              (m.timestamp || 0) >= window.startTime &&
              (m.timestamp || 0) <= window.endTime,
          )

          // Process each message in the window
          const messageResults = await Promise.all(
            windowMessages.map(async (message, messageIndex) => {
              try {
                // Encrypt if not already encrypted
                const messageContent = message.encrypted
                  ? message.content
                  : await this.fheService.encryptData(message.content)

                // Get emotional categorization
                const emotionResult = await this.fheService.processEncrypted!(
                  messageContent,
                  mapOperation(FHEOperation.CATEGORIZE),
                  {
                    categories: {
                      anger: ['angry', 'frustrated', 'mad'],
                      sadness: ['sad', 'down', 'depressed'],
                      fear: ['scared', 'afraid', 'anxious'],
                      joy: ['happy', 'excited', 'pleased'],
                      surprise: ['shocked', 'surprised', 'unexpected'],
                      disgust: ['disgusted', 'repulsed', 'awful'],
                    },
                  },
                )

                return {
                  messageIndex,
                  emotion: emotionResult,
                  timestamp: message.timestamp || Date.now(),
                }
              } catch (error: unknown) {
                logger.error(
                  `Failed to analyze emotion for message ${messageIndex}`,
                  error as Record<string, unknown>,
                )
                return {
                  messageIndex,
                  error: true,
                  timestamp: message.timestamp || Date.now(),
                }
              }
            }),
          )

          return {
            windowIndex,
            startTime: window.startTime,
            endTime: window.endTime,
            messageCount: windowMessages.length,
            emotions: messageResults.filter((r) => !r.error),
          }
        }),
      )

      // Create result object
      const analyticsData = {
        timeWindowCount: timeWindows.length,
        messageCount: userMessages.length,
        windowResults,
        timeRange: {
          start: config.timeWindow?.startTime || 0,
          end: config.timeWindow?.endTime || Date.now(),
        },
      }

      // Encrypt results if configured
      const finalResult: AnalyticsResult = {
        type: AnalyticsType.EMOTIONAL_PATTERNS,
        timestamp: Date.now(),
        data: analyticsData as Record<string, unknown>,
        encryptionMode: this.fheService.getMode() as EncryptionMode,
        isEncrypted: false,
      }

      if (config.encryptResults) {
        // Convert the encrypted string to a record to satisfy the type
        const encryptedDataString = await this.fheService.encryptData(
          JSON.stringify(analyticsData),
        )
        finalResult.data = { encrypted: encryptedDataString } as Record<
          string,
          unknown
        >
        finalResult.isEncrypted = true
      }

      return finalResult
    } catch (error: unknown) {
      logger.error(
        'Failed to analyze emotional patterns',
        error as Record<string, unknown>,
      )
      throw error
    }
  }

  /**
   * Create a comprehensive analytics dashboard for therapy sessions
   *
   * @param messages - Array of chat messages
   * @param config - Analytics configuration
   * @returns Combined analytics dashboard
   */
  public async createAnalyticsDashboard(
    messages: ChatMessage[],
    config: AnalyticsConfig = DEFAULT_CONFIG,
  ): Promise<AnalyticsResult[]> {
    await this.ensureInitialized()

    try {
      logger.info('Creating comprehensive analytics dashboard')

      // Run all analytics in parallel
      return await Promise.all([
        this.analyzeSentimentTrend(messages, config),
        this.analyzeTopicClusters(messages, config),
        this.analyzeEmotionalPatterns(messages, config),
        this.analyzeInterventionEffectiveness(messages, config),
        this.performRiskAssessment(messages, config),
      ])
    } catch (error: unknown) {
      logger.error(
        'Failed to create analytics dashboard',
        error as Record<string, unknown>,
      )
      throw error
    }
  }

  /**
   * Filter messages by time window
   */
  private filterMessagesByTimeWindow(
    messages: ChatMessage[],
    config: AnalyticsConfig,
  ): ChatMessage[] {
    const startTime = config.timeWindow?.startTime || 0
    const endTime = config.timeWindow?.endTime || Date.now()

    return messages.filter((message) => {
      const timestamp = message.timestamp || Date.now()
      return timestamp >= startTime && timestamp <= endTime
    })
  }

  /**
   * Ensure the analytics service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }
}

// Export the singleton instance
export const fheAnalytics = FHEAnalyticsService.getInstance()
export default fheAnalytics
