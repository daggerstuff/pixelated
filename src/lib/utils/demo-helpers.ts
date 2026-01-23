// Utility functions for bias detection demo data generation and export

import type {
  PresetScenario,
  SessionData,
  BiasFactors,
  BiasAnalysisResults,
  CounterfactualScenario,
  HistoricalComparison,
  ExportData,
  Demographics,
} from '../types/bias-detection'

/**
 * Comprehensive preset scenarios with realistic bias patterns
 */
export const PRESET_SCENARIOS: PresetScenario[] = [
  {
    id: 'high-bias-cultural',
    name: 'High Cultural Bias',
    description:
      'Scenario with significant cultural stereotyping and assumptions',
    riskLevel: 'critical',
    category: 'cultural',
    scenario: 'anxiety-treatment',
    demographics: {
      age: '65+',
      gender: 'female',
      ethnicity: 'hispanic',
      primaryLanguage: 'es',
    },
    content: `Therapist: You people from your culture tend to be more emotional about these things. Maybe it's because of your traditional upbringing.
Patient: I feel judged and misunderstood when you say that.
Therapist: I'm just trying to understand your cultural background. Hispanic women are usually more expressive, right?
Patient: That's not fair to assume about me or my culture.
Therapist: Well, maybe you should try to be more like American women who handle stress better.`,
    expectedBiasScore: 0.85,
    learningObjectives: [
      'Recognize cultural stereotyping in therapeutic language',
      'Understand impact of generalizations on client trust',
      'Practice culturally sensitive communication',
    ],
  },
  {
    id: 'medium-bias-gender',
    name: 'Gender Role Assumptions',
    description: 'Subtle gender bias in therapeutic assumptions and responses',
    riskLevel: 'high',
    category: 'gender',
    scenario: 'family-therapy',
    demographics: {
      age: '26-35',
      gender: 'female',
      ethnicity: 'white',
      primaryLanguage: 'en',
    },
    content: `Therapist: As a mother, you must be feeling overwhelmed trying to balance work and family.
Patient: Actually, my husband and I share household responsibilities equally.
Therapist: That's nice, but naturally mothers have that special nurturing instinct that makes them better at childcare.
Patient: I don't think gender determines parenting ability.
Therapist: Of course, but women are just naturally more emotional and intuitive with children.`,
    expectedBiasScore: 0.65,
    learningObjectives: [
      'Identify gender role assumptions in therapy',
      'Recognize impact of stereotyping on client autonomy',
      'Practice gender-neutral therapeutic language',
    ],
  },
  {
    id: 'low-bias-inclusive',
    name: 'Inclusive Best Practice',
    description:
      'Example of culturally competent, bias-free therapeutic interaction',
    riskLevel: 'low',
    category: 'intersectional',
    scenario: 'anxiety-treatment',
    demographics: {
      age: '26-35',
      gender: 'non-binary',
      ethnicity: 'mixed',
      primaryLanguage: 'en',
    },
    content: `Therapist: Thank you for sharing your preferred pronouns with me. How are you feeling today?
Patient: I've been experiencing some anxiety about coming out at work.
Therapist: That sounds like a significant source of stress. Can you tell me more about what specifically concerns you?
Patient: I'm worried about how my colleagues will react.
Therapist: Your concerns are completely valid. Let's explore some strategies that feel right for you and your situation.`,
    expectedBiasScore: 0.15,
    learningObjectives: [
      'Demonstrate inclusive therapeutic practices',
      'Show respect for client identity and autonomy',
      'Practice affirming communication techniques',
    ],
  },
  {
    id: 'high-bias-age',
    name: 'Ageism in Treatment',
    description: 'Age-based assumptions affecting therapeutic approach',
    riskLevel: 'high',
    category: 'age',
    scenario: 'crisis-intervention',
    demographics: {
      age: '65+',
      gender: 'male',
      ethnicity: 'white',
      primaryLanguage: 'en',
    },
    content: `Therapist: At your age, it's normal to feel depressed about declining health and abilities.
Patient: I'm actually quite active and healthy. My depression is about losing my wife.
Therapist: Well, elderly people often struggle with technology and social connections these days.
Patient: I use technology fine. I'm grieving, not incompetent.
Therapist: Maybe we should focus on accepting the limitations that come with aging.`,
    expectedBiasScore: 0.75,
    learningObjectives: [
      'Recognize ageist assumptions in therapeutic practice',
      'Understand individual differences within age groups',
      'Practice age-appropriate but not patronizing communication',
    ],
  },
  {
    id: 'medium-bias-linguistic',
    name: 'Language Barrier Bias',
    description:
      'Assumptions about language ability affecting therapeutic quality',
    riskLevel: 'medium',
    category: 'linguistic',
    scenario: 'trauma-therapy',
    demographics: {
      age: '36-50',
      gender: 'female',
      ethnicity: 'asian',
      primaryLanguage: 'zh',
    },
    content: `Therapist: Let me speak slowly so you can understand better.
Patient: My English is actually quite good, I've lived here for 20 years.
Therapist: Oh, but trauma therapy requires very precise communication. Maybe we should use simpler words.
Patient: I understand complex concepts. I have a PhD in engineering.
Therapist: That's impressive, but emotional vocabulary is different. Let me explain things more basically.`,
    expectedBiasScore: 0.55,
    learningObjectives: [
      'Avoid assumptions about language proficiency',
      'Recognize linguistic bias in therapeutic communication',
      'Practice respectful communication with multilingual clients',
    ],
  },
  {
    id: 'critical-bias-intersectional',
    name: 'Multiple Bias Intersection',
    description: 'Complex scenario with multiple intersecting bias types',
    riskLevel: 'critical',
    category: 'intersectional',
    scenario: 'substance-abuse',
    demographics: {
      age: '18-25',
      gender: 'female',
      ethnicity: 'black',
      primaryLanguage: 'en',
    },
    content: `Therapist: Young Black women from your neighborhood often turn to drugs because of family problems.
Patient: That's a harmful stereotype. My substance use isn't about my race or where I live.
Therapist: I'm just being realistic about the challenges in your community.
Patient: You don't know anything about my community or my family.
Therapist: Statistics show that single mothers in urban areas struggle more with addiction.
Patient: You're making assumptions about my family structure and my life.`,
    expectedBiasScore: 0.92,
    learningObjectives: [
      'Recognize intersectional bias patterns',
      'Understand cumulative impact of multiple stereotypes',
      'Practice individualized, non-assumptive therapeutic approach',
    ],
  },
]

/**
 * Generate realistic bias factors based on session data
 */
export function calculateBiasFactors(sessionData: SessionData): BiasFactors {
  const content = sessionData.content.toLowerCase()
  const { demographics } = sessionData

  // Base bias scores
  let linguistic = 0.15 + Math.random() * 0.1
  let gender = 0.1 + Math.random() * 0.05
  let racial = 0.08 + Math.random() * 0.05
  let age = 0.12 + Math.random() * 0.05
  let cultural = 0.09 + Math.random() * 0.05

  // Content-based bias detection
  const biasKeywords = {
    cultural: [
      'culture',
      'traditional',
      'your people',
      'background',
      'heritage',
    ],
    gender: ['naturally', 'instinct', 'emotional', 'nurturing', 'typical'],
    age: ['at your age', 'elderly', 'young people', 'generation', 'declining'],
    racial: ['community', 'neighborhood', 'statistics show', 'realistic about'],
    linguistic: [
      'speak slowly',
      'simpler words',
      'let me explain',
      'understand better',
    ],
  }

  // Increase bias scores based on problematic content
  Object.entries(biasKeywords).forEach(([biasType, keywords]) => {
    const keywordCount = keywords.filter((keyword) =>
      content.includes(keyword),
    ).length
    const biasIncrease = keywordCount * 0.15

    switch (biasType) {
      case 'cultural':
        cultural += biasIncrease
        break
      case 'gender':
        gender += biasIncrease
        break
      case 'age':
        age += biasIncrease
        break
      case 'racial':
        racial += biasIncrease
        break
      case 'linguistic':
        linguistic += biasIncrease
        break
    }
  })

  // Demographic-based risk factors
  if (demographics.ethnicity !== 'white') {
    racial += 0.1
    cultural += 0.08
  }
  if (demographics.primaryLanguage !== 'en') {
    linguistic += 0.2
    cultural += 0.12
  }
  if (demographics.age === '65+' || demographics.age === '18-25') {
    age += 0.15
  }
  if (
    demographics.gender === 'non-binary' ||
    demographics.gender === 'prefer-not-to-say'
  ) {
    gender += 0.1
  }

  // Calculate overall score
  const overall = (linguistic + gender + racial + age + cultural) / 5

  return {
    overall: Math.min(overall, 0.95),
    linguistic: Math.min(linguistic, 0.9),
    gender: Math.min(gender, 0.8),
    racial: Math.min(racial, 0.8),
    age: Math.min(age, 0.8),
    cultural: Math.min(cultural, 0.8),
    model: overall * 0.9 + Math.random() * 0.1,
    interactive: overall * 0.85 + Math.random() * 0.15,
    evaluation: overall * 0.8 + Math.random() * 0.2,
  }
}

/**
 * Generate counterfactual scenarios based on analysis results
 */
export function generateCounterfactualScenarios(
  biasFactors: BiasFactors,
): CounterfactualScenario[] {
  const scenarios: CounterfactualScenario[] = []

  // Age-based counterfactual
  if (biasFactors.age > 0.3) {
    scenarios.push({
      id: 'age-counterfactual',
      change: 'Different Age Group (25-35 instead of current)',
      impact: `Bias score could decrease by ${(biasFactors.age * 100).toFixed(0)}-${((biasFactors.age + 0.1) * 100).toFixed(0)}%`,
      likelihood: biasFactors.age > 0.5 ? 'high' : 'medium',
      biasScoreChange: -biasFactors.age * 0.8,
      confidence: 0.85,
    })
  }

  // Cultural/ethnic counterfactual
  if (biasFactors.cultural > 0.3 || biasFactors.racial > 0.3) {
    scenarios.push({
      id: 'cultural-counterfactual',
      change: 'Different Cultural Background (White, English-speaking)',
      impact: 'Cultural and racial bias patterns may shift significantly',
      likelihood:
        Math.max(biasFactors.cultural, biasFactors.racial) > 0.5
          ? 'high'
          : 'medium',
      biasScoreChange: -(biasFactors.cultural + biasFactors.racial) * 0.6,
      confidence: 0.78,
    })
  }

  // Gender counterfactual
  if (biasFactors.gender > 0.3) {
    scenarios.push({
      id: 'gender-counterfactual',
      change: 'Different Gender Identity',
      impact: `Gender bias could reduce by ${(biasFactors.gender * 80).toFixed(0)}-${(biasFactors.gender * 100).toFixed(0)}%`,
      likelihood: biasFactors.gender > 0.4 ? 'high' : 'medium',
      biasScoreChange: -biasFactors.gender * 0.7,
      confidence: 0.82,
    })
  }

  // Language counterfactual
  if (biasFactors.linguistic > 0.3) {
    scenarios.push({
      id: 'language-counterfactual',
      change: 'Native English Speaker',
      impact: 'Linguistic bias could reduce by 60-80%',
      likelihood: 'high',
      biasScoreChange: -biasFactors.linguistic * 0.75,
      confidence: 0.88,
    })
  }

  // Therapeutic approach counterfactual
  scenarios.push({
    id: 'approach-counterfactual',
    change: 'Modified Therapeutic Language (Bias-aware)',
    impact: `Overall bias could decrease by ${(biasFactors.overall * 40).toFixed(0)}-${(biasFactors.overall * 60).toFixed(0)}%`,
    likelihood: 'high',
    biasScoreChange: -biasFactors.overall * 0.5,
    confidence: 0.92,
  })

  return scenarios
}

/**
 * Generate historical comparison data
 */
export function generateHistoricalComparison(
  currentBiasScore: number,
): HistoricalComparison {
  const thirtyDayAverage = 0.235 + (Math.random() - 0.5) * 0.1
  const comparisonToAverage = currentBiasScore - thirtyDayAverage

  let trendDirection: 'improving' | 'stable' | 'worsening'
  if (Math.abs(comparisonToAverage) < 0.05) {
    trendDirection = 'stable'
  } else if (comparisonToAverage < 0) {
    trendDirection = 'improving'
  } else {
    trendDirection = 'worsening'
  }

  return {
    thirtyDayAverage: Math.max(0, thirtyDayAverage),
    sevenDayTrend: trendDirection,
    percentileRank: Math.floor(Math.random() * 100),
    comparisonToAverage,
    trendDirection:
      trendDirection === 'improving'
        ? 'Improving ↘️'
        : trendDirection === 'worsening'
          ? 'Worsening ↗️'
          : 'Stable →',
  }
}

/**
 * Generate comprehensive recommendations based on bias factors
 */
export function generateRecommendations(
  biasFactors: BiasFactors,
  demographics: Demographics,
): string[] {
  const recommendations: string[] = []

  // Overall bias recommendations
  if (biasFactors.overall > 0.7) {
    recommendations.push(
      '🚨 Critical bias detected - implement immediate intervention and supervision',
    )
    recommendations.push(
      '📚 Mandatory bias awareness training required before continuing client work',
    )
  } else if (biasFactors.overall > 0.5) {
    recommendations.push(
      '⚠️ High bias detected - schedule additional supervision and bias training',
    )
  }

  // Specific bias type recommendations
  if (biasFactors.racial > 0.4) {
    recommendations.push(
      '🌍 Review content for racial bias patterns and implement cultural humility practices',
    )
    recommendations.push(
      '📖 Complete cultural competency training focused on anti-racism in therapy',
    )
  }

  if (biasFactors.gender > 0.4) {
    recommendations.push(
      '⚧ Analyze gender-based assumptions and practice gender-affirming language',
    )
    recommendations.push(
      '🏳️‍⚧️ Complete training on LGBTQ+ affirming therapeutic practices',
    )
  }

  if (biasFactors.age > 0.4) {
    recommendations.push(
      '👥 Address ageist assumptions and practice age-appropriate communication',
    )
    recommendations.push(
      '📚 Study lifespan development to understand age-related diversity',
    )
  }

  if (biasFactors.cultural > 0.4) {
    recommendations.push(
      '🌏 Enhance cultural competency and avoid cultural generalizations',
    )
    recommendations.push(
      '🤝 Engage in cultural self-awareness exercises and bias reflection',
    )
  }

  if (biasFactors.linguistic > 0.4) {
    recommendations.push(
      '🗣️ Avoid assumptions about language proficiency and communication ability',
    )
    recommendations.push('🌐 Learn about multilingual therapy best practices')
  }

  // Demographic-specific recommendations
  if (demographics.primaryLanguage !== 'en') {
    recommendations.push(
      '🔄 Consider professional interpreter services for complex therapeutic work',
    )
  }

  if (
    demographics.gender === 'non-binary' ||
    demographics.gender === 'prefer-not-to-say'
  ) {
    recommendations.push(
      '🏳️‍⚧️ Ensure consistent use of chosen pronouns and gender-affirming language',
    )
  }

  // General improvement recommendations
  if (biasFactors.overall > 0.3) {
    recommendations.push(
      '🎯 Practice mindfulness and self-reflection before and during sessions',
    )
    recommendations.push(
      '📝 Implement bias interruption techniques in real-time',
    )
    recommendations.push(
      '👥 Seek consultation with colleagues from diverse backgrounds',
    )
  }

  return recommendations
}

/**
 * Create export data structure with comprehensive metadata
 */
export function createExportData(
  analysisResults: BiasAnalysisResults,
  counterfactualScenarios: CounterfactualScenario[],
  historicalComparison: HistoricalComparison,
): ExportData {
  return {
    timestamp: new Date().toISOString(),
    sessionId: analysisResults.sessionId,
    analysis: analysisResults,
    counterfactualScenarios,
    historicalComparison,
    metadata: {
      exportedBy: 'bias-detection-demo',
      version: '2.0.0',
      demoType: 'enhanced-bias-detection',
    },
  }
}

/**
 * Download export data as JSON file
 */
export function downloadExportData(exportData: ExportData): void {
  try {
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bias-analysis-${exportData.sessionId}-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (error: unknown) {
    console.error('Export failed:', error)
    throw new Error('Failed to export analysis results. Please try again.', {
      cause: error,
    })
  }
}

/**
 * Get preset scenario by ID
 */
export function getPresetScenario(id: string): PresetScenario | undefined {
  return PRESET_SCENARIOS.find((scenario) => scenario.id === id)
}

/**
 * Get preset scenarios by category
 */
export function getPresetScenariosByCategory(
  category: string,
): PresetScenario[] {
  return PRESET_SCENARIOS.filter((scenario) => scenario.category === category)
}

/**
 * Get preset scenarios by risk level
 */
export function getPresetScenariosByRiskLevel(
  riskLevel: string,
): PresetScenario[] {
  return PRESET_SCENARIOS.filter((scenario) => scenario.riskLevel === riskLevel)
}

/**
 * Determine alert level based on bias score
 */
export function determineAlertLevel(
  biasScore: number,
): 'low' | 'medium' | 'high' | 'critical' {
  if (biasScore >= 0.8) {
    return 'critical'
  }
  if (biasScore >= 0.6) {
    return 'high'
  }
  if (biasScore >= 0.4) {
    return 'medium'
  }
  return 'low'
}

/**
 * Check if browser crypto API is available
 */
const hasBrowserCrypto = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    window.crypto &&
    window.crypto.getRandomValues !== undefined
  )
}

/**
 * Check if Node.js crypto is available
 */
const hasNodeCrypto = (): boolean => {
  return (
    typeof process !== 'undefined' &&
    process.versions !== undefined &&
    process.versions.node !== undefined
  )
}

/**
 * Generate random values using browser crypto API
 */
const generateBrowserRandomValues = (array: Uint32Array): void => {
  if (hasBrowserCrypto()) {
    window.crypto.getRandomValues(array)
  }
}

/**
 * Generate random values using Node.js crypto
 */
import { tryRequireNode } from './index'

/**
 * Generate random values using Node.js crypto
 */
const generateNodeRandomValues = (array: Uint32Array): void => {
  if (!hasNodeCrypto()) {
    return
  }
  // Node.js fallback - use guarded runtime require to avoid bundler issues
  // Use tryRequireNode from utils to avoid bundlers including `crypto` in frontend bundles
  // Import dynamically to prevent circular import at module-eval time
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const crypto = tryRequireNode('crypto') || require('crypto')
  const buf = crypto.randomBytes(8)
  array[0] = buf.readUInt32LE(0)
  array[1] = buf.readUInt32LE(4)
}

/**
 * Generate session ID
 */
export function generateSessionId(): string {
  // Use cryptographically secure random values for session ID
  const array = new Uint32Array(2)
  if (hasBrowserCrypto()) {
    generateBrowserRandomValues(array)
  } else if (hasNodeCrypto()) {
    generateNodeRandomValues(array)
  } else {
    // Fallback to Math.random (should not happen)
    array[0] = Math.floor(Math.random() * 0xffffffff)
    array[1] = Math.floor(Math.random() * 0xffffffff)
  }
  const randomStr = (array[0] ?? 0).toString(36) + (array[1] ?? 0).toString(36)
  return 'demo_' + Date.now() + '_' + randomStr.slice(0, 9)
}
