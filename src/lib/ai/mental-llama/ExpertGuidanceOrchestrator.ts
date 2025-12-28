import { getClinicalAnalysisLogger } from '@/lib/logging/standardized-logger.ts'
import { EvidenceService } from './evidence/EvidenceService.ts'
import { ClinicalKnowledgeBase } from './ClinicalKnowledgeBase.ts'
import { ClinicalAnalysisHelpers } from './ClinicalAnalysisHelpers.ts'
import type {
  MentalHealthAnalysisResult,
  ExpertGuidedAnalysisResult,
  ExpertGuidance,
  RoutingContext,
  CrisisContext,
  ICrisisNotificationHandler,
  IModelProvider,
} from './types/mentalLLaMATypes.ts'

const logger = getClinicalAnalysisLogger('general')

/**
 * Expert Guidance Orchestrator coordinates the expert-guided analysis process,
 * integrating clinical knowledge, analysis helpers, and evidence services.
 */
export class ExpertGuidanceOrchestrator {
  private clinicalKnowledgeBase: ClinicalKnowledgeBase
  private clinicalAnalysisHelpers: ClinicalAnalysisHelpers

  constructor(
    private evidenceService: EvidenceService,
    private modelProvider?: IModelProvider,
    private crisisNotifier?: ICrisisNotificationHandler,
  ) {
    this.clinicalKnowledgeBase = new ClinicalKnowledgeBase()
    this.clinicalAnalysisHelpers = new ClinicalAnalysisHelpers(
      this.modelProvider,
    )
  }

  /**
   * Orchestrates the complete expert-guided analysis process.
   */
  public async analyzeWithExpertGuidance(
    text: string,
    baseAnalysis: MentalHealthAnalysisResult,
    fetchExpertGuidance: boolean = true,
    routingContextParams?: Partial<RoutingContext>,
  ): Promise<ExpertGuidedAnalysisResult> {
    const analysisTimestamp = new Date().toISOString()

    try {
      // Step 1: Fetch expert guidance if requested and available
      let expertGuidance: ExpertGuidance | undefined
      if (fetchExpertGuidance) {
        expertGuidance = await this.clinicalKnowledgeBase.fetchExpertGuidance(
          baseAnalysis.mentalHealthCategory,
          text,
          baseAnalysis,
        )
      }

      // Step 2: Generate expert-guided analysis using LLM with clinical prompts
      const expertGuidedAnalysis =
        await this.clinicalAnalysisHelpers.generateExpertGuidedAnalysis(
          text,
          baseAnalysis,
          expertGuidance,
        )

      // Step 3: Perform comprehensive risk assessment
      const riskAssessment =
        await this.clinicalAnalysisHelpers.performRiskAssessment(
          text,
          baseAnalysis,
          expertGuidance,
        )

      // Step 4: Generate clinical recommendations
      const clinicalRecommendations =
        await this.clinicalAnalysisHelpers.generateClinicalRecommendations(
          baseAnalysis,
          expertGuidance,
          riskAssessment,
        )

      // Step 5: Calculate quality metrics
      const qualityMetrics =
        this.clinicalAnalysisHelpers.calculateQualityMetrics(
          expertGuidedAnalysis,
          expertGuidance,
          baseAnalysis,
        )

      // Step 6: Update routing decision insights
      const updatedRoutingDecision = baseAnalysis._routingDecision
        ? {
            ...baseAnalysis._routingDecision,
            insights: {
              ...baseAnalysis._routingDecision.insights,
              expertGuidanceApplied: true,
              expertGuidanceSource: fetchExpertGuidance
                ? 'clinical_knowledge_base'
                : 'llm_only',
              clinicalEnhancement: true,
            },
          }
        : undefined

      // Step 7: Extract comprehensive evidence for expert-guided analysis
      let enhancedEvidence: string[] = baseAnalysis.supportingEvidence || []
      try {
        const enhancedContext = {
          ...routingContextParams,
          explicitTaskHint:
            routingContextParams?.explicitTaskHint || 'expert_guided_analysis',
        }

        const evidenceResult =
          await this.evidenceService.extractSupportingEvidence(
            text,
            baseAnalysis.mentalHealthCategory,
            baseAnalysis,
            enhancedContext,
          )

        // Prioritize high-quality evidence
        const prioritizedEvidence = evidenceResult.evidenceItems.slice(0, 10)
        enhancedEvidence = prioritizedEvidence

        logger.info('Expert-guided evidence extraction completed', {
          originalCount: baseAnalysis.supportingEvidence?.length || 0,
          enhancedCount: enhancedEvidence.length,
          evidenceStrength: evidenceResult.processingMetadata.evidenceStrength,
          category: baseAnalysis.mentalHealthCategory,
        })
      } catch (evidenceError) {
        logger.error('Expert-guided evidence extraction failed', {
          error: evidenceError,
          category: baseAnalysis.mentalHealthCategory,
        })
        // Use original evidence if extraction fails
      }

      // Step 8: Construct final expert-guided result
      const result: ExpertGuidedAnalysisResult = {
        ...baseAnalysis,
        expertGuided: true,
        explanation: expertGuidedAnalysis.explanation,
        confidence: expertGuidedAnalysis.confidence,
        supportingEvidence: enhancedEvidence,
        ...(expertGuidance && { expertGuidance }),
        clinicalRecommendations,
        riskAssessment,
        qualityMetrics,
        ...(updatedRoutingDecision && {
          _routingDecision: updatedRoutingDecision,
        }),
        timestamp: analysisTimestamp,
      }

      // Step 9: Handle crisis scenarios with expert guidance and enhanced evidence
      if (result.isCrisis && expertGuidance) {
        await this.handleCrisisWithExpertGuidance(result, routingContextParams)

        // Extract crisis-specific evidence for enhanced crisis handling
        try {
          const crisisEvidence =
            await this.evidenceService.extractCrisisEvidence(text, result)

          // Add crisis evidence to the crisis context for better crisis response
          if (crisisEvidence.immediateRiskIndicators.length > 0) {
            logger.warn('Immediate risk indicators identified', {
              count: crisisEvidence.immediateRiskIndicators.length,
              indicators: crisisEvidence.immediateRiskIndicators,
              userId: routingContextParams?.userId,
            })
          }
        } catch (crisisEvidenceError) {
          logger.error('Crisis evidence extraction failed', {
            error: crisisEvidenceError,
            userId: routingContextParams?.userId,
          })
        }
      }

      logger.info('Expert-guided analysis completed successfully', {
        userId: routingContextParams?.userId,
        category: result.mentalHealthCategory,
        expertGuided: result.expertGuided,
        overallRisk: result.riskAssessment?.overallRisk,
        recommendationCount: result.clinicalRecommendations?.length || 0,
      })

      return result
    } catch (error: unknown) {
      logger.error('Error in expert-guided analysis orchestration', {
        error,
        userId: routingContextParams?.userId,
      })
      throw error // Re-throw for handling by caller
    }
  }

  /**
   * Handles crisis scenarios with expert guidance.
   */
  private async handleCrisisWithExpertGuidance(
    result: ExpertGuidedAnalysisResult,
    routingContextParams?: Partial<RoutingContext>,
  ): Promise<void> {
    logger.warn('Handling crisis with expert guidance', {
      userId: routingContextParams?.userId,
      overallRisk: result.riskAssessment?.overallRisk,
    })

    // Enhanced crisis context with expert guidance
    if (this.crisisNotifier) {
      const enhancedCrisisContext: CrisisContext = {
        ...(routingContextParams?.userId && {
          userId: routingContextParams.userId,
        }),
        ...(routingContextParams?.sessionId && {
          sessionId: routingContextParams.sessionId,
        }),
        ...(routingContextParams?.sessionType && {
          sessionType: routingContextParams.sessionType,
        }),
        ...(routingContextParams?.explicitTaskHint && {
          explicitTaskHint: routingContextParams.explicitTaskHint,
        }),
        textSample:
          result.supportingEvidence?.join(' | ') || 'No evidence available',
        timestamp: result.timestamp,
        decisionDetails: result._routingDecision || {},
        analysisResult: {
          ...result,
          explanation: `[EXPERT-GUIDED] ${result.explanation}`,
        },
      }

      try {
        await this.crisisNotifier.sendCrisisAlert(enhancedCrisisContext)
        logger.info('Enhanced crisis alert sent successfully')
      } catch (error: unknown) {
        logger.error('Failed to send enhanced crisis alert', { error })
      }
    }
  }
}
