import { getClinicalAnalysisLogger } from '@/lib/logging/standardized-logger'
import type {
  MentalHealthAnalysisResult,
  ExpertGuidance,
} from './types/mentalLLaMATypes'

const logger = getClinicalAnalysisLogger('knowledge-base')

/**
 * Clinical Knowledge Base provides evidence-based clinical guidelines,
 * risk assessment, and intervention suggestions for mental health analysis.
 */
export class ClinicalKnowledgeBase {
  /**
   * Gets clinical guidelines for a specific mental health category.
   */
  public getClinicalGuidelines(category: string): void {
    const guidelinesMap: Record<
      string,
      Array<{
        category: string
        rule: string
        priority: 'high' | 'medium' | 'low'
        source: string
      }>
    > = {
      crisis: [
        {
          category: 'crisis',
          rule: 'Immediate safety assessment and intervention required',
          priority: 'high',
          source: 'crisis_intervention_protocols',
        },
        {
          category: 'crisis',
          rule: 'Contact emergency services if imminent danger present',
          priority: 'high',
          source: 'emergency_protocols',
        },
      ],
      depression: [
        {
          category: 'depression',
          rule: 'Assess for suicidal ideation using standardized screening tools',
          priority: 'high',
          source: 'DSM-5',
        },
        {
          category: 'depression',
          rule: 'Consider severity level for treatment planning',
          priority: 'medium',
          source: 'clinical_guidelines',
        },
      ],
      anxiety: [
        {
          category: 'anxiety',
          rule: 'Differentiate between anxiety disorders and normal stress responses',
          priority: 'medium',
          source: 'DSM-5',
        },
        {
          category: 'anxiety',
          rule: 'Assess functional impairment and duration of symptoms',
          priority: 'medium',
          source: 'clinical_guidelines',
        },
      ],
      general_mental_health: [
        {
          category: 'general',
          rule: 'Conduct comprehensive mental status examination',
          priority: 'medium',
          source: 'clinical_guidelines',
        },
      ],
    }

    return guidelinesMap[category] || guidelinesMap['general_mental_health']
  }

  /**
   * Assesses risk factors based on text content, category, and base analysis.
   */
  public assessRiskFactors(
    text: string,
    category: string,
    baseAnalysis: MentalHealthAnalysisResult,
  ) {
    const riskFactors: Array<{
      factor: string
      severity: 'critical' | 'high' | 'moderate' | 'low'
      description: string
    }> = []

    // Crisis-specific risk factors
    if (baseAnalysis.isCrisis) {
      riskFactors.push({
        factor: 'Crisis indicators present',
        severity: 'critical',
        description: 'Text contains indicators suggesting immediate risk',
      })
    }

    // Category-specific risk keywords
    const categoryRiskKeywords: Record<
      string,
      {
        critical: string[]
        high: string[]
        moderate: string[]
        low: string[]
      }
    > = {
      depression: {
        critical: [
          'suicide',
          'kill myself',
          'end it all',
          'no point living',
          'better off dead',
        ],
        high: ['hopeless', 'worthless', 'burden', 'trapped', 'empty', 'numb'],
        moderate: ['sad', 'down', 'depressed', 'lonely', 'tired'],
        low: ['blue', 'upset', 'disappointed'],
      },
      anxiety: {
        critical: [
          'panic attack',
          "can't breathe",
          'heart racing',
          'going to die',
        ],
        high: ['terrified', 'paralyzed', 'overwhelming fear', 'constant worry'],
        moderate: ['anxious', 'worried', 'nervous', 'stressed', 'uneasy'],
        low: ['concerned', 'apprehensive', 'tense'],
      },
      crisis: {
        critical: [
          'suicide',
          'kill myself',
          'end it all',
          'hurt myself',
          'weapon',
        ],
        high: ['hopeless', 'trapped', 'no way out', 'burden'],
        moderate: ['desperate', 'overwhelmed', "can't cope"],
        low: ['struggling', 'difficult'],
      },
      general_mental_health: {
        critical: ['suicide', 'kill myself', 'end it all', 'no point living'],
        high: ['hopeless', 'worthless', 'burden', 'trapped'],
        moderate: ['sad', 'anxious', 'worried', 'stressed'],
        low: ['upset', 'concerned'],
      },
    }

    // Use category-specific keywords or fall back to general
    const defaultKeywords = {
      critical: ['suicide', 'kill myself', 'end it all', 'no point living'],
      high: ['hopeless', 'worthless', 'burden', 'trapped'],
      moderate: ['sad', 'anxious', 'worried', 'stressed'],
      low: ['upset', 'concerned'],
    }
    const riskKeywords = categoryRiskKeywords[category] ?? defaultKeywords

    // Type-safe iteration over risk keywords
    Object.entries(riskKeywords).forEach(([severity, keywords]) => {
      const matchedKeywords = keywords.filter((keyword) =>
        text.toLowerCase().includes(keyword.toLowerCase()),
      )

      if (matchedKeywords.length > 0) {
        riskFactors.push({
          factor: `${category} indicators: ${matchedKeywords.join(', ')}`,
          severity: severity as 'critical' | 'high' | 'moderate' | 'low',
          description: `Text contains ${severity} risk language patterns specific to ${category}`,
        })
      }
    })

    // Category-specific contextual risk assessment
    this.addCategorySpecificRiskFactors(text, category, riskFactors)

    return riskFactors
  }

  /**
   * Adds category-specific risk factors based on contextual analysis.
   */
  private addCategorySpecificRiskFactors(
    text: string,
    category: string,
    riskFactors: Array<{
      factor: string
      severity: 'critical' | 'high' | 'moderate' | 'low'
      description: string
    }>,
  ) {
    const lowerText = text.toLowerCase()

    switch (category) {
      case 'depression':
        if (
          lowerText.includes('sleep') &&
          (lowerText.includes("can't") || lowerText.includes('trouble'))
        ) {
          riskFactors.push({
            factor: 'Sleep disturbance indicators',
            severity: 'moderate',
            description: 'Sleep disruption is a common symptom of depression',
          })
        }
        if (lowerText.includes('appetite') || lowerText.includes('eating')) {
          riskFactors.push({
            factor: 'Appetite/eating changes',
            severity: 'moderate',
            description:
              'Changes in eating patterns may indicate depression severity',
          })
        }
        break

      case 'anxiety':
        if (
          lowerText.includes('physical') &&
          (lowerText.includes('symptom') || lowerText.includes('racing'))
        ) {
          riskFactors.push({
            factor: 'Physical anxiety symptoms',
            severity: 'high',
            description:
              'Physical manifestations suggest significant anxiety levels',
          })
        }
        if (lowerText.includes('avoid') || lowerText.includes('avoidance')) {
          riskFactors.push({
            factor: 'Avoidance behaviors',
            severity: 'moderate',
            description: 'Avoidance patterns indicate functional impairment',
          })
        }
        break

      case 'crisis':
        if (
          lowerText.includes('plan') &&
          (lowerText.includes('hurt') || lowerText.includes('end'))
        ) {
          riskFactors.push({
            factor: 'Potential planning indicators',
            severity: 'critical',
            description:
              'References to planning self-harm require immediate attention',
          })
        }
        if (lowerText.includes('alone') || lowerText.includes('isolated')) {
          riskFactors.push({
            factor: 'Social isolation',
            severity: 'high',
            description:
              'Isolation increases crisis risk and reduces protective factors',
          })
        }
        break
    }
  }

  /**
   * Gets intervention suggestions based on category and base analysis.
   */
  public getInterventionSuggestions(
    category: string,
    baseAnalysis: MentalHealthAnalysisResult,
  ) {
    const interventions: Array<{
      intervention: string
      urgency: 'immediate' | 'urgent' | 'routine'
      rationale: string
    }> = []

    if (baseAnalysis.isCrisis) {
      interventions.push({
        intervention: 'Crisis intervention and safety planning',
        urgency: 'immediate',
        rationale:
          'Crisis indicators require immediate professional intervention',
      })
    }

    const categoryInterventions: Record<
      string,
      Array<{
        intervention: string
        urgency: 'immediate' | 'urgent' | 'routine'
        rationale: string
      }>
    > = {
      depression: [
        {
          intervention: 'Comprehensive depression screening and assessment',
          urgency: 'urgent',
          rationale: 'Early identification and treatment improve outcomes',
        },
        {
          intervention: 'Consider evidence-based psychotherapy (CBT, IPT)',
          urgency: 'routine',
          rationale:
            'Psychotherapy is first-line treatment for mild to moderate depression',
        },
      ],
      anxiety: [
        {
          intervention: 'Anxiety disorder screening and differential diagnosis',
          urgency: 'urgent',
          rationale: 'Proper diagnosis guides appropriate treatment selection',
        },
        {
          intervention: 'Relaxation techniques and coping strategies',
          urgency: 'routine',
          rationale: 'Self-management techniques can provide immediate relief',
        },
      ],
    }

    return interventions.concat(categoryInterventions[category] || [])
  }

  /**
   * Gets clinical context for a specific category.
   */
  public getClinicalContext(
    category: string,
    baseAnalysis: MentalHealthAnalysisResult,
  ) {
    const contextMap: Record<
      string,
      {
        relevantDiagnoses?: string[]
        contraindications?: string[]
        specialConsiderations?: string[]
      }
    > = {
      crisis: {
        relevantDiagnoses: [
          'Major Depressive Disorder',
          'Bipolar Disorder',
          'Substance Use Disorder',
        ],
        contraindications: [
          'Immediate safety concerns override standard protocols',
        ],
        specialConsiderations: [
          'Legal and ethical obligations for duty to warn/protect',
        ],
      },
      depression: {
        relevantDiagnoses: [
          'Major Depressive Disorder',
          'Persistent Depressive Disorder',
          'Bipolar Disorder',
        ],
        contraindications: ['Active psychosis', 'Severe cognitive impairment'],
        specialConsiderations: [
          'Assess for bipolar disorder before treatment',
          'Monitor for suicidal ideation',
        ],
      },
      anxiety: {
        relevantDiagnoses: [
          'Generalized Anxiety Disorder',
          'Panic Disorder',
          'Social Anxiety Disorder',
        ],
        contraindications: [
          'Substance-induced anxiety',
          'Medical conditions causing anxiety',
        ],
        specialConsiderations: [
          'Rule out medical causes',
          'Assess functional impairment',
        ],
      },
    }

    // Get base context for the category
    const baseContext = contextMap[category] || {}

    // Enhance context based on analysis results
    return this.enhanceContextWithAnalysis(baseContext, baseAnalysis, category)
  }

  /**
   * Enhances clinical context based on analysis results and confidence.
   */
  private enhanceContextWithAnalysis(
    baseContext: {
      relevantDiagnoses?: string[]
      contraindications?: string[]
      specialConsiderations?: string[]
    },
    baseAnalysis: MentalHealthAnalysisResult,
    category: string,
  ) {
    const enhancedContext = {
      relevantDiagnoses: [...(baseContext.relevantDiagnoses || [])],
      contraindications: [...(baseContext.contraindications || [])],
      specialConsiderations: [...(baseContext.specialConsiderations || [])],
    }

    // Crisis-specific enhancements
    if (baseAnalysis.isCrisis) {
      enhancedContext.specialConsiderations.push(
        'Immediate crisis intervention protocols in effect',
        'Document all safety planning interventions',
        'Consider involuntary commitment criteria if applicable',
      )

      if (category === 'depression') {
        enhancedContext.relevantDiagnoses.push(
          'Major Depressive Disorder with Suicidal Ideation',
        )
        enhancedContext.contraindications.push(
          'Delay in crisis intervention contraindicated',
        )
      }
    }

    // Confidence-based context adjustments
    if (baseAnalysis.confidence < 0.7) {
      enhancedContext.specialConsiderations.push(
        'Low analysis confidence - consider additional assessment tools',
        'Recommend clinical interview for comprehensive evaluation',
      )
    } else if (baseAnalysis.confidence > 0.9) {
      enhancedContext.specialConsiderations.push(
        'High confidence in analysis - prioritize evidence-based interventions',
        'Consider immediate implementation of recommended protocols',
      )
    }

    // Mental health issue presence enhancements
    if (baseAnalysis.hasMentalHealthIssue) {
      enhancedContext.specialConsiderations.push(
        'Mental health concerns identified - comprehensive assessment recommended',
        'Monitor for symptom progression and functional impact',
      )
    }

    // Category-specific analysis enhancements
    this.addCategorySpecificContextEnhancements(
      enhancedContext,
      baseAnalysis,
      category,
    )

    return enhancedContext
  }

  /**
   * Adds category-specific context enhancements based on analysis results.
   */
  private addCategorySpecificContextEnhancements(
    context: {
      relevantDiagnoses: string[]
      contraindications: string[]
      specialConsiderations: string[]
    },
    baseAnalysis: MentalHealthAnalysisResult,
    category: string,
  ) {
    switch (category) {
      case 'depression':
        if (baseAnalysis.confidence > 0.8) {
          context.specialConsiderations.push(
            'High confidence in depression indicators - prioritize evidence-based treatments',
            'Consider standardized depression rating scales for monitoring',
          )
        }

        if (baseAnalysis.hasMentalHealthIssue) {
          context.relevantDiagnoses.push(
            'Depressive Disorder - Further Assessment Needed',
          )
          context.specialConsiderations.push(
            'Screen for psychotic features',
            'Assess medication adherence if applicable',
          )
        }
        break

      case 'anxiety':
        if (
          baseAnalysis.confidence > 0.8 &&
          baseAnalysis.hasMentalHealthIssue
        ) {
          context.relevantDiagnoses.push(
            'Anxiety Disorder with Significant Distress',
          )
          context.specialConsiderations.push(
            'Assess for panic disorder and agoraphobia',
            'Consider comorbid depression screening',
          )
        }

        context.contraindications.push(
          'Avoid benzodiazepines for long-term treatment',
        )
        break

      case 'crisis':
        context.specialConsiderations.push(
          'Activate crisis response protocols immediately',
          'Ensure continuous monitoring until safety established',
          'Document all intervention attempts and outcomes',
        )

        if (baseAnalysis.confidence > 0.9) {
          context.specialConsiderations.push(
            'High confidence crisis detection - immediate professional intervention required',
          )
        }
        break

      default:
        if (
          baseAnalysis.hasMentalHealthIssue &&
          baseAnalysis.confidence > 0.7
        ) {
          context.specialConsiderations.push(
            'Mental health concerns detected - refer for comprehensive assessment',
            'Consider category-specific screening tools',
          )
        }
        break
    }
  }

  /**
   * Gets evidence base for recommendations based on category.
   */
  public getEvidenceBase(category: string): void {
    const evidenceMap: Record<
      string,
      Array<{
        source: string
        reliability: 'high' | 'medium' | 'low'
        summary: string
      }>
    > = {
      crisis: [
        {
          source: 'Crisis Intervention Guidelines (APA)',
          reliability: 'high',
          summary: 'Immediate intervention protocols for crisis situations',
        },
      ],
      depression: [
        {
          source: 'APA Practice Guidelines for Depression',
          reliability: 'high',
          summary: 'Evidence-based treatment recommendations for depression',
        },
        {
          source: 'Cochrane Reviews on Depression Treatment',
          reliability: 'high',
          summary: 'Systematic reviews of depression treatment efficacy',
        },
      ],
      anxiety: [
        {
          source: 'APA Practice Guidelines for Anxiety Disorders',
          reliability: 'high',
          summary:
            'Evidence-based treatment recommendations for anxiety disorders',
        },
      ],
    }

    return evidenceMap[category] || []
  }

  /**
   * Fetches comprehensive expert guidance for a given category and analysis.
   */
  public async fetchExpertGuidance(
    category: string,
    text: string,
    baseAnalysis: MentalHealthAnalysisResult,
  ): Promise<ExpertGuidance> {
    logger.info('Fetching expert guidance', { category })

    try {
      // Clinical guidelines database (in production, this would be a real knowledge base)
      const clinicalGuidelines = this.getClinicalGuidelines(category)

      // Risk factors assessment
      const riskFactors = this.assessRiskFactors(text, category, baseAnalysis)

      // Intervention suggestions based on category and severity
      const interventionSuggestions = this.getInterventionSuggestions(
        category,
        baseAnalysis,
      )

      // Clinical context and considerations
      const clinicalContext = this.getClinicalContext(category, baseAnalysis)

      // Evidence base for recommendations
      const evidenceBase = this.getEvidenceBase(category)

      return {
        guidelines: clinicalGuidelines || [],
        riskFactors,
        interventionSuggestions,
        clinicalContext,
        evidenceBase,
      }
    } catch (error: unknown) {
      logger.error('Error fetching expert guidance', { error, category })

      // Return minimal guidance on error
      return {
        guidelines: [
          {
            category: 'general',
            rule: 'Follow standard clinical assessment protocols',
            priority: 'medium',
            source: 'fallback_guidance',
          },
        ],
        riskFactors: [],
        interventionSuggestions: [],
        clinicalContext: {},
        evidenceBase: [],
      }
    }
  }
}
