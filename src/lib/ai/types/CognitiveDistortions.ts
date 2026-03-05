/**
 * Cognitive Distortions Types
 * Definitions for cognitive distortion detection types
 */

export type CognitiveDistortionType =
  | "all-or-nothing"
  | "overgeneralization"
  | "mental-filter"
  | "disqualifying-positive"
  | "mind-reading"
  | "fortune-telling"
  | "catastrophizing"
  | "minimization"
  | "emotional-reasoning"
  | "should-statements"
  | "labeling"
  | "personalization";

export interface CognitiveDistortion {
  type: CognitiveDistortionType;
  label: string;
  description: string;
  example: string;
  question: string;
}

export interface CognitiveDistortionResult {
  detected: boolean;
  distortions: Array<{
    type: CognitiveDistortionType;
    confidence: number;
    evidence: string;
    suggestion: string;
  }>;
  overallScore: number;
  timestamp: string;
}

export interface CognitiveDistortionConfig {
  type: CognitiveDistortionType;
  keywords: string[];
  patterns: RegExp[];
  severity: number;
}

export const cognitiveDistortionConfigs: CognitiveDistortion[] = [
  {
    type: "all-or-nothing",
    label: "All-or-Nothing Thinking",
    description: "Seeing things in black and white categories",
    example: "If I fail at one thing, I am a total failure",
    question: "Are there any shades of gray in this situation?",
  },
  {
    type: "overgeneralization",
    label: "Overgeneralization",
    description: "Making broad conclusions from a single event",
    example: "I always make mistakes",
    question: "What evidence supports this generalization?",
  },
  {
    type: "mental-filter",
    label: "Mental Filter",
    description: "Focusing only on negatives while filtering out positives",
    example: "My boss said one thing negative among many positives",
    question: "What positive aspects might you be overlooking?",
  },
  {
    type: "disqualifying-positive",
    label: "Disqualifying the Positive",
    description: "Dismissing positive experiences as not counting",
    example: "They only said that to be nice",
    question: "What evidence suggests this compliment is genuine?",
  },
  {
    type: "mind-reading",
    label: "Mind Reading",
    description: "Assuming you know what others are thinking",
    example: "They think I am incompetent",
    question: "What evidence do you have about their actual thoughts?",
  },
  {
    type: "fortune-telling",
    label: "Fortune Telling",
    description: "Predicting negative outcomes without evidence",
    example: "I know I will fail this presentation",
    question: "What evidence supports this prediction?",
  },
  {
    type: "catastrophizing",
    label: "Catastrophizing",
    description: "Expecting the worst possible outcome",
    example: "If this goes wrong, everything will be ruined",
    question: "What are the most likely outcomes?",
  },
  {
    type: "minimization",
    label: "Minimization",
    description: "Shrinking the importance of positive events",
    example: "It was just luck, not a real achievement",
    question: "How would you describe this to a friend?",
  },
  {
    type: "emotional-reasoning",
    label: "Emotional Reasoning",
    description: "Assuming feelings reflect reality",
    example: "I feel stupid, so I must be stupid",
    question: "Do your feelings necessarily reflect the facts?",
  },
  {
    type: "should-statements",
    label: "Should Statements",
    description: 'Criticizing yourself with "shoulds" and "musts"',
    example: "I should always be productive",
    question: "Is this expectation realistic?",
  },
  {
    type: "labeling",
    label: "Labeling",
    description: "Attaching negative labels to yourself or others",
    example: "I am a loser",
    question: "Can you describe the behavior without the label?",
  },
  {
    type: "personalization",
    label: "Personalization",
    description: "Taking responsibility for things outside your control",
    example: "My friend is upset, it must be my fault",
    question: "What other factors might explain this?",
  },
];
