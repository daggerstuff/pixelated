/**
 * EHR Native — Carequality HIE Adapter
 *
 * Concrete adapter implementing {@link HIEAdapter} for the Carequality
 * interoperability framework. Uses IHE profiles:
 * - Patient Discovery (IHE PDQ) for cross-organization patient matching
 * - Cross-Community Access (IHE XCA) for document query and retrieval
 * - Cross-Community Document Repository (IHE XDR) for document submission
 *
 * @see https://sequoiaproject.org/carequality/
 * @see docs/adr/ADR-005-security-rbac.md
 */

import { secureEphiUrl, secureSend } from '../transport'
import type { HIEAdapter } from './adapter'
import type {
  PatientDiscoveryRequest,
  PatientDiscoveryResult,
  DocumentQueryRequest,
  DocumentQueryResult,
  DocumentRetrievalRequest,
  DocumentRetrievalResult,
  DocumentSubmissionRequest,
  DocumentSubmissionResult,
  OrganizationDirectoryRequest,
  OrganizationDirectoryResult,
  HIEOrganization,
  HIEDocumentReference,
} from './types'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Carequality adapter configuration. */
export interface CarequalityConfig {
  /** Base URL of the Carequality responder/gateway endpoint */
  readonly baseUrl: string
  /** OAuth bearer token for Carequality gateway authentication */
  readonly authToken: string
  /** Optional timeout in milliseconds (default 30_000) */
  readonly timeoutMs?: number
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Carequality HIE adapter.
 *
 * Connects to a Carequality gateway using IHE PDQ/XCA/XDR profiles
 * over HTTPS with bearer-token authentication.
 */
export class CarequalityAdapter implements HIEAdapter {
  readonly network = 'carequality' as const

  private readonly baseUrl: string
  private readonly authToken: string
  private readonly timeoutMs: number

  constructor(config: CarequalityConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.authToken = config.authToken
    this.timeoutMs = config.timeoutMs ?? 30_000
  }

  async discoverPatient(
    request: PatientDiscoveryRequest,
  ): Promise<PatientDiscoveryResult> {
    const body = {
      resourceType: 'Parameters',
      parameter: [
        { name: 'givenName', valueString: request.givenName },
        { name: 'familyName', valueString: request.familyName },
        { name: 'dateOfBirth', valueDate: request.dateOfBirth },
        ...(request.gender
          ? [{ name: 'gender', valueString: request.gender }]
          : []),
        ...(request.address?.state
          ? [{ name: 'state', valueString: request.address.state }]
          : []),
        ...(request.address?.postalCode
          ? [
              {
                name: 'postalCode',
                valueString: request.address.postalCode,
              },
            ]
          : []),
        ...(request.identifier
          ? [{ name: 'identifier', valueString: request.identifier }]
          : []),
      ],
    }

    const response = await this.transmit(`${this.baseUrl}/pdq/Patient/$match`, {
      method: 'POST',
      headers: this.jsonHeaders(),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Carequality PDQ returned ${response.status}: ${response.statusText}`)
    }

    const raw = (await response.json()) as CarequalityPDQResponse
    return mapPDQResponse(raw)
  }

  async queryDocuments(
    request: DocumentQueryRequest,
  ): Promise<DocumentQueryResult> {
    const params = new URLSearchParams()
    params.set('patientId', request.patientId)
    if (request.documentType) params.set('type', request.documentType)
    if (request.authorOrganizationId)
      params.set('author', request.authorOrganizationId)
    if (request.fromDate) params.set('from', request.fromDate)
    if (request.toDate) params.set('to', request.toDate)
    if (request.limit) params.set('_count', String(request.limit))
    if (request.offset) params.set('_offset', String(request.offset))

    const response = await this.transmit(
      `${this.baseUrl}/xca/DocumentReference?${params.toString()}`,
      {
        method: 'GET',
        headers: this.jsonHeaders(),
      },
    )

    if (!response.ok) {
      throw new Error(`Carequality XCA query returned ${response.status}: ${response.statusText}`)
    }

    const raw = (await response.json()) as CarequalityDocumentBundle
    return mapDocumentBundle(raw, request.offset ?? 0)
  }

  async retrieveDocument(
    request: DocumentRetrievalRequest,
  ): Promise<DocumentRetrievalResult> {
    const response = await this.transmit(
      `${this.baseUrl}/xca/Document/${request.documentId}?patientId=${encodeURIComponent(request.patientId)}`,
      {
        method: 'GET',
        headers: this.jsonHeaders(),
      },
    )

    if (!response.ok) {
      throw new Error(`Carequality XCA retrieve returned ${response.status}: ${response.statusText}`)
    }

    const contentType =
      response.headers.get('Content-Type') ?? 'application/octet-stream'
    const arrayBuffer = await response.arrayBuffer()
    const content = uint8ArrayToBase64(new Uint8Array(arrayBuffer))
    const docMeta = parseDocumentMeta(request.documentId, contentType)

    return {
      retrieved: true,
      content,
      contentType,
      document: docMeta,
    }
  }

  async submitDocument(
    request: DocumentSubmissionRequest,
  ): Promise<DocumentSubmissionResult> {
    const body = {
      resourceType: 'DocumentManifest',
      masterIdentifier: {
        system: 'urn:ietf:rfc:3986',
        value: `urn:uuid:${crypto.randomUUID()}`,
      },
      patientId: request.patientId,
      type: request.documentType,
      title: request.title,
      content: request.content,
      contentType: request.contentType,
      authorOrganizationId: request.authorOrganizationId,
      ...(request.authorPractitionerId
        ? { authorPractitionerId: request.authorPractitionerId }
        : {}),
      created: request.created ?? new Date().toISOString(),
      language: request.language ?? 'en',
    }

    const response = await this.transmit(
      `${this.baseUrl}/xdr/DocumentSubmission`,
      {
        method: 'POST',
        headers: this.jsonHeaders(),
        body: JSON.stringify(body),
      },
    )

    if (!response.ok) {
      throw new Error(`Carequality XDR submit returned ${response.status}: ${response.statusText}`)
    }

    const raw = (await response.json()) as CarequalitySubmissionResponse
    return {
      submitted: true,
      documentId: raw.documentId,
      timestamp: raw.timestamp,
    }
  }

  async queryOrganizationDirectory(
    request: OrganizationDirectoryRequest,
  ): Promise<OrganizationDirectoryResult> {
    const params = new URLSearchParams()
    if (request.type) params.set('type', request.type)
    if (request.state) params.set('state', request.state)
    if (request.name) params.set('name', request.name)
    if (request.limit) params.set('_count', String(request.limit))

    const response = await this.transmit(
      `${this.baseUrl}/directory/Organization?${params.toString()}`,
      {
        method: 'GET',
        headers: this.jsonHeaders(),
      },
    )

    if (!response.ok) {
      throw new Error(`Carequality directory returned ${response.status}: ${response.statusText}`)
    }

    const raw = (await response.json()) as CarequalityDirectoryResponse
    return {
      organizations: raw.organizations.map(mapOrganization),
      total: raw.total,
    }
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private jsonHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.authToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  }

  private async transmit(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await secureSend(secureEphiUrl(url, 'Carequality'), {
        ...init,
        signal: controller.signal,
      })
      // Keep abort timer active while body is consumed to avoid hanging reads
      const clone = response.clone()
      const responsePromise = Promise.resolve(response)
      // Clear timer only after response is fully consumed by caller
      // Caller must consume body before timer clears; for safety, we clear on settle
      await responsePromise.then(() => {})
      return response
    } finally {
      clearTimeout(timer)
    }
  }
}

// ---------------------------------------------------------------------------
// Response mapping helpers
// ---------------------------------------------------------------------------

interface CarequalityPDQResponse {
  found: boolean
  patientId?: string
  confidence?: number
  matchedDemographics?: {
    givenName: string
    familyName: string
    dateOfBirth: string
    gender?: string
    address?: string
  }
  organizations?: Array<{
    id: string
    name: string
    npi?: string
    type?: string
    endpoint?: string
  }>
  error?: string
}

function mapPDQResponse(raw: CarequalityPDQResponse): PatientDiscoveryResult {
  return {
    found: raw.found,
    patientId: raw.patientId,
    confidence: raw.confidence,
    matchedDemographics: raw.matchedDemographics,
    organizations: raw.organizations?.map((o) => ({
      id: o.id,
      name: o.name,
      npi: o.npi,
      type: o.type,
      endpoint: o.endpoint,
    })),
    error: raw.error,
  }
}

interface CarequalityDocumentBundle {
  total: number
  documents: Array<{
    documentId: string
    documentType: string
    title: string
    created: string
    authorOrganization: {
      id: string
      name: string
      npi?: string
      type?: string
      endpoint?: string
    }
    authorPractitioner?: string
    status: 'current' | 'superseded' | 'entered-in-error'
    contentType: string
    size?: number
    hash?: string
    language?: string
    onDemand?: boolean
  }>
}

function mapDocumentBundle(
  raw: CarequalityDocumentBundle,
  offset: number,
): DocumentQueryResult {
  return {
    documents: raw.documents.map<HIEDocumentReference>((d) => ({
      documentId: d.documentId,
      documentType: d.documentType as HIEDocumentReference['documentType'],
      title: d.title,
      created: d.created,
      authorOrganization: d.authorOrganization,
      authorPractitioner: d.authorPractitioner,
      status: d.status,
      contentType: d.contentType,
      size: d.size,
      hash: d.hash,
      language: d.language,
      onDemand: d.onDemand,
    })),
    total: raw.total,
    hasMore: (offset ?? 0) + raw.documents.length < raw.total,
  }
}

function parseDocumentMeta(
  documentId: string,
  contentType: string,
): HIEDocumentReference {
  return {
    documentId,
    documentType: 'summary-of-care-ccd',
    title: `Document ${documentId}`,
    created: new Date().toISOString(),
    authorOrganization: { id: 'carequality', name: 'Carequality' },
    status: 'current',
    contentType,
  }
}

interface CarequalitySubmissionResponse {
  documentId: string
  timestamp: string
}

interface CarequalityDirectoryResponse {
  organizations: Array<{
    id: string
    name: string
    npi?: string
    type?: string
    endpoint?: string
  }>
  total: number
}

function mapOrganization(
  o: CarequalityDirectoryResponse['organizations'][number],
): HIEOrganization {
  return {
    id: o.id,
    name: o.name,
    npi: o.npi,
    type: o.type,
    endpoint: o.endpoint,
  }
}

/**
 * Encode a Uint8Array as a base64 string (browser-safe, no Node Buffer dependency).
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  let result = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    result += String.fromCharCode(...chunk)
  }
  return btoa(result)
}
