/**
 * Speech Recognition Utilities
 *
 * Helper functions and configuration for Web Speech API integration.
 * Provides features for initializing and managing speech recognition
 * with privacy-first approaches and enhanced therapeutic features.
 */

// Define proper types for Web Speech API
interface SpeechRecognitionInterface {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  grammars?: SpeechGrammarListInterface
  start(): void
  stop(): void
  abort(): void
  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void
}

interface SpeechGrammarListInterface {
  addFromString(string: string, weight: number): void
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInterface
}

interface SpeechGrammarListConstructor {
  new (): SpeechGrammarListInterface
}

// Define the speech recognition window interface
declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor
    webkitSpeechRecognition: SpeechRecognitionConstructor
    SpeechGrammarList: SpeechGrammarListConstructor
  }
}

/**
 * Configuration options for speech recognition
 */
export interface SpeechRecognitionConfig {
  language?: string
  continuous?: boolean
  interimResults?: boolean
  maxAlternatives?: number
  grammarList?: string[]
}

/**
 * Default configuration for therapeutic practice
 */
export const DEFAULT_SPEECH_CONFIG: SpeechRecognitionConfig = {
  language: 'en-US',
  continuous: true,
  interimResults: true,
  maxAlternatives: 1,
}

/**
 * Creates and configures a speech recognition instance
 */
export function createSpeechRecognition(
  config: SpeechRecognitionConfig = DEFAULT_SPEECH_CONFIG,
): SpeechRecognitionInterface | null {
  // Check if browser supports the Web Speech API
  if (
    typeof window === 'undefined' ||
    (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window))
  ) {
    return null
  }

  // Initialize speech recognition with the appropriate constructor
  const SpeechRecognitionConstructor =
    (window as unknown as Window).SpeechRecognition ||
    (window as unknown as Window).webkitSpeechRecognition

  const recognition = new SpeechRecognitionConstructor()

  // Apply configuration
  recognition.lang = config.language || 'en-US'
  recognition.continuous =
    config.continuous !== undefined ? config.continuous : true
  recognition.interimResults =
    config.interimResults !== undefined ? config.interimResults : true
  recognition.maxAlternatives = config.maxAlternatives || 1

  // Add grammar list if specified and supported
  if (config.grammarList && window.SpeechGrammarList) {
    const speechGrammarList = new window.SpeechGrammarList()
    for (const grammar of config.grammarList) {
      speechGrammarList.addFromString(grammar, 1)
    }
    recognition.grammars = speechGrammarList
  }

  return recognition
}

/**
 * Checks if speech recognition is supported in the current browser
 */
export function isSpeechRecognitionSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  )
}

/**
 * Creates a therapeutic vocabulary grammar for improved recognition
 * of therapeutic terminology
 */
export function createTherapeuticGrammar(domain?: string): string {
  // Base therapeutic terms that should be recognized with higher accuracy
  const coreTherapeuticTerms = [
    'empathy',
    'validation',
    'reflection',
    'mindfulness',
    'cognitive',
    'behavioral',
    'trauma',
    'anxiety',
    'depression',
    'therapeutic',
    'intervention',
    'technique',
    'emotion',
    'feeling',
    'thought',
    'behavior',
    'relationship',
  ]

  // Domain-specific terms
  const domainTerms: Record<string, string[]> = {
    anxiety: [
      'worry',
      'panic',
      'fear',
      'avoidance',
      'exposure',
      'anxious',
      'nervous',
      'overwhelmed',
      'catastrophizing',
    ],
    depression: [
      'sad',
      'hopeless',
      'motivation',
      'energy',
      'interest',
      'pleasure',
      'appetite',
      'sleep',
      'concentration',
      'worth',
    ],
    trauma: [
      'safety',
      'trust',
      'flashback',
      'nightmare',
      'trigger',
      'hypervigilance',
      'avoidance',
      'emotional numbing',
    ],
    relationship: [
      'conflict',
      'communication',
      'boundary',
      'attachment',
      'intimacy',
      'trust',
      'connection',
      'pattern',
      'cycle',
    ],
  }

  // Combine core terms with domain-specific terms if available
  const vocabularyTerms = [
    ...coreTherapeuticTerms,
    ...(domain && domainTerms[domain] ? domainTerms[domain] : []),
  ]

  // Create a simple JSGF grammar string (not fully compliant but illustrative)
  return `#JSGF V1.0;
grammar therapeutic;
public <therapeutic> = ${vocabularyTerms.join(' | ')};`
}

/**
 * Generates keyword spotting patterns for therapeutic domains
 */
export function getKeywordPatterns(domain: string): RegExp[] {
  const patterns: Record<string, RegExp[]> = {
    anxiety: [
      /\b(worry|anxious|nervous|panic|fear|phobia|stress)\b/i,
      /\b(avoid|escape|safety behavior)\b/i,
      /\b(breathing|relaxation|grounding|mindfulness)\b/i,
    ],
    depression: [
      /\b(sad|down|blue|hopeless|worthless)\b/i,
      /\b(motivation|energy|interest|pleasure|appetite|sleep)\b/i,
      /\b(negative thought|thinking|cognitive distortion)\b/i,
    ],
    trauma: [
      /\b(trauma|ptsd|flashback|nightmare|trigger)\b/i,
      /\b(safety|trust|power|control|choice)\b/i,
      /\b(hypervigilance|startle|numb|avoid|detach)\b/i,
    ],
    relationship: [
      /\b(communication|conflict|boundary|need|attachment)\b/i,
      /\b(pattern|cycle|dynamic|trigger|reaction)\b/i,
      /\b(intimacy|trust|connection|disconnect|repair)\b/i,
    ],
    general: [
      /\b(feel|feeling|emotion|thought|believe|experience)\b/i,
      /\b(cope|strategy|skill|practice|exercise|technique)\b/i,
      /\b(support|help|change|improve|better|progress)\b/i,
    ],
  }

  // eslint-disable-next-line @typescript-eslint/dot-notation
  return patterns[domain] || patterns['general'] || []
}

/**
 * Process recognized speech text for therapeutic practice
 * Enhances recognition by applying therapeutic domain knowledge
 */
export function processRecognizedSpeech(
  text: string,
  domain = 'general',
): {
  processedText: string
  detectedKeywords: string[]
  confidenceScores: Record<string, number>
} {
  // Basic text cleanup
  const processedText = text
    .trim()
    .replace(/(\s{2,})/g, ' ')
    .replace(/^\s*um\s+|^\s*uh\s+|^\s*er\s+/gi, '')

  // Detect domain-specific keywords
  const patterns = getKeywordPatterns(domain)
  const detectedKeywords: string[] = []

  for (const pattern of patterns) {
    const matches = processedText.match(pattern)
    if (matches) {
      for (const match of matches) {
        if (!detectedKeywords.includes(match)) {
          detectedKeywords.push(match)
        }
      }
    }
  }

  // Very simple confidence scoring for demonstration
  // In a real implementation, this would be more sophisticated
  const confidenceScores: Record<string, number> = {}

  for (const keyword of detectedKeywords) {
    // Assign higher confidence to keywords that appear in the domain's patterns
    confidenceScores[keyword] = 0.7 + Math.random() * 0.3
  }

  return {
    processedText,
    detectedKeywords,
    confidenceScores,
  }
}

/**
 * Returns therapeutic prompts based on detected keywords
 */
export function getTherapeuticPrompts(
  detectedKeywords: string[],
  domain = 'general',
): string[] {
  // Map of keywords to potential therapeutic follow-up prompts
  const promptMap: Record<string, string[]> = {
    // Anxiety domain
    worry: [
      'Can you tell me more about what worries you?',
      'On a scale of 0-10, how intense is this worry?',
    ],
    anxiety: [
      'Where do you feel that anxiety in your body?',
      'What thoughts come up when you feel anxious?',
    ],
    panic: [
      'What happens just before you experience panic?',
      "What helps you when you're feeling panicked?",
    ],

    // Depression domain
    sad: [
      'How long have you been feeling sad?',
      'What activities still bring you some enjoyment?',
    ],
    motivation: [
      'What small step might feel manageable right now?',
      'What helped your motivation in the past?',
    ],
    worthless: [
      'Where did you first learn to view yourself this way?',
      'What would you say to a friend who felt worthless?',
    ],

    // General therapeutic terms
    feel: [
      'What other feelings come up for you?',
      'How intense is that feeling right now?',
    ],
    cope: [
      'What coping strategies have worked for you before?',
      'What new coping skills would you like to develop?',
    ],
    support: [
      'Who in your life provides you with support?',
      'What kind of support would be most helpful right now?',
    ],
  }

  // Collect relevant prompts based on detected keywords
  const prompts: string[] = []

  for (const keyword of detectedKeywords) {
    const keywordLower = keyword.toLowerCase()
    // Try to find exact match first
    if (promptMap[keywordLower]) {
      // Add a random prompt for this keyword
      const keywordPrompts = promptMap[keywordLower]
      if (keywordPrompts) {
        const randomIndex = Math.floor(Math.random() * keywordPrompts.length)
        const selectedPrompt = keywordPrompts[randomIndex]
        if (selectedPrompt) {
          prompts.push(selectedPrompt)
        }
      }
    } else {
      // Check for partial matches
      for (const key in promptMap) {
        if (keywordLower.includes(key) || key.includes(keywordLower)) {
          const keyPrompts = promptMap[key]
          if (keyPrompts) {
            const randomIndex = Math.floor(Math.random() * keyPrompts.length)
            const selectedPrompt = keyPrompts[randomIndex]
            if (selectedPrompt) {
              prompts.push(selectedPrompt)
            }
          }
          break // Only add one prompt per keyword
        }
      }
    }
  }

  // Add domain-specific general prompts if we don't have enough
  if (prompts.length === 0) {
    const generalPrompts: Record<string, string[]> = {
      anxiety: [
        'How has anxiety been affecting you lately?',
        'What situations typically trigger your anxiety?',
      ],
      depression: [
        'How have your energy levels been this week?',
        'What activities do you find most difficult right now?',
      ],
      trauma: [
        'How have you been managing your safety needs?',
        'What helps you feel more grounded when memories arise?',
      ],
      relationship: [
        'What patterns do you notice in your interactions?',
        'How do you typically respond when feeling disconnected?',
      ],
      general: [
        'Could you tell me more about that?',
        'How does that affect you day to day?',
      ],
    }

    // eslint-disable-next-line @typescript-eslint/dot-notation
    const domainPrompts = generalPrompts[domain] || generalPrompts['general']
    if (domainPrompts) {
      const selectedPrompt =
        domainPrompts[Math.floor(Math.random() * domainPrompts.length)]
      if (selectedPrompt) {
        prompts.push(selectedPrompt)
      }
    }
  }

  // Limit to a maximum of 2 prompts
  return prompts.slice(0, 2)
}

/**
 * Analyzes a response for therapeutic techniques
 * Returns detected techniques and their confidence scores
 */
export function analyzeTherapeuticTechniques(
  text: string,
): Record<string, number> {
  // Patterns for different therapeutic techniques
  const techniquePatterns: Record<string, RegExp[]> = {
    reflection: [
      /it sounds like you(?:'re| are) feeling/i,
      /what I(?:'m| am) hearing is/i,
      /you(?:'re| are) saying that/i,
    ],
    validation: [
      /that makes sense/i,
      /it's understandable/i,
      /many people would feel/i,
      /i can see why you/i,
    ],
    open_question: [
      /\bwhat\b.+\?/i,
      /\bhow\b.+\?/i,
      /\bwhy\b.+\?/i,
      /\bcan you tell me\b.+\?/i,
    ],
    empathy: [
      /that must be/i,
      /i can imagine/i,
      /that sounds/i,
      /it's tough/i,
      /it must feel/i,
    ],
    summarizing: [
      /\bso\b.+\bsummary\b/i,
      /^let me summarize/i,
      /to summarize/i,
      /\bin summary\b/i,
    ],
  }

  const detectedTechniques: Record<string, number> = {}

  // Check for each technique
  for (const [technique, patterns] of Object.entries(techniquePatterns)) {
    // Calculate a confidence score based on how many patterns match
    let matchCount = 0

    for (const pattern of patterns) {
      if (pattern.test(text)) {
        matchCount++
      }
    }

    // Only record techniques with at least one match
    if (matchCount > 0) {
      // Calculate confidence score (higher when more patterns match)
      const baseConfidence = 0.7
      const patternBonus = (matchCount / patterns.length) * 0.3
      detectedTechniques[technique] = baseConfidence + patternBonus
    }
  }

  return detectedTechniques
}

// Example PHI audit logging - uncomment and customize as needed
// logger.info('Accessing PHI data', {
//   userId: 'user-id-here',
//   action: 'read',
//   dataType: 'patient-record',
//   recordId: 'record-id-here'
// });
