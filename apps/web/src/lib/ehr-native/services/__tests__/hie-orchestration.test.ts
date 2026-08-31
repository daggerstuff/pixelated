import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EHRAuditService } from '../../audit/ehr-audit-service'
import { EHRAuditAction } from '../../audit/events'
import type { HIEAdapter } from '../../integrations/hie/adapter'
import type {
  DocumentRetrievalRequest,
  DocumentRetrievalResult,
  DocumentSubmissionRequest,
  DocumentSubmissionResult,
  PatientDiscoveryRequest,
  PatientDiscoveryResult,
} from '../../integrations/hie/types'
import { HIEOrchestrationService } from '../hie.service'

const { mockAuditService, mockConsentService } = vi.hoisted(() => ({
  mockAuditService: {
    logIntegration: vi.fn(
      async (..._args: Parameters<EHRAuditService['logIntegration']>) =>
        'audit-id',
    ),
  },
  mockConsentService: {
    hasActiveConsent: vi.fn(async () => true),
  },
}))

vi.mock('../../audit/ehr-audit-service', () => ({
  EHRAuditService: {
    getInstance: () => mockAuditService,
  },
}))

vi.mock('../../../security/consent/ConsentService', () => ({
  consentService: mockConsentService,
}))

const DISCOVERY_RESULT: PatientDiscoveryResult = {
  found: true,
  patientId: 'patient-001',
  confidence: 0.95,
}

const RETRIEVAL_RESULT: DocumentRetrievalResult = {
  retrieved: true,
  content: 'aGk=',
  contentType: 'application/xml',
  document: {
    documentId: 'doc-001',
    documentType: 'summary-of-care-ccd',
    title: 'Summary of Care',
    created: '2026-08-30T16:00:00.000Z',
    authorOrganization: { id: 'org-001', name: 'Org' },
    status: 'current',
    contentType: 'application/xml',
  },
}

const SUBMISSION_RESULT: DocumentSubmissionResult = {
  submitted: true,
  documentId: 'doc-001',
  timestamp: '2026-08-30T16:00:00.000Z',
}

function makeAdapter(overrides: Partial<HIEAdapter> = {}): HIEAdapter {
  return {
    network: 'carequality',
    discoverPatient: vi.fn().mockResolvedValue(DISCOVERY_RESULT),
    queryDocuments: vi.fn().mockResolvedValue({
      documents: [],
      total: 0,
      hasMore: false,
    }),
    retrieveDocument: vi.fn().mockResolvedValue(RETRIEVAL_RESULT),
    submitDocument: vi.fn().mockResolvedValue(SUBMISSION_RESULT),
    queryOrganizationDirectory: vi.fn().mockResolvedValue({
      organizations: [],
      total: 0,
    }),
    ...overrides,
  }
}

type AuditPayload = { status?: string; errorMessage?: string }

function lastAuditCall(): AuditPayload | undefined {
  const { calls } = mockAuditService.logIntegration.mock
  return calls[calls.length - 1]?.[1]
}

const DISCOVERY_REQUEST: PatientDiscoveryRequest = {
  givenName: 'Test',
  familyName: 'Patient',
  dateOfBirth: '1990-01-01',
}

const RETRIEVAL_REQUEST: DocumentRetrievalRequest = {
  documentId: 'doc-001',
  patientId: 'patient-001',
}

const SUBMISSION_REQUEST: DocumentSubmissionRequest = {
  patientId: 'patient-001',
  documentType: 'summary-of-care-ccd',
  title: 'Summary of Care',
  content: 'aGk=',
  contentType: 'application/xml',
  authorOrganizationId: 'org-001',
  recipientDirectAddress: 'clinic@direct.example.org',
}

describe('HIEOrchestrationService audit outcomes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('audits a thrown adapter error as failure and rethrows', async () => {
    const service = new HIEOrchestrationService({
      adapter: makeAdapter({
        discoverPatient: vi
          .fn()
          .mockRejectedValue(new Error('Carequality PDQ returned 503')),
      }),
    })

    await expect(
      service.discoverPatient('user-001', DISCOVERY_REQUEST),
    ).rejects.toThrow('Carequality PDQ returned 503')

    expect(lastAuditCall()).toMatchObject({
      status: 'failure',
      errorMessage: 'Carequality PDQ returned 503',
    })
  })

  it('audits a discovery result carrying an error as failure', async () => {
    const service = new HIEOrchestrationService({
      adapter: makeAdapter({
        discoverPatient: vi.fn().mockResolvedValue({
          found: false,
          error: 'Gateway resolver timeout',
        }),
      }),
    })

    const result = await service.discoverPatient('user-001', DISCOVERY_REQUEST)

    expect(result.found).toBe(false)
    expect(lastAuditCall()).toMatchObject({
      status: 'failure',
      errorMessage: 'Gateway resolver timeout',
    })
  })

  it('audits a failed retrieval (retrieved=false with error) as failure', async () => {
    const service = new HIEOrchestrationService({
      adapter: makeAdapter({
        retrieveDocument: vi.fn().mockResolvedValue({
          ...RETRIEVAL_RESULT,
          retrieved: false,
          content: undefined,
          error: 'Document not found',
        }),
      }),
    })

    await service.retrieveDocument('user-001', RETRIEVAL_REQUEST)

    expect(lastAuditCall()).toMatchObject({
      status: 'failure',
      errorMessage: 'Document not found',
    })
  })

  it('audits a failed submission (submitted=false with error) as failure', async () => {
    const service = new HIEOrchestrationService({
      adapter: makeAdapter({
        submitDocument: vi.fn().mockResolvedValue({
          submitted: false,
          timestamp: '2026-08-30T16:00:00.000Z',
          error: 'DirectTrust send returned 500',
        }),
      }),
    })

    await service.submitDocument('user-001', SUBMISSION_REQUEST)

    expect(lastAuditCall()).toMatchObject({
      status: 'failure',
      errorMessage: 'DirectTrust send returned 500',
    })
  })

  it('audits successful results as success', async () => {
    const service = new HIEOrchestrationService({ adapter: makeAdapter() })

    await service.discoverPatient('user-001', DISCOVERY_REQUEST)
    expect(lastAuditCall()).toMatchObject({ status: 'success' })

    await service.retrieveDocument('user-001', RETRIEVAL_REQUEST)
    expect(lastAuditCall()).toMatchObject({ status: 'success' })

    await service.submitDocument('user-001', SUBMISSION_REQUEST)
    expect(lastAuditCall()).toMatchObject({ status: 'success' })
  })
})
