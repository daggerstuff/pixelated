/**
 * Cognitive Distortions Types
 * Definitions for cognitive distortion detection types
 */

export type CognitiveDistortionType =
  | 'all-or-nothing'
  | 'overgeneralization'
  | 'mental-filter'
  | 'disqualifying-positive'
  | 'mind-reading'
  | 'fortune-telling'
  | 'catastrophizing'
  | 'minimization'
  | 'emotional-reasoning'
  | 'should-statements'
  | 'labeling'
  | 'personalization'

export interface CognitiveDistortion {
  type: CognitiveDistortionType
  label: string
  description: string
  example: string
  question: string
  patterns: RegExp[]
}

export interface DetectedDistortion {
  type: CognitiveDistortionType
  confidence: number
  evidence: string
  suggestion: string
}

export interface CognitiveDistortionResult {
  distortions: DetectedDistortion[]
  overallNegativeThinking: number
  summary: string
  timestamp: number
}

export interface CognitiveDistortionConfig {
  type: CognitiveDistortionType
  name: string
  patterns: RegExp[]
  description: string
  impact: string
}

export const cognitiveDistortionConfigs: Record<
  CognitiveDistortionType,
  CognitiveDistortion
> = {
  'all-or-nothing': {
    type: 'all-or-nothing',
    label: 'All-or-Nothing Thinking',
    description: 'Seeing things in black and white categories',
    example: 'If I fail at one thing, I am a total failure',
    question: 'Are there any shades of gray in this situation?',
    patterns: [/always/i, /never/i, /completely/i, /total/i, /perfect/i],
  },
  overgeneralization: {
    type: 'overgeneralization',
    label: 'Overgeneralization',
    description: 'Making broad conclusions from a single event',
    example: 'I always make mistakes',
    question: 'What evidence supports this generalization?',
    patterns: [/always/i, /everyone/i, /nobody/i, /every time/i],
  },
  'mental-filter': {
    type: 'mental-filter',
    label: 'Mental Filter',
    description: 'Focusing only on negatives while filtering out positives',
    example: 'My boss said one thing negative among many positives',
    question: 'What positive aspects might you be overlooking?',
    patterns: [/terrible /i, /awful/i, /only bad/i],
  },
  'disqualifying-positive': {
    type: 'disqualifying-positive',
    label: 'Disqualifying the Positive',
    description: 'Dismissing positive experiences as not counting',
    example: 'They only said that to be nice',
    question: 'What evidence suggests this compliment is genuine?',
    patterns: [/just luck/i, /doesn't count/i, /only because/i],
  },
  'mind-reading': {
    type: 'mind-reading',
    label: 'Mind Reading',
    description: 'Assuming you know what others are thinking',
    example: 'They think I am incompetent',
    question: 'What evidence do you have about their actual thoughts?',
    patterns: [/they think/i, /I know they/i, /she thinks/i, /he thinks/i],
  },
  'fortune-telling': {
    type: 'fortune-telling',
    label: 'Fortune Telling',
    description: 'Predicting negative outcomes without evidence',
    example: 'I know I will fail this presentation',
    question: 'What evidence supports this prediction?',
    patterns: [/I know will/i, /going to fail/i, /never get better/i],
  },
  catastrophizing: {
    type: 'catastrophizing',
    label: 'Catastrophizing',
    description: 'Expecting the worst possible outcome',
    example: 'If this goes wrong, everything will be ruined',
    question: 'What are the most likely outcomes?',
    patterns: [/horrible/i, /disaster/i, /end of the world/i],
  },
  minimization: {
    type: 'minimization',
    label: 'Minimization',
    description: 'Shrinking the importance of positive events',
    example: 'It was just luck, not a real achievement',
    question: 'How would you describe this to a friend?',
    patterns: [/no big deal/i, /anyone could/i, /just/i],
  },
  'emotional-reasoning': {
    type: 'emotional-reasoning',
    label: 'Emotional Reasoning',
    description: 'Assuming feelings reflect reality',
    example: 'I feel stupid, so I must be stupid',
    question: 'Do your feelings necessarily reflect the facts?',
    patterns: [/I feel like/i, /feel stupid/i, /feel like a failure/i],
  },
  'should-statements': {
    type: 'should-statements',
    label: 'Should Statements',
    description: 'Criticizing yourself with "shoulds" and "musts"',
    example: 'I should always be productive',
    question: 'Is this expectation realistic?',
    patterns: [/should/i, /must/i, /ought to/i, /have to/i],
  },
  labeling: {
    type: 'labeling',
    label: 'Labeling',
    description: 'Attaching negative labels to yourself or others',
    example: 'I am a loser',
    question: 'Can you describe the behavior without the label?',
    patterns: [/I am a/i, /you are a/i, /idiot/i, /loser/i, /failure/i],
  },
  personalization: {
    type: 'personalization',
    label: 'Personalization',
    description: 'Taking responsibility for things outside your control',
    example: 'My friend is upset, it must be my fault',
    question: 'What other factors might explain this?',
    patterns: [/my fault/i, /because of me/i, /I caused/i],
  },
}
