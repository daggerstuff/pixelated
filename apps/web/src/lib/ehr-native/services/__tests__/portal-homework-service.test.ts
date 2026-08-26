// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { RLSContext } from '@/lib/ehr-native/repositories/base-repository'

// Mock client.query — private HomeworkRepository overrides call this.withRLS(client => client.query(...))
const mockClientQuery = vi.fn()
const mockClient = { query: mockClientQuery }

// findById is delegated to super.findById() which we mock here
// Must return a DocumentReference (the fhir_resource), NOT a DB row
const mockFindById = vi.fn()

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  transaction: vi.fn(async (cb: (client: unknown) => Promise<unknown>) =>
    cb(mockClient),
  ),
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
    withRLS = vi.fn(async (cb: (client: unknown) => Promise<unknown>) =>
      cb(mockClient),
    )
    findById = mockFindById
  },
}))

const { PortalHomeworkService } = await import('../portal-homework-service')

const rlsContext: RLSContext = {
  tenantId: 'tenant-123',
  userId: 'patient-456',
  role: 'patient',
  breakGlass: false,
}

const VALID_ASSIGNMENT_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const VALID_PATIENT_ID = 'ffffffff-1111-2222-3333-444444444444'

// Build a mock DocumentReference for homework with base64-encoded JSON payload
function makeMockHomeworkDocRef(
  payloadOverrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const payload = {
    description: 'CBT exercise description',
    instructions: 'Do this exercise daily',
    dueDate: '2024-12-31T00:00:00.000Z',
    assignedAt: '2024-01-01T00:00:00.000Z',
    status: 'assigned',
    ...payloadOverrides,
  }
  return {
    resourceType: 'DocumentReference',
    status: 'current',
    category: [
      { coding: [{ code: 'homework' }], text: 'Therapy Homework Assignment' },
    ],
    subject: { reference: `Patient/${VALID_PATIENT_ID}` },
    description: 'CBT exercise',
    date: '2024-01-01T00:00:00.000Z',
    author: [{ reference: 'Practitioner/doc-1' }],
    content: [
      {
        attachment: {
          contentType: 'application/json',
          data: Buffer.from(JSON.stringify(payload)).toString('base64'),
          title: 'CBT exercise',
        },
      },
    ],
    context: { related: [{ ref: { reference: 'Practitioner/doc-1' } }] },
  }
}

describe('PortalHomeworkService', () => {
  let service: InstanceType<typeof PortalHomeworkService>

  beforeEach(() => {
    vi.clearAllMocks()
    service = new PortalHomeworkService(rlsContext)
  })

  describe('listAssignments', () => {
    it('returns paginated assignments for a patient', async () => {
      const mockDocRef = makeMockHomeworkDocRef()
      // findByPatient query first (Promise.all order), then countByPatient
      mockClientQuery
        .mockResolvedValueOnce({
          rows: [{ fhir_resource: mockDocRef }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] })

      const result = await service.listAssignments(VALID_PATIENT_ID, {
        limit: 20,
        offset: 0,
      })
      expect(result.assignments).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('returns empty when no assignments', async () => {
      mockClientQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] })

      const result = await service.listAssignments(VALID_PATIENT_ID, {
        limit: 20,
        offset: 0,
      })
      expect(result.assignments).toHaveLength(0)
      expect(result.total).toBe(0)
    })
  })

  describe('getAssignment', () => {
    it('returns assignment when found', async () => {
      const mockDocRef = makeMockHomeworkDocRef()
      // findById override calls super.findById → mockFindById
      mockFindById.mockResolvedValue(mockDocRef)

      const result = await service.getAssignment(
        VALID_ASSIGNMENT_ID,
        VALID_PATIENT_ID,
      )
      expect(result).not.toBeNull()
      expect(result?.patientId).toBe(VALID_PATIENT_ID)
    })

    it('returns null when assignment not found', async () => {
      mockFindById.mockResolvedValue(null)
      const result = await service.getAssignment(
        VALID_ASSIGNMENT_ID,
        VALID_PATIENT_ID,
      )
      expect(result).toBeNull()
    })
  })

  describe('completeAssignment', () => {
    it('marks assignment as completed with notes', async () => {
      const mockDocRef = makeMockHomeworkDocRef({ status: 'assigned' })
      const mockUpdatedDocRef = makeMockHomeworkDocRef({
        status: 'completed',
        completedAt: '2024-01-02T00:00:00.000Z',
        patientNotes: 'Completed',
      })

      // updateAssignment calls findById twice: once in getAssignment, once in homeworkRepo.updateAssignment
      mockFindById.mockResolvedValue(mockDocRef)
      // homeworkRepo.updateAssignment calls withRLS → client.query(UPDATE...RETURNING)
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ fhir_resource: mockUpdatedDocRef }],
      })

      const result = await service.completeAssignment(
        VALID_ASSIGNMENT_ID,
        VALID_PATIENT_ID,
        'Completed',
      )
      expect(mockClientQuery).toHaveBeenCalledOnce()
      expect(result).not.toBeNull()
      expect(result?.status).toBe('completed')
    })
  })

  describe('getSummary', () => {
    it('returns summary with counts', async () => {
      const mockCompleted = makeMockHomeworkDocRef({ status: 'completed' })
      const mockAssigned = makeMockHomeworkDocRef({ status: 'assigned' })

      // getSummary → listAssignments → findByPatient (1st query) + countByPatient (2nd query)
      mockClientQuery
        .mockResolvedValueOnce({
          rows: [
            { fhir_resource: mockCompleted },
            { fhir_resource: mockAssigned },
          ],
          rowCount: 2,
        })
        .mockResolvedValueOnce({ rows: [{ count: 2 }] })

      const result = await service.getSummary(VALID_PATIENT_ID)
      expect(result).toBeTruthy()
      expect(result.totalAssigned).toBe(2)
      expect(result.completed).toBe(1)
      expect(result.pending).toBe(1)
    })
  })
})
