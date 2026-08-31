/**
 * EHR Native — DirectTrust HIE Adapter
 *
 * Concrete adapter implementing {@link HIEAdapter} for the DirectTrust
 * Direct Secure Messaging framework. Uses the Direct protocol (SMTP + S/MIME)
 * for secure clinical document exchange between trusted health organizations.
 *
 * @see https://directtrust.org/
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
  HIEDocumentReference,
} from './types'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** DirectTrust adapter configuration. */
export interface DirectTrustConfig {
  /** Health Information Service Provider (HISP) REST API base URL */
  readonly baseUrl: string
  /** API key or bearer token for the HISP REST gateway */
  readonly authToken: string
  /** Direct address used to send/receive messages (e.g. org@direct.example.org) */
  readonly directAddress: string
  /** Optional timeout in milliseconds (default 30_000) */
  readonly timeoutMs?: number
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * DirectTrust HIE adapter.
 *
 * Connects to a DirectTrust-certified Health Information Service Provider
 * (HISP) REST gateway. Uses Direct Secure Messaging (SMTP + S/MIME) for
 * document exchange and the HISP's directory API for organization lookup.
 * Patient discovery is performed via the HISP's address book / patient
 * resolution service.
 */
export class DirectTrustAdapter implements HIEAdapter {
  readonly network = 'directtrust' as const

  private readonly baseUrl: string
  private readonly authToken: string
  private readonly directAddress: string
  private readonly timeoutMs: number

  constructor(config: DirectTrustConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.authToken = config.authToken
    this.directAddress = config.directAddress
    this.timeoutMs = config.timeoutMs ?? 30_000
  }

  async discoverPatient(
    request: PatientDiscoveryRequest,
  ): Promise<PatientDiscoveryResult> {
    // DirectTrust does not natively support IHE PDQ; patient discovery
    // is performed via the HISP's patient resolution service which maps
    // demographics to known Direct addresses.
    const body = {
      givenName: request.givenName,
      familyName: request.familyName,
      dateOfBirth: request.dateOfBirth,
      ...(request.gender ? { gender: request.gender } : {}),
      ...(request.address ? { address: request.address } : {}),
      ...(request.identifier ? { identifier: request.identifier } : {}),
    }

    const raw = await this.transmitJson<DirectTrustPatientResponse>(
      `${this.baseUrl}/patients/resolve`,
      {
        method: 'POST',
        headers: this.jsonHeaders(),
        body: JSON.stringify(body),
      },
      'DirectTrust patient resolution returned',
    )
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
        endpoint: o.directAddress,
      })),
      error: raw.error,
    }
  }

  async queryDocuments(
    request: DocumentQueryRequest,
  ): Promise<DocumentQueryResult> {
    // In DirectTrust, documents are received as Direct messages with
    // CDA attachments. The HISP REST gateway provides a "received messages"
    // endpoint that we query with patient context as a filter.
    const params = new URLSearchParams()
    params.set('patientId', request.patientId)
    if (request.documentType) params.set('type', request.documentType)
    if (request.authorOrganizationId)
      params.set('from', request.authorOrganizationId)
    if (request.fromDate) params.set('fromDate', request.fromDate)
    if (request.toDate) params.set('toDate', request.toDate)
    if (request.limit) params.set('_count', String(request.limit))
    if (request.offset) params.set('_offset', String(request.offset))

    const raw = await this.transmitJson<DirectTrustMessageList>(
      `${this.baseUrl}/messages/received?${params.toString()}`,
      {
        method: 'GET',
        headers: this.jsonHeaders(),
      },
      'DirectTrust message query returned',
    )
    return {
      documents: raw.messages.map((m) => ({
        documentId: m.id,
        documentType: (m.metadata?.type ??
          'progress-note') as HIEDocumentReference['documentType'],
        title: m.subject,
        created: m.receivedAt,
        authorOrganization: {
          id: m.from.id,
          name: m.from.name,
          npi: m.from.npi,
          type: m.from.type,
          endpoint: m.from.directAddress,
        },
        authorPractitioner: m.from.practitioner,
        status: 'current',
        contentType: m.metadata?.contentType ?? 'application/xml',
        size: m.metadata?.size,
        language: m.metadata?.language,
      })),
      total: raw.total,
      hasMore: (request.offset ?? 0) + raw.messages.length < raw.total,
    }
  }

  async retrieveDocument(
    request: DocumentRetrievalRequest,
  ): Promise<DocumentRetrievalResult> {
    const { contentType, content } = await this.transmitBinary(
      `${this.baseUrl}/messages/${encodeURIComponent(request.documentId)}/content?patientId=${encodeURIComponent(request.patientId)}`,
      {
        method: 'GET',
        headers: this.jsonHeaders(),
      },
      'DirectTrust content retrieval returned',
    )

    return {
      retrieved: true,
      content,
      contentType,
      document: {
        documentId: request.documentId,
        documentType: 'progress-note',
        title: `Message ${request.documentId}`,
        created: new Date().toISOString(),
        authorOrganization: { id: 'directtrust', name: 'DirectTrust' },
        status: 'current',
        contentType,
      },
    }
  }

  async submitDocument(
    request: DocumentSubmissionRequest,
  ): Promise<DocumentSubmissionResult> {
    // Direct Secure Messaging requires a real recipient Direct address.
    // The patient ID alone is not routable — never fabricate an address.
    if (!request.recipientDirectAddress) {
      throw new Error(
        'DirectTrust submission requires a validated recipientDirectAddress',
      )
    }

    // Send a Direct message with the document as a CDA attachment.
    const body = {
      from: this.directAddress,
      to: request.recipientDirectAddress,
      subject: request.title,
      bodyText: `Clinical document: ${request.title}`,
      attachments: [
        {
          filename: `${request.documentType}.xml`,
          contentType: request.contentType,
          content: request.content, // base64-encoded
        },
      ],
      metadata: {
        patientId: request.patientId,
        documentType: request.documentType,
        authorOrganizationId: request.authorOrganizationId,
        ...(request.authorPractitionerId
          ? { authorPractitionerId: request.authorPractitionerId }
          : {}),
        created: request.created ?? new Date().toISOString(),
        language: request.language ?? 'en',
      },
    }

    const raw = await this.transmitJson<DirectTrustSendResponse>(
      `${this.baseUrl}/messages/send`,
      {
        method: 'POST',
        headers: this.jsonHeaders(),
        body: JSON.stringify(body),
      },
      'DirectTrust send returned',
    )
    return {
      submitted: true,
      documentId: raw.messageId,
      timestamp: raw.sentAt,
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

    const raw = await this.transmitJson<DirectTrustDirectoryResponse>(
      `${this.baseUrl}/directory?${params.toString()}`,
      {
        method: 'GET',
        headers: this.jsonHeaders(),
      },
      'DirectTrust directory returned',
    )
    return {
      organizations: raw.organizations.map((o) => ({
        id: o.id,
        name: o.name,
        npi: o.npi,
        type: o.type,
        endpoint: o.directAddress,
      })),
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
      const response = await secureSend(secureEphiUrl(url, 'DirectTrust'), {
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
      const response = await secureSend(secureEphiUrl(url, 'DirectTrust'), {
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

interface DirectTrustPatientResponse {
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
    directAddress: string
  }>
  error?: string
}

interface DirectTrustMessageList {
  total: number
  messages: Array<{
    id: string
    subject: string
    receivedAt: string
    from: {
      id: string
      name: string
      npi?: string
      type?: string
      directAddress: string
      practitioner?: string
    }
    metadata?: {
      type?: string
      contentType?: string
      size?: number
      language?: string
    }
  }>
}

interface DirectTrustSendResponse {
  messageId: string
  sentAt: string
}

interface DirectTrustDirectoryResponse {
  organizations: Array<{
    id: string
    name: string
    npi?: string
    type?: string
    directAddress: string
  }>
  total: number
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
