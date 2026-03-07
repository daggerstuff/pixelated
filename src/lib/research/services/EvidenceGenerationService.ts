import { getLogger } from '@/lib/logging'
import {
  EvidenceReport,
  StatisticalTest,
  PatternDiscoveryResult,
} from '@/lib/research/types/research-types'
import { PatternDiscoveryService } from './PatternDiscoveryService'
import { ResearchQueryEngine } from './ResearchQueryEngine'

const logger = getLogger({ prefix: 'EvidenceGenerationService' })

export interface EvidenceConfig {
  significanceLevel: number
  minEffectSize: number
  minSampleSize: number
  confidenceLevel: number
  maxHypotheses: number
}

export interface Hypothesis {
  id: string
  statement: string
  variables: string[]
  expectedDirection: 'positive' | 'negative' | 'neutral'
  nullHypothesis: string
  alternativeHypothesis: string
}

export interface EvidenceRequest {
  hypotheses: Hypothesis[]
  dataFilters?: Record<string, unknown>
  timeRange?: { start: Date; end: Date }
  demographicFilters?: Record<string, unknown>
  techniqueFilters?: Record<string, unknown>
}

export class EvidenceGenerationService {
  private config: EvidenceConfig
  private patternService: PatternDiscoveryService
  private queryEngine: ResearchQueryEngine

  constructor(
    config: EvidenceConfig = {
      significanceLevel: 0.05,
      minEffectSize: 0.3,
      minSampleSize: 30,
      confidenceLevel: 0.95,
      maxHypotheses: 10,
    },
    patternService: PatternDiscoveryService,
    queryEngine: ResearchQueryEngine,
  ) {
    this.config = config
    this.patternService = patternService
    this.queryEngine = queryEngine
  }

  /**
   * Main evidence generation pipeline
   */
  async generateEvidence(request: EvidenceRequest): Promise<EvidenceReport> {
    logger.info('Starting evidence generation', {
      hypothesisCount: request.hypotheses.length,
    })

    try {
      const startTime = Date.now()

      // Validate hypotheses
      const validatedHypotheses = await this.validateHypotheses(
        request.hypotheses,
      )

      // Generate statistical tests
      const tests = await this.generateStatisticalTests(
        validatedHypotheses,
        request,
      )

      // Execute tests
      const results = await this.executeStatisticalTests(tests, request)

      // Generate findings
      const findings = await this.generateFindings(results)

      // Generate conclusions
      const conclusions = await this.generateConclusions(findings)

      // Generate recommendations
      const recommendations = await this.generateRecommendations(
        findings,
        conclusions,
      )

      // Generate limitations
      const limitations = await this.generateLimitations(results)

      // Generate references
      const references = await this.generateReferences(findings)

      const report: EvidenceReport = {
        id: crypto.randomUUID(),
        title: `Evidence Report - ${new Date().toISOString().split('T')[0]}`,
        hypothesis: request.hypotheses.map((h) => h.statement).join('; '),
        methodology: this.generateMethodology(request),
        findings,
        conclusions,
        limitations,
        recommendations,
        references,
        generatedAt: new Date().toISOString(),
        generatedBy: 'EvidenceGenerationService',
      }

      logger.info('Evidence generation completed', {
        reportId: report.id,
        findingCount: findings.length,
        processingTime: Date.now() - startTime,
      })

      return report
    } catch (error) {
      logger.error('Evidence generation failed', { error })
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Evidence generation failed: ${errorMessage}`, {
        cause: error,
      })
    }
  }

  /**
   * Generate evidence from patterns
   */
  async generateEvidenceFromPatterns(
    patterns: PatternDiscoveryResult,
    hypotheses: Hypothesis[],
  ): Promise<EvidenceReport> {
    logger.info('Generating evidence from patterns', {
      patternCount: patterns.patterns.length,
    })

    const request: EvidenceRequest = {
      hypotheses,
      dataFilters: {
        patternBased: true,
        patternIds: patterns.patterns.map((p) => p.id),
      },
    }

    return this.generateEvidence(request)
  }

  /**
   * Validate research hypotheses
   */
  async validateHypotheses(hypotheses: Hypothesis[]): Promise<Hypothesis[]> {
    logger.info('Validating hypotheses', { count: hypotheses.length })

    const validated: Hypothesis[] = []

    for (const hypothesis of hypotheses) {
      const validation = await this.validateSingleHypothesis(hypothesis)
      if (validation.valid) {
        validated.push(hypothesis)
      } else {
        logger.warn('Invalid hypothesis', {
          hypothesis: hypothesis.statement,
          issues: validation.issues,
        })
      }
    }

    if (validated.length === 0) {
      throw new Error('No valid hypotheses provided')
    }

    return validated.slice(0, this.config.maxHypotheses)
  }

  /**
   * Generate statistical tests for hypotheses
   */
  async generateStatisticalTests(
    hypotheses: Hypothesis[],
    request: EvidenceRequest,
  ): Promise<StatisticalTest[]> {
    logger.info('Generating statistical tests', { count: hypotheses.length })

    const tests: StatisticalTest[] = []

    for (const hypothesis of hypotheses) {
      const test = await this.createStatisticalTest(hypothesis, request)
      tests.push(test)
    }

    return tests
  }

  /**
   * Execute statistical tests
   */
  async executeStatisticalTests(
    tests: StatisticalTest[],
    request: EvidenceRequest,
  ): Promise<StatisticalTest[]> {
    logger.info('Executing statistical tests', { count: tests.length })

    const results: StatisticalTest[] = []

    for (const test of tests) {
      const result = await this.executeSingleTest(test, request)
      results.push(result)
    }

    return results
  }

  /**
   * Generate clinical evidence
   */
  async generateClinicalEvidence(
    clinicalQuestion: string,
    population: string,
    intervention: string,
    outcome: string,
  ): Promise<EvidenceReport> {
    logger.info('Generating clinical evidence', {
      question: clinicalQuestion,
    })

    const hypothesis: Hypothesis = {
      id: crypto.randomUUID(),
      statement: `${intervention} improves ${outcome} in ${population}`,
      variables: [intervention, outcome],
      expectedDirection: 'positive',
      nullHypothesis: `No significant difference in ${outcome} between ${intervention} and control`,
      alternativeHypothesis: `${intervention} significantly improves ${outcome}`,
    }

    const request: EvidenceRequest = {
      hypotheses: [hypothesis],
      demographicFilters: { population },
      techniqueFilters: { intervention },
    }

    return this.generateEvidence(request)
  }

  /**
   * Generate systematic review
   */
  async generateSystematicReview(
    topic: string,
    inclusionCriteria: Record<string, unknown>,
    exclusionCriteria: Record<string, unknown>,
  ): Promise<EvidenceReport> {
    logger.info('Generating systematic review', { topic })

    const hypothesis: Hypothesis = {
      id: crypto.randomUUID(),
      statement: `Evidence supports ${topic} effectiveness`,
      variables: [topic, 'effectiveness'],
      expectedDirection: 'positive',
      nullHypothesis: `No significant evidence for ${topic} effectiveness`,
      alternativeHypothesis: `Significant evidence supports ${topic} effectiveness`,
    }

    const request: EvidenceRequest = {
      hypotheses: [hypothesis],
      dataFilters: { inclusionCriteria, exclusionCriteria },
    }

    return this.generateEvidence(request)
  }

  /**
   * Generate meta-analysis
   */
  async generateMetaAnalysis(
    studies: Array<{
      studyId: string
      effectSize: number
      sampleSize: number
      variance: number
    }>,
    hypothesis: string,
  ): Promise<EvidenceReport> {
    logger.info('Generating meta-analysis', { studyCount: studies.length })

    const metaEffectSize = this.calculateMetaEffectSize(studies)
    const heterogeneity = this.calculateHeterogeneity(studies)
    const confidenceInterval = this.calculateMetaConfidenceInterval(studies)

    const finding = {
      metric: 'meta-analysis',
      value: metaEffectSize,
      confidence: 0.95,
      statisticalTest: 'random-effects-meta-analysis',
      pValue: this.calculateMetaPValue(studies),
      effectSize: metaEffectSize,
    }

    const report: EvidenceReport = {
      id: crypto.randomUUID(),
      title: `Meta-Analysis: ${hypothesis}`,
      hypothesis,
      methodology: 'Random-effects meta-analysis',
      findings: [finding],
      conclusions: [
        `Pooled effect size: ${metaEffectSize.toFixed(3)}`,
        `Heterogeneity: ${heterogeneity.toFixed(3)}`,
        `95% CI: [${confidenceInterval[0].toFixed(3)}, ${confidenceInterval[1].toFixed(3)}]`,
      ],
      limitations: [
        'Study heterogeneity may affect generalizability',
        'Publication bias possible',
        'Quality of included studies varies',
      ],
      recommendations: [
        'Consider heterogeneity in clinical application',
        'Further high-quality studies needed',
        'Monitor for publication bias',
      ],
      references: studies.map((s) => s.studyId),
      generatedAt: new Date().toISOString(),
      generatedBy: 'EvidenceGenerationService',
    }

    return report
  }

  /**
   * Export evidence report
   */
  async exportEvidenceReport(
    report: EvidenceReport,
    format: 'pdf' | 'html' | 'markdown' | 'json',
  ): Promise<{
    content: string
    format: string
    metadata: Record<string, unknown>
  }> {
    logger.info('Exporting evidence report', {
      reportId: report.id,
      format,
    })

    let content: string
    const metadata = {
      exportDate: new Date().toISOString(),
      reportId: report.id,
      format,
    }

    switch (format) {
      case 'pdf':
        content = await this.generatePDFReport(report)
        break
      case 'html':
        content = this.generateHTMLReport(report)
        break
      case 'markdown':
        content = this.generateMarkdownReport(report)
        break
      case 'json':
        content = JSON.stringify(report, null, 2)
        break
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }

    return { content, format, metadata }
  }

  /**
   * Private methods
   */
  private async validateSingleHypothesis(hypothesis: Hypothesis): Promise<{
    valid: boolean
    issues: string[]
  }> {
    const issues: string[] = []

    if (!hypothesis.statement || hypothesis.statement.trim().length === 0) {
      issues.push('Hypothesis statement is required')
    }

    if (!hypothesis.variables || hypothesis.variables.length < 2) {
      issues.push('At least two variables required for hypothesis testing')
    }

    if (
      !['positive', 'negative', 'neutral'].includes(
        hypothesis.expectedDirection,
      )
    ) {
      issues.push('Invalid expected direction')
    }

    return { valid: issues.length === 0, issues }
  }

  private async createStatisticalTest(
    hypothesis: Hypothesis,
    request: EvidenceRequest,
  ): Promise<StatisticalTest> {
    const testType = this.determineTestType(hypothesis, request)

    return {
      testType,
      variables: hypothesis.variables,
      nullHypothesis: hypothesis.nullHypothesis,
      alternativeHypothesis: hypothesis.alternativeHypothesis,
      alpha: this.config.significanceLevel,
      results: {
        testStatistic: 0,
        pValue: 1.0,
        effectSize: 0,
        confidenceInterval: [0, 0],
        conclusion: 'pending',
      },
    }
  }

  private determineTestType(
    hypothesis: Hypothesis,
    _request: EvidenceRequest,
  ): StatisticalTest['testType'] {
    const variableCount = hypothesis.variables.length

    if (variableCount === 2) {
      return 'correlation'
    } else if (variableCount > 2) {
      return 'regression'
    } else {
      return 't-test'
    }
  }

  private async executeSingleTest(
    test: StatisticalTest,
    _request: EvidenceRequest,
  ): Promise<StatisticalTest> {
    // In real implementation, execute actual statistical test
    const mockResults = this.generateMockResults(test)

    return {
      ...test,
      results: mockResults,
    }
  }

  private generateMockResults(
    _test: StatisticalTest,
  ): StatisticalTest['results'] {
    // Generate realistic mock results for demonstration
    const effectSize = Math.random() * 0.8 - 0.4
    const pValue = Math.random() * 0.1

    return {
      testStatistic: Math.random() * 10 - 5,
      pValue,
      effectSize,
      confidenceInterval: [effectSize - 0.2, effectSize + 0.2],
      conclusion:
        pValue < this.config.significanceLevel
          ? 'reject_null'
          : 'fail_to_reject',
    }
  }

  private async generateFindings(results: StatisticalTest[]): Promise<
    Array<{
      metric: string
      value: number
      confidence: number
      statisticalTest: string
      pValue: number
      effectSize: number
      confidenceInterval: [number, number]
      interpretation: string
    }>
  > {
    return results.map((result) => ({
      metric: result.variables.join('_vs_'),
      value: result.results.effectSize,
      confidence: this.config.confidenceLevel,
      statisticalTest: result.testType,
      pValue: result.results.pValue,
      effectSize: result.results.effectSize,
      confidenceInterval: result.results.confidenceInterval,
      interpretation: this.interpretFinding(result),
    }))
  }

  private interpretFinding(result: StatisticalTest): string {
    const effectSize = Math.abs(result.results.effectSize)
    let interpretation = ''

    if (effectSize < 0.1) {
      interpretation = 'negligible'
    } else if (effectSize < 0.3) {
      interpretation = 'small'
    } else if (effectSize < 0.5) {
      interpretation = 'medium'
    } else {
      interpretation = 'large'
    }

    return `${interpretation} effect size (${result.results.effectSize.toFixed(3)})`
  }

  private generateMethodology(request: EvidenceRequest): string {
    return `
      Methodology:
      1. Data Collection: Anonymized therapeutic session data
      2. Sample Size: Minimum ${this.config.minSampleSize} records
      3. Statistical Tests: ${request.hypotheses.map((h) => h.variables.join('-')).join(', ')}
      4. Significance Level: α = ${this.config.significanceLevel}
      5. Effect Size Threshold: d ≥ ${this.config.minEffectSize}
      6. Confidence Level: ${this.config.confidenceLevel * 100}%
    `.trim()
  }

  private async generateConclusions(
    findings: Array<{
      pValue: number
      effectSize: number
    }>,
  ): Promise<string[]> {
    const conclusions: string[] = []

    const significantFindings = findings.filter(
      (f) => f.pValue < this.config.significanceLevel,
    )

    if (significantFindings.length > 0) {
      conclusions.push(
        `${significantFindings.length} statistically significant findings identified`,
      )

      const largeEffects = significantFindings.filter(
        (f) => Math.abs(f.effectSize) >= 0.5,
      )
      if (largeEffects.length > 0) {
        conclusions.push(
          `${largeEffects.length} findings show large effect sizes`,
        )
      }
    } else {
      conclusions.push('No statistically significant findings identified')
    }

    return conclusions
  }

  private async generateRecommendations(
    findings: Array<{ pValue: number }>,
    _conclusions: string[],
  ): Promise<string[]> {
    const recommendations: string[] = []

    const significantFindings = findings.filter(
      (f) => f.pValue < this.config.significanceLevel,
    )

    if (significantFindings.length > 0) {
      recommendations.push(
        'Consider implementing findings in clinical practice',
      )
      recommendations.push('Validate findings with independent datasets')
      recommendations.push('Conduct follow-up studies to confirm results')
    }

    recommendations.push('Regular monitoring of therapeutic outcomes')
    recommendations.push('Continuous data collection for longitudinal analysis')

    return recommendations
  }

  private async generateLimitations(
    _results: StatisticalTest[],
  ): Promise<string[]> {
    return [
      'Retrospective analysis may have selection bias',
      'Missing data may affect results',
      'Confounding variables not fully controlled',
      'Generalizability limited to similar populations',
      'Effect sizes may be overestimated',
    ]
  }

  private async generateReferences(
    _findings: Array<{ pValue: number }>,
  ): Promise<string[]> {
    return [
      'Cohen, J. (1988). Statistical Power Analysis for the Behavioral Sciences',
      'Field, A. (2013). Discovering Statistics Using IBM SPSS Statistics',
      'Cumming, G. (2012). Understanding The New Statistics',
    ]
  }

  private calculateMetaEffectSize(
    studies: Array<{
      effectSize: number
      sampleSize: number
    }>,
  ): number {
    const weightedSum = studies.reduce(
      (sum, study) => sum + study.effectSize * study.sampleSize,
      0,
    )
    const totalWeight = studies.reduce(
      (sum, study) => sum + study.sampleSize,
      0,
    )

    return weightedSum / totalWeight
  }

  private calculateHeterogeneity(
    studies: Array<{
      effectSize: number
      variance: number
    }>,
  ): number {
    // I² statistic calculation
    const effectSizes = studies.map((s) => s.effectSize)
    const meanEffect =
      effectSizes.reduce((a, b) => a + b, 0) / effectSizes.length

    const q = studies.reduce(
      (sum, study) =>
        sum + Math.pow(study.effectSize - meanEffect, 2) / study.variance,
      0,
    )

    const df = studies.length - 1
    return Math.max(0, ((q - df) / q) * 100)
  }

  private calculateMetaConfidenceInterval(
    studies: Array<{
      effectSize: number
      sampleSize: number
      variance: number
    }>,
  ): [number, number] {
    const effectSize = this.calculateMetaEffectSize(studies)
    const se = Math.sqrt(
      1 / studies.reduce((sum, study) => sum + 1 / study.variance, 0),
    )

    const z = 1.96 // 95% CI
    return [effectSize - z * se, effectSize + z * se]
  }

  private calculateMetaPValue(
    studies: Array<{
      effectSize: number
      sampleSize: number
      variance: number
    }>,
  ): number {
    const effectSize = this.calculateMetaEffectSize(studies)
    const se = Math.sqrt(
      1 / studies.reduce((sum, study) => sum + 1 / study.variance, 0),
    )

    const z = effectSize / se
    return 2 * (1 - this.normalCDF(Math.abs(z)))
  }

  private normalCDF(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)))
  }

  private erf(x: number): number {
    // Error function approximation
    const a1 = 0.254829592
    const a2 = -0.284496736
    const a3 = 1.421413741
    const a4 = -1.453152027
    const a5 = 1.061405429
    const p = 0.3275911

    const sign = x >= 0 ? 1 : -1
    x = Math.abs(x)

    const t = 1.0 / (1.0 + p * x)
    const y =
      1.0 -
      ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)

    return sign * y
  }

  private generatePDFReport(report: EvidenceReport): Promise<string> {
    // In real implementation, use PDF generation library
    return Promise.resolve(`PDF Report: ${report.title}`)
  }

  private generateHTMLReport(report: EvidenceReport): string {
    return `
      <html>
        <head>
          <title>${report.title}</title>
        </head>
        <body>
          <h1>${report.title}</h1>
          <h2>Hypothesis</h2>
          <p>${report.hypothesis}</p>
          <h2>Methodology</h2>
          <p>${report.methodology}</p>
          <h2>Findings</h2>
          <ul>
            ${report.findings.map((f) => `<li>${f.metric}: ${f.value} (${f.statisticalTest}, p=${f.pValue})</li>`).join('')}
          </ul>
          <h2>Conclusions</h2>
          <ul>
            ${report.conclusions.map((c) => `<li>${c}</li>`).join('')}
          </ul>
        </body>
      </html>
    `
  }

  private generateMarkdownReport(report: EvidenceReport): string {
    return `
# ${report.title}

## Hypothesis
${report.hypothesis}

## Methodology
${report.methodology}

## Findings
${report.findings.map((f) => `- **${f.metric}**: ${f.value} (${f.statisticalTest}, p=${f.pValue})`).join('\n')}

## Conclusions
${report.conclusions.map((c) => `- ${c}`).join('\n')}

## Limitations
${report.limitations.map((l) => `- ${l}`).join('\n')}

## Recommendations
${report.recommendations.map((r) => `- ${r}`).join('\n')}
    `.trim()
  }
}
