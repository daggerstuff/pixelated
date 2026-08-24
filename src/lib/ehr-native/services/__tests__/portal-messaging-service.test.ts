// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RLSContext } from '@/lib/ehr-native/repositories/base-repository'

// Mock client.query — the private CommunicationRepository overrides call this.withRLS(client => client.query(...))
const mockClientQuery = vi.fn()
const mockClient = { query: mockClientQuery }

// findById is delegated to super.findById() which we mock here
// It must return a DocumentReference (the fhir_resource), NOT a DB row
const mockFindById = vi.fn()

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  transaction: vi.fn(async (cb: (client: unknown) => Promise<unknown>) => cb(mockClient)),
}))

vi.mock('@/lib/ehr-native/repositories/base-repository', () => ({
  BaseRepository: class MockBaseRepository {
    protected rlsContext: RLSContext
    protected readonly tableName = 'ehr_document_reference'
    protected readonly idColumn = 'document_reference_id'
    protected readonly resourceType = 'DocumentReference'
    constructor(rlsContext: RLSContext) {
      this.rlsContext = rlsContext
    }
    withRLS = vi.fn(async (cb: (client: unknown) => Promise<unknown>) => cb(mockClient))
    findById = mockFindById
  },
}))

const { PortalMessagingService } = await import('../portal-messaging-service')

const rlsContext: RLSContext = {
  tenantId: 'tenant-123',
  userId: 'patient-456',
  role: 'patient',
  breakGlass: false,
}

const VALID_THREAD_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const VALID_PATIENT_ID = 'ffffffff-1111-2222-3333-444444444444'

// Mock DocumentReference — must match what toThread() accesses
function makeMockDocRef(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    resourceType: 'DocumentReference',
    status: 'current',
    category: [{ coding: [{ code: 'communication' }], text: 'Secure Message Thread' }],
    subject: { reference: `Patient/${VALID_PATIENT_ID}` },
    description: 'Test Thread',
    date: '2024-01-01T00:00:00.000Z',
    author: [{ reference: `Patient/${VALID_PATIENT_ID}` }],
    content: [
      {
        attachment: {
          contentType: 'text/plain',
          data: Buffer.from('Hello doctor').toString('base64'),
          title: 'Initial message',
        },
      },
    ],
    context: { related: [{ ref: { reference: 'Practitioner/doc-1' } }] },
    ...overrides,
  }
}

describe('PortalMessagingService', () => {
  let service: InstanceType<typeof PortalMessagingService>

  beforeEach(() => {
    vi.clearAllMocks()
    service = new PortalMessagingService(rlsContext)
  })

  describe('listThreads', () => {
    it('returns paginated threads for a patient', async () => {
      const mockDocRef = makeMockDocRef()
      // findByPatient query runs first (Promise.all order), then countByPatient
      mockClientQuery
        .mockResolvedValueOnce({ rows: [{ fhir_resource: mockDocRef }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] })

      const result = await service.listThreads(VALID_PATIENT_ID, { limit: 20, offset: 0 })
      expect(result.threads).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('returns empty array when no threads exist', async () => {
      mockClientQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] })

      const result = await service.listThreads(VALID_PATIENT_ID, { limit: 20, offset: 0 })
      expect(result.threads).toHaveLength(0)
      expect(result.total).toBe(0)
    })
  })

  describe('createThread', () => {
    it('creates a new thread with initial message', async () => {
      const mockDocRef = makeMockDocRef()
      // CommunicationRepository.createThread calls documentReferenceSchema.parse then withRLS → client.query(INSERT...RETURNING)
      mockClientQuery.mockResolvedValueOnce({ rows: [{ fhir_resource: mockDocRef }], rowCount: 1 })

      const result = await service.createThread({
        patientId: VALID_PATIENT_ID,
        subject: 'Test Thread',
        practitionerReference: 'Practitioner/doc-1',
        initialMessage: 'Hello doctor',
      })

      expect(mockClientQuery).toHaveBeenCalledOnce()
      expect(result).toBeTruthy()
      expect(result.subject).toBe('Test Thread')
    })
  })

  describe('getThread', () => {
    it('returns thread when found', async () => {
      const mockDocRef = makeMockDocRef()
      // findById override calls super.findById → mockFindById
      mockFindById.mockResolvedValue(mockDocRef)

      const result = await service.getThread(VALID_THREAD_ID, VALID_PATIENT_ID)
      expect(result).not.toBeNull()
      expect(result?.patientId).toBe(VALID_PATIENT_ID)
    })

    it('returns null when thread not found', async () => {
      mockFindById.mockResolvedValue(null)
      const result = await service.getThread(VALID_THREAD_ID, VALID_PATIENT_ID)
      expect(result).toBeNull()
    })
  })

  describe('deleteThread', () => {
    it('returns true when deletion succeeds', async () => {
      const mockDocRef = makeMockDocRef()
      mockFindById.mockResolvedValue(mockDocRef)
      // delete override calls withRLS → client.query(DELETE...)
      mockClientQuery.mockResolvedValueOnce({ rowCount: 1 })

      const result = await service.deleteThread(VALID_THREAD_ID, VALID_PATIENT_ID)
      expect(result).toBe(true)
    })

    it('returns false when thread not found', async () => {
      mockFindById.mockResolvedValue(null)
      const result = await service.deleteThread(VALID_THREAD_ID, VALID_PATIENT_ID)
      expect(result).toBe(false)
    })
  })
})
