import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PoolClient } from 'pg'

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

import type { RLSContext } from '../base-repository'
const { EncounterRepository } = await import('../encounter-repository')

const rlsContext: RLSContext = {
  tenantId: 'tenant-123',
  userId: 'user-456',
  role: 'physician',
  breakGlass: false,
}

const validEncounter = {
  resourceType: 'Encounter' as const,
  status: 'in-progress' as const,
  class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
  subject: { reference: 'Patient/p-1' },
  participant: [
    {
      individual: { reference: 'Practitioner/pr-1' },
    },
  ],
  period: { start: '2025-01-15T10:00:00Z', end: '2025-01-15T11:00:00Z' },
}

describe('EncounterRepository', () => {
  let repo: InstanceType<typeof EncounterRepository>

  beforeEach(() => {
    vi.clearAllMocks()
    mockedTransaction.mockImplementation(async (cb) => cb(mockClient))
    mockQuery.mockReset()
    repo = new EncounterRepository(rlsContext)
  })

  describe('create', () => {
    it('inserts a valid encounter and extracts denormalized fields', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ fhir_resource: { ...validEncounter, id: 'e-1' } }],
          rowCount: 1,
        })

      const result = await repo.create(validEncounter)

      expect(result.id).toBe('e-1')
      const insertCall = mockQuery.mock.calls[2]
      expect(insertCall[0]).toContain('INSERT INTO ehr_encounter')
      expect(insertCall[1]).toContain('p-1')
      expect(insertCall[1]).toContain('pr-1')
      expect(insertCall[1]).toContain('in-progress')
      expect(insertCall[1]).toContain('AMB')
    })

    it('rejects invalid encounter schema', async () => {
      await expect(
        repo.create({ ...validEncounter, resourceType: 'NotEncounter' })
      ).rejects.toThrow()
    })
  })

  describe('findById', () => {
    it('returns the FHIR resource when found', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ fhir_resource: { ...validEncounter, id: 'e-1' } }],
          rowCount: 1,
        })

      const result = await repo.findById('e-1')

      expect(result).not.toBeNull()
      expect(result?.id).toBe('e-1')
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
    it('merges and updates an existing encounter', async () => {
      const existing = { ...validEncounter, id: 'e-1' }
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
          rows: [{ fhir_resource: { ...existing, status: 'finished' as const } }],
          rowCount: 1,
        })

      const result = await repo.update('e-1', { status: 'finished' })

      expect(result).not.toBeNull()
      expect(result?.status).toBe('finished')
      const updateCall = mockQuery.mock.calls[5]
      expect(updateCall[0]).toContain('UPDATE ehr_encounter')
    })

    it('returns null when encounter does not exist', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })

      const result = await repo.update('nonexistent', { status: 'finished' })

      expect(result).toBeNull()
    })
  })

  describe('findByStatus', () => {
    it('queries by status with pagination', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ fhir_resource: { ...validEncounter, id: 'e-1' } }],
          rowCount: 1,
        })

      const result = await repo.findByStatus('in-progress', 10, 5)

      expect(result).toHaveLength(1)
      const selectCall = mockQuery.mock.calls[2]
      expect(selectCall[0]).toContain('WHERE status = $1')
      expect(selectCall[0]).toContain('period_start DESC')
      expect(selectCall[1]).toEqual(['in-progress', 10, 5])
    })
  })

  describe('findByDateRange', () => {
    it('filters by period_start and period_end', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })

      await repo.findByDateRange('2025-01-01', '2025-01-31', 50, 0)

      const selectCall = mockQuery.mock.calls[2]
      expect(selectCall[0]).toContain('period_start >= $1')
      expect(selectCall[0]).toContain('period_end <= $2')
      expect(selectCall[1]).toEqual(['2025-01-01', '2025-01-31', 50, 0])
    })
  })

  describe('findByPractitioner', () => {
    it('queries by practitioner_id', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })

      await repo.findByPractitioner('pr-1', 25, 0)

      const selectCall = mockQuery.mock.calls[2]
      expect(selectCall[0]).toContain('WHERE practitioner_id = $1')
      expect(selectCall[1]).toEqual(['pr-1', 25, 0])
    })
  })

  describe('findByPatient', () => {
    it('queries by patient_id with pagination', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ fhir_resource: { ...validEncounter, id: 'e-1' } }],
          rowCount: 1,
        })

      const result = await repo.findByPatient('p-1', 10, 0)

      expect(result).toHaveLength(1)
      const selectCall = mockQuery.mock.calls[2]
      expect(selectCall[0]).toContain('patient_id = $1')
    })
  })

  describe('delete', () => {
    it('returns true when deleted', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })

      const result = await repo.delete('e-1')

      expect(result).toBe(true)
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
})
