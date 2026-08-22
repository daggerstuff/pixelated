import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PoolClient } from 'pg'
import type { RLSContext } from '../base-repository'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
}))

const mockQuery = vi.fn()
const mockClient = {
  query: mockQuery,
} as unknown as PoolClient

const { transaction } = await import('@/lib/db')
const mockedTransaction = vi.mocked(transaction)

const { PatientRepository } = await import('../patient-repository')

const rlsContext: RLSContext = {
  tenantId: 'tenant-123',
  userId: 'user-456',
  role: 'physician',
  breakGlass: false,
}

const validPatient = {
  resourceType: 'Patient' as const,
  identifier: [{ system: 'http://hospital.example.org/mrn', value: 'MRN-001' }],
  active: true,
  name: [{ family: 'Doe', given: ['John'] }],
  gender: 'male',
  birthDate: '1990-01-15',
}

describe('PatientRepository', () => {
  let repo: InstanceType<typeof PatientRepository>

  beforeEach(() => {
    vi.clearAllMocks()
    mockedTransaction.mockImplementation(async (cb) => cb(mockClient))
    mockQuery.mockReset()
    repo = new PatientRepository(rlsContext)
  })

  describe('create', () => {
    it('inserts a valid patient and returns the stored FHIR resource', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // SET LOCAL app.tenant_id
        .mockResolvedValueOnce({ rows: [] }) // SET LOCAL request.jwt.claims
        .mockResolvedValueOnce({
          rows: [{ fhir_resource: { ...validPatient, id: 'p-1' } }],
          rowCount: 1,
        })

      const result = await repo.create(validPatient)

      expect(result.id).toBe('p-1')
      expect(mockQuery).toHaveBeenCalledTimes(3)
      const insertCall = mockQuery.mock.calls[2]
      expect(insertCall[0]).toContain('INSERT INTO ehr_patient')
      expect(insertCall[0]).toContain('RETURNING fhir_resource')
      expect(insertCall[1]).toContain('MRN-001')
      expect(insertCall[1]).toContain('Doe')
      expect(insertCall[1]).toContain('John')
    })

    it('rejects an invalid patient schema', async () => {
      await expect(
        repo.create({ ...validPatient, resourceType: 'NotPatient' })
      ).rejects.toThrow()
    })
  })

  describe('findById', () => {
    it('returns the FHIR resource when found', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ fhir_resource: { ...validPatient, id: 'p-1' } }],
          rowCount: 1,
        })

      const result = await repo.findById('p-1')

      expect(result).not.toBeNull()
      expect(result?.id).toBe('p-1')
      const selectCall = mockQuery.mock.calls[2]
      expect(selectCall[0]).toContain('SELECT fhir_resource FROM ehr_patient')
      expect(selectCall[0]).toContain('patient_id = $1')
    })

    it('returns null when not found', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })

      const result = await repo.findById('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('update', () => {
    it('merges and updates an existing patient', async () => {
      const existing = { ...validPatient, id: 'p-1' }
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ fhir_resource: existing }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ fhir_resource: { ...existing, active: false } }],
          rowCount: 1,
        })

      const result = await repo.update('p-1', { active: false })

      expect(result).not.toBeNull()
      expect(result?.active).toBe(false)
      const updateCall = mockQuery.mock.calls[5]
      expect(updateCall[0]).toContain('UPDATE ehr_patient')
      expect(updateCall[0]).toContain('SET mrn =')
    })

    it('returns null when patient does not exist', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })

      const result = await repo.update('nonexistent', { active: false })

      expect(result).toBeNull()
    })
  })

  describe('findByMRN', () => {
    it('queries by MRN and returns the resource', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ fhir_resource: { ...validPatient, id: 'p-1' } }],
          rowCount: 1,
        })

      const result = await repo.findByMRN('MRN-001')

      expect(result).not.toBeNull()
      expect(result?.id).toBe('p-1')
    })
  })

  describe('findActive', () => {
    it('returns active patients paginated', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            { fhir_resource: { ...validPatient, id: 'p-1' } },
            { fhir_resource: { ...validPatient, id: 'p-2' } },
          ],
          rowCount: 2,
        })

      const result = await repo.findActive(10, 0)

      expect(result).toHaveLength(2)
      const selectCall = mockQuery.mock.calls[2]
      expect(selectCall[0]).toContain('WHERE active = true')
      expect(selectCall[0]).toContain('ORDER BY family_name')
    })
  })

  describe('searchByName', () => {
    it('uses ILIKE for partial name matching', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ fhir_resource: { ...validPatient, id: 'p-1' } }],
          rowCount: 1,
        })

      const result = await repo.searchByName('Doe')

      expect(result).toHaveLength(1)
      const selectCall = mockQuery.mock.calls[2]
      expect(selectCall[0]).toContain('ILIKE')
      expect(selectCall[1]).toEqual(['%Doe%', 20, 0])
    })
  })

  describe('delete', () => {
    it('returns true when a row is deleted', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })

      const result = await repo.delete('p-1')

      expect(result).toBe(true)
      const deleteCall = mockQuery.mock.calls[2]
      expect(deleteCall[0]).toContain('DELETE FROM ehr_patient')
    })

    it('returns false when nothing deleted', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })

      const result = await repo.delete('nonexistent')

      expect(result).toBe(false)
    })
  })

  describe('RLS context', () => {
    it('sets RLS session variables on every operation', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ fhir_resource: validPatient }], rowCount: 1 })

      await repo.findById('p-1')

      const tenantCall = mockQuery.mock.calls[0]
      const claimsCall = mockQuery.mock.calls[1]

      expect(tenantCall[0]).toContain('SET LOCAL app.tenant_id')
      expect(tenantCall[1]).toEqual(['tenant-123'])

      expect(claimsCall[0]).toContain('SET LOCAL request.jwt.claims')
      const claims = JSON.parse(claimsCall[1][0] as string)
      expect(claims.sub).toBe('user-456')
      expect(claims.role).toBe('physician')
      expect(claims.break_glass).toBe(false)
    })
  })
})
