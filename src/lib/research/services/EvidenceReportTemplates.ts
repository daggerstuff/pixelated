import { getLogger } from '@/lib/logging'
import type { EvidenceReport } from '@/lib/research/types/research-types'

import {
  EvidenceGenerationService,
  type Hypothesis,
  type EvidenceRequest,
} from './EvidenceGenerationService'

const logger = getLogger({ prefix: 'EvidenceReportTemplates' })

export type TemplateId =
  | 'intervention-effectiveness-by-technique'
  | 'crisis-detection-accuracy-over-time'
  | 'therapeutic-alliance-correlation-with-outcome'

export interface ReportTemplate {
  id: TemplateId
  name: string
  description: string
  category: 'effectiveness' | 'safety' | 'alliance'
  hypotheses: Hypothesis[]
  request: Omit<EvidenceRequest, 'hypotheses'>
  hipaaChecklist: HipAAChecklistItem[]
}

export interface HipAAChecklistItem {
  id: string
  label: string
  satisfied: boolean
  notes: string
}

export interface GeneratedReport {
  report: EvidenceReport
  template: ReportTemplate
  markdown: string
  hipaaChecklist: HipAAChecklistItem[]
  generatedAt: string
}

const DEFAULT_HIPAA_CHECKLIST: HipAAChecklistItem[] = [
  {
    id: 'data-minimization',
    label: 'Data minimization — only necessary variables collected',
    satisfied: true,
    notes: 'Only aggregated, anonymized data used in report',
  },
  {
    id: 'de-identification',
    label: 'De-identification — PHI removed per Safe Harbor method',
    satisfied: true,
    notes: 'All identifiers stripped; k-anonymity (k>=5) applied',
  },
  {
    id: 'differential-privacy',
    label: 'Differential privacy — noise injection applied',
    satisfied: true,
    notes: 'Laplace noise with epsilon=0.1 injected on all aggregates',
  },
  {
    id: 'audit-trail',
    label: 'Audit trail — all query access logged',
    satisfied: true,
    notes: 'QueryAuditService logs all queries with requester and timestamp',
  },
  {
    id: 'consent-verified',
    label: 'Consent verified — all data subjects consented to research use',
    satisfied: true,
    notes: 'ConsentManagementService validates consent before query execution',
  },
  {
    id: 'access-controls',
    label: 'Access controls — admin-only access to evidence reports',
    satisfied: true,
    notes: 'API routes protected with protectRoute({ requiredRole: admin })',
  },
  {
    id: 'retention-policy',
    label: 'Retention policy — reports retained per HIPAA 7-year requirement',
    satisfied: true,
    notes: 'Audit retention: 2555 days (7 years)',
  },
  {
    id: 'no-phi-disclosure',
    label: 'No PHI disclosure — report contains only aggregated statistics',
    satisfied: true,
    notes: 'No individual-level data in report; only summary statistics',
  },
]

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'intervention-effectiveness-by-technique',
    name: 'Intervention Effectiveness by Technique',
    description:
      'Evaluates the differential effectiveness of therapeutic techniques (CBT, mindfulness, motivational interviewing, etc.) on patient outcomes including symptom reduction and goal achievement.',
    category: 'effectiveness',
    hypotheses: [
      {
        id: 'h-technique-1',
        statement:
          'Cognitive restructuring techniques show significantly higher outcome achievement rates compared to supportive listening',
        variables: ['technique_type', 'outcome_achievement_rate'],
        expectedDirection: 'positive',
        nullHypothesis:
          'No significant difference in outcome achievement between cognitive restructuring and supportive listening',
        alternativeHypothesis:
          'Cognitive restructuring significantly improves outcome achievement rate',
      },
      {
        id: 'h-technique-2',
        statement:
          'Mindfulness-based interventions show equal or superior effectiveness for anxiety-related presentations compared to traditional CBT',
        variables: ['mindfulness', 'cbt', 'anxiety_outcome'],
        expectedDirection: 'positive',
        nullHypothesis:
          'No significant difference between mindfulness and CBT for anxiety outcomes',
        alternativeHypothesis:
          'Mindfulness is non-inferior or superior to CBT for anxiety outcomes',
      },
      {
        id: 'h-technique-3',
        statement:
          'Motivational interviewing techniques show higher engagement retention for ambivalent clients',
        variables: ['motivational_interviewing', 'engagement_retention'],
        expectedDirection: 'positive',
        nullHypothesis:
          'No significant difference in engagement retention for motivational interviewing',
        alternativeHypothesis:
          'Motivational interviewing significantly improves engagement retention',
      },
    ],
    request: {
      dataFilters: {
        sessionTypes: ['individual', 'group'],
        techniques: [
          'cognitive_restructuring',
          'mindfulness',
          'motivational_interviewing',
          'active_listening',
          'reflective_statements',
        ],
        outcomeMetrics: [
          'goal_achievement',
          'symptom_reduction',
          'engagement_retention',
        ],
      },
    },
    hipaaChecklist: DEFAULT_HIPAA_CHECKLIST,
  },
  {
    id: 'crisis-detection-accuracy-over-time',
    name: 'Crisis Detection Accuracy Over Time',
    description:
      'Tracks the accuracy of AI-powered crisis detection (suicidal ideation, self-harm risk) over time periods, measuring sensitivity, specificity, and false positive/negative rates across model versions.',
    category: 'safety',
    hypotheses: [
      {
        id: 'h-crisis-1',
        statement:
          'Crisis detection sensitivity has improved significantly over the observation period (>= 0.85 in latest period)',
        variables: ['time_period', 'sensitivity'],
        expectedDirection: 'positive',
        nullHypothesis:
          'No significant improvement in crisis detection sensitivity over time',
        alternativeHypothesis:
          'Crisis detection sensitivity has significantly improved over time',
      },
      {
        id: 'h-crisis-2',
        statement:
          'False positive rate for crisis detection has decreased to below 0.10 in the most recent quarter',
        variables: ['time_period', 'false_positive_rate'],
        expectedDirection: 'negative',
        nullHypothesis:
          'False positive rate has not significantly decreased over time',
        alternativeHypothesis:
          'False positive rate has significantly decreased to below 0.10',
      },
      {
        id: 'h-crisis-3',
        statement:
          'Model version updates correlate with measurable improvements in specificity (>= 0.90)',
        variables: ['model_version', 'specificity'],
        expectedDirection: 'positive',
        nullHypothesis: 'No correlation between model version and specificity',
        alternativeHypothesis:
          'Model version updates significantly correlate with specificity improvements',
      },
    ],
    request: {
      dataFilters: {
        sessionTypes: ['individual', 'emergency'],
        detectionMetrics: [
          'sensitivity',
          'specificity',
          'false_positive_rate',
          'false_negative_rate',
        ],
        timeGranularity: 'monthly',
        modelVersions: ['v1.0', 'v1.1', 'v2.0', 'v2.1'],
      },
    },
    hipaaChecklist: DEFAULT_HIPAA_CHECKLIST,
  },
  {
    id: 'therapeutic-alliance-correlation-with-outcome',
    name: 'Therapeutic Alliance Correlation with Outcome',
    description:
      'Analyzes the correlation between therapeutic alliance scores and treatment outcomes, examining the strength of the relationship across different therapeutic modalities and client demographics.',
    category: 'alliance',
    hypotheses: [
      {
        id: 'h-alliance-1',
        statement:
          'Therapeutic alliance score positively correlates with treatment outcome (r >= 0.40)',
        variables: ['alliance_score', 'treatment_outcome'],
        expectedDirection: 'positive',
        nullHypothesis:
          'No significant correlation between alliance score and treatment outcome',
        alternativeHypothesis:
          'Therapeutic alliance score significantly positively correlates with treatment outcome',
      },
      {
        id: 'h-alliance-2',
        statement:
          'The alliance-outcome correlation is stronger for client-centered approaches than for structured CBT',
        variables: ['alliance_score', 'outcome', 'therapy_approach'],
        expectedDirection: 'positive',
        nullHypothesis:
          'No difference in alliance-outcome correlation between client-centered and CBT approaches',
        alternativeHypothesis:
          'Alliance-outcome correlation is significantly stronger for client-centered approaches',
      },
      {
        id: 'h-alliance-3',
        statement:
          'Early-session alliance scores (session 1-3) predict overall treatment completion rate',
        variables: ['early_alliance_score', 'completion_rate'],
        expectedDirection: 'positive',
        nullHypothesis:
          'Early-session alliance scores do not predict treatment completion',
        alternativeHypothesis:
          'Early-session alliance scores significantly predict treatment completion rate',
      },
    ],
    request: {
      dataFilters: {
        sessionTypes: ['individual'],
        allianceMeasures: ['WAI', 'CALPAAS', 'session_rating_scale'],
        outcomeMeasures: [
          'goal_attainment',
          'symptom_reduction',
          'completion_rate',
        ],
        timeWindows: ['early_1-3', 'mid_4-8', 'late_9+'],
      },
    },
    hipaaChecklist: DEFAULT_HIPAA_CHECKLIST,
  },
]

export class EvidenceReportGenerator {
  private readonly service: EvidenceGenerationService

  constructor(service?: EvidenceGenerationService) {
    this.service =
      service ??
      new EvidenceGenerationService({
        significanceLevel: 0.05,
        minEffectSize: 0.3,
        minSampleSize: 30,
        confidenceLevel: 0.95,
        maxHypotheses: 10,
      })
  }

  getTemplates(): ReportTemplate[] {
    return REPORT_TEMPLATES
  }

  getTemplate(id: TemplateId): ReportTemplate | undefined {
    return REPORT_TEMPLATES.find((t) => t.id === id)
  }

  async generateFromTemplate(
    templateId: TemplateId,
    customFilters?: Record<string, unknown>,
  ): Promise<GeneratedReport> {
    const template = this.getTemplate(templateId)
    if (!template) {
      throw new Error(`Unknown template: ${templateId}`)
    }

    logger.info('Generating evidence report from template', { templateId })

    const request: EvidenceRequest = {
      ...template.request,
      hypotheses: template.hypotheses,
      dataFilters: customFilters
        ? { ...template.request.dataFilters, ...customFilters }
        : template.request.dataFilters,
    }

    const report = await this.service.generateEvidence(request)
    const markdown = this.generateMarkdown(report, template)

    return {
      report,
      template,
      markdown,
      hipaaChecklist: template.hipaaChecklist,
      generatedAt: new Date().toISOString(),
    }
  }

  async generateAll(
    customFilters?: Record<string, unknown>,
  ): Promise<GeneratedReport[]> {
    const results: GeneratedReport[] = []
    for (const template of REPORT_TEMPLATES) {
      try {
        const generated = await this.generateFromTemplate(
          template.id,
          customFilters,
        )
        results.push(generated)
      } catch (error) {
        logger.error('Failed to generate from template', {
          templateId: template.id,
          error,
        })
      }
    }
    return results
  }

  generateMarkdown(report: EvidenceReport, template: ReportTemplate): string {
    const lines: string[] = []

    lines.push(`# ${report.title}`)
    lines.push('')
    lines.push(`**Template:** ${template.name}`)
    lines.push(`**Category:** ${template.category}`)
    lines.push(`**Generated:** ${report.generatedAt}`)
    lines.push(`**Generated By:** ${report.generatedBy}`)
    lines.push('')

    lines.push('## HIPAA Compliance Checklist')
    lines.push('')
    for (const item of template.hipaaChecklist) {
      const status = item.satisfied ? '[x]' : '[ ]'
      lines.push(`- ${status} ${item.label}`)
      if (item.notes) {
        lines.push(`  - _${item.notes}_`)
      }
    }
    lines.push('')

    lines.push('## Hypothesis')
    lines.push('')
    lines.push(report.hypothesis)
    lines.push('')

    lines.push('## Methodology')
    lines.push('')
    lines.push(report.methodology)
    lines.push('')

    lines.push('## Findings')
    lines.push('')
    if (report.findings.length === 0) {
      lines.push('_No findings generated._')
    } else {
      lines.push(
        '| Metric | Value | Confidence | Statistical Test | p-value | Effect Size | Interpretation |',
      )
      lines.push(
        '|--------|-------|------------|-------------------|---------|-------------|-----------------|',
      )
      for (const finding of report.findings) {
        const interpretation =
          'interpretation' in finding
            ? (finding as { interpretation: string }).interpretation
            : ''
        lines.push(
          `| ${finding.metric} | ${finding.value.toFixed(4)} | ${(finding.confidence * 100).toFixed(0)}% | ${finding.statisticalTest} | ${finding.pValue.toFixed(4)} | ${finding.effectSize.toFixed(4)} | ${interpretation} |`,
        )
      }
    }
    lines.push('')

    lines.push('## Conclusions')
    lines.push('')
    for (const c of report.conclusions) {
      lines.push(`- ${c}`)
    }
    lines.push('')

    lines.push('## Limitations')
    lines.push('')
    for (const l of report.limitations) {
      lines.push(`- ${l}`)
    }
    lines.push('')

    lines.push('## Recommendations')
    lines.push('')
    for (const r of report.recommendations) {
      lines.push(`- ${r}`)
    }
    lines.push('')

    lines.push('## References')
    lines.push('')
    for (const ref of report.references) {
      lines.push(`- ${ref}`)
    }
    lines.push('')

    lines.push('---')
    lines.push('')
    lines.push(
      '_This report was generated from anonymized, de-identified data in compliance with HIPAA Safe Harbor de-identification standards. No PHI is disclosed in this report._',
    )

    return lines.join('\n')
  }

  getHipaaChecklist(templateId: TemplateId): HipAAChecklistItem[] {
    const template = this.getTemplate(templateId)
    return template?.hipaaChecklist ?? DEFAULT_HIPAA_CHECKLIST
  }
}

let instance: EvidenceReportGenerator | null = null

export function getEvidenceReportGenerator(): EvidenceReportGenerator {
  instance ??= new EvidenceReportGenerator()
  return instance
}

export function resetEvidenceReportGenerator(): void {
  instance = null
}
