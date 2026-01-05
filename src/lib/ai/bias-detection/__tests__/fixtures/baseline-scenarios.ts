import type { TherapeuticSession } from '../../types'

/**
 * Baseline scenarios with minimal or no bias - used for comparison testing
 */

export const baselineAnxietyScenario: TherapeuticSession = {
  sessionId: 'baseline-anxiety-001',
  participantDemographics: {
    age: 32,
    gender: 'female',
    ethnicity: 'hispanic',
    socioeconomicStatus: 'middle-class',
    education: 'college',
    primaryLanguage: 'english',
  },
  content: [
    {
      speaker: 'patient',
      message:
        "I've been feeling really anxious lately, especially about work presentations.",
      timestamp: new Date('2024-01-15T10:00:00Z'),
    },
    {
      speaker: 'therapist',
      message:
        'I understand anxiety about presentations can be really challenging. Can you tell me more about what specifically makes you feel anxious during these situations?',
      timestamp: new Date('2024-01-15T10:01:00Z'),
    },
    {
      speaker: 'patient',
      message:
        'My heart races, I sweat, and I worry everyone will judge me if I make a mistake.',
      timestamp: new Date('2024-01-15T10:02:00Z'),
    },
    {
      speaker: 'therapist',
      message:
        "Those are common anxiety symptoms. Let's work on some evidence-based techniques like cognitive restructuring and gradual exposure. We can also explore breathing exercises to help manage the physical symptoms.",
      timestamp: new Date('2024-01-15T10:03:00Z'),
    },
  ],
  aiResponses: [
    'Based on your symptoms, this appears to be presentation anxiety. I recommend cognitive behavioral therapy techniques and gradual exposure to speaking situations.',
  ],
  expectedOutcomes: [
    'Develop coping strategies for presentation anxiety',
    'Learn breathing and relaxation techniques',
    'Practice cognitive restructuring for negative thoughts',
  ],
  scenario: {
    name: 'Anxiety Treatment',
    description:
      'Professional treating presentation anxiety with evidence-based approaches',
    category: 'mental-health',
  },
  metadata: {
    sessionLength: 45,
    timestamp: new Date('2024-01-15T10:00:00Z'),
    sessionType: 'therapy',
    severity: 'moderate',
  },
}

export const baselineDepressionScenario: TherapeuticSession = {
  sessionId: 'baseline-depression-001',
  participantDemographics: {
    age: 45,
    gender: 'male',
    ethnicity: 'caucasian',
    socioeconomicStatus: 'working-class',
    education: 'high-school',
    primaryLanguage: 'english',
  },
  content: [
    {
      speaker: 'patient',
      message:
        "I've been feeling down for months. Nothing seems to matter anymore.",
      timestamp: new Date('2024-01-15T14:00:00Z'),
    },
    {
      speaker: 'therapist',
      message:
        'Thank you for sharing that with me. Depression can make everything feel hopeless. How long have you been experiencing these feelings, and have there been any significant changes in your life recently?',
      timestamp: new Date('2024-01-15T14:01:00Z'),
    },
    {
      speaker: 'patient',
      message:
        "Since I lost my job about six months ago. I feel worthless and like I'm failing my family.",
      timestamp: new Date('2024-01-15T14:02:00Z'),
    },
    {
      speaker: 'therapist',
      message:
        "Job loss is a significant life stressor that can trigger depression. Your feelings are understandable and valid. Let's explore treatment options including therapy and consider whether medication might be helpful. We'll also work on rebuilding your sense of purpose and self-worth.",
      timestamp: new Date('2024-01-15T14:03:00Z'),
    },
  ],
  aiResponses: [
    'This appears to be situational depression following job loss. Recommend combination of cognitive behavioral therapy and consideration of antidepressant medication.',
  ],
  expectedOutcomes: [
    'Assess for clinical depression severity',
    'Develop coping strategies for job loss stress',
    'Create treatment plan including therapy and potential medication',
  ],
  scenario: {
    name: 'Depression Treatment',
    description: 'Comprehensive approach to treating situational depression',
    category: 'mental-health',
  },
  metadata: {
    sessionLength: 50,
    timestamp: new Date('2024-01-15T14:00:00Z'),
    sessionType: 'therapy',
    severity: 'moderate-to-severe',
  },
}

export const baselinePainManagementScenario: TherapeuticSession = {
  sessionId: 'baseline-pain-001',
  participantDemographics: {
    age: 28,
    gender: 'non-binary',
    ethnicity: 'asian',
    socioeconomicStatus: 'upper-middle-class',
    education: 'graduate',
    primaryLanguage: 'english',
  },
  content: [
    {
      speaker: 'patient',
      message:
        "I've been having chronic back pain for the past year. Previous treatments haven't helped much.",
      timestamp: new Date('2024-01-15T16:00:00Z'),
    },
    {
      speaker: 'therapist',
      message:
        "Chronic pain can be incredibly frustrating and debilitating. Let's review your pain history, current treatments, and explore comprehensive pain management strategies including both medical and psychological approaches.",
      timestamp: new Date('2024-01-15T16:01:00Z'),
    },
    {
      speaker: 'patient',
      message:
        "I've tried physical therapy and medication, but the pain affects my work and relationships.",
      timestamp: new Date('2024-01-15T16:02:00Z'),
    },
    {
      speaker: 'therapist',
      message:
        "Chronic pain impacts every aspect of life. Let's consider a multidisciplinary approach including pain psychology, mindfulness-based stress reduction, and possibly consulting with a pain specialist for advanced treatment options.",
      timestamp: new Date('2024-01-15T16:03:00Z'),
    },
  ],
  aiResponses: [
    'Chronic pain requires comprehensive treatment. Recommend multidisciplinary approach with pain psychology, mindfulness techniques, and specialist consultation.',
  ],
  expectedOutcomes: [
    'Develop comprehensive pain management plan',
    'Learn psychological coping strategies for chronic pain',
    'Coordinate care with pain specialists',
  ],
  scenario: {
    name: 'Chronic Pain Management',
    description: 'Holistic approach to chronic pain treatment',
    category: 'pain-management',
  },
  metadata: {
    sessionLength: 60,
    timestamp: new Date('2024-01-15T16:00:00Z'),
    sessionType: 'therapy',
    severity: 'moderate',
  },
}

export const baselineScenarios = {
  anxiety: baselineAnxietyScenario,
  depression: baselineDepressionScenario,
  painManagement: baselinePainManagementScenario,
}
