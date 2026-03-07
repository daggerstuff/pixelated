import { getAiServiceLogger } from '@/lib/logging/standardized-logger'
import { EvidenceService } from '../evidence/EvidenceService.ts'
import { ExpertGuidanceOrchestrator } from '../ExpertGuidanceOrchestrator.js'
import type {
  MentalLLaMAAdapterOptions,
  MentalHealthAnalysisResult,
  ExpertGuidedAnalysisResult,
  RoutingContext,
  CrisisContext,
  ICrisisNotificationHandler,
  IMentalHealthTaskRouter,
  IModelProvider,
  AnalysisFailure,
  RoutingDecision, // <-- Use RoutingDecision from mentalLLaMATypes only
  RawModelOutput,
} from '../types/mentalLLaMATypes.ts'
import type {
  AnalyzeMentalHealthParams,
  Message,
  ExplanationQualityMetrics,
} from '../types/index.ts'
import {
  specializedPrompts,
  buildGeneralAnalysisPrompt,
} from '../prompts/prompt-templates.ts'
import { ROUTER_LOW_CONFIDENCE_THRESHOLD } from '../constants/index.ts'
const logger = getAiServiceLogger('mental-llama')

// Option 1: Static import (uncomment if you want static import)
// import { CrisisSessionFlaggingService } from '../../crisis/CrisisSessionFlaggingService.ts'

export class MentalLLaMAAdapter {
  private modelProvider: IModelProvider | undefined
  private crisisNotifier: ICrisisNotificationHandler | undefined
  private taskRouter: IMentalHealthTaskRouter | undefined
  private evidenceService: EvidenceService
  private expertGuidanceOrchestrator: ExpertGuidanceOrchestrator

  // Preload CrisisSessionFlaggingService module (optional, handle missing module gracefully)
  // @ts-expect-error: Module may not exist in all environments
  private crisisSessionFlaggingServiceImport?: Promise<unknown>

  constructor(options: MentalLLaMAAdapterOptions) {
    this.modelProvider = options.modelProvider
    this.crisisNotifier = options.crisisNotifier
    this.taskRouter = options.taskRouter
    this.evidenceService = new EvidenceService(
      this.modelProvider as IModelProvider | undefined,
      {
        enableLLMEnhancement: !!this.modelProvider,
        enableCaching: true,
        enableMetrics: true,
      },
    )
    this.expertGuidanceOrchestrator = new ExpertGuidanceOrchestrator(
      this.evidenceService,
      this.modelProvider,
      this.crisisNotifier,
    )
    // Preload CrisisSessionFlaggingService module (optional, handle missing module gracefully)
    try {
      // @ts-expect-error: Module may not exist in all environments
      this.crisisSessionFlaggingServiceImport = import(
        '../../crisis/CrisisSessionFlaggingService.ts'
      )
    } catch {
      logger.warn(
        'CrisisSessionFlaggingService module not found, continuing without it.',
      )
    }
    logger.info('MentalLLaMAAdapter initialized.', {
      hasCrisisNotifier: !!this.crisisNotifier,
      hasTaskRouter: !!this.taskRouter,
      hasEvidenceService: true,
    })
    if (!this.taskRouter) {
      logger.warn(
        'MentalLLaMAAdapter initialized without a TaskRouter. Analysis will be limited.',
      )
    }
    if (!this.modelProvider) {
      logger.warn(
        'MentalLLaMAAdapter initialized without a ModelProvider. Analysis capabilities will be significantly limited.',
      )
    }
  }

  private async handleCrisis(
    text: string,
    analysisResult: MentalHealthAnalysisResult,
    routingContext?: RoutingContext,
  ): Promise<void> {
    if (!this.crisisNotifier) {
      return
    }
    const alertContext: CrisisContext = {
      ...(routingContext?.userId ? { userId: routingContext.userId } : {}),
      ...(routingContext?.sessionId
        ? { sessionId: routingContext.sessionId }
        : {}),
      textSample: text.slice(0, 200),
      timestamp: analysisResult.timestamp,
      decisionDetails: analysisResult._routingDecision || {},
      analysisResult,
      ...(routingContext?.sessionType
        ? { sessionType: routingContext.sessionType }
        : {}),
      ...(routingContext?.explicitTaskHint
        ? { explicitTaskHint: routingContext.explicitTaskHint }
        : {}),
    }
    try {
      await this.crisisNotifier.sendCrisisAlert(alertContext)
    } catch (err: unknown) {
      logger.error('Failed to send crisis alert', { error: err })
    }
  }

  public async analyzeMentalHealth(
    params: AnalyzeMentalHealthParams,
  ): Promise<MentalHealthAnalysisResult> {
    const { text, categories = 'auto_route', routingContext = {} } = params
    const timestamp = new Date().toISOString()
    const failures: AnalysisFailure[] = []

    const {
      effectiveCategories,
      analysisCategory,
      analysisConfidence,
      routingDecisionStore,
      crisisResult,
    } = await this.performRouting(
      text,
      categories,
      // Ensure RoutingContext properties are always strings (never null)
      {
        ...routingContext,
        userId: routingContext.userId ?? '',
        sessionId: routingContext.sessionId ?? '',
      },
      timestamp,
    )

    if (crisisResult) {
      return crisisResult
    }

    const {
      explanation,
      supportingEvidence: llmSupportingEvidence,
      category: llmCategory,
      confidence: llmConfidence,
      hasMentalHealthIssue,
      rawOutput,
      llmFailures,
    } = await this.performLLMAnalysis({
      text,
      effectiveCategories,
      analysisCategory,
      analysisConfidence,
      categories,
      routingDecisionStore,
      timestamp,
    })
    if (llmFailures?.length > 0) {
      failures.push(...llmFailures)
    }

    const { combinedEvidence, evidenceFailures } =
      await this.enhanceWithEvidence({
        text,
        category: llmCategory || analysisCategory,
        existingEvidence: llmSupportingEvidence,
        timestamp,
      })
    if (evidenceFailures?.length > 0) {
      failures.push(...evidenceFailures)
    }

    const finalResult: MentalHealthAnalysisResult = {
      hasMentalHealthIssue:
        hasMentalHealthIssue ??
        (llmCategory !== 'none' &&
          llmCategory !== 'wellness' &&
          llmCategory !== 'unknown'),
      mentalHealthCategory: llmCategory || analysisCategory,
      confidence: llmConfidence ?? analysisConfidence,
      explanation: explanation || 'Analysis incomplete.',
      supportingEvidence: (combinedEvidence as string[]) || [],
      isCrisis: (llmCategory || analysisCategory) === 'crisis',
      timestamp,
      ...(routingDecisionStore
        ? { _routingDecision: routingDecisionStore }
        : {}),
      _rawModelOutput: rawOutput as RawModelOutput,
    }
    if (failures.length > 0) {
      finalResult._failures = failures
    }
    if (finalResult.isCrisis && finalResult.confidence > 0.7) {
      logger.warn(
        `Crisis detected: ${finalResult.mentalHealthCategory} (confidence: ${finalResult.confidence})`,
      )
      const normalizedRoutingContext = {
        ...routingContext,
        userId: routingContext?.userId ?? '',
        sessionId: routingContext?.sessionId ?? '',
      }
      await this.handleCrisis(text, finalResult, normalizedRoutingContext)
    }
    logger.info('Mental health analysis complete.', {
      category: finalResult.mentalHealthCategory,
      confidence: finalResult.confidence,
    })
    return finalResult
  }

  // --- Extracted Methods ---

  private async performRouting(
    text: string,
    categories: string | string[],
    routingContext: RoutingContext,
    timestamp: string,
  ): Promise<{
    effectiveCategories: string[]
    analysisCategory: string
    analysisConfidence: number
    isCrisisFromRouting: boolean
    routingDecisionStore: RoutingDecision | null
    crisisResult?: MentalHealthAnalysisResult
  }> {
    let effectiveCategories: string[] = []
    let analysisCategory: string = 'none'
    let analysisConfidence: number = 0.0
    let routingDecisionStore: RoutingDecision | null = null
    // let isCrisisFromRouting = false // removed unused variable
    let crisisResult: MentalHealthAnalysisResult | undefined = undefined

    if (categories === 'auto_route') {
      if (!this.taskRouter) {
        crisisResult = {
          hasMentalHealthIssue: false,
          mentalHealthCategory: 'unknown',
          confidence: 0,
          explanation: 'TaskRouter unavailable for auto_route',
          isCrisis: false,
          timestamp,
          _failures: [
            {
              type: 'general',
              message: 'TaskRouter unavailable for auto_route',
              timestamp,
            },
          ],
        }
        return {
          effectiveCategories,
          analysisCategory,
          analysisConfidence,
          isCrisisFromRouting: false,
          routingDecisionStore,
          crisisResult,
        }
      }
      const sanitizedContext = {
        ...routingContext,
        userId: routingContext.userId ?? '',
        sessionId: routingContext.sessionId ?? '',
      }
      const routingInput = { text, context: sanitizedContext }
      const route = await this.taskRouter.route(routingInput)
      routingDecisionStore = route
      analysisCategory = route.targetAnalyzer
      analysisConfidence = route.confidence
      if (route.isCritical || analysisCategory === 'crisis') {
        crisisResult = {
          hasMentalHealthIssue: true,
          mentalHealthCategory: 'crisis',
          confidence: route.confidence,
          explanation:
            (route.insights?.llmReasoning as string) ||
            'Crisis detected by routing rules or preliminary analysis.',
          supportingEvidence: route.insights?.matchedKeyword
            ? [route.insights.matchedKeyword]
            : [],
          isCrisis: true,
          timestamp,
          _routingDecision: route,
        }
        // Normalize userId and sessionId to always be strings for type safety
        const normalizedRoutingContext = {
          ...routingContext,
          userId: routingContext?.userId ?? '',
          sessionId: routingContext?.sessionId ?? '',
        }
        await this.handleCrisis(text, crisisResult, normalizedRoutingContext)
        return {
          effectiveCategories,
          analysisCategory,
          analysisConfidence,
          isCrisisFromRouting: true,
          routingDecisionStore: route,
          crisisResult,
        }
      }
      if (
        !route.isCritical &&
        route.confidence < ROUTER_LOW_CONFIDENCE_THRESHOLD
      ) {
        logger.warn(
          `Router confidence is low (${route.confidence} for ${route.targetAnalyzer}). Defaulting to general_mental_health for LLM analysis.`,
        )
        effectiveCategories = ['general_mental_health']
      } else {
        effectiveCategories = [route.targetAnalyzer]
      }
    } else {
      effectiveCategories = Array.isArray(categories)
        ? categories
        : [categories]
      analysisCategory = effectiveCategories.join(', ')
      analysisConfidence = 0.9
      logger.info(`Explicit categories provided: ${analysisCategory}`)
    }
    return {
      effectiveCategories,
      analysisCategory,
      analysisConfidence,
      isCrisisFromRouting: false,
      routingDecisionStore,
    }
  }

  private async performLLMAnalysis({
    text,
    effectiveCategories,
    analysisCategory,
    analysisConfidence,
    categories,
    routingDecisionStore,
    timestamp,
  }: {
    text: string
    effectiveCategories: string[]
    analysisCategory: string
    analysisConfidence: number
    categories: string | string[]
    routingDecisionStore: RoutingDecision | null
    timestamp: string
  }): Promise<{
    explanation: string
    supportingEvidence: unknown[]
    category: string
    confidence: number
    hasMentalHealthIssue: boolean
    rawOutput: unknown
    llmFailures: AnalysisFailure[]
  }> {
    let categoryForPrompt = effectiveCategories[0] || 'general_mental_health'
    if (categoryForPrompt === 'unknown' || categoryForPrompt === 'none') {
      categoryForPrompt = 'general_mental_health'
    }
    let promptBuilder =
      ((specializedPrompts as Record<string, unknown>)[
        categoryForPrompt
      ] as (params: { text: string; categoryHint: string }) => Message[]) ||
      buildGeneralAnalysisPrompt
    let llmMessages: Message[] = promptBuilder({
      text,
      categoryHint: categoryForPrompt,
    })
    let llmAnalysisResult: Partial<MentalHealthAnalysisResult> = {
      explanation: 'LLM analysis could not be completed.',
      confidence: 0.1,
      mentalHealthCategory: 'unknown',
      supportingEvidence: [],
    }
    const llmFailures: AnalysisFailure[] = []

    if (!this.modelProvider) {
      llmFailures.push({
        type: 'general',
        message: 'ModelProvider unavailable for detailed analysis',
        timestamp,
      })
      return {
        explanation: 'ModelProvider unavailable for detailed analysis',
        supportingEvidence: [],
        category: analysisCategory,
        confidence: analysisConfidence,
        hasMentalHealthIssue: false,
        rawOutput:
          llmAnalysisResult as unknown as import('../types/mentalLLaMATypes.js').RawModelOutput,
        llmFailures,
      }
    }

    try {
      const llmResponseRaw = await this.modelProvider.invoke(llmMessages, {
        temperature: 0.3,
        max_tokens: 500,
      })
      try {
        const parsedLlmResponse = JSON.parse(llmResponseRaw.content) as unknown
        llmAnalysisResult.mentalHealthCategory =
          parsedLlmResponse.mentalHealthCategory || categoryForPrompt
        llmAnalysisResult.confidence =
          parseFloat(parsedLlmResponse.confidence) || analysisConfidence
        llmAnalysisResult.explanation =
          parsedLlmResponse.explanation || 'No explanation provided by LLM.'
        llmAnalysisResult.supportingEvidence =
          parsedLlmResponse.supportingEvidence || []
        llmAnalysisResult.hasMentalHealthIssue =
          llmAnalysisResult.mentalHealthCategory !== 'none' &&
          llmAnalysisResult.mentalHealthCategory !== 'wellness' &&
          llmAnalysisResult.mentalHealthCategory !== 'unknown'
        if (categories === 'auto_route' && routingDecisionStore) {
          if (
            parsedLlmResponse.mentalHealthCategory &&
            parsedLlmResponse.mentalHealthCategory !==
              routingDecisionStore.targetAnalyzer &&
            parsedLlmResponse.confidence > routingDecisionStore.confidence
          ) {
            logger.info(
              `LLM analysis refined category from ${routingDecisionStore.targetAnalyzer} to ${parsedLlmResponse.mentalHealthCategory}`,
            )
            llmAnalysisResult.mentalHealthCategory =
              parsedLlmResponse.mentalHealthCategory
          }
          llmAnalysisResult.confidence = Math.max(
            analysisConfidence,
            parsedLlmResponse.confidence,
          )
        } else if (parsedLlmResponse.mentalHealthCategory) {
          llmAnalysisResult.mentalHealthCategory =
            parsedLlmResponse.mentalHealthCategory
          llmAnalysisResult.confidence = parsedLlmResponse.confidence
        }
      } catch (parseError) {
        logger.error('Failed to parse LLM JSON response for analysis', {
          rawResponse: llmResponseRaw,
          error: parseError,
        })
        llmAnalysisResult.explanation = `LLM provided a non-JSON response: ${llmResponseRaw.content}`
        llmAnalysisResult.mentalHealthCategory = analysisCategory
        llmAnalysisResult.confidence = analysisConfidence * 0.5
        llmAnalysisResult.hasMentalHealthIssue =
          analysisCategory !== 'none' &&
          analysisCategory !== 'wellness' &&
          analysisCategory !== 'unknown'
        llmFailures.push({
          type: 'model_analysis',
          message: 'Failed to parse LLM JSON response',
          timestamp,
          error: parseError,
        })
      }
    } catch (llmError) {
      logger.error('Error during LLM call for analysis', { error: llmError })
      llmAnalysisResult.explanation = `Error during LLM analysis: ${llmError instanceof Error ? llmError.message : String(llmError)}`
      llmAnalysisResult.mentalHealthCategory = analysisCategory
      llmAnalysisResult.confidence = analysisConfidence * 0.3
      llmAnalysisResult.hasMentalHealthIssue =
        analysisCategory !== 'none' &&
        analysisCategory !== 'wellness' &&
        analysisCategory !== 'unknown'
      llmFailures.push({
        type: 'model_analysis',
        message: 'Error during LLM analysis',
        timestamp,
        error: llmError,
      })
    }
    return {
      explanation: llmAnalysisResult.explanation || '',
      supportingEvidence: llmAnalysisResult.supportingEvidence || [],
      category: llmAnalysisResult.mentalHealthCategory || analysisCategory,
      confidence: llmAnalysisResult.confidence ?? analysisConfidence,
      hasMentalHealthIssue:
        llmAnalysisResult.hasMentalHealthIssue ??
        (analysisCategory !== 'none' &&
          analysisCategory !== 'wellness' &&
          analysisCategory !== 'unknown'),
      rawOutput:
        llmAnalysisResult as unknown as import('../types/mentalLLaMATypes.js').RawModelOutput,
      llmFailures,
    }
  }

  private async enhanceWithEvidence({
    text,
    category,
    existingEvidence,
    timestamp,
  }: {
    text: string
    category: string
    existingEvidence: unknown[]
    timestamp: string
  }): Promise<{
    combinedEvidence: unknown[]
    evidenceFailures: AnalysisFailure[]
  }> {
    const evidenceFailures: AnalysisFailure[] = []
    let combinedEvidence = existingEvidence || []
    try {
      const evidence = await this.evidenceService.extractSupportingEvidence(
        text,
        category,
      )
      if (evidence && evidence.evidenceItems) {
        combinedEvidence = [...combinedEvidence, ...evidence.evidenceItems]
      }
    } catch (evidenceError) {
      logger.error('Evidence extraction failed', { error: evidenceError })
      evidenceFailures.push({
        type: 'general',
        message: 'Evidence extraction failed',
        timestamp,
        error: evidenceError,
      })
    }
    return { combinedEvidence, evidenceFailures }
  }

  public async analyzeMentalHealthWithExpertGuidance(
    text: string,
    fetchExpertGuidance: boolean = true,
    routingContextParams?: RoutingContext,
  ): Promise<ExpertGuidedAnalysisResult> {
    const baseAnalysis = await this.analyzeMentalHealth({
      text,
      routingContext: routingContextParams,
    })
    try {
      return await this.expertGuidanceOrchestrator.analyzeWithExpertGuidance(
        text,
        baseAnalysis,
        fetchExpertGuidance,
        routingContextParams,
      )
    } catch (err: unknown) {
      logger.error('Expert guidance orchestration failed', { error: err })
      return {
        ...baseAnalysis,
        expertGuided: false,
        explanation: `Expert guidance unavailable due to system error: ${(err as Error).message}. Base fallback explanation: ${baseAnalysis.explanation}`,
        _failures: [
          ...(baseAnalysis._failures || []),
          {
            type: 'general', // expert guidance orchestration errors are categorized as 'general'
            message: 'Expert guidance orchestration failed',
            error: err,
            timestamp: new Date().toISOString(),
          },
        ],
      }
    }
  }

  public async evaluateExplanationQuality(
    explanation: string,
    textContext?: string,
  ): Promise<ExplanationQualityMetrics> {
    if (!this.modelProvider) {
      return {
        fluency: 0.1,
        completeness: 0.1,
        reliability: 0.1,
        overall: 0.1,
        assessment: 'ModelProvider not configured',
      }
    }
    const messages: Message[] = [
      {
        role: 'system',
        content:
          'You are an expert system that evaluates the quality of explanations for mental health analyses. Rate the following explanation for fluency, completeness, reliability, and overall quality (0.0-1.0).',
      },
      {
        role: 'user',
        content: `Explanation: ${explanation}\n${textContext ? `Context: ${textContext}` : ''}\nPlease provide a JSON object with fields: fluency, completeness, reliability, overall, assessment (string).`,
      },
    ]
    try {
      const response = await this.modelProvider.invoke(messages, {
        temperature: 0.2,
        max_tokens: 200,
      })
      const parsed = JSON.parse(response.content) as unknown
      return {
        fluency: parsed.fluency,
        completeness: parsed.completeness,
        reliability: parsed.reliability,
        overall: parsed.overall,
        assessment: parsed.assessment,
      }
    } catch (err: unknown) {
      logger.error('Failed to evaluate explanation quality', { error: err })
      return {
        fluency: 0.1,
        completeness: 0.1,
        reliability: 0.1,
        overall: 0.1,
        assessment: 'Failed to evaluate explanation quality',
      }
    }
  }

  // EvidenceService wrapper methods for advanced use/testing
  public async extractDetailedEvidence(text: string, category: string) {
    return this.evidenceService.extractSupportingEvidence(text, category)
  }
  public getEvidenceMetrics() {
    return this.evidenceService.getMetrics()
  }
  public clearEvidenceCache() {
    return this.evidenceService.clearCache()
  }
}
