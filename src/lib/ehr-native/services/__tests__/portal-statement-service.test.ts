// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RLSContext } from '@/lib/ehr-native/repositories/base-repository'

// Mock client.query — private StatementRepository overrides call this.withRLS(client => client.query(...))
const mockClientQuery = vi.fn()
const mockClient = { query: mockClientQuery }

// findById is delegated to super.findById() which we mock here
// Must return a Claim (the fhir_resource), NOT a DB row
const mockFindById = vi.fn()

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  transaction: vi.fn(async (cb: (client: unknown) => Promise<unknown>) => cb(mockClient)),
}))

vi.mock('@/lib/ehr-native/repositories/base-repository', () => ({
  BaseRepository: class MockBaseRepository {
    protected rlsContext: RLSContext
    protected readonly tableName = 'ehr_claim'
    protected readonly idColumn = 'claim_id'
    protected readonly resourceType = 'Claim'
    constructor(rlsContext: RLSContext) {
      this.rlsContext = rlsContext
    }
    withRLS = vi.fn(async (cb: (client: unknown) => Promise<unknown>) => cb(mockClient))
    findById = mockFindById
  },
}))

const { PortalStatementService } = await import('../portal-statement-service')

const rlsContext: RLSContext = {
  tenantId: 'tenant-123',
  userId: 'patient-456',
  role: 'patient',
  breakGlass: false,
}

const VALID_STATEMENT_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const VALID_PATIENT_ID = 'ffffffff-1111-2222-3333-444444444444'

// Mock Claim — must match what toStatement() accesses
function makeMockClaim(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    resourceType: 'Claim',
    status: 'active',
    use: 'claim',
    patient: { reference: `Patient/${VALID_PATIENT_ID}` },
    provider: { reference: 'Practitioner/doc-1' },
    total: { value: 150.0, currency: 'USD' },
    created: '2024-01-01T00:00:00.000Z',
    item: [{ sequence: 1, net: { value: 150.0, currency: 'USD' } }],
    diagnosis: [],
    insurance: [],
    ...overrides,
  }
}

describe('PortalStatementService', () => {
  let service: InstanceType<typeof PortalStatementService>

  beforeEach(() => {
    vi.clearAllMocks()
    service = new PortalStatementService(rlsContext)
  })

  describe('listStatements', () => {
    it('returns paginated statements for a patient', async () => {
      const mockClaim = makeMockClaim()
      // findByPatient query first (Promise.all order), then countByPatient
      mockClientQuery
        .mockResolvedValueOnce({ rows: [{ fhir_resource: mockClaim }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] })

      const result = await service.listStatements(VALID_PATIENT_ID, { limit: 20, offset: 0 })
      expect(result.statements).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('returns empty when no statements', async () => {
      mockClientQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] })

      const result = await service.listStatements(VALID_PATIENT_ID, { limit: 20, offset: 0 })
      expect(result.statements).toHaveLength(0)
      expect(result.total).toBe(0)
    })
  })

  describe('getStatement', () => {
    it('returns statement when found', async () => {
      const mockClaim = makeMockClaim({ total: { value: 200.0, currency: 'USD' } })
      // findById override calls super.findById → mockFindById
      mockFindById.mockResolvedValue(mockClaim)

      const result = await service.getStatement(VALID_STATEMENT_ID, VALID_PATIENT_ID)
      expect(result).not.toBeNull()
      expect(result?.patientId).toBe(VALID_PATIENT_ID)
      expect(result?.totalAmount).toBe(200.0)
    })

    it('returns null when statement not found', async () => {
      mockFindById.mockResolvedValue(null)
      const result = await service.getStatement(VALID_STATEMENT_ID, VALID_PATIENT_ID)
      expect(result).toBeNull()
    })
  })

  describe('downloadStatement', () => {
    it('returns CSV download data', async () => {
      const mockClaim = makeMockClaim({
        total: { value: 250.0, currency: 'USD' },
        item: [{ sequence: 1, net: { value: 250.0, currency: 'USD' } }],
      })
      mockFindById.mockResolvedValue(mockClaim)

      const result = await service.downloadStatement(VALID_STATEMENT_ID, VALID_PATIENT_ID)
      expect(result).not.toBeNull()
      if (result) {
        expect(result.contentType).toContain('text/csv')
        expect(result.filename).toContain('.csv')
        expect(result.data).toContain('Statement ID')
      }
    })

    it('returns null when statement not found for download', async () => {
      mockFindById.mockResolvedValue(null)
      const result = await service.downloadStatement(VALID_STATEMENT_ID, VALID_PATIENT_ID)
      expect(result).toBeNull()
    })
  })

  describe('getSummary', () => {
    it('returns summary with totals', async () => {
      const mockClaim1 = makeMockClaim({ total: { value: 100.0, currency: 'USD' } })
      const mockClaim2 = makeMockClaim({
        status: 'adjudicated',
        total: { value: 50.0, currency: 'USD' },
      })

      // getSummary → listStatements → findByPatient (1st query) + countByPatient (2nd query)
      mockClientQuery
        .mockResolvedValueOnce({
          rows: [{ fhir_resource: mockClaim1 }, { fhir_resource: mockClaim2 }],
          rowCount: 2,
        })
        .mockResolvedValueOnce({ rows: [{ count: 2 }] })

      const result = await service.getSummary(VALID_PATIENT_ID)
      expect(result).toBeTruthy()
      expect(result.totalStatements).toBe(2)
      expect(result.totalBilled).toBe(150.0)
      expect(result.currency).toBe('USD')
    })
  })
})
