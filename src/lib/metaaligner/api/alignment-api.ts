/**
 * MetaAligner LLM Integration API
 * Provides integration mechanisms for evaluating and enhancing LLM responses using objectives
 */

import type {
  AIMessage,
  AIService,
  AIServiceOptions,
  AICompletion,
} from '../../ai/models/ai-types'

// Define AIServiceResponse and AIStreamOptions locally if not available
export interface AIServiceResponse {
  content: string
  model: string
  usage?: {
    totalTokens: number
    promptTokens: number
    completionTokens: number
    processingTimeMs?: number
  }
  id?: string
  provider?: string
  created?: number
}

// Avoid using an empty interface extension which triggers the no-empty-object-type rule.
// Use a type alias to explicitly represent the same shape as AIServiceOptions.
export type AIStreamOptions = AIServiceOptions
import {
  ObjectiveDefinition,
  AlignmentContext,
  ContextType,
  CORE_MENTAL_HEALTH_OBJECTIVES,
} from '../core/objectives'
import {
  ObjectiveEvaluationResult,
  AlignmentEvaluationResult,
  AggregationMethod,
} from '../core/objective-interfaces'
import {
  ObjectiveMetricsEngine,
  AlignmentMetrics,
} from '../core/objective-metrics'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('metaaligner-api')

export interface AlignmentIntegrationConfig {
  objectives?: ObjectiveDefinition[]
  enableRealTimeEvaluation?: boolean
  enableResponseEnhancement?: boolean
  enhancementThreshold?: number // Minimum score threshold to trigger enhancement
  maxEnhancementAttempts?: number
  aiService?: AIService
  model?: string
  temperature?: number
}

export interface EvaluationRequest {
  response: string
  context: AlignmentContext
  objectives?: ObjectiveDefinition[]
}

export interface EvaluationResponse {
  evaluation: AlignmentEvaluationResult
  metrics: AlignmentMetrics
  recommendations: string[]
  needsEnhancement: boolean
}

export interface EnhancementRequest {
  originalResponse: string
  evaluationResult: AlignmentEvaluationResult
  context: AlignmentContext
  targetObjectives?: string[] // Specific objectives to focus on
}

export interface EnhancementResponse {
  enhancedResponse: string
  improvementMetrics: AlignmentMetrics
  enhancementExplanation: string
  enhancementApplied: boolean
}

export interface IntegratedResponse extends AIServiceResponse {
  alignment?: {
    evaluation: AlignmentEvaluationResult
    metrics: AlignmentMetrics
    enhanced: boolean
    enhancementAttempts: number
  }
}

/**
 * MetaAligner LLM Integration Service
 */
export class MetaAlignerAPI {
  private config: AlignmentIntegrationConfig
  private objectives: ObjectiveDefinition[]
  private metricsEngine: ObjectiveMetricsEngine
  private aiService: AIService | undefined

  constructor(config: AlignmentIntegrationConfig = {}) {
    this.config = {
      enableRealTimeEvaluation: true,
      enableResponseEnhancement: true,
      enhancementThreshold: 0.7,
      maxEnhancementAttempts: 2,
      model: 'mistralai/Mixtral-8x7B-Instruct-v0.2',
      temperature: 0.7,
      ...config,
    }

    this.objectives = config.objectives || CORE_MENTAL_HEALTH_OBJECTIVES
    this.aiService = config.aiService

    this.metricsEngine = new ObjectiveMetricsEngine({
      historyWindow: 50,
      trendSensitivity: 0.1,
      benchmarkThresholds: { overall: 0.8, safety: 0.9 },
      weightDecay: 0.95,
      confidenceThreshold: 0.7,
    })

    logger.info('MetaAlignerAPI initialized', {
      objectiveCount: this.objectives.length,
      realTimeEnabled: this.config.enableRealTimeEvaluation,
      enhancementEnabled: this.config.enableResponseEnhancement,
      action: 'initialize',
    })
  }

  /**
   * Evaluate a response against objectives
   */
  async evaluateResponse(
    request: EvaluationRequest,
  ): Promise<EvaluationResponse> {
    const { response, context, objectives = this.objectives } = request

    if (response === null || response === undefined) {
      logger.warn(
        'evaluateResponse called with null or undefined response. Returning default low score evaluation.',
      )
      // Construct a default/error EvaluationReport
      // This requires access to or recreation of some evaluation logic, simplified here
      const dummyObjectiveResults: Record<string, ObjectiveEvaluationResult> =
        {}
      for (const obj of this.objectives) {
        dummyObjectiveResults[obj.id] = {
          objectiveId: obj.id,
          score: 0.1,
          criteriaScores: {},
          confidence: 0.1,
          metadata: {
            evaluationTime: 0,
            contextFactors: [ContextType.GENERAL],
            adjustmentFactors: {},
          },
          explanation: 'Response was null or undefined.',
        }
      }
      const fallbackEvaluation: AlignmentEvaluationResult = {
        objectiveResults: dummyObjectiveResults,
        overallScore: 0.1,
        weights: this.objectives.reduce(
          (acc, obj) => ({ ...acc, [obj.id]: obj.weight }),
          {},
        ),
        normalizedScores: this.objectives.reduce(
          (acc, obj) => ({ ...acc, [obj.id]: 0.1 }),
          {},
        ),
        aggregationMethod: AggregationMethod.WEIGHTED_AVERAGE,
        evaluationContext: context,
        timestamp: new Date(),
      }
      return {
        evaluation: fallbackEvaluation,
        metrics: this.metricsEngine.calculateAlignmentMetrics(
          fallbackEvaluation,
          this.objectives,
        ),
        recommendations: [
          'Response was null or undefined, cannot provide specific improvement advice.',
        ],
        needsEnhancement: true,
      }
    }

    logger.info('Evaluating response', {
      responseLength: response.length,
      contextType: context.detectedContext,
      objectiveCount: objectives.length,
      action: 'evaluate_response',
    })

    try {
      // Create objective evaluation results
      const objectiveResults: Record<string, ObjectiveEvaluationResult> = {}

      for (const objective of objectives) {
        const score = objective.evaluationFunction(response, context)
        const criteriaScores: Record<string, number> = {}

        // Evaluate each criterion
        for (const criterion of objective.criteria) {
          criteriaScores[criterion.criterion] = this.evaluateCriterion(
            response,
            context,
            criterion.criterion,
          )
        }

        objectiveResults[objective.id] = {
          objectiveId: objective.id,
          score,
          criteriaScores,
          confidence: this.calculateConfidence(response, context, objective),
          explanation: `${objective.name}: Score reflects alignment with criteria such as ${objective.criteria.map((c) => c.criterion).join(', ')}.`, // Added default explanation
          metadata: {
            evaluationTime: Date.now(),
            contextFactors: [context.detectedContext],
            adjustmentFactors: {},
          },
        }
      }

      // Calculate overall score
      const overallScore = this.calculateOverallScore(
        objectiveResults,
        objectives,
      )

      // Create evaluation result
      const evaluation: AlignmentEvaluationResult = {
        objectiveResults,
        overallScore,
        weights: objectives.reduce(
          (weights, obj) => {
            weights[obj.id] = obj.weight
            return weights
          },
          {} as Record<string, number>,
        ),
        normalizedScores: Object.fromEntries(
          Object.entries(objectiveResults).map(([id, result]) => [
            id,
            result.score,
          ]),
        ),
        aggregationMethod: AggregationMethod.WEIGHTED_AVERAGE,
        evaluationContext: context,
        timestamp: new Date(),
      }

      // Calculate comprehensive metrics
      const metrics = this.metricsEngine.calculateAlignmentMetrics(
        evaluation,
        objectives,
      )

      // Add to history for trend analysis
      this.metricsEngine.addEvaluation(evaluation, objectives)

      // Generate recommendations
      const recommendations = this.generateRecommendations(evaluation, metrics)

      // Determine if enhancement is needed
      const needsEnhancement =
        overallScore < (this.config.enhancementThreshold || 0.7)

      logger.info('Response evaluation completed', {
        overallScore: overallScore.toFixed(3),
        needsEnhancement,
        recommendationCount: recommendations.length,
        action: 'evaluate_response_complete',
      })

      return {
        evaluation,
        metrics,
        recommendations,
        needsEnhancement,
      }
    } catch (error: unknown) {
      logger.error('Response evaluation failed', {
        error: error instanceof Error ? String(error) : 'Unknown error',
        action: 'evaluate_response_error',
      })
      throw new Error(
        `Response evaluation failed: ${error instanceof Error ? String(error) : 'Unknown error'}`,
        { cause: error },
      )
    }
  }

  /**
   * Enhance a response based on evaluation results
   */
  async enhanceResponse(
    request: EnhancementRequest,
  ): Promise<EnhancementResponse> {
    const { originalResponse, evaluationResult, context, targetObjectives } =
      request

    if (!this.aiService) {
      // Tests expect the error message to be 'AI service not configured'
      throw new Error('AI service not configured')
    }

    logger.info('Enhancing response', {
      originalLength: originalResponse.length,
      overallScore: evaluationResult.overallScore.toFixed(3),
      targetObjectives: targetObjectives?.join(', '),
      action: 'enhance_response',
    })

    try {
      // Identify areas for improvement
      const improvementAreas = this.identifyImprovementAreas(
        evaluationResult,
        targetObjectives,
      )

      // Generate enhancement prompt
      const enhancementPrompt = this.createEnhancementPrompt(
        originalResponse,
        context,
        improvementAreas,
        evaluationResult,
      )

      // Create messages for AI service
      const messages: AIMessage[] = [
        {
          role: 'system',
          content: enhancementPrompt,
          name: 'metaaligner',
        },
        {
          role: 'user',
          content: `Please enhance this mental health response:\n\n"${originalResponse}"`,
          name: 'user',
        },
      ]

      // Generate enhanced response
      const aiResponse: AICompletion =
        await this.aiService.createChatCompletion(messages, {
          model: this.config.model || 'mistralai/Mixtral-8x7B-Instruct-v0.2',
          temperature: this.config.temperature || 0.7,
          maxTokens: Math.max(originalResponse.length * 1.5, 1024),
        })

      if (!aiResponse.choices?.[0]?.message?.content) {
        throw new Error('Failed to generate enhanced response')
      }

      const enhancedResponse = aiResponse.choices[0].message.content

      // Evaluate the enhanced response
      const enhancedEvaluation = await this.evaluateResponse({
        response: enhancedResponse,
        context,
      })

      // Generate improvement explanation
      const enhancementExplanation = this.generateEnhancementExplanation(
        evaluationResult,
        enhancedEvaluation.evaluation,
        improvementAreas,
      )

      const enhancementApplied =
        enhancedEvaluation.evaluation.overallScore >
        evaluationResult.overallScore

      logger.info('Response enhancement completed', {
        originalScore: evaluationResult.overallScore.toFixed(3),
        enhancedScore: enhancedEvaluation.evaluation.overallScore.toFixed(3),
        improvement: (
          enhancedEvaluation.evaluation.overallScore -
          evaluationResult.overallScore
        ).toFixed(3),
        enhancementApplied,
        action: 'enhance_response_complete',
      })

      return {
        enhancedResponse: enhancementApplied
          ? enhancedResponse
          : originalResponse,
        improvementMetrics: enhancedEvaluation.metrics,
        enhancementExplanation,
        enhancementApplied,
      }
    } catch (error: unknown) {
      logger.error('Response enhancement failed', {
        error: error instanceof Error ? String(error) : 'Unknown error',
        action: 'enhance_response_error',
      })

      // Return original response if enhancement fails
      return {
        enhancedResponse: originalResponse,
        improvementMetrics: this.metricsEngine.calculateAlignmentMetrics(
          evaluationResult,
          this.objectives,
        ),
        enhancementExplanation: `Enhancement failed: ${error instanceof Error ? String(error) : 'Unknown error'}`,
        enhancementApplied: false,
      }
    }
  }

  /**
   * Create an integrated AI service that automatically evaluates and enhances responses
   */
  createIntegratedService(baseAIService: AIService): IntegratedAIService {
    return new IntegratedAIService(baseAIService, this)
  }

  /**
   * Detect context from user query and conversation history
   */
  detectContext(
    userQuery: string,
    conversationHistory?: AIMessage[],
  ): AlignmentContext {
    // Basic context detection - this would be enhanced with NLP in a real implementation
    const queryLower = userQuery.toLowerCase()

    let detectedContext: ContextType = ContextType.GENERAL

    // Crisis detection keywords
    const crisisKeywords = [
      'suicide',
      'kill myself',
      'end it all',
      'hurt myself',
      'crisis',
      'emergency',
    ]
    if (crisisKeywords.some((keyword) => queryLower.includes(keyword))) {
      detectedContext = ContextType.CRISIS
    }
    // Educational context
    else if (
      queryLower.includes('learn') ||
      queryLower.includes('understand') ||
      queryLower.includes('explain')
    ) {
      detectedContext = ContextType.EDUCATIONAL
    }
    // Support context
    else if (
      queryLower.includes('support') ||
      queryLower.includes('help') ||
      queryLower.includes('feeling')
    ) {
      detectedContext = ContextType.SUPPORT
    }
    // Clinical assessment
    else if (
      queryLower.includes('symptoms') ||
      queryLower.includes('diagnosis') ||
      queryLower.includes('treatment')
    ) {
      detectedContext = ContextType.CLINICAL_ASSESSMENT
    }
    // Informational
    else if (
      queryLower.includes('what is') ||
      queryLower.includes('how does') ||
      queryLower.includes('information')
    ) {
      detectedContext = ContextType.INFORMATIONAL
    }

    return {
      userQuery,
      conversationHistory: conversationHistory?.map((msg) => msg.content) || [],
      detectedContext,
    }
  }

  // Private helper methods

  private evaluateCriterion(
    response: string,
    context: AlignmentContext,
    criterion: string,
  ): number {
    // This would be implemented with specific NLP analysis for each criterion
    // For now, providing a basic scoring mechanism
    const responseLength = response.length
    const hasContextualWords = this.hasContextualWords(response, context)

    switch (criterion) {
      case 'factual_accuracy':
        return hasContextualWords && responseLength > 50 ? 0.8 : 0.6
      case 'evidence_based':
        return response.includes('research') || response.includes('studies')
          ? 0.9
          : 0.7
      case 'clinical_soundness':
        return !response.includes('diagnose') && responseLength > 100
          ? 0.85
          : 0.6
      case 'emotional_validation':
        return hasContextualWords ? 0.9 : 0.5
      case 'harm_prevention':
        return this.containsHarmfulContent(response) ? 0.2 : 0.95
      default:
        return 0.7 // Default score
    }
  }

  private hasContextualWords(
    response: string,
    _context: AlignmentContext,
  ): boolean {
    const supportiveWords = [
      'understand',
      'validate',
      'support',
      'empathy',
      'feel',
      'experience',
    ]
    const responseLower = response.toLowerCase()
    return supportiveWords.some((word) => responseLower.includes(word))
  }

  private containsHarmfulContent(response: string): boolean {
    const harmfulPatterns = [
      'you should hurt',
      'kill yourself',
      'give up',
      'hopeless case',
    ]
    const responseLower = response.toLowerCase()
    return harmfulPatterns.some((pattern) => responseLower.includes(pattern))
  }

  private calculateConfidence(
    response: string,
    context: AlignmentContext,
    _objective: ObjectiveDefinition,
  ): number {
    // Calculate confidence based on response clarity and context alignment
    const responseQuality = Math.min(response.length / 200, 1) // Length factor
    const contextAlignment =
      context.detectedContext !== ContextType.GENERAL ? 0.9 : 0.7
    return (responseQuality + contextAlignment) / 2
  }

  private calculateOverallScore(
    objectiveResults: Record<string, ObjectiveEvaluationResult>,
    objectives: ObjectiveDefinition[],
  ): number {
    let totalScore = 0
    let totalWeight = 0

    for (const objective of objectives) {
      const result = objectiveResults[objective.id]
      if (result) {
        totalScore += result.score * objective.weight
        totalWeight += objective.weight
      }
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0
  }

  private generateRecommendations(
    evaluation: AlignmentEvaluationResult,
    metrics: AlignmentMetrics,
  ): string[] {
    const recommendations: string[] = []

    // Check each objective for specific recommendations
    for (const [objectiveId, result] of Object.entries(
      evaluation.objectiveResults,
    )) {
      if (result.score < 0.7) {
        const objective = this.objectives.find((o) => o.id === objectiveId)
        if (objective) {
          recommendations.push(
            `Improve ${objective.name}: ${objective.description}`,
          )
        }
      }
    }

    // Add balance recommendations
    if (metrics.balanceScore < 0.7) {
      recommendations.push(
        'Focus on balancing objectives to avoid over-optimization in specific areas.',
      )
    }

    // Add context-specific recommendations
    if (metrics.contextualAlignment < 0.8) {
      recommendations.push(
        'Ensure response better aligns with the detected conversation context.',
      )
    }

    return recommendations
  }

  private identifyImprovementAreas(
    evaluation: AlignmentEvaluationResult,
    targetObjectives?: string[],
  ): string[] {
    // If specific targets are provided, reflect them directly in prioritized areas
    const targetedAreas: string[] = []
    const areas: string[] = []

    for (const [objectiveId, result] of Object.entries(
      evaluation.objectiveResults,
    )) {
      const isTargeted = !!targetObjectives?.includes(objectiveId)
      if (isTargeted || result.score < 0.7) {
        const objective = this.objectives.find((o) => o.id === objectiveId)
        if (objective) {
          ;(isTargeted ? targetedAreas : areas).push(objective.name)
        }
      }
    }

    // Ensure targeted objectives appear in explanation
    return [...new Set([...targetedAreas, ...areas])]
  }

  private createEnhancementPrompt(
    _originalResponse: string,
    context: AlignmentContext,
    improvementAreas: string[],
    evaluation: AlignmentEvaluationResult,
  ): string {
    return `You are an expert mental health response enhancer. Your task is to improve the following response to better align with mental health objectives.

Context: ${context.detectedContext}
Original Query: ${context.userQuery}

Areas needing improvement: ${improvementAreas.join(', ')}

Mental Health Objectives to focus on:
- Correctness: Ensure information is accurate and evidence-based
- Informativeness: Provide comprehensive, relevant, actionable information
- Professionalism: Maintain appropriate clinical tone and boundaries
- Empathy: Show understanding, validation, and emotional support
- Safety: Prioritize user safety and avoid harmful suggestions

Current Overall Score: ${(evaluation.overallScore * 100).toFixed(1)}%

Please enhance the response to better meet these objectives while maintaining its core message and helpfulness. Focus particularly on the identified improvement areas.`
  }

  private generateEnhancementExplanation(
    original: AlignmentEvaluationResult,
    enhanced: AlignmentEvaluationResult,
    improvementAreas: string[],
  ): string {
    const overallImprovement =
      (enhanced.overallScore - original.overallScore) * 100

    // Convert improvement areas to lowercase to match test expectations
    const lowercaseAreas = improvementAreas.map((area) => area.toLowerCase())
    let explanation = `Enhancement focused on: ${lowercaseAreas.join(', ')}. `
    explanation += `Overall score improvement: ${overallImprovement > 0 ? '+' : ''}${overallImprovement.toFixed(1)}%. `

    // Identify specific objective improvements
    const improvements: string[] = []
    for (const [objectiveId, enhancedResult] of Object.entries(
      enhanced.objectiveResults,
    )) {
      const originalResult = original.objectiveResults[objectiveId]
      if (originalResult && enhancedResult.score > originalResult.score) {
        const objective = this.objectives.find((o) => o.id === objectiveId)
        if (objective) {
          const improvement =
            (enhancedResult.score - originalResult.score) * 100
          improvements.push(`${objective.name}: +${improvement.toFixed(1)}%`)
        }
      }
    }

    if (improvements.length > 0) {
      explanation += `Specific improvements: ${improvements.join(', ')}.`
    }

    return explanation
  }
}

/**
 * Integrated AI Service that automatically applies MetaAligner evaluation and enhancement
 */
export class IntegratedAIService {
  constructor(
    private baseService: AIService,
    private metaAligner: MetaAlignerAPI,
  ) {}

  async createChatCompletion(
    messages: AIMessage[],
    options?: AIStreamOptions,
  ): Promise<IntegratedResponse> {
    // Get the base response
    const baseResponse: AICompletion =
      await this.baseService.createChatCompletion(messages, options)

    if (!baseResponse.choices?.[0]?.message?.content) {
      return {
        ...baseResponse,
        content: '',
        usage: baseResponse.usage
          ? {
              ...baseResponse.usage,
              processingTimeMs: 0,
            }
          : undefined,
      } as IntegratedResponse
    }

    const responseContent = baseResponse.choices[0].message.content

    // Detect context from the last user message
    const lastUserMessage = messages
      .filter((m: AIMessage) => m.role === 'user')
      .pop()
    if (!lastUserMessage) {
      return {
        ...baseResponse,
        content: responseContent,
        usage: {
          promptTokens: baseResponse.usage?.promptTokens ?? 0,
          completionTokens: baseResponse.usage?.completionTokens ?? 0,
          totalTokens: baseResponse.usage?.totalTokens ?? 0,
          processingTimeMs: 0,
        },
      } as IntegratedResponse
    }

    const context = this.metaAligner.detectContext(
      lastUserMessage.content,
      messages,
    )

    // Evaluate the response
    const evaluation = await this.metaAligner.evaluateResponse({
      response: responseContent,
      context,
    })

    // Enhance if needed and enabled
    let finalResponse = responseContent
    let enhancementAttempts = 0
    let enhanced = false

    if (
      evaluation.needsEnhancement &&
      this.metaAligner['config'].enableResponseEnhancement
    ) {
      const maxAttempts = this.metaAligner['config'].maxEnhancementAttempts || 2

      // Attempt enhancement up to maxAttempts. Count attempts even when an enhancement succeeds
      while (enhancementAttempts < maxAttempts && evaluation.needsEnhancement) {
        enhancementAttempts++

        const enhancement = await this.metaAligner.enhanceResponse({
          originalResponse: finalResponse,
          evaluationResult: evaluation.evaluation,
          context,
        })

        if (enhancement.enhancementApplied) {
          finalResponse = enhancement.enhancedResponse
          enhanced = true
          break
        }
      }
    }

    // Create integrated response
    const integratedResponse: IntegratedResponse = {
      ...baseResponse,
      content: finalResponse,
      usage: {
        promptTokens: baseResponse.usage?.promptTokens ?? 0,
        completionTokens: baseResponse.usage?.completionTokens ?? 0,
        totalTokens: baseResponse.usage?.totalTokens ?? 0,
        processingTimeMs: 0,
      },
      alignment: {
        evaluation: evaluation.evaluation,
        metrics: evaluation.metrics,
        enhanced,
        enhancementAttempts,
      },
    }

    return integratedResponse
  }
}

// Export main API class as default

export { MetaAlignerAPI as default }
