/**
 * Context Detection System for MetaAligner
 * Integrates with existing crisis detection and identifies different conversation contexts
 * to enable dynamic objective prioritization
 */

import { ContextType, type AlignmentContext } from '../core/objectives'
import { CrisisDetectionService } from '../../ai/services/crisis-detection'
import { EducationalContextRecognizer } from './educational-context-recognizer'
import type { AIService, AIMessage } from '../../ai/models/types'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('context-detector')

export interface ContextDetectionResult {
  detectedContext: ContextType
  confidence: number
  contextualIndicators: ContextualIndicator[]
  needsSpecialHandling: boolean
  urgency: 'low' | 'medium' | 'high' | 'critical'
  metadata: Record<string, unknown>
}

export interface ContextualIndicator {
  type: string
  description: string
  confidence: number
  severity?: number
}

export interface ContextDetectorConfig {
  aiService: AIService
  crisisDetectionService?: CrisisDetectionService
  educationalContextRecognizer?: EducationalContextRecognizer
  model?: string
  enableCrisisIntegration?: boolean
  enableEducationalRecognition?: boolean
}

/**
 * System prompt for context detection
 */
const CONTEXT_DETECTION_PROMPT = `You are a mental health context analysis system. Analyze the user's message to determine the primary context type and provide detailed indicators.

Context Types:
- CRISIS: Immediate safety concerns, self-harm, suicidal ideation, abuse, severe psychological distress
- EDUCATIONAL: Learning about mental health concepts, conditions, treatments, or general information
- SUPPORT: Seeking emotional support, validation, or coping strategies for ongoing challenges
- CLINICAL_ASSESSMENT: Seeking professional evaluation, diagnosis, or clinical guidance
- INFORMATIONAL: Requesting factual information about resources, services, or procedures
- GENERAL: Casual conversation, check-ins, or unclear intent

Respond in JSON format with:
- detectedContext: one of the context types above
- confidence: number from 0-1 indicating confidence in classification
- contextualIndicators: array of objects with type, description, and confidence
- needsSpecialHandling: boolean indicating if special protocols are needed
- urgency: "low", "medium", "high", or "critical"
- metadata: object with additional context-specific information

Be thorough in identifying indicators but prioritize safety - if there's any indication of crisis, classify as CRISIS.`

/**
 * Context Detection System
 *
 * Analyzes conversation context to determine appropriate objective prioritization
 */
export class ContextDetector {
  private aiService: AIService
  private crisisDetectionService: CrisisDetectionService | undefined
  private educationalContextRecognizer: EducationalContextRecognizer | undefined
  private model: string
  private enableCrisisIntegration: boolean
  private enableEducationalRecognition: boolean

  constructor(config: ContextDetectorConfig): void {
    this.aiService = config.aiService
    this.crisisDetectionService = config.crisisDetectionService ?? undefined
    this.educationalContextRecognizer =
      config.educationalContextRecognizer ?? undefined
    this.model = config.model || 'gpt-4'
    this.enableCrisisIntegration = config.enableCrisisIntegration ?? true
    this.enableEducationalRecognition =
      config.enableEducationalRecognition ?? true
  }

  /**
   * Detect context from user input
   */
  async detectContext(
    userInput: string,
    conversationHistory?: string[],
    userId?: string,
  ): Promise<ContextDetectionResult> {
    try {
      // First, check for crisis if integration is enabled
      let crisisResult = null
      if (this.enableCrisisIntegration && this.crisisDetectionService) {
        const crisisOptions = {
          sensitivityLevel: 'medium' as const,
          userId: userId || 'anonymous',
          source: 'context-detection',
        }
        crisisResult = await this.crisisDetectionService.detectCrisis(
          userInput,
          crisisOptions,
        )

        // If crisis is detected, immediately return crisis context
        if (crisisResult['isCrisis']) {
          return {
            detectedContext: ContextType.CRISIS,
            confidence: crisisResult['confidence'],
            contextualIndicators: [
              {
                type: 'crisis_detection',
                description: crisisResult['category'] || 'Crisis detected',
                confidence: crisisResult['confidence'],
                severity: this.mapRiskLevelToNumber(crisisResult['riskLevel']),
              },
            ],
            needsSpecialHandling: true,
            urgency: this.mapUrgencyFromCrisis(crisisResult['urgency']),
            metadata: {
              crisisResult,
              suggestedActions: crisisResult['suggestedActions'],
            },
          }
        }
      }

      // Check for educational context if recognizer is available
      let educationalResult = null
      if (
        this.enableEducationalRecognition &&
        this.educationalContextRecognizer
      ) {
        educationalResult =
          await this.educationalContextRecognizer.recognizeEducationalContext(
            userInput,
            undefined, // userProfile - would need to be passed through
            conversationHistory,
          )

        // If high confidence educational context, return it
        if (
          educationalResult['isEducational'] &&
          educationalResult['confidence'] > 0.8
        ) {
          return {
            detectedContext: ContextType.EDUCATIONAL,
            confidence: educationalResult['confidence'],
            contextualIndicators: [
              {
                type: 'educational_recognition',
                description: `Educational ${educationalResult['educationalType']} about ${educationalResult['topicArea']}`,
                confidence: educationalResult['confidence'],
              },
            ],
            needsSpecialHandling: educationalResult['complexity'] === 'advanced',
            urgency: 'low',
            metadata: {
              educationalResult,
              learningObjectives: educationalResult['learningObjectives'],
              recommendedResources: educationalResult['recommendedResources'],
            },
          }
        }
      }

      // If no specific context detected, proceed with general context detection
      const messages: AIMessage[] = [
        {
          role: 'system',
          content: CONTEXT_DETECTION_PROMPT,
        },
        {
          role: 'user',
          content: this.formatInputForAnalysis(userInput, conversationHistory),
        },
      ]

      const response = await this.aiService.createChatCompletion(messages, {
        model: this.model,
      })

      const content = response['content'] || ''
      const result = this.parseContextDetectionResponse(content)

      // Merge crisis detection data if available
      if (crisisResult && !crisisResult['isCrisis']) {
        result['metadata']['crisisAnalysis'] = {
          confidence: crisisResult['confidence'],
          riskLevel: crisisResult['riskLevel'],
        }
      }

      // Merge educational analysis if available
      if (educationalResult && educationalResult['isEducational']) {
        result['metadata']['educationalAnalysis'] = {
          confidence: educationalResult['confidence'],
          type: educationalResult['educationalType'],
          complexity: educationalResult['complexity'],
          topicArea: educationalResult['topicArea'],
        }
      }

      logger.info('Context detected', {
        context: result['detectedContext'],
        confidence: result['confidence'],
        urgency: result['urgency'],
      })

      return result
    } catch (error: unknown) {
      logger.error('Error detecting context:', error as Record<string, unknown>)

      // Fallback to general context with low confidence
      return {
        detectedContext: ContextType.GENERAL,
        confidence: 0.1,
        contextualIndicators: [
          {
            type: 'error_fallback',
            description: 'Context detection failed, using general fallback',
            confidence: 0.1,
          },
        ],
        needsSpecialHandling: false,
        urgency: 'low',
        metadata: {
          error: error instanceof Error ? String(error) : 'Unknown error',
        },
      }
    }
  }

  /**
   * Batch context detection for multiple inputs
   */
  async detectContextBatch(
    inputs: Array<{
      text: string
      conversationHistory?: string[]
      userId?: string
    }>,
  ): Promise<ContextDetectionResult[]> {
    return Promise.all(
      inputs.map((input) =>
        this.detectContext(input['text'], input['conversationHistory'], input['userId']),
      ),
    )
  }

  /**
   * Create alignment context from detection result
   */
  createAlignmentContext(
    userQuery: string,
    detectionResult: ContextDetectionResult,
  ): AlignmentContext {
    return {
      userQuery,
      detectedContext: detectionResult.detectedContext,
      sessionMetadata: {
        confidence: detectionResult.confidence,
        urgency: detectionResult.urgency,
        needsSpecialHandling: detectionResult.needsSpecialHandling,
        contextualIndicators: detectionResult.contextualIndicators,
        ...detectionResult.metadata,
      },
    }
  }

  /**
   * Format input for analysis
   */
  private formatInputForAnalysis(
    userInput: string,
    conversationHistory?: string[],
  ): string {
    let formatted = `Current message: ${userInput}`

    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-5).join('\n')
      formatted += `\n\nRecent conversation context:\n${recentHistory}`
    }

    return formatted
  }

  /**
   * Parse context detection response
   */
  private parseContextDetectionResponse(
    content: string,
  ): ContextDetectionResult {
    try {
      const parsed = JSON.parse(content) as unknown as Record<string, unknown>
      return {
        detectedContext:
          (parsed['detectedContext'] as ContextType) || ContextType.GENERAL,
        confidence: (parsed['confidence'] as number) || 0.5,
        contextualIndicators:
          (parsed['contextualIndicators'] as ContextualIndicator[]) || [],
        needsSpecialHandling:
          (parsed['needsSpecialHandling'] as boolean) || false,
        urgency:
          (parsed['urgency'] as 'low' | 'medium' | 'high' | 'critical') ||
          'low',
        metadata: (parsed['metadata'] as Record<string, unknown>) || {},
      }
    } catch {
      return {
        detectedContext: ContextType.GENERAL,
        confidence: 0.3,
        contextualIndicators: [],
        needsSpecialHandling: false,
        urgency: 'low',
        metadata: {},
      }
    }
  }

  /**
   * Map risk level to number for severity scoring
   */
  private mapRiskLevelToNumber(riskLevel: string): number {
    switch (riskLevel) {
      case 'low':
        return 1
      case 'medium':
        return 2
      case 'high':
        return 3
      case 'critical':
        return 4
      default:
        return 1
    }
  }

  /**
   * Map crisis urgency to context urgency
   */
  private mapUrgencyFromCrisis(
    urgency: string,
  ): 'low' | 'medium' | 'high' | 'critical' {
    switch (urgency) {
      case 'immediate':
        return 'critical'
      case 'high':
        return 'high'
      case 'medium':
        return 'medium'
      case 'low':
        return 'low'
      default:
        return 'medium'
    }
  }
}
