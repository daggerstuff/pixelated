/**
 * Tests for EHR Native Consent Repository (F1.4)
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

import type { QueryResultRow } from '@/lib/db'

// ---------------------------------------------------------------------------
// Mock the db module
// ---------------------------------------------------------------------------

const { mockQuery, mockTransaction } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockTransaction: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  query: mockQuery,
  transaction: mockTransaction,
}))

import type { Consent } from '../types/consent'
// Import after mocks are set up
import {
  ConsentRepository,
  type ConsentRow,
  type CreateConsentInput,
} from './repository'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConsentRow(overrides: Partial<ConsentRow> = {}): ConsentRow {
  return {
    consent_id: 'consent-123',
    tenant_id: 'tenant-abc',
    patient_id: 'patient-456',
    status: 'active',
    scope: 'treatment',
    category: 'default',
    consent_level: 'minimal',
    period_start: '2025-01-01',
    period_end: '2026-12-31',
    fhir_resource: {
      resourceType: 'Consent',
      status: 'active',
      scope: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/consentscope',
            code: 'patient-privacy',
          },
        ],
      },
      category: [{ coding: [{ system: 'http://loinc.org', code: '59284-0' }] }],
      patient: { reference: 'Patient/patient-456' },
      dateTime: '2025-01-01',
    } as Consent,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeConsentResource(): Consent {
  return {
    resourceType: 'Consent',
    status: 'active',
    scope: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/consentscope',
          code: 'patient-privacy',
        },
      ],
    },
    category: [{ coding: [{ system: 'http://loinc.org', code: '59284-0' }] }],
    patient: { reference: 'Patient/patient-456' },
    dateTime: '2025-01-01',
  } as Consent
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConsentRepository', () => {
  let repo: ConsentRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new ConsentRepository()
  })

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  describe('create', () => {
    it('inserts a new consent record and returns it', async () => {
      const row = makeConsentRow()
      mockQuery.mockResolvedValue({ rows: [row], rowCount: 1 })

      const input: CreateConsentInput = {
        tenantId: 'tenant-abc',
        patientId: 'patient-456',
        consentLevel: 'minimal',
        fhirResource: makeConsentResource(),
      }

      const result = await repo.create(input)

      expect(result).toEqual(row)
      expect(mockQuery).toHaveBeenCalledTimes(1)
      const [sql, params] = mockQuery.mock.calls[0]
      expect(sql).toContain('INSERT INTO ehr_consent')
      expect(sql).toContain('RETURNING *')
      expect(params).toHaveLength(9)
      expect(params[0]).toBe('tenant-abc')
      expect(params[1]).toBe('patient-456')
      expect(params[2]).toBe('active') // default status
      expect(params[3]).toBeNull() // default scope
      expect(params[4]).toBeNull() // default category
      expect(params[5]).toBe('minimal')
      expect(params[6]).toBeNull() // default periodStart
      expect(params[7]).toBeNull() // default periodEnd
      expect(params[8]).toBe(JSON.stringify(input.fhirResource))
    })

    it('passes provided values instead of defaults', async () => {
      const row = makeConsentRow()
      mockQuery.mockResolvedValue({ rows: [row], rowCount: 1 })

      const fhir = makeConsentResource()
      await repo.create({
        tenantId: 't1',
        patientId: 'p1',
        status: 'inactive',
        scope: 'research',
        category: 'cat-1',
        consentLevel: 'full',
        periodStart: '2025-06-01',
        periodEnd: '2026-06-01',
        fhirResource: fhir,
      })

      const params = mockQuery.mock.calls[0][1]
      expect(params[0]).toBe('t1')
      expect(params[1]).toBe('p1')
      expect(params[2]).toBe('inactive')
      expect(params[3]).toBe('research')
      expect(params[4]).toBe('cat-1')
      expect(params[5]).toBe('full')
      expect(params[6]).toBe('2025-06-01')
      expect(params[7]).toBe('2026-06-01')
      expect(params[8]).toBe(JSON.stringify(fhir))
    })
  })

  // -------------------------------------------------------------------------
  // getById
  // -------------------------------------------------------------------------

  describe('getById', () => {
    it('returns the consent row when found', async () => {
      const row = makeConsentRow()
      mockQuery.mockResolvedValue({ rows: [row], rowCount: 1 })

      const result = await repo.getById('consent-123', 'tenant-abc')

      expect(result).toEqual(row)
      expect(mockQuery).toHaveBeenCalledTimes(1)
      const [sql, params] = mockQuery.mock.calls[0]
      expect(sql).toContain('SELECT * FROM ehr_consent')
      expect(sql).toContain('WHERE consent_id = $1 AND tenant_id = $2')
      expect(params).toEqual(['consent-123', 'tenant-abc'])
    })

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 })

      const result = await repo.getById('nonexistent', 'tenant-abc')

      expect(result).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // getByPatient
  // -------------------------------------------------------------------------

  describe('getByPatient', () => {
    it('returns all consent records for a patient ordered by created_at DESC', async () => {
      const row1 = makeConsentRow({ consent_id: 'c1' })
      const row2 = makeConsentRow({ consent_id: 'c2' })
      mockQuery.mockResolvedValue({ rows: [row1, row2], rowCount: 2 })

      const result = await repo.getByPatient('patient-456', 'tenant-abc')

      expect(result).toEqual([row1, row2])
      const [sql, params] = mockQuery.mock.calls[0]
      expect(sql).toContain('ORDER BY created_at DESC')
      expect(params).toEqual(['patient-456', 'tenant-abc'])
    })

    it('returns empty array when no records exist', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 })

      const result = await repo.getByPatient('no-patient', 'no-tenant')

      expect(result).toEqual([])
    })
  })

  // -------------------------------------------------------------------------
  // getActiveByPatient
  // -------------------------------------------------------------------------

  describe('getActiveByPatient', () => {
    it('returns the most recent active consent', async () => {
      const row = makeConsentRow()
      mockQuery.mockResolvedValue({ rows: [row], rowCount: 1 })

      const result = await repo.getActiveByPatient('patient-456', 'tenant-abc')

      expect(result).toEqual(row)
      const [sql, params] = mockQuery.mock.calls[0]
      expect(sql).toContain("status = 'active'")
      expect(sql).toContain('ORDER BY created_at DESC')
      expect(sql).toContain('LIMIT 1')
      expect(params).toEqual(['patient-456', 'tenant-abc'])
    })

    it('returns null when no active consent exists', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 })

      const result = await repo.getActiveByPatient('patient-456', 'tenant-abc')

      expect(result).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // listByTenant
  // -------------------------------------------------------------------------

  describe('listByTenant', () => {
    it('lists consent records for a tenant with default pagination', async () => {
      const rows = [makeConsentRow()]
      mockQuery.mockResolvedValue({ rows, rowCount: 1 })

      const result = await repo.listByTenant('tenant-abc')

      expect(result).toEqual(rows)
      const [sql, params] = mockQuery.mock.calls[0]
      expect(sql).toContain('LIMIT $2 OFFSET $3')
      expect(params).toEqual(['tenant-abc', 50, 0])
    })

    it('accepts custom limit and offset', async () => {
      const rows = [makeConsentRow()]
      mockQuery.mockResolvedValue({ rows, rowCount: 1 })

      await repo.listByTenant('tenant-abc', 10, 20)

      const params = mockQuery.mock.calls[0][1]
      expect(params).toEqual(['tenant-abc', 10, 20])
    })
  })

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------

  describe('update', () => {
    it('updates specified fields and returns the updated row', async () => {
      const updatedRow = makeConsentRow({
        status: 'inactive',
        consent_level: 'full',
      })
      mockQuery.mockResolvedValue({ rows: [updatedRow], rowCount: 1 })

      const result = await repo.update('consent-123', 'tenant-abc', {
        status: 'inactive',
        consentLevel: 'full',
      })

      expect(result).toEqual(updatedRow)
      const [sql, params] = mockQuery.mock.calls[0]
      expect(sql).toContain('UPDATE ehr_consent')
      expect(sql).toContain('SET')
      expect(sql).toContain('status = $1')
      expect(sql).toContain('consent_level = $2')
      expect(sql).toContain('updated_at = NOW()')
      expect(sql).toContain('WHERE consent_id = $3 AND tenant_id = $4')
      expect(params).toEqual(['inactive', 'full', 'consent-123', 'tenant-abc'])
    })

    it('updates only provided fields', async () => {
      const row = makeConsentRow()
      mockQuery.mockResolvedValue({ rows: [row], rowCount: 1 })

      await repo.update('consent-123', 'tenant-abc', {
        periodEnd: '2027-01-01',
      })

      const [sql, params] = mockQuery.mock.calls[0]
      expect(sql).toContain('period_end = $1')
      expect(sql).not.toContain('status')
      expect(sql).not.toContain('consent_level')
      expect(params).toEqual(['2027-01-01', 'consent-123', 'tenant-abc'])
    })

    it('falls back to getById when no fields are provided', async () => {
      const row = makeConsentRow()
      mockQuery.mockResolvedValue({ rows: [row], rowCount: 1 })

      const result = await repo.update('consent-123', 'tenant-abc', {})

      expect(result).toEqual(row)
      const [sql, params] = mockQuery.mock.calls[0]
      expect(sql).toContain('SELECT * FROM ehr_consent')
      expect(params).toEqual(['consent-123', 'tenant-abc'])
    })

    it('serializes fhirResource to JSON in params', async () => {
      const fhir = makeConsentResource()
      mockQuery.mockResolvedValue({ rows: [makeConsentRow()], rowCount: 1 })

      await repo.update('c1', 't1', { fhirResource: fhir })

      const params = mockQuery.mock.calls[0][1]
      expect(params[0]).toBe(JSON.stringify(fhir))
    })

    it('returns null when row not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 })

      const result = await repo.update('nonexistent', 'tenant-abc', {
        status: 'inactive',
      })

      expect(result).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // revoke
  // -------------------------------------------------------------------------

  describe('revoke', () => {
    it('marks consent as inactive within a transaction', async () => {
      const revokedRow = makeConsentRow({ status: 'inactive' })
      const clientQuery = vi
        .fn()
        .mockResolvedValue({ rows: [revokedRow], rowCount: 1 })
      mockTransaction.mockImplementation(
        async (
          cb: (client: { query: typeof clientQuery }) => Promise<unknown>,
        ) => {
          return cb({ query: clientQuery })
        },
      )

      const result = await repo.revoke('consent-123', 'tenant-abc')

      expect(result).toEqual(revokedRow)
      expect(mockTransaction).toHaveBeenCalledTimes(1)
      const [sql, params] = clientQuery.mock.calls[0]
      expect(sql).toContain("SET status = 'inactive'")
      expect(sql).toContain('updated_at = NOW()')
      expect(params).toEqual(['consent-123', 'tenant-abc'])
    })

    it('returns null when consent not found', async () => {
      const clientQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 })
      mockTransaction.mockImplementation(
        async (
          cb: (client: { query: typeof clientQuery }) => Promise<unknown>,
        ) => {
          return cb({ query: clientQuery })
        },
      )

      const result = await repo.revoke('nonexistent', 'tenant-abc')

      expect(result).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // delete
  // -------------------------------------------------------------------------

  describe('delete', () => {
    it('permanently deletes the consent record and returns true', async () => {
      const clientQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 })
      mockTransaction.mockImplementation(
        async (
          cb: (client: { query: typeof clientQuery }) => Promise<unknown>,
        ) => {
          return cb({ query: clientQuery })
        },
      )

      const result = await repo.delete('consent-123', 'tenant-abc')

      expect(result).toBe(true)
      expect(mockTransaction).toHaveBeenCalledTimes(1)
      const [sql, params] = clientQuery.mock.calls[0]
      expect(sql).toContain('DELETE FROM ehr_consent')
      expect(params).toEqual(['consent-123', 'tenant-abc'])
    })

    it('returns false when no row was deleted', async () => {
      const clientQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 })
      mockTransaction.mockImplementation(
        async (
          cb: (client: { query: typeof clientQuery }) => Promise<unknown>,
        ) => {
          return cb({ query: clientQuery })
        },
      )

      const result = await repo.delete('nonexistent', 'tenant-abc')

      expect(result).toBe(false)
    })

    it('returns false when rowCount is null', async () => {
      const clientQuery = vi
        .fn()
        .mockResolvedValue({ rows: [], rowCount: null })
      mockTransaction.mockImplementation(
        async (
          cb: (client: { query: typeof clientQuery }) => Promise<unknown>,
        ) => {
          return cb({ query: clientQuery })
        },
      )

      const result = await repo.delete('consent-123', 'tenant-abc')

      expect(result).toBe(false)
    })
  })
})
