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
const { AppointmentRepository } = await import('../appointment-repository')

const rlsContext: RLSContext = {
  tenantId: 'tenant-123',
  userId: 'user-456',
  role: 'physician',
  breakGlass: false,
}

const validAppointment = {
  resourceType: 'Appointment' as const,
  status: 'booked' as const,
  start: '2025-01-20T09:00:00Z',
  end: '2025-01-20T09:30:00Z',
  participant: [
    {
      actor: { reference: 'Patient/p-1' },
      status: 'accepted' as const,
    },
    {
      actor: { reference: 'Practitioner/pr-1' },
      status: 'accepted' as const,
    },
  ],
}

describe('AppointmentRepository', () => {
  let repo: InstanceType<typeof AppointmentRepository>

  beforeEach(() => {
    vi.clearAllMocks()
    mockedTransaction.mockImplementation(async (cb) => cb(mockClient))
    mockQuery.mockReset()
    repo = new AppointmentRepository(rlsContext)
  })

  describe('create', () => {
    it('inserts a valid appointment and extracts denormalized fields', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ fhir_resource: { ...validAppointment, id: 'a-1' } }],
          rowCount: 1,
        })

      const result = await repo.create(validAppointment)

      expect(result.id).toBe('a-1')
      const insertCall = mockQuery.mock.calls[2]
      expect(insertCall[0]).toContain('INSERT INTO ehr_appointment')
      expect(insertCall[1]).toContain('p-1')
      expect(insertCall[1]).toContain('pr-1')
      expect(insertCall[1]).toContain('booked')
      expect(insertCall[1]).toContain('2025-01-20T09:00:00Z')
    })

    it('rejects invalid appointment schema', async () => {
      await expect(
        repo.create({ ...validAppointment, resourceType: 'NotAppointment' }),
      ).rejects.toThrow()
    })
  })

  describe('findById', () => {
    it('returns the FHIR resource when found', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ fhir_resource: { ...validAppointment, id: 'a-1' } }],
          rowCount: 1,
        })

      const result = await repo.findById('a-1')

      expect(result).not.toBeNull()
      expect(result?.id).toBe('a-1')
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
    it('merges and updates an existing appointment', async () => {
      const existing = { ...validAppointment, id: 'a-1' }
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
            { fhir_resource: { ...existing, status: 'cancelled' as const } },
          ],
          rowCount: 1,
        })

      const result = await repo.update('a-1', { status: 'cancelled' })

      expect(result).not.toBeNull()
      expect(result?.status).toBe('cancelled')
      const updateCall = mockQuery.mock.calls[5]
      expect(updateCall[0]).toContain('UPDATE ehr_appointment')
    })

    it('returns null when appointment does not exist', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })

      const result = await repo.update('nonexistent', { status: 'cancelled' })

      expect(result).toBeNull()
    })
  })

  describe('findByStatus', () => {
    it('queries by status with pagination', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ fhir_resource: { ...validAppointment, id: 'a-1' } }],
          rowCount: 1,
        })

      const result = await repo.findByStatus('booked', 10, 5)

      expect(result).toHaveLength(1)
      const selectCall = mockQuery.mock.calls[2]
      expect(selectCall[0]).toContain('WHERE status = $1')
      expect(selectCall[0]).toContain('start_time ASC')
    })
  })

  describe('findByDateRange', () => {
    it('filters by start_time range', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })

      await repo.findByDateRange('2025-01-01', '2025-01-31', 50, 0)

      const selectCall = mockQuery.mock.calls[2]
      expect(selectCall[0]).toContain('start_time >= $1')
      expect(selectCall[0]).toContain('start_time <= $2')
    })
  })

  describe('findUpcomingByPractitioner', () => {
    it('queries upcoming appointments for a practitioner', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })

      await repo.findUpcomingByPractitioner('pr-1', 20, 0)

      const selectCall = mockQuery.mock.calls[2]
      expect(selectCall[0]).toContain('practitioner_id = $1')
      expect(selectCall[0]).toContain('start_time >= NOW()')
      expect(selectCall[1]).toEqual(['pr-1', 20, 0])
    })
  })

  describe('findByPatient', () => {
    it('queries by patient_id ordered by start_time DESC', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ fhir_resource: { ...validAppointment, id: 'a-1' } }],
          rowCount: 1,
        })

      const result = await repo.findByPatient('p-1', 10, 0)

      expect(result).toHaveLength(1)
      const selectCall = mockQuery.mock.calls[2]
      expect(selectCall[0]).toContain('patient_id = $1')
      expect(selectCall[0]).toContain('start_time DESC')
    })
  })

  describe('delete', () => {
    it('returns true when deleted', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })

      const result = await repo.delete('a-1')

      expect(result).toBe(true)
    })
  })
})
