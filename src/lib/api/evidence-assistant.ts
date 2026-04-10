import type {
  EvidenceAnswerCitation,
  EvidenceCollection,
  EvidenceSearchResult,
} from '@/lib/evidence-assistant/types'

export interface EvidenceAssistantRequest {
  query: string
  limit?: number
  collection?: EvidenceCollection
  category?: string
  generateAnswer?: boolean
  provider?: string
}

export interface EvidenceAssistantResponse {
  query: string
  answer: string | null
  providerUsed: string | null
  results: EvidenceSearchResult[]
  citations: EvidenceAnswerCitation[]
  warnings: string[]
}

export interface EvidenceAssistantMetadata {
  name: string
  version: string
  description: string
  methods: string[]
  collections: string[]
  availableProviders: string[]
  note: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}


function isEvidenceSearchResult(value: unknown): value is EvidenceSearchResult {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.content === 'string' &&
    typeof value.url === 'string' &&
    typeof value.collection === 'string' &&
    typeof value.score === 'number' &&
    typeof value.excerpt === 'string' &&
    Array.isArray(value.matchedTerms)
  )
}

function isEvidenceCitation(value: unknown): value is EvidenceAnswerCitation {
  return (
    isRecord(value) &&
    typeof value.index === 'number' &&
    typeof value.title === 'string' &&
    typeof value.url === 'string' &&
    typeof value.collection === 'string'
  )
}

function isEvidenceAssistantMetadataRecord(
  value: unknown,
): value is EvidenceAssistantMetadata {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    typeof value.version === 'string' &&
    typeof value.description === 'string' &&
    Array.isArray(value.methods) &&
    Array.isArray(value.collections) &&
    Array.isArray(value.availableProviders) &&
    typeof value.note === 'string'
  )
}

function normalizeEvidenceAssistantResponse(
  payload: unknown,
): EvidenceAssistantResponse {
  if (!isRecord(payload)) {
    throw new Error('Evidence assistant returned an invalid payload')
  }

  return {
    query: typeof payload.query === 'string' ? payload.query : '',
    answer: typeof payload.answer === 'string' ? payload.answer : null,
    providerUsed:
      typeof payload.providerUsed === 'string' ? payload.providerUsed : null,
    results: Array.isArray(payload.results)
      ? payload.results.filter(isEvidenceSearchResult)
      : [],
    citations: Array.isArray(payload.citations)
      ? payload.citations.filter(isEvidenceCitation)
      : [],
    warnings: Array.isArray(payload.warnings)
      ? payload.warnings.filter(
          (warning): warning is string => typeof warning === 'string',
        )
      : [],
  }
}

function normalizeEvidenceAssistantMetadata(
  payload: unknown,
): EvidenceAssistantMetadata {
  if (!isRecord(payload)) {
    throw new Error('Evidence assistant metadata response is invalid')
  }

  if (!isEvidenceAssistantMetadataRecord(payload)) {
    return {
      name:
        typeof payload.name === 'string'
          ? payload.name
          : 'Evidence Assistant API',
      version: typeof payload.version === 'string' ? payload.version : 'unknown',
      description:
        typeof payload.description === 'string'
          ? payload.description
          : 'Internal evidence search and grounded answer API.',
      methods: Array.isArray(payload.methods)
        ? payload.methods.filter((method): method is string => typeof method === 'string')
        : [],
      collections: Array.isArray(payload.collections)
        ? payload.collections.filter(
            (collection): collection is string => typeof collection === 'string',
          )
        : [],
      availableProviders: Array.isArray(payload.availableProviders)
        ? payload.availableProviders.filter(
            (provider): provider is string => typeof provider === 'string',
          )
        : [],
      note:
        typeof payload.note === 'string'
          ? payload.note
          : 'Internal evidence assistant endpoint.',
    }
  }

  return {
    name: payload.name,
    version: payload.version,
    description: payload.description,
    methods: payload.methods.filter((method): method is string => typeof method === 'string'),
    collections: payload.collections.filter(
      (collection): collection is string => typeof collection === 'string',
    ),
    availableProviders: payload.availableProviders.filter(
      (provider): provider is string => typeof provider === 'string',
    ),
    note: payload.note,
  }
}

export async function searchEvidenceAssistant(
  request: EvidenceAssistantRequest,
  signal?: AbortSignal,
): Promise<EvidenceAssistantResponse> {
  const response = await fetch('/api/ai/evidence-assistant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    signal,
  })

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null)
    const message =
      isRecord(payload) && typeof payload.message === 'string'
        ? payload.message
        : `Evidence assistant request failed: ${response.status}`

    throw new Error(message)
  }

  const payload: unknown = await response.json()
  return normalizeEvidenceAssistantResponse(payload)
}

export async function getEvidenceAssistantMetadata(
  signal?: AbortSignal,
): Promise<EvidenceAssistantMetadata> {
  const response = await fetch('/api/ai/evidence-assistant', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    signal,
  })

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null)
    const message =
      isRecord(payload) && typeof payload.message === 'string'
        ? payload.message
        : `Evidence assistant metadata request failed: ${response.status}`

    throw new Error(message)
  }

  const payload: unknown = await response.json()
  return normalizeEvidenceAssistantMetadata(payload)
}
