// Type-safe JSON parsing utilities with validation
export type ValidationResult<T> =
  | {
      success: true
      data: T
    }
  | {
      success: false
      error: string
    }

/**
 * Validates that all required properties exist and types match
 */
function validateObjectShape<T extends Record<string, unknown>>(
  obj: unknown,
  requiredProps: Record<keyof T, string>, // Property name -> expected type description
): ValidationResult<T> {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { success: false, error: 'Expected an object' }
  }

  const data = obj as Record<string, unknown>

  for (const [prop, typeDesc] of Object.entries(requiredProps)) {
    if (!(prop in data)) {
      return { success: false, error: `Missing required property: ${prop}` }
    }

    const value = data[prop]

    // Basic type validation based on description
    if (typeDesc.includes('array') && !Array.isArray(value)) {
      return { success: false, error: `${prop} must be an array` }
    }

    if (typeDesc.includes('object') && !value) {
      return { success: false, error: `${prop} must be an object` }
    }

    if (typeDesc.includes('string') && typeof value !== 'string') {
      return { success: false, error: `${prop} must be a string` }
    }

    if (typeDesc.includes('number') && typeof value !== 'number') {
      return { success: false, error: `${prop} must be a number` }
    }

    if (typeDesc.includes('boolean') && typeof value !== 'boolean') {
      return { success: false, error: `${prop} must be a boolean` }
    }
  }

  return { success: true, data: data as T }
}

/**
 * Safely parses JSON with type validation
 */
export function parseJsonSafely<T>(
  json: string,
  validator: (obj: unknown) => ValidationResult<T>,
): ValidationResult<T> {
  try {
    const parsed = JSON.parse(json)
    return validator(parsed)
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Invalid JSON',
    }
  }
}

export type AnalysisResults = {
  entities: Array<{
    text: string
    type: string
    confidence: number
    start?: number
    end?: number
  }>
  concepts: Array<{
    concept: string
    relevance: number
    category?: string
  }>
  riskFactors: Array<{
    factor: string
    severity: 'High' | 'Moderate' | 'Low'
    probability?: number
  }>
  metadata?: {
    processingTime: number
    wordCount: number
    sentenceCount: number
    complexity: number
    readabilityScore: number
  }
  insights?: Array<{
    category: string
    insight: string
    confidence: number
  }>
}

/**
 * Validates AnalysisResults structure
 */
export function validateAnalysisResults(
  obj: unknown,
): ValidationResult<AnalysisResults> {
  if (!obj || typeof obj !== 'object') {
    return { success: false, error: 'Expected an object' }
  }

  const data = obj as Record<string, unknown>

  // Validate required arrays
  for (const prop of ['entities', 'concepts', 'riskFactors']) {
    if (!(prop in data)) {
      return { success: false, error: `Missing required property: ${prop}` }
    }
    if (!Array.isArray(data[prop])) {
      return { success: false, error: `${prop} must be an array` }
    }
  }

  const entities = data['entities'] as unknown[]
  const concepts = data['concepts'] as unknown[]
  const riskFactors = data['riskFactors'] as unknown[]

  // Validate entities structure
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i]
    if (!entity || typeof entity !== 'object') {
      return { success: false, error: `Entity ${i} must be an object` }
    }

    const e = entity as Record<string, unknown>
    if (
      typeof e['text'] !== 'string' ||
      typeof e['type'] !== 'string' ||
      typeof e['confidence'] !== 'number'
    ) {
      return { success: false, error: `Entity ${i} has invalid structure` }
    }
  }

  // Validate concepts structure
  for (let i = 0; i < concepts.length; i++) {
    const concept = concepts[i]
    if (!concept || typeof concept !== 'object') {
      return { success: false, error: `Concept ${i} must be an object` }
    }

    const c = concept as Record<string, unknown>
    if (
      typeof c['concept'] !== 'string' ||
      typeof c['relevance'] !== 'number'
    ) {
      return { success: false, error: `Concept ${i} has invalid structure` }
    }
  }

  // Validate risk factors structure
  for (let i = 0; i < riskFactors.length; i++) {
    const risk = riskFactors[i]
    if (!risk || typeof risk !== 'object') {
      return { success: false, error: `Risk factor ${i} must be an object` }
    }

    const r = risk as Record<string, unknown>
    if (typeof r['factor'] !== 'string' || typeof r['severity'] !== 'string') {
      return { success: false, error: `Risk factor ${i} has invalid structure` }
    }

    if (!['High', 'Moderate', 'Low'].includes(r['severity'] as string)) {
      return { success: false, error: `Risk factor ${i} has invalid severity` }
    }
  }

  // Validate metadata if present
  if ('metadata' in data && data['metadata'] !== null) {
    if (typeof data['metadata'] !== 'object') {
      return { success: false, error: 'Metadata must be an object' }
    }

    const meta = data['metadata'] as Record<string, unknown>
    const requiredMetaProps = [
      'processingTime',
      'wordCount',
      'sentenceCount',
      'complexity',
      'readabilityScore',
    ]

    for (const prop of requiredMetaProps) {
      if (!(prop in meta) || typeof meta[prop] !== 'number') {
        return { success: false, error: `Metadata.${prop} must be a number` }
      }
    }
  }

  return { success: true, data: data as AnalysisResults }
}

export type CrisisDetectionResponseData = {
  assessment: {
    overallRisk: 'none' | 'low' | 'moderate' | 'high' | 'imminent'
    suicidalIdeation: {
      present: boolean
      severity: 'with_intent' | 'with_plan' | 'active' | 'passive' | 'none'
    }
    selfHarm: {
      present: boolean
      risk: 'high' | 'moderate' | 'low'
      frequency: 'daily' | 'frequent' | 'occasional' | 'rare' | 'none'
    }
    agitation: {
      present: boolean
      controllable: boolean
      severity: string
    }
    substanceUse: {
      present: boolean
      acute: boolean
      impairment: string
    }
  }
  riskFactors: Array<{ factor: string }>
  protectiveFactors: Array<{ factor: string }>
  recommendations: {
    immediate: Array<{ action: string }>
  }
  resources: {
    crisis: Array<{
      name: string
      contact: string
      specialization: string[]
      availability: string
    }>
  }
  metadata: {
    confidenceScore: number
  }
}

/**
 * Validates CrisisDetectionApiResponse structure
 */
export function validateCrisisDetectionResponse(
  obj: unknown,
): ValidationResult<CrisisDetectionResponseData> {
  const validation = validateObjectShape(obj, {
    assessment: 'object',
    riskFactors: 'array',
    protectiveFactors: 'array',
    recommendations: 'object',
    resources: 'object',
    metadata: 'object',
  })

  if (!validation.success) {
    return validation
  }

  const { data } = validation

  // Validate assessment structure
  const assessmentShape = validateObjectShape(data.assessment, {
    overallRisk: 'string',
    suicidalIdeation: 'object',
    selfHarm: 'object',
    agitation: 'object',
    substanceUse: 'object',
  })

  if (!assessmentShape.success) {
    return { success: false, error: `assessment.${assessmentShape.error}` }
  }

  // Validate overallRisk enum values
  if (
    !['none', 'low', 'moderate', 'high', 'imminent'].includes(
      assessmentShape.data.overallRisk as string,
    )
  ) {
    return { success: false, error: 'assessment.overallRisk has invalid value' }
  }

  // Validate metadata.confidenceScore
  const metadataShape = validateObjectShape(data.metadata, {
    confidenceScore: 'number',
  })

  if (!metadataShape.success) {
    return { success: false, error: `metadata.${metadataShape.error}` }
  }

  return { success: true, data: data as CrisisDetectionResponseData }
}

/**
 * Generic function to parse API response safely
 */
export async function parseApiResponse<T>(
  response: Response,
  validator: (obj: unknown) => ValidationResult<T>,
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    if (!response.ok) {
      const { status, statusText } = response
      return { success: false, error: `HTTP ${status}: ${statusText}` }
    }

    const jsonText = await response.text()
    if (!jsonText.trim()) {
      return { success: false, error: 'Empty response body' }
    }

    return parseJsonSafely(jsonText, validator)
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Response parsing failed',
    }
  }
}
