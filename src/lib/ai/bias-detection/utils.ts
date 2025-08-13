import { z } from 'zod'

const TherapeuticSessionSchema = z.object({
  sessionId: z.string(),
  timestamp: z.instanceof(Date),
  participantDemographics: z.object({
    age: z.string(),
    gender: z.string(),
    ethnicity: z.string(),
    primaryLanguage: z.string(),
    socioeconomicStatus: z.string().optional(),
    education: z.string().optional(),
    region: z.string().optional(),
    culturalBackground: z.array(z.string()).optional(),
    disabilityStatus: z.string().optional(),
  }),
  scenario: z.object({
    scenarioId: z.string(),
    type: z.enum([
      'depression',
      'anxiety',
      'trauma',
      'substance-abuse',
      'grief',
      'other',
    ]),
    complexity: z.enum(['beginner', 'intermediate', 'advanced']),
    tags: z.array(z.string()),
    description: z.string(),
    learningObjectives: z.array(z.string()),
  }),
  content: z.object({
    patientPresentation: z.string(),
    therapeuticInterventions: z.array(z.string()),
    patientResponses: z.array(z.string()),
    sessionNotes: z.string(),
    assessmentResults: z.record(z.unknown()).optional(),
  }),
  aiResponses: z.array(
    z.object({
      responseId: z.string(),
      timestamp: z.instanceof(Date),
      type: z.enum([
        'diagnostic',
        'intervention',
        'risk-assessment',
        'recommendation',
      ]),
      content: z.string(),
      confidence: z.number(),
      modelUsed: z.string(),
      reasoning: z.string().optional(),
    }),
  ),
  transcripts: z.array(
    z.object({
      speakerId: z.string(),
      timestamp: z.instanceof(Date),
      content: z.string(),
      emotionalTone: z.string().optional(),
      confidenceLevel: z.number().optional(),
    }),
  ),
  metadata: z.object({
    trainingInstitution: z.string(),
    supervisorId: z.string().optional(),
    traineeId: z.string(),
    sessionDuration: z.number(),
    completionStatus: z.enum(['completed', 'partial', 'abandoned']),
    technicalIssues: z.array(z.string()).optional(),
  }),
})

export { TherapeuticSessionSchema }

// Example session data for testing
const session = {
  sessionId: 'example-session-id',
  timestamp: new Date(),
  participantDemographics: {
    age: '26-35',
    gender: 'prefer-not-to-say',
    ethnicity: 'not-specified',
    primaryLanguage: 'en',
    socioeconomicStatus: 'middle',
    education: 'bachelor',
    region: 'unknown',
  },
  scenario: {
    scenarioId: 'scenario-id-test',
    type: 'depression',
    complexity: 'beginner',
    tags: ['test'],
    description: 'Test scenario description',
    learningObjectives: ['Objective 1'],
  },
  content: {
    patientPresentation: 'Test patient presentation',
    therapeuticInterventions: ['Intervention 1'],
    patientResponses: ['Response 1'],
    sessionNotes: 'Session notes here',
  },
  aiResponses: [],
  transcripts: [],
  metadata: {
    trainingInstitution: 'Test Institution',
    traineeId: 'trainee-test-id',
    sessionDuration: 30,
    completionStatus: 'partial',
  },
}

// Validation function for testing (call manually when needed)
export function validateExampleSession() {
  try {
    const rawSession = TherapeuticSessionSchema.parse(session)
    console.log('Session validation successful:', rawSession)
    return rawSession
  } catch (error) {
    console.error('Error parsing session data:', error)
    throw error
  }
}

/**
 * Check if a value is within a specified range
 */
export function isWithinRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) {
    return newValue === 0 ? 0 : 100
  }
  return ((newValue - oldValue) / oldValue) * 100
}

/**
 * Generate analysis summary from bias detection results
 */
export function generateAnalysisSummary(results: any): string {
  if (!results || typeof results !== 'object') {
    return 'No analysis results available'
  }

  const summary: string[] = []
  
  if (results.overallBiasScore !== undefined) {
    summary.push(`Overall bias score: ${results.overallBiasScore.toFixed(2)}`)
  }
  
  if (results.detectedBiases && Array.isArray(results.detectedBiases)) {
    summary.push(`Detected biases: ${results.detectedBiases.length}`)
  }
  
  if (results.riskLevel) {
    summary.push(`Risk level: ${results.riskLevel}`)
  }

  return summary.length > 0 ? summary.join(', ') : 'Analysis completed'
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as unknown as T
  }
  
  const cloned = {} as T
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key])
    }
  }
  
  return cloned
}

/**
 * Debounce function to limit function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    
    timeout = setTimeout(() => {
      func(...args)
    }, wait)
  }
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt === maxRetries) {
        throw lastError
      }
      
      const delay = baseDelay * Math.pow(2, attempt)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError!
}

/**
 * Format bias score for display
 */
export function formatBiasScore(score: number): string {
  if (typeof score !== 'number' || isNaN(score)) {
    return 'N/A'
  }
  
  return score.toFixed(2)
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: Date | string | number): string {
  try {
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) {
      return 'Invalid date'
    }
    
    return date.toLocaleString()
  } catch (error) {
    return 'Invalid date'
  }
}
