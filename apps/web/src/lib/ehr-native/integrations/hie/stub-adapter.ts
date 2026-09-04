/**
 * EHR Native — Stub HIE Adapter
 *
 * In-memory implementation of the HIEAdapter interface for development
 * and testing. Simulates patient discovery, document query/retrieval,
 * and submission with realistic behavior patterns.
 *
 * @see docs/adr/ADR-005-security-rbac.md
 */

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
  HIEOrganization,
  HIENetwork,
  HIEDocumentType,
} from './types'

/** Simulated organizations on the HIE network */
const STUB_ORGANIZATIONS: HIEOrganization[] = [
  {
    id: 'org-001',
    name: 'Riverside General Hospital',
    npi: '1234567890',
    type: 'hospital',
    endpoint: 'direct:riverside@hie.example.org',
  },
  {
    id: 'org-002',
    name: 'Westview Family Clinic',
    npi: '2345678901',
    type: 'clinic',
    endpoint: 'direct:westview@hie.example.org',
  },
  {
    id: 'org-003',
    name: 'Northshore Imaging Center',
    npi: '3456789012',
    type: 'imaging',
    endpoint: 'direct:northshore@hie.example.org',
  },
  {
    id: 'org-004',
    name: 'Central Laboratory Services',
    npi: '4567890123',
    type: 'lab',
    endpoint: 'direct:centrallab@hie.example.org',
  },
  {
    id: 'org-005',
    name: 'Eastside Behavioral Health',
    npi: '5678901234',
    type: 'behavioral',
    endpoint: 'direct:eastsidebh@hie.example.org',
  },
  {
    id: 'org-006',
    name: 'Summit Pharmacy Network',
    npi: '6789012345',
    type: 'pharmacy',
    endpoint: 'direct:summitrx@hie.example.org',
  },
]

/** Simulated document store keyed by patient ID */
interface StoredDocument {
  reference: HIEDocumentReference
  content: string
}

const documentStore = new Map<string, StoredDocument[]>()
const patientRegistry = new Map<
  string,
  { organizations: HIEOrganization[]; demographics: PatientDiscoveryRequest }
>()

/** Counter for generating document IDs */
let docCounter = 0

/**
 * Stub HIE adapter for development. Simulates:
 * - Patient discovery with fuzzy demographic matching
 * - Document query with pre-seeded clinical documents
 * - Document retrieval returning base64 content
 * - Document submission with ID assignment
 * - Organization directory search
 */
export class StubHIEAdapter implements HIEAdapter {
  readonly network: HIENetwork = 'carequality'

  async discoverPatient(
    request: PatientDiscoveryRequest,
  ): Promise<PatientDiscoveryResult> {
    if (!request.familyName || request.familyName.trim().length === 0) {
      throw new Error('Invalid familyName: must be non-empty')
    }
    // Simulate finding patients with common names. Normalize the family
    // name so the generated registry key always satisfies HIE_ID_PATTERN
    // (spaces are not valid identifier characters).
    const key =
      `${request.familyName.toLowerCase().replace(/\s+/g, '-').slice(0, 80)}:` +
      `${request.dateOfBirth}`
    const existing = patientRegistry.get(key)

    if (existing) {
      return {
        found: true,
        patientId: key,
        confidence: 0.95,
        matchedDemographics: {
          givenName: request.givenName,
          familyName: request.familyName,
          dateOfBirth: request.dateOfBirth,
          gender: request.gender,
        },
        organizations: existing.organizations,
      }
    }

    // Simulate: 70% chance of finding a new patient
    const hash = simpleHash(key)
    if (hash % 10 < 7) {
      // Assign 1-3 random organizations
      const orgCount = (hash % 3) + 1
      const orgs = STUB_ORGANIZATIONS.slice(0, orgCount)
      patientRegistry.set(key, { organizations: orgs, demographics: request })

      // Seed some documents for this patient
      seedDocuments(key, orgs)

      return {
        found: true,
        patientId: key,
        confidence: 0.85 + (hash % 10) / 100,
        matchedDemographics: {
          givenName: request.givenName,
          familyName: request.familyName,
          dateOfBirth: request.dateOfBirth,
          gender: request.gender,
        },
        organizations: orgs,
      }
    }

    return {
      found: false,
      error: 'Patient not found on HIE network',
    }
  }

  async queryDocuments(
    request: DocumentQueryRequest,
  ): Promise<DocumentQueryResult> {
    assertHieId(request.patientId, 'patientId')
    const docs = documentStore.get(request.patientId) ?? []
    let filtered = docs

    if (request.documentType) {
      filtered = filtered.filter(
        (d) => d.reference.documentType === request.documentType,
      )
    }
    if (request.authorOrganizationId) {
      filtered = filtered.filter(
        (d) =>
          d.reference.authorOrganization.id === request.authorOrganizationId,
      )
    }
    if (request.fromDate) {
      filtered = filtered.filter(
        (d) => d.reference.created >= request.fromDate!,
      )
    }
    if (request.toDate) {
      filtered = filtered.filter((d) => d.reference.created <= request.toDate!)
    }

    const limit = request.limit ?? 50
    const offset = request.offset ?? 0
    const paged = filtered.slice(offset, offset + limit)
    const hasMore = offset + limit < filtered.length

    return {
      documents: paged.map((d) => d.reference),
      total: filtered.length,
      hasMore,
    }
  }

  async retrieveDocument(
    request: DocumentRetrievalRequest,
  ): Promise<DocumentRetrievalResult> {
    assertHieId(request.documentId, 'documentId')
    assertHieId(request.patientId, 'patientId')
    const docs = documentStore.get(request.patientId) ?? []
    const doc = docs.find((d) => d.reference.documentId === request.documentId)

    if (!doc) {
      return {
        retrieved: false,
        contentType: 'application/xml',
        document: {
          documentId: request.documentId,
          documentType: 'summary-of-care-ccd',
          title: 'Unknown',
          created: new Date().toISOString(),
          authorOrganization: STUB_ORGANIZATIONS[0],
          status: 'entered-in-error',
          contentType: 'application/xml',
        },
        error: 'Document not found',
      }
    }

    return {
      retrieved: true,
      content: doc.content,
      contentType: doc.reference.contentType,
      charset: 'utf-8',
      document: doc.reference,
    }
  }

  async submitDocument(
    request: DocumentSubmissionRequest,
  ): Promise<DocumentSubmissionResult> {
    assertHieId(request.patientId, 'patientId')
    assertHieId(request.authorOrganizationId, 'authorOrganizationId')
    const docId = `doc-${++docCounter}`
    const org = STUB_ORGANIZATIONS.find(
      (o) => o.id === request.authorOrganizationId,
    )
    const authorOrg = org ?? STUB_ORGANIZATIONS[0]

    const reference: HIEDocumentReference = {
      documentId: docId,
      documentType: request.documentType,
      title: request.title,
      created: request.created ?? new Date().toISOString(),
      authorOrganization: authorOrg,
      authorPractitioner: request.authorPractitionerId,
      status: 'current',
      contentType: request.contentType,
      language: request.language ?? 'en',
    }

    const docs = documentStore.get(request.patientId) ?? []
    docs.push({ reference, content: request.content })
    documentStore.set(request.patientId, docs)

    return {
      submitted: true,
      documentId: docId,
      timestamp: reference.created,
    }
  }

  async queryOrganizationDirectory(
    request: OrganizationDirectoryRequest,
  ): Promise<OrganizationDirectoryResult> {
    let orgs = [...STUB_ORGANIZATIONS]

    if (request.type) {
      orgs = orgs.filter((o) => o.type === request.type)
    }
    if (request.state) {
      const stateLower = request.state.toLowerCase()
      orgs = orgs.filter(
        (o) =>
          (o as { state?: string }).state?.toLowerCase() === stateLower ||
          o.id.toLowerCase().includes(stateLower),
      )
    }
    if (request.name) {
      const lower = request.name.toLowerCase()
      orgs = orgs.filter((o) => o.name.toLowerCase().includes(lower))
    }

    const limit = request.limit ?? 50
    const total = orgs.length
    orgs = orgs.slice(0, limit)

    return {
      organizations: orgs,
      total,
    }
  }
}

// ---------------------------------------------------------------------------
// Input validation (defense in depth — the service layer also sanitizes)
// ---------------------------------------------------------------------------

/** HIE identifier token: alphanumeric start, internal . _ : - separators. */
const HIE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

function assertHieId(value: string, field: string): void {
  if (!HIE_ID_PATTERN.test(value.trim())) {
    throw new Error(`Invalid ${field}: expected an HIE identifier token`)
  }
}

/** Seed initial documents for a discovered patient */
function seedDocuments(patientId: string, orgs: HIEOrganization[]): void {
  const docs: StoredDocument[] = []
  const now = Date.now()

  const seedTypes: Array<{
    type: HIEDocumentType
    title: string
    daysAgo: number
  }> = [
    {
      type: 'summary-of-care-ccd',
      title: 'Summary of Care (CCD)',
      daysAgo: 30,
    },
    {
      type: 'discharge-summary',
      title: 'Hospital Discharge Summary',
      daysAgo: 15,
    },
    { type: 'progress-note', title: 'Clinical Progress Note', daysAgo: 7 },
    { type: 'lab-results', title: 'Laboratory Results Panel', daysAgo: 5 },
    { type: 'medication-list', title: 'Current Medication List', daysAgo: 3 },
    { type: 'allergy-list', title: 'Active Allergy List', daysAgo: 3 },
  ]

  for (let i = 0; i < seedTypes.length; i++) {
    const seed = seedTypes[i]
    const org = orgs[i % orgs.length]
    const created = new Date(now - seed.daysAgo * 86400000).toISOString()

    docs.push({
      reference: {
        documentId: `seed-${patientId}-${i}`,
        documentType: seed.type,
        title: seed.title,
        created,
        authorOrganization: org,
        authorPractitioner: `Dr. ${org.name.split(' ')[0]}`,
        status: 'current',
        contentType: 'application/xml',
        size: 4096 + i * 1024,
        hash: `sha256:${simpleHash(seed.title + created).toString(16)}`,
        language: 'en',
      },
      content: btoa(
        `<ClinicalDocument>${seed.title} for ${patientId}</ClinicalDocument>`,
      ),
    })
  }

  documentStore.set(patientId, docs)
}

/** Simple string hash for deterministic stub behavior */
function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/** Singleton stub adapter instance */
export const stubHIEAdapter = new StubHIEAdapter()
