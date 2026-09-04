/**
 * Production-Grade Mental Arena Adapter for Synthetic Therapeutic Conversation Generation
 *
 * This adapter integrates with the MentalArena framework to generate high-quality synthetic
 * therapy conversations that can be used for training and evaluation of mental health AI systems.
 *
 * Features:
 * - Symptom encoding and decoding for therapeutic conversations
 * - Multi-disorder support with configurable parameters
 * - Quality assessment and accuracy scoring
 * - HIPAA-compliant data handling and encryption
 * - Performance monitoring and analytics
 *
 * @author MentalArena Integration Team
 * @since 2025-06-27
 */

import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const appLogger = createBuildSafeLogger('app')
import crypto from 'crypto'

import type { MentalArenaPythonBridge } from './MentalArenaPythonBridge.ts'
import {
  DisorderCategory,
  type SyntheticConversation,
  type SymptomEncodingResult,
  type TherapistDecodingResult,
} from './types.ts'

const logger = appLogger
import { PerformanceMetrics } from './mental-arena-adapter.types'
import type {
  MentalArenaProvider,
  FHEService,
  GenerateSyntheticDataOptions,
  SyntheticDataGenerationResult,
  ValidationResult,
  ValidationIssue,
  EmotionAnalysisResult,
  InterventionContext,
  InterventionResult,
  ChatMessage,
  ChatCompletionResult,
  RiskAssessmentResult,
  EmergencyContext,
  EmergencyResponse,
  TextGenerationOptions,
  EncryptedData,
} from './mental-arena-adapter.types'
import {
  validateGenerationOptions,
  getSymptomTemplatesForDisorder,
  randomDuration,
  calculateAverage,
  calculateAccuracyScore,
  countUniqueSymptoms,
  calculateCoverageByDisorder,
  createSymptomEncodingPrompt,
  extractManifestations,
  extractCognitions,
  createInitialConversationPrompt,
  createPatientPrompt,
  createTherapistPrompt,
  shouldEndConversation,
  createTherapistDecodingPrompt,
  parseIdentifiedSymptoms,
  generateSessionSummary,
  validateClinicalAccuracy,
  validateConversationalFlow,
  validateEthicalConsiderations,
  validateTechnicalQuality,
  generateRecommendations,
  calculateSingleConversationMetrics,
  saveToFile,
  selectRandomSymptoms,
} from './mental-arena-adapter.utils'
export type {
  MentalArenaProvider,
  FHEService,
  GenerateSyntheticDataOptions,
  SyntheticDataGenerationResult,
  ValidationResult,
  ValidationIssue,
} from './mental-arena-adapter.types'

/**
 * Per-disorder symptom lexicon. Surface forms (snake_case) map to clinically
 * meaningful manifestation/cognition labels. Used by:
 *   - {@link MentalArenaAdapter.getSymptomTemplatesForDisorder} (sample pool)
 *   - {@link MentalArenaAdapter.extractManifestations} / extractCognitions
 *     (NLP phrase matching against LLM-generated patient text)
 *
 * Tokens are matched against prose by converting underscores to whitespace
 * (see tokenToPhraseRegex), so "catastrophic_thinking" matches
 * "catastrophic thinking" and "catastrophic-thinking".
 */
export class MentalArenaAdapter {
  private readonly provider: MentalArenaProvider
  private readonly fheService: FHEService
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly pythonBridgeEnabled: boolean
  private readonly pythonBridge: MentalArenaPythonBridge | undefined
  private readonly performanceMetrics: PerformanceMetrics
  private readonly validationEnabled: boolean
  private readonly encryptionEnabled: boolean

  constructor(
    provider: MentalArenaProvider,
    fheService: FHEService,
    baseUrl: string,
    apiKey: string,
    pythonBridgeEnabled: boolean = false,
    pythonBridge?: MentalArenaPythonBridge,
  ) {
    this.provider = provider
    this.fheService = fheService
    this.baseUrl = baseUrl
    this.apiKey = apiKey
    this.pythonBridgeEnabled = pythonBridgeEnabled
    this.pythonBridge = pythonBridge
    this.performanceMetrics = new PerformanceMetrics()
    this.validationEnabled = true
    this.encryptionEnabled = true

    logger.info('MentalArenaAdapter initialized', {
      baseUrl: this.baseUrl,
      pythonBridgeEnabled: this.pythonBridgeEnabled,
      validationEnabled: this.validationEnabled,
      encryptionEnabled: this.encryptionEnabled,
      hasApiKey: !!this.apiKey,
      hasPythonBridge: !!this.pythonBridge,
    })
  }

  /**
   * Generate synthetic therapeutic conversations
   */
  async generateSyntheticData(
    options: GenerateSyntheticDataOptions,
  ): Promise<SyntheticConversation[]> {
    const startTime = Date.now()
    logger.info('Starting synthetic data generation', options)

    try {
      const result = await this.generateSyntheticDataWithMetrics(options)
      return result.conversations
    } catch (error: unknown) {
      logger.error('Failed to generate synthetic data', { error, options })
      throw new Error(
        `Synthetic data generation failed: ${error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : String(error)}`,
        {
          cause: error,
        },
      )
    } finally {
      const processingTime = Date.now() - startTime
      this.performanceMetrics.recordGeneration(
        processingTime,
        options.numSessions,
      )
      logger.info('Synthetic data generation completed', {
        processingTime,
        numSessions: options.numSessions,
      })
    }
  }

  /**
   * Generate synthetic data with comprehensive metrics
   */
  async generateSyntheticDataWithMetrics(
    options: GenerateSyntheticDataOptions,
  ): Promise<SyntheticDataGenerationResult> {
    const startTime = Date.now()
    const conversations: SyntheticConversation[] = []
    const validationResults: ValidationResult[] = []
    let successfulGenerations = 0
    let failedGenerations = 0
    const qualityScores: number[] = []
    const accuracyScores: number[] = []

    // Validate input options
    validateGenerationOptions(options)

    // Initialize encryption if needed
    if (this.encryptionEnabled && !this.fheService.isInitialized()) {
      await this.fheService.initialize({
        mode: 'secure',
        keySize: 2048,
        securityLevel: 'tc128',
      })
    }

    // Generate conversations for each disorder concurrently
    const disorderPromises = options.disorders.map(async (disorder) => {
      try {
        const sessionsPerDisorder = Math.ceil(
          options.numSessions / options.disorders.length,
        )
        const disorderConversations =
          await this.generateConversationsForDisorder(
            disorder as DisorderCategory,
            sessionsPerDisorder,
            options,
          )

        // Process conversations with validation if enabled
        if (options.enableValidation !== false) {
          // Validate all conversations concurrently
          const validationPromises = disorderConversations.map( async (conversation) =>
            this.validateConversation(conversation),
          )
          const validations = await Promise.all(validationPromises)

          // Process validation results
          const processedResults = {
            validConversations: [] as SyntheticConversation[],
            validationResults: [] as ValidationResult[],
            successCount: 0,
            failureCount: 0,
            accuracyScores: [] as number[],
            qualityScores: [] as number[],
          }

          disorderConversations.forEach((conversation, index) => {
            const validation = validations[index]
            processedResults.validationResults.push(validation)

            if (validation.isValid) {
              processedResults.validConversations.push(conversation)
              processedResults.successCount++
              if (conversation.accuracyScore) {
                processedResults.accuracyScores.push(conversation.accuracyScore)
              }
              processedResults.qualityScores.push(validation.qualityScore)
            } else {
              processedResults.failureCount++
              logger.warn('Conversation failed validation', {
                sessionId: conversation.sessionSummary,
                issues: validation.issues.map((i) => i.description),
              })
            }
          })

          return processedResults
        } else {
          // Return all conversations without validation
          return {
            validConversations: disorderConversations,
            validationResults: [] as ValidationResult[],
            successCount: disorderConversations.length,
            failureCount: 0,
            accuracyScores: disorderConversations
              .map((c) => c.accuracyScore)
              .filter((score): score is number => score !== undefined),
            qualityScores: [] as number[],
          }
        }
      } catch (error: unknown) {
        logger.error(
          `Failed to generate conversations for disorder: ${disorder}`,
          error,
        )
        const sessionsPerDisorder = Math.ceil(
          options.numSessions / options.disorders.length,
        )
        return {
          validConversations: [] as SyntheticConversation[],
          validationResults: [] as ValidationResult[],
          successCount: 0,
          failureCount: sessionsPerDisorder,
          accuracyScores: [] as number[],
          qualityScores: [] as number[],
        }
      }
    })

    // Wait for all disorder processing to complete
    const allResults = await Promise.all(disorderPromises)

    // Aggregate results from all disorders
    for (const result of allResults) {
      conversations.push(...result.validConversations)
      validationResults.push(...result.validationResults)
      successfulGenerations += result.successCount
      failedGenerations += result.failureCount
      accuracyScores.push(...result.accuracyScores)
      qualityScores.push(...result.qualityScores)
    }

    // Calculate quality metrics
    const qualityMetrics = await this.calculateQualityMetrics(conversations)

    // Calculate coverage metrics
    const coverageByDisorder = calculateCoverageByDisorder(
      conversations,
      options.disorders,
    )

    // Prepare result
    const processingTime = Date.now() - startTime
    const result: SyntheticDataGenerationResult = {
      conversations,
      metadata: {
        totalSessions: options.numSessions,
        successfulGenerations,
        failedGenerations,
        averageAccuracyScore: calculateAverage(accuracyScores),
        averageQualityScore: calculateAverage(qualityScores),
        processingTime,
        uniqueSymptoms: countUniqueSymptoms(conversations),
        coverageByDisorder,
      },
      qualityMetrics,
      ...(options.enableValidation !== false && { validationResults }),
    }

    // Encrypt output if required
    if (options.encryptOutput && this.encryptionEnabled) {
      result.conversations = await this.encryptConversations(
        result.conversations,
      )
    }

    // Save to file if path provided
    if (options.outputPath) {
      await saveToFile(result, options.outputPath)
    }

    logger.info('Synthetic data generation completed with metrics', {
      totalConversations: conversations.length,
      successRate:
        (successfulGenerations / (successfulGenerations + failedGenerations)) *
        100,
      averageQuality: result.metadata.averageQualityScore,
      processingTime,
    })

    return result
  }

  /**
   * Generate conversations for a specific disorder
   */
  private async generateConversationsForDisorder(
    disorder: DisorderCategory,
    count: number,
    options: GenerateSyntheticDataOptions,
  ): Promise<SyntheticConversation[]> {
    // Create array of promises for concurrent generation
    const conversationPromises = Array.from({ length: count }, async (_, i) => {
      try {
        return await this.generateSingleConversation(disorder, options)
      } catch (error: unknown) {
        logger.error(
          `Failed to generate conversation ${i + 1} for ${disorder}`,
          error,
        )
        return null // Return null for failed conversations
      }
    })

    // Execute all promises concurrently and filter out failures
    const results = await Promise.all(conversationPromises)
    return results.filter(
      (conversation): conversation is SyntheticConversation =>
        conversation !== null,
    )
  }

  /**
   * Generate a single therapeutic conversation
   */
  private async generateSingleConversation(
    disorder: DisorderCategory,
    options: GenerateSyntheticDataOptions,
  ): Promise<SyntheticConversation> {
    const sessionId = crypto.randomUUID()
    logger.debug(`Generating conversation for disorder: ${disorder}`, {
      sessionId,
    })

    // Step 1: Generate symptom profile
    const symptomProfile = await this.generateSymptomProfile(disorder)

    // Step 2: Encode symptoms into patient persona
    const encodingResult = await this.encodeSymptoms(symptomProfile, disorder)

    // Step 3: Generate conversation turns
    const conversationTurns = await this.generateConversationTurns(
      encodingResult,
      options.maxTurns,
      options,
    )

    // Step 4: Simulate therapist decoding
    const decodingResult = await this.simulateTherapistDecoding(
      conversationTurns.patientText,
      symptomProfile.symptoms,
    )

    // Step 5: Calculate accuracy and quality
    const accuracyScore = calculateAccuracyScore(
      symptomProfile.symptoms.map((s) => s.name),
      decodingResult.identifiedSymptoms,
    )

    // Step 6: Generate session summary
    const sessionSummary = await generateSessionSummary(
      conversationTurns,
      encodingResult,
      decodingResult,
    )

    return {
      patientText: conversationTurns.patientText,
      therapistText: conversationTurns.therapistText,
      encodedSymptoms: encodingResult.symptoms,
      decodedSymptoms: decodingResult.identifiedSymptoms,
      sessionSummary,
      accuracyScore,
    }
  }

  /**
   * Generate symptom profile for a disorder
   */
  private async generateSymptomProfile(
    disorder: DisorderCategory,
  ): Promise<SymptomEncodingResult> {
    const symptoms = await getSymptomTemplatesForDisorder(disorder)
    const selectedSymptoms = selectRandomSymptoms(symptoms, 3, 7) // 3-7 symptoms per session

    return {
      symptoms: selectedSymptoms.map((symptom) => ({
        name: symptom.name,
        severity: Math.random() * 10, // 0-10 severity scale
        duration: randomDuration(),
        manifestations: symptom.manifestations,
        cognitions: symptom.cognitions,
      })),
      metadata: {
        disorderCategory: disorder,
        sessionId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    }
  }

  /**
   * Encode symptoms into patient conversation style
   */
  private async encodeSymptoms(
    symptomProfile: SymptomEncodingResult,
    disorder: DisorderCategory,
  ): Promise<SymptomEncodingResult> {
    const prompt = createSymptomEncodingPrompt(symptomProfile, disorder)

    try {
      const encodedText = await this.provider.generateText(prompt, {
        temperature: 0.8,
        maxTokens: 500,
      })

      // Parse and enhance the encoding result
      const enhancedSymptoms = symptomProfile.symptoms.map((symptom) => ({
        ...symptom,
        manifestations: [
          ...symptom.manifestations,
          ...extractManifestations(encodedText, disorder),
        ],
        cognitions: [
          ...symptom.cognitions,
          ...extractCognitions(encodedText, disorder),
        ],
      }))

      return {
        ...symptomProfile,
        symptoms: enhancedSymptoms,
      }
    } catch (error: unknown) {
      logger.error('Failed to encode symptoms', { error, disorder })
      return symptomProfile // Return original if encoding fails
    }
  }

  /**
   * Generate conversation turns between patient and therapist
   */
  private async generateConversationTurns(
    encodingResult: SymptomEncodingResult,
    maxTurns: number,
    options: GenerateSyntheticDataOptions,
  ): Promise<{ patientText: string; therapistText: string }> {
    const conversationHistory: ChatMessage[] = []
    let patientText = ''
    let therapistText = ''

    // Initialize conversation
    const initialPrompt = createInitialConversationPrompt(encodingResult)
    conversationHistory.push({ role: 'system', content: initialPrompt })

    // Generate conversation turns sequentially to maintain conversation flow
    const generateTurn = async (turn: number): Promise<boolean> => {
      try {
        // Generate patient response
        const patientPrompt = createPatientPrompt(
          encodingResult,
          conversationHistory,
          turn,
        )
        const patientResponse = await this.provider.generateText(
          patientPrompt,
          {
            temperature: options.temperature ?? 0.9,
            maxTokens: 150,
          },
        )

        patientText += `Turn ${turn + 1} - Patient: ${patientResponse}\n\n`
        conversationHistory.push({ role: 'user', content: patientResponse })

        // Generate therapist response
        const therapistPrompt = createTherapistPrompt(conversationHistory)
        const therapistResponse = await this.provider.generateText(
          therapistPrompt,
          {
            temperature: 0.7,
            maxTokens: 200,
          },
        )

        therapistText += `Turn ${turn + 1} - Therapist: ${therapistResponse}\n\n`
        conversationHistory.push({
          role: 'assistant',
          content: therapistResponse,
        })

        // Check for natural conversation end
        return shouldEndConversation(therapistResponse, turn, maxTurns)
      } catch (error: unknown) {
        logger.error(`Failed to generate conversation turn ${turn + 1}`, error)
        return true // End conversation on error
      }
    }

    // Process turns sequentially by recursively calling generateTurn
    const processTurns = async (turn: number): Promise<void> => {
      if (turn >= maxTurns) {
        return
      }

      const shouldEnd = await generateTurn(turn)
      if (!shouldEnd) {
        await processTurns(turn + 1)
      }
    }

    await processTurns(0)

    return { patientText, therapistText }
  }

  /**
   * Simulate therapist's ability to decode symptoms from conversation
   */
  private async simulateTherapistDecoding(
    patientText: string,
    actualSymptoms: Array<{
      name: string
      severity: number
      duration: string
      manifestations: string[]
      cognitions: string[]
    }>,
  ): Promise<TherapistDecodingResult> {
    const decodingPrompt = createTherapistDecodingPrompt(patientText)

    try {
      const decodingResponse = await this.provider.generateText(
        decodingPrompt,
        {
          temperature: 0.3, // Lower temperature for more consistent analysis
          maxTokens: 300,
        },
      )

      const identifiedSymptoms = parseIdentifiedSymptoms(decodingResponse)
      const actualSymptomNames = actualSymptoms.map((s) => s.name)

      return {
        identifiedSymptoms,
        accuracyScore: calculateAccuracyScore(
          actualSymptomNames,
          identifiedSymptoms,
        ),
        missedSymptoms: actualSymptomNames.filter(
          (s) => !identifiedSymptoms.includes(s),
        ),
        falsePositives: identifiedSymptoms.filter(
          (s) => !actualSymptomNames.includes(s),
        ),
        analysis: {
          correctlyIdentified: identifiedSymptoms.filter((s) =>
            actualSymptomNames.includes(s),
          ),
          missed: actualSymptomNames.filter(
            (s) => !identifiedSymptoms.includes(s),
          ),
          incorrect: identifiedSymptoms.filter(
            (s) => !actualSymptomNames.includes(s),
          ),
        },
      }
    } catch (error: unknown) {
      logger.error('Failed to simulate therapist decoding', error)
      return {
        identifiedSymptoms: [],
        accuracyScore: 0,
        missedSymptoms: actualSymptoms.map((s) => s.name),
        falsePositives: [],
        analysis: {
          correctlyIdentified: [],
          missed: actualSymptoms.map((s) => s.name),
          incorrect: [],
        },
      }
    }
  }

  /**
   * Validate a generated conversation for quality and clinical accuracy
   */
  private async validateConversation(
    conversation: SyntheticConversation,
  ): Promise<ValidationResult> {
    const issues: ValidationIssue[] = []
    let qualityScore = 100 // Start with perfect score and deduct for issues

    // Clinical validation
    const clinicalIssues = await validateClinicalAccuracy(conversation)
    issues.push(...clinicalIssues)
    qualityScore -= clinicalIssues.length * 10

    // Conversational flow validation
    const flowIssues = validateConversationalFlow(conversation)
    issues.push(...flowIssues)
    qualityScore -= flowIssues.length * 5

    // Ethical considerations validation
    const ethicalIssues = validateEthicalConsiderations(conversation)
    issues.push(...ethicalIssues)
    qualityScore -= ethicalIssues.length * 15

    // Technical validation
    const technicalIssues = validateTechnicalQuality(conversation)
    issues.push(...technicalIssues)
    qualityScore -= technicalIssues.length * 3

    const isValid =
      qualityScore >= (conversation.accuracyScore ? 70 : 60) &&
      !issues.some((i) => i.severity === 'critical')
    // LOG: Fixed unterminated string literal and parenthesis at validation check

    return {
      sessionId: conversation.sessionSummary ?? crypto.randomUUID(),
      isValid,
      issues,
      qualityScore: Math.max(0, qualityScore),
      recommendations: generateRecommendations(issues),
    }
  }

  /**
   * Calculate comprehensive quality metrics for the generated conversations
   */
  private async calculateQualityMetrics(
    conversations: SyntheticConversation[],
  ): Promise<{
    coherenceScore: number
    clinicalAccuracy: number
    conversationalFlow: number
    therapeuticValue: number
  }> {
    if (conversations.length === 0) {
      return {
        coherenceScore: 0,
        clinicalAccuracy: 0,
        conversationalFlow: 0,
        therapeuticValue: 0,
      }
    }

    // Process all conversations concurrently to avoid await in loop
    const allMetrics = await Promise.all(
      conversations.map( async (conversation) =>
        calculateSingleConversationMetrics(conversation),
      ),
    )

    let totalCoherence = 0
    let totalClinical = 0
    let totalFlow = 0
    let totalTherapeutic = 0

    for (const metrics of allMetrics) {
      totalCoherence += metrics.coherence
      totalClinical += metrics.clinical
      totalFlow += metrics.flow
      totalTherapeutic += metrics.therapeutic
    }

    const count = conversations.length
    return {
      coherenceScore: totalCoherence / count,
      clinicalAccuracy: totalClinical / count,
      conversationalFlow: totalFlow / count,
      therapeuticValue: totalTherapeutic / count,
    }
  }

  // ... Helper methods and private functions follow ...

  private async encryptConversations(
    conversations: SyntheticConversation[],
  ): Promise<SyntheticConversation[]> {
    if (!this.encryptionEnabled) {
      return conversations
    }

    return Promise.all(
      conversations.map(async (conv) => ({
        ...conv,
        patientText: await this.fheService.encryptText(conv.patientText),
        therapistText: await this.fheService.encryptText(conv.therapistText),
      })),
    )
  }

}

