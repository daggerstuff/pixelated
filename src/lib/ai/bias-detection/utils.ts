import { z } from 'zod'
import crypto from 'node:crypto'
import type {
  ParticipantDemographics,
  TherapeuticSession,
  BiasAnalysisResult,
  AlertLevel,
} from './types'

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

// Validate participant demographics data
export function validateParticipantDemographics(demographics: any): void {
  const requiredFields = ['age', 'gender', 'ethnicity', 'primaryLanguage']
  for (const field of requiredFields) {
    if (!(field in demographics)) {
      throw new Error('Invalid participant demographics data')
    }
  }
  // Example valid values for gender
  const validGenders = ['male', 'female', 'non-binary', 'prefer-not-to-say']
  if (!validGenders.includes(demographics.gender)) {
    throw new Error('Invalid participant demographics data')
  }
  // Additional validation can be added as needed
  return demographics
}

// Validate Therapeutic Session with basic checks used in tests
export function validateTherapeuticSession(session: any): TherapeuticSession {
  if (!session || typeof session !== 'object') {
    throw new Error('Invalid therapeutic session data')
  }
  const uuidV4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuidV4.test(String(session.sessionId))) {
    throw new Error('Invalid therapeutic session data')
  }
  // Convert timestamps if needed
  const normalizeDate = (d: any) => (typeof d === 'string' ? new Date(d) : d)
  const aiResponses = Array.isArray(session.aiResponses)
    ? session.aiResponses.map((r: any) => ({
        ...r,
        timestamp: normalizeDate(r.timestamp),
      }))
    : []
  const normalized: TherapeuticSession = {
    ...session,
    timestamp: normalizeDate(session.timestamp),
    aiResponses,
  }
  return normalized
}

// Validate Bias Detection configuration used in tests
export function validateBiasDetectionConfig(config: any): void {
  if (!config || typeof config !== 'object') {
    throw new Error('Invalid bias detection configuration')
  }
  const t = config.thresholds || {}
  if (
    !(t.warningLevel ?? t.warning) ||
    !(t.highLevel ?? t.high) ||
    !(t.criticalLevel ?? t.critical)
  ) {
    throw new Error('Invalid bias detection configuration')
  }
  const warning = Number(t.warningLevel ?? t.warning)
  const high = Number(t.highLevel ?? t.high)
  const critical = Number(t.criticalLevel ?? t.critical)
  if (!(warning < high && high < critical)) {
    throw new Error('Invalid bias detection configuration')
  }
  const w = config.layerWeights || {}
  const sum = ['preprocessing', 'modelLevel', 'interactive', 'evaluation']
    .map((k) => Number(w[k] ?? 0))
    .reduce((a, b) => a + b, 0)
  if (Math.abs(sum - 1) > 1e-6) {
    throw new Error('Invalid bias detection configuration')
  }
  return config
}

// Data sanitization
export function sanitizeTextContent(
  content: string,
  maskingEnabled = true,
): string {
  if (!maskingEnabled) {
    return content
  }
  let result = content
  // Specific pattern: "Patient First Last" -> preserve prefix
  result = result.replace(
    /\bPatient\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/g,
    'Patient [NAME]',
  )
  // Emails
  result = result.replace(
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    '[EMAIL]',
  )
  // Phone numbers (simple patterns 123-456-7890 or 123.456.7890 or (123) 456-7890)
  result = result.replace(
    /(?:\(\d{3}\)\s*|\b\d{3}[-.\s])\d{3}[-.\s]\d{4}\b/g,
    '[PHONE]',
  )
  // SSN
  result = result.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
  // Naive proper name (First Last) -> [NAME]
  result = result.replace(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, '[NAME]')
  return result
}

// Demographic helpers
export function extractDemographicGroups(
  d: ParticipantDemographics,
): Array<{ type: string; value: string }> {
  const groups: Array<{ type: string; value: string }> = []
  if (d.age) {
    groups.push({ type: 'age', value: d.age })
  }
  if (d.gender) {
    groups.push({ type: 'gender', value: d.gender })
  }
  if (d.ethnicity) {
    groups.push({ type: 'ethnicity', value: d.ethnicity })
  }
  if (d.primaryLanguage) {
    groups.push({ type: 'language', value: d.primaryLanguage })
  }
  if (d.socioeconomicStatus) {
    groups.push({ type: 'socioeconomic', value: d.socioeconomicStatus })
  }
  if (d.education) {
    groups.push({ type: 'education', value: d.education })
  }
  if (d.region) {
    groups.push({ type: 'region', value: d.region })
  }
  return groups
}

export function calculateDemographicRepresentation(
  sessions: Array<Pick<TherapeuticSession, 'participantDemographics'>>,
) {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return {}
  }
  const counts: Record<string, Record<string, number>> = {}
  const add = (key: string, val?: string) => {
    if (!val) {
      return
    }
    counts[key] ||= {}
    counts[key]![val] = (counts[key]![val] || 0) + 1
  }
  for (const s of sessions) {
    const d = s.participantDemographics as ParticipantDemographics
    add('age', d.age)
    add('gender', d.gender)
    add('ethnicity', d.ethnicity)
    add('language', d.primaryLanguage)
    if (d.socioeconomicStatus) {
      add('socioeconomic', d.socioeconomicStatus)
    }
    if (d.education) {
      add('education', d.education)
    }
    if (d.region) {
      add('region', d.region)
    }
  }
  // Convert to proportions
  const representation: Record<string, Record<string, number>> = {}
  for (const [key, map] of Object.entries(counts)) {
    const total = Object.values(map).reduce((a, b) => a + b, 0)
    representation[key] = Object.fromEntries(
      Object.entries(map).map(([k, v]) => [k, v / total]),
    )
  }
  return representation
}

// Bias calculations
export function calculateOverallBiasScore(
  layerResults: Record<string, { biasScore: number }>,
  weights: Record<string, number>,
): number {
  const layers = ['preprocessing', 'modelLevel', 'interactive', 'evaluation']
  const score = layers.reduce((sum, k) => {
    const raw = layerResults?.[k]?.biasScore ?? 0
    const clamped = Math.min(1, Math.max(0, raw))
    return sum + (weights?.[k] ?? 0) * clamped
  }, 0)
  return Number(score)
}

export function calculateConfidenceScore(
  scores: number[] | Record<string, { biasScore: number }>,
): number {
  let values: number[] = []
  if (Array.isArray(scores)) {
    values = scores
  } else if (scores && typeof scores === 'object') {
    values = Object.values(scores).map((v) => v?.biasScore ?? 0)
  }
  if (!Array.isArray(values) || values.length === 0) {
    return 0
  }
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance =
    values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  const std = Math.sqrt(variance)
  // Normalize std by max possible (0.5 for values in [0,1]) so high variance -> low confidence
  return Math.max(0, Math.min(1, 1 - 2 * std))
}

export function determineAlertLevel(
  score: number,
  thresholds: {
    warningLevel: number
    highLevel: number
    criticalLevel: number
  },
): AlertLevel {
  if (score < thresholds.warningLevel) {
    return 'low'
  }
  if (score < thresholds.highLevel) {
    return 'medium'
  }
  if (score < thresholds.criticalLevel) {
    return 'high'
  }
  return 'critical'
}

export function calculateFairnessMetrics(
  groupMetrics: Record<
    string,
    { tp: number; fp: number; tn: number; fn: number }
  >,
) {
  const groups = Object.keys(groupMetrics)
  if (groups.length < 2) {
    throw new Error('At least two demographic groups required')
  }
  const positiveRates: number[] = []
  const tprs: number[] = []
  const fprs: number[] = []
  for (const g of groups) {
    const m = groupMetrics[g]!
    const { tp, fp, tn, fn } = m
    const total = tp + fp + tn + fn
    const pr = total > 0 ? (tp + fp) / total : 0
    const tpr = tp + fn > 0 ? tp / (tp + fn) : 0
    const fpr = fp + tn > 0 ? fp / (fp + tn) : 0
    positiveRates.push(pr)
    tprs.push(tpr)
    fprs.push(fpr)
  }
  const spread = (arr: number[]) => Math.max(...arr) - Math.min(...arr)
  const demographicParity = spread(positiveRates)
  const tprSpread = spread(tprs)
  const fprSpread = spread(fprs)
  const equalOpportunity = tprSpread
  const equalizedOdds = (tprSpread + fprSpread) / 2
  const calibration = Math.max(0, 1 - demographicParity)
  const individualFairness = Math.max(0, 1 - equalizedOdds)
  const counterfactualFairness = individualFairness
  return {
    demographicParity,
    equalizedOdds,
    equalOpportunity,
    calibration,
    individualFairness,
    counterfactualFairness,
  }
}

// Error helpers
export class BiasDetectionError extends Error {
  code: string
  data: Record<string, unknown>
  retryable: boolean
  recoverable: boolean
  sessionId?: string
  constructor(
    code: string,
    message: string,
    data: Record<string, unknown> = {},
    retryable = false,
  ) {
    super(message)
    this.name = 'BiasDetectionError'
    this.code = code
    this.data = data
    this.retryable = retryable
    this.recoverable = retryable
    if (data && typeof data === 'object' && 'sessionId' in data) {
      this.sessionId = String(data['sessionId'])
    }
  }

  override toString(): string {
    return this.message
  }
}

export function createBiasDetectionError(
  code: string,
  message: string,
  data: Record<string, unknown> = {},
  retryable = false,
) {
  return new BiasDetectionError(code, message, data, retryable)
}

export function isBiasDetectionError(err: unknown): err is BiasDetectionError {
  return (
    err instanceof BiasDetectionError ||
    (typeof err === 'object' &&
      err !== null &&
      'name' in err &&
      (err as any).name === 'BiasDetectionError')
  )
}

export function handleBiasDetectionError(
  error: unknown,
  _context?: Record<string, unknown>,
): { shouldRetry: boolean; alertLevel: AlertLevel } {
  if (isBiasDetectionError(error)) {
    return {
      shouldRetry: !!error.retryable,
      alertLevel: 'medium' as AlertLevel,
    }
  }
  return { shouldRetry: false, alertLevel: 'critical' as AlertLevel }
}

// Data transformation to/from Python
export function transformSessionForPython(session: TherapeuticSession): any {
  return {
    session_id: session.sessionId,
    timestamp: session.timestamp.toISOString(),
    participant_demographics: {
      age: session.participantDemographics.age,
      gender: session.participantDemographics.gender,
      ethnicity: session.participantDemographics.ethnicity,
      primary_language: session.participantDemographics.primaryLanguage,
      socioeconomic_status: session.participantDemographics.socioeconomicStatus,
      education: session.participantDemographics.education,
      region: session.participantDemographics.region,
    },
    scenario: session.scenario,
    content: session.content,
    ai_responses: session.aiResponses.map((r) => ({
      response_id: r.responseId,
      timestamp: r.timestamp.toISOString(),
      type: r.type,
      content: r.content,
      confidence: r.confidence,
      model_used: r.modelUsed,
    })),
    expected_outcomes: session.expectedOutcomes,
    transcripts: session.transcripts.map((t) => ({
      speaker_id: t.speakerId,
      timestamp: t.timestamp.toISOString(),
      content: t.content,
      emotional_tone: t.emotionalTone,
      confidence_level: t.confidenceLevel,
    })),
    metadata: session.metadata,
  }
}

export function transformPythonResponse(response: any): any {
  return {
    overallBiasScore: response.overall_bias_score,
    confidence: response.confidence,
    alertLevel: response.alert_level,
    recommendations: response.recommendations,
  }
}

// HIPAA/Audit utilities
export function createAuditLogEntry(
  userId: string,
  userEmail: string,
  action: {
    type: string
    category: string
    description: string
    sensitivityLevel: string
  },
  resource: string,
  details: Record<string, unknown>,
  reqInfo: { ipAddress: string; userAgent: string },
  sessionId?: string,
) {
  return {
    userId,
    userEmail,
    action,
    resource,
    resourceId: details['resourceId'] as string | undefined,
    details,
    ipAddress: reqInfo.ipAddress,
    userAgent: reqInfo.userAgent,
    sessionId,
    timestamp: new Date(),
    success: true,
  }
}

export function requiresAdditionalAuth(
  dataType: 'session-data' | 'demographics' | string,
  role: string,
  sensitivity: 'low' | 'medium' | 'high' | 'critical',
) {
  if (sensitivity === 'high' || sensitivity === 'critical') {
    return true
  }
  if (dataType === 'demographics') {
    return role !== 'admin'
  }
  if (dataType === 'session-data') {
    return role === 'viewer'
  }
  return false
}

export function generateAnonymizedId(input: string, salt: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(`${salt}:${input}`)
    .digest('hex')
  return `anon_${hash.slice(0, 16)}`
}

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
  } catch (error: unknown) {
    console.error('Error parsing session data:', error)
    throw error
  }
}

/**
 * Check if a value is within a specified range
 */
export function isWithinRange(
  value: number,
  min: number,
  max: number,
  inclusive: boolean,
): boolean {
  return inclusive ? value >= min && value <= max : value > min && value < max
}

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(
  oldValue: number,
  newValue: number,
): number {
  if (oldValue === 0) {
    return newValue === 0 ? 0 : 100
  }
  return ((newValue - oldValue) / oldValue) * 100
}

/**
 * Generate analysis summary from bias detection results
 */
export function generateAnalysisSummary(results: BiasAnalysisResult[]): {
  totalSessions: number
  averageBiasScore: number
  alertDistribution: Record<string, number>
  topRecommendations: string[]
} {
  if (!Array.isArray(results) || results.length === 0) {
    return {
      totalSessions: 0,
      averageBiasScore: 0,
      alertDistribution: {},
      topRecommendations: [],
    }
  }
  const totalSessions = results.length
  const averageBiasScore =
    results.reduce((sum, r) => sum + (r.overallBiasScore ?? 0), 0) /
    totalSessions
  const alertDistribution: Record<string, number> = {}
  const recCounts: Record<string, number> = {}
  for (const r of results) {
    alertDistribution[r.alertLevel] = (alertDistribution[r.alertLevel] || 0) + 1
    for (const rec of r.recommendations || []) {
      recCounts[rec] = (recCounts[rec] || 0) + 1
    }
  }
  const topRecommendations = Object.entries(recCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
  return {
    totalSessions,
    averageBiasScore,
    alertDistribution,
    topRecommendations,
  }
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
    return obj.map((item) => deepClone(item)) as unknown as T
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
  wait: number,
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
  baseDelay: number = 1000,
): Promise<T> {
  let lastError: Error

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt === maxRetries) {
        throw lastError
      }

      const delay = baseDelay * Math.pow(2, attempt)
      await new Promise((resolve) => setTimeout(resolve, delay))
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
  const pct = Math.max(0, Math.min(1, score)) * 100
  return `${pct.toFixed(1)}%`
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
    const pad = (n: number) => String(n).padStart(2, '0')
    const y = date.getUTCFullYear()
    const m = pad(date.getUTCMonth() + 1)
    const d = pad(date.getUTCDate())
    const hh = pad(date.getUTCHours())
    const mm = pad(date.getUTCMinutes())
    const ss = pad(date.getUTCSeconds())
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
  } catch {
    return 'Invalid date'
  }
}
