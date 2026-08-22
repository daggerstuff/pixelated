import type { PoolClient } from 'pg'
import { describe, it, expect, vi, beforeEach } from 'vitest'

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
const { ObservationRepository } = await import('../observation-repository')

const rlsContext: RLSContext = {
  tenantId: 'tenant-123',
  userId: 'user-456',
  role: 'physician',
  breakGlass: false,
}

const validObservation = {
  resourceType: 'Observation' as const,
  status: 'final' as const,
  code: {
    coding: [{ system: 'http://loinc.org', code: '2951-2' }],
    text: 'Sodium [Moles/volume] in Serum or Plasma',
  },
  subject: { reference: 'Patient/p-1' },
  encounter: { reference: 'Encounter/e-1' },
  effectiveDateTime: '2025-01-15T10:30:00Z',
  valueQuantity: {
    value: 140,
    unit: 'mmol/L',
    system: 'http://unitsofmeasure.org',
    code: 'mmol/L',
  },
}

describe('ObservationRepository', () => {
  let repo: InstanceType<typeof ObservationRepository>

  beforeEach(() => {
    vi.clearAllMocks()
    mockedTransaction.mockImplementation(async (cb) => cb(mockClient))
    mockQuery.mockReset()
    repo = new ObservationRepository(rlsContext)
  })

  describe('create', () => {
    it('inserts a valid observation and extracts denormalized fields', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ fhir_resource: { ...validObservation, id: 'o-1' } }],
          rowCount: 1,
        })

      const result = await repo.create(validObservation)

      expect(result.id).toBe('o-1')
      const insertCall = mockQuery.mock.calls[2]
      expect(insertCall[0]).toContain('INSERT INTO ehr_observation')
      expect(insertCall[1]).toContain('p-1')
      expect(insertCall[1]).toContain('e-1')
      expect(insertCall[1]).toContain('final')
      expect(insertCall[1]).toContain('2951-2')
      expect(insertCall[1]).toContain('2025-01-15T10:30:00Z')
    })

    it('rejects invalid observation schema', async () => {
      await expect(
        repo.create({ ...validObservation, resourceType: 'NotObservation' }),
      ).rejects.toThrow()
    })

    it('falls back to code.text when coding is absent', async () => {
      const obs = {
        ...validObservation,
        code: { text: 'Blood Pressure' },
      }
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ fhir_resource: { ...obs, id: 'o-2' } }],
          rowCount: 1,
        })

      await repo.create(obs)

      const insertCall = mockQuery.mock.calls[2]
      expect(insertCall[1]).toContain('Blood Pressure')
    })
  })

  describe('findById', () => {
    it('returns the FHIR resource when found', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ fhir_resource: { ...validObservation, id: 'o-1' } }],
          rowCount: 1,
        })

      const result = await repo.findById('o-1')

      expect(result).not.toBeNull()
      expect(result?.id).toBe('o-1')
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
    it('merges and updates an existing observation', async () => {
      const existing = { ...validObservation, id: 'o-1' }
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
          rows: [
            { fhir_resource: { ...existing, status: 'amended' as const } },
          ],
          rowCount: 1,
        })

      const result = await repo.update('o-1', { status: 'amended' })

      expect(result).not.toBeNull()
      expect(result?.status).toBe('amended')
      const updateCall = mockQuery.mock.calls[5]
      expect(updateCall[0]).toContain('UPDATE ehr_observation')
    })

    it('returns null when observation does not exist', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })

      const result = await repo.update('nonexistent', { status: 'amended' })

      expect(result).toBeNull()
    })
  })

  describe('findByStatus', () => {
    it('queries by status with pagination', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })

      await repo.findByStatus('final', 10, 5)

      const selectCall = mockQuery.mock.calls[2]
      expect(selectCall[0]).toContain('WHERE status = $1')
      expect(selectCall[0]).toContain('effective_date DESC')
      expect(selectCall[1]).toEqual(['final', 10, 5])
    })
  })

  describe('findByCode', () => {
    it('queries by LOINC code', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })

      await repo.findByCode('2951-2', 50, 0)

      const selectCall = mockQuery.mock.calls[2]
      expect(selectCall[0]).toContain('WHERE code = $1')
      expect(selectCall[1]).toEqual(['2951-2', 50, 0])
    })
  })

  describe('findByPatientAndDateRange', () => {
    it('filters by patient and effective_date range', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })

      await repo.findByPatientAndDateRange(
        'p-1',
        '2025-01-01',
        '2025-01-31',
        50,
        0,
      )

      const selectCall = mockQuery.mock.calls[2]
      expect(selectCall[0]).toContain('patient_id = $1')
      expect(selectCall[0]).toContain('effective_date >= $2')
      expect(selectCall[0]).toContain('effective_date <= $3')
      expect(selectCall[1]).toEqual(['p-1', '2025-01-01', '2025-01-31', 50, 0])
    })
  })

  describe('findByEncounter', () => {
    it('queries by encounter_id', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })

      await repo.findByEncounter('e-1', 100, 0)

      const selectCall = mockQuery.mock.calls[2]
      expect(selectCall[0]).toContain('WHERE encounter_id = $1')
      expect(selectCall[1]).toEqual(['e-1', 100, 0])
    })
  })

  describe('findByPatient', () => {
    it('queries by patient_id with pagination', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ fhir_resource: { ...validObservation, id: 'o-1' } }],
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

      const result = await repo.delete('o-1')

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

  describe('RLS context with break-glass', () => {
    it('sets break_glass=true in JWT claims when enabled', async () => {
      const breakGlassContext: RLSContext = {
        ...rlsContext,
        breakGlass: true,
      }
      const repoWithBreakGlass = new ObservationRepository(breakGlassContext)

      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })

      await repoWithBreakGlass.findById('o-1')

      const claimsCall = mockQuery.mock.calls[1]
      const claims = JSON.parse(claimsCall[1][0] as string)
      expect(claims.break_glass).toBe(true)
    })
  })
})
