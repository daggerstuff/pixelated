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

    const raw = await this.transmitJson<CarequalityPDQResponse>(
      `${this.baseUrl}/pdq/Patient/$match`,
      {
        method: 'POST',
        headers: this.jsonHeaders(),
        body: JSON.stringify(body),
      },
      'Carequality PDQ returned',
    )
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

    const raw = await this.transmitJson<CarequalityDocumentBundle>(
      `${this.baseUrl}/xca/DocumentReference?${params.toString()}`,
      {
        method: 'GET',
        headers: this.jsonHeaders(),
      },
      'Carequality XCA query returned',
    )
    return mapDocumentBundle(raw, request.offset ?? 0)
  }

  async retrieveDocument(
    request: DocumentRetrievalRequest,
  ): Promise<DocumentRetrievalResult> {
    const { contentType, content } = await this.transmitBinary(
      `${this.baseUrl}/xca/Document/${request.documentId}?patientId=${encodeURIComponent(request.patientId)}`,
      {
        method: 'GET',
        headers: this.jsonHeaders(),
      },
      'Carequality XCA retrieve returned',
    )
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

    const raw = await this.transmitJson<CarequalitySubmissionResponse>(
      `${this.baseUrl}/xdr/DocumentSubmission`,
      {
        method: 'POST',
        headers: this.jsonHeaders(),
        body: JSON.stringify(body),
      },
      'Carequality XDR submit returned',
    )
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

    const raw = await this.transmitJson<CarequalityDirectoryResponse>(
      `${this.baseUrl}/directory/Organization?${params.toString()}`,
      {
        method: 'GET',
        headers: this.jsonHeaders(),
      },
      'Carequality directory returned',
    )
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

  /**
   * Send a request and consume the JSON body inside the abort-timeout
   * window. The timer must cover body streaming, not just headers, or a
   * server that sends headers and stalls the body would hang past the
   * configured timeout.
   */
  private async transmitJson<T>(
    url: string,
    init: RequestInit,
    errorMessage: string,
  ): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await secureSend(secureEphiUrl(url, 'Carequality'), {
        ...init,
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new Error(
          `${errorMessage} ${response.status}: ${response.statusText}`,
        )
      }
      return (await response.json()) as T
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * Send a request and consume a binary body inside the abort-timeout
   * window. Returns the content type and base64-encoded content.
   */
  private async transmitBinary(
    url: string,
    init: RequestInit,
    errorMessage: string,
  ): Promise<{ contentType: string; content: string }> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await secureSend(secureEphiUrl(url, 'Carequality'), {
        ...init,
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new Error(
          `${errorMessage} ${response.status}: ${response.statusText}`,
        )
      }
      const contentType =
        response.headers.get('Content-Type') ?? 'application/octet-stream'
      const arrayBuffer = await response.arrayBuffer()
      return {
        contentType,
        content: uint8ArrayToBase64(new Uint8Array(arrayBuffer)),
      }
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
