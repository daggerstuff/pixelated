export interface TherapyStyle {
  id: string
  name: string
  description: string
  approach:
    | 'cognitive-behavioral'
    | 'psychodynamic'
    | 'humanistic'
    | 'integrative'
    | 'solution-focused'
  techniques: string[]
  suitableFor: string[]
  contraindications?: string[]
}

export interface TherapyStylePreferences {
  primaryStyle: string
  secondaryStyles: string[]
  adaptiveMode: boolean
  clientSpecificAdjustments: Record<string, Partial<TherapyStyle>>
}

export const THERAPY_STYLES: Record<string, TherapyStyle> = {
  cbt: {
    id: 'cbt',
    name: 'Cognitive Behavioral Therapy',
    description:
      'Focus on identifying and changing negative thought patterns and behaviors',
    approach: 'cognitive-behavioral',
    techniques: [
      'thought challenging',
      'behavioral activation',
      'exposure therapy',
    ],
    suitableFor: ['anxiety', 'depression', 'phobias', 'PTSD'],
  },
  humanistic: {
    id: 'humanistic',
    name: 'Person-Centered Therapy',
    description:
      'Emphasizes empathy, unconditional positive regard, and client self-direction',
    approach: 'humanistic',
    techniques: ['active listening', 'reflection', 'empathic responding'],
    suitableFor: [
      'self-esteem issues',
      'personal growth',
      'relationship problems',
    ],
  },
  solutionFocused: {
    id: 'solution-focused',
    name: 'Solution-Focused Brief Therapy',
    description: 'Concentrates on solutions rather than problems',
    approach: 'solution-focused',
    techniques: ['miracle question', 'scaling questions', 'exception finding'],
    suitableFor: [
      'goal-oriented clients',
      'brief interventions',
      'specific problems',
    ],
  },
}

export type TherapyStyleId = keyof typeof THERAPY_STYLES

// Export therapyStyleConfigs as alias for THERAPY_STYLES
export const therapyStyleConfigs = THERAPY_STYLES

// Export getRecommendedStyles function
export function getRecommendedStyles(_issue: string): TherapyStyleId[] {
  // Simple stub: recommend all styles for any issue
  return Object.keys(THERAPY_STYLES) as TherapyStyleId[]
}
