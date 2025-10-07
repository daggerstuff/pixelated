import type {
  MentalHealthAnalysis,
  HealthIndicator,
  SentimentScore,
  MentalHealthCategory,
} from './types'

export class MentalHealthAnalyzer {
  private readonly crisisKeywords = [
    'suicide',
    'kill myself',
    'end it all',
    'not worth living',
    'better off dead',
    'hurt myself',
    'self harm',
    'cut myself',
    'overdose',
  ]

  private readonly depressionKeywords = [
    'depressed',
    'hopeless',
    'worthless',
    'empty',
    'numb',
    'sad',
    'crying',
    'no energy',
    'tired',
    'exhausted',
    'sleep all day',
    "can't get up",
  ]

  private readonly anxietyKeywords = [
    'anxious',
    'worried',
    'panic',
    'scared',
    'nervous',
    'overwhelmed',
    'racing thoughts',
    "can't breathe",
    'heart racing',
    'shaking',
  ]

  private readonly stressKeywords = [
    'stressed',
    'pressure',
    'overwhelmed',
    'too much',
    "can't cope",
    'breaking point',
    'burned out',
    'exhausted',
  ]

  private readonly angerKeywords = [
    'angry',
    'furious',
    'rage',
    'hate',
    'frustrated',
    'irritated',
    'want to scream',
    'losing it',
    "can't control",
  ]

  private readonly isolationKeywords = [
    'alone',
    'lonely',
    'isolated',
    'no friends',
    'nobody cares',
    'abandoned',
    'disconnected',
    'withdrawn',
  ]

  async analyze(text: string): Promise<MentalHealthAnalysis> {
    const normalizedText = text.toLowerCase()
    const words = normalizedText.split(/\s+/)

    const indicators = this.detectIndicators(normalizedText)
    const sentiment = this.analyzeSentiment(normalizedText, words)
    const categories = this.categorizeIssues(indicators)

    const riskLevel = this.calculateRiskLevel(indicators)
    const confidence = this.calculateConfidence(indicators, words.length)
    const requiresIntervention =
      riskLevel === 'high' || riskLevel === 'critical'

    return {
      id: `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: Date.now(),
      confidence,
      riskLevel,
      categories,
      sentiment,
      indicators,
      recommendations: this.generateRecommendations(indicators, riskLevel),
      requiresIntervention,
    }
  }

  private detectIndicators(text: string): HealthIndicator[] {
    const indicators: HealthIndicator[] = []

    // Crisis detection
    const crisisMatches = this.findMatches(text, this.crisisKeywords)
    if (crisisMatches.length > 0) {
      indicators.push({
        type: 'crisis',
        severity: Math.min(1.0, crisisMatches.length * 0.4),
        evidence: crisisMatches,
        description: 'Crisis indicators detected requiring immediate attention',
      })
    }

    // Depression detection
    const depressionMatches = this.findMatches(text, this.depressionKeywords)
    if (depressionMatches.length > 0) {
      indicators.push({
        type: 'depression',
        severity: Math.min(1.0, depressionMatches.length * 0.2),
        evidence: depressionMatches,
        description: 'Signs of depression detected',
      })
    }

    // Anxiety detection
    const anxietyMatches = this.findMatches(text, this.anxietyKeywords)
    if (anxietyMatches.length > 0) {
      indicators.push({
        type: 'anxiety',
        severity: Math.min(1.0, anxietyMatches.length * 0.25),
        evidence: anxietyMatches,
        description: 'Anxiety symptoms identified',
      })
    }

    // Stress detection
    const stressMatches = this.findMatches(text, this.stressKeywords)
    if (stressMatches.length > 0) {
      indicators.push({
        type: 'stress',
        severity: Math.min(1.0, stressMatches.length * 0.2),
        evidence: stressMatches,
        description: 'High stress levels indicated',
      })
    }

    // Anger detection
    const angerMatches = this.findMatches(text, this.angerKeywords)
    if (angerMatches.length > 0) {
      indicators.push({
        type: 'anger',
        severity: Math.min(1.0, angerMatches.length * 0.3),
        evidence: angerMatches,
        description: 'Anger and frustration detected',
      })
    }

    // Isolation detection
    const isolationMatches = this.findMatches(text, this.isolationKeywords)
    if (isolationMatches.length > 0) {
      indicators.push({
        type: 'isolation',
        severity: Math.min(1.0, isolationMatches.length * 0.25),
        evidence: isolationMatches,
        description: 'Social isolation indicators present',
      })
    }

    return indicators
  }

  private findMatches(text: string, keywords: string[]): string[] {
    return keywords.filter((keyword) => text.includes(keyword))
  }

  private analyzeSentiment(text: string, words: string[]): SentimentScore {
    const positiveWords = [
      'happy',
      'good',
      'great',
      'better',
      'hope',
      'love',
      'joy',
      'excited',
      'grateful',
    ]
    const negativeWords = [
      'bad',
      'terrible',
      'awful',
      'hate',
      'sad',
      'angry',
      'frustrated',
      'hopeless',
    ]

    const positiveCount = positiveWords.filter((word) =>
      text.includes(word),
    ).length
    const negativeCount = negativeWords.filter((word) =>
      text.includes(word),
    ).length
    const totalWords = words.length

    const positive = totalWords > 0 ? positiveCount / totalWords : 0
    const negative = totalWords > 0 ? negativeCount / totalWords : 0
    const neutral = Math.max(0, 1 - positive - negative)
    const overall = positive - negative

    return { overall, positive, negative, neutral }
  }

  private categorizeIssues(
    indicators: HealthIndicator[],
  ): MentalHealthCategory[] {
    const categories: MentalHealthCategory[] = []

    indicators.forEach((indicator) => {
      categories.push({
        name: indicator.type,
        score: indicator.severity,
        confidence: Math.min(1.0, indicator.evidence.length * 0.2 + 0.5),
        keywords: indicator.evidence,
      })
    })

    return categories
  }

  private calculateRiskLevel(
    indicators: HealthIndicator[],
  ): 'low' | 'medium' | 'high' | 'critical' {
    const crisisIndicator = indicators.find((i) => i.type === 'crisis')
    if (crisisIndicator && crisisIndicator.severity > 0.3) {
      return 'critical'
    }

    const maxSeverity = Math.max(...indicators.map((i) => i.severity), 0)
    const avgSeverity =
      indicators.length > 0
        ? indicators.reduce((sum, i) => sum + i.severity, 0) / indicators.length
        : 0

    if (maxSeverity > 0.7 || avgSeverity > 0.5) {
      return 'high'
    }
    if (maxSeverity > 0.4 || avgSeverity > 0.3) {
      return 'medium'
    }
    return 'low'
  }

  private calculateConfidence(
    indicators: HealthIndicator[],
    textLength: number,
  ): number {
    if (indicators.length === 0) {
      return 0.8
    }

    const evidenceCount = indicators.reduce(
      (sum, i) => sum + i.evidence.length,
      0,
    )
    const lengthFactor = Math.min(1.0, textLength / 50)
    const evidenceFactor = Math.min(1.0, evidenceCount * 0.1)

    return Math.min(0.95, 0.6 + lengthFactor * 0.2 + evidenceFactor * 0.2)
  }

  private generateRecommendations(
    indicators: HealthIndicator[],
    riskLevel: string,
  ): string[] {
    const recommendations: string[] = []

    if (riskLevel === 'critical') {
      recommendations.push(
        'Seek immediate professional help or contact a crisis hotline',
      )
      recommendations.push(
        'Consider contacting emergency services if in immediate danger',
      )
    }

    if (riskLevel === 'high') {
      recommendations.push(
        'Schedule an appointment with a mental health professional',
      )
      recommendations.push('Reach out to trusted friends or family members')
    }

    indicators.forEach((indicator) => {
      switch (indicator.type) {
        case 'depression':
          recommendations.push('Consider therapy or counseling for depression')
          recommendations.push('Maintain regular sleep and exercise routines')
          break
        case 'anxiety':
          recommendations.push('Practice breathing exercises and mindfulness')
          recommendations.push('Consider anxiety management techniques')
          break
        case 'stress':
          recommendations.push('Identify and address sources of stress')
          recommendations.push('Practice stress reduction techniques')
          break
        case 'isolation':
          recommendations.push('Try to connect with others, even in small ways')
          recommendations.push('Consider joining support groups or communities')
          break
      }
    })

    return [...new Set(recommendations)]
  }
}
