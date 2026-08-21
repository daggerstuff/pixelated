// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid-001'),
}))

vi.mock('@/lib/audit', () => ({
  AuditEventType: {
    CONSENT: 'consent',
    CREATE: 'create',
    MODIFY: 'modify',
    DELETE: 'delete',
    ACCESS: 'access',
  },
  AuditEventStatus: {
    SUCCESS: 'success',
    FAILURE: 'failure',
    ATTEMPT: 'attempt',
    BLOCKED: 'blocked',
    WARNING: 'warning',
  },
  createHIPAACompliantAuditLog: vi.fn().mockResolvedValue({ id: 'audit-001' }),
}))

vi.mock('@/lib/consent/ConsentExpiryService', () => ({
  getConsentExpiryService: vi.fn(() => ({
    getExpiringConsents: vi.fn().mockResolvedValue([
      { clientId: 'patient-001', expirationDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString() },
    ]),
    checkExpiries: vi.fn().mockResolvedValue({
      checkedAt: new Date().toISOString(),
      totalChecked: 1,
      reminders: [],
      summary: { expiringSoon: 0, expiringCritical: 0, expired: 0 },
    }),
  })),
}))

import { createHIPAACompliantAuditLog } from '@/lib/audit'
import { getConsentExpiryService } from '@/lib/consent/ConsentExpiryService'

import { ConsentEngine } from '../consent-engine.js'
import type { ConsentResource } from '../../types/consent.js'

function makeMockPool() {
  const queryMock = vi.fn()
  const pool = { query: queryMock } as unknown as { query: typeof queryMock }
  return { pool, queryMock }
}

function makeActiveConsentResource(
  consentId: string,
  patientId: string,
  treatmentType: string,
  expiresAt: string | null = null,
): ConsentResource {
  const now = new Date().toISOString()
  return {
    resourceType: 'Consent',
    id: consentId,
    status: 'active',
    scope: {
      coding: [
        { system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'treatment' },
      ],
    },
    category: [
      {
        coding: [
          { system: 'http://pixelated.example.com/fhir/consent/treatment-type', code: treatmentType },
        ],
      },
    ],
    patient: { reference: `Patient/${patientId}` },
    dateTime: now,
    performer: [{ reference: 'Practitioner/performer-001' }],
    provision: {
      type: 'permit',
      period: expiresAt ? { start: now, end: expiresAt } : { start: now },
    },
  } as ConsentResource
}

function makeWithdrawnConsentResource(
  consentId: string,
  patientId: string,
  treatmentType: string,
): ConsentResource {
  const now = new Date().toISOString()
  return {
    resourceType: 'Consent',
    id: consentId,
    status: 'inactive',
    scope: {
      coding: [
        { system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'treatment' },
      ],
    },
    category: [
      {
        coding: [
          { system: 'http://pixelated.example.com/fhir/consent/treatment-type', code: treatmentType },
        ],
      },
    ],
    patient: { reference: `Patient/${patientId}` },
    dateTime: now,
    performer: [{ reference: 'Practitioner/performer-001' }],
    provision: {
      type: 'deny',
      period: { start: now },
    },
  } as ConsentResource
}

function makeDeniedConsentResource(
  consentId: string,
  patientId: string,
  treatmentType: string,
): ConsentResource {
  const now = new Date().toISOString()
  return {
    resourceType: 'Consent',
    id: consentId,
    status: 'active',
    scope: {
      coding: [
        { system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'treatment' },
      ],
    },
    category: [
      {
        coding: [
          { system: 'http://pixelated.example.com/fhir/consent/treatment-type', code: treatmentType },
        ],
      },
    ],
    patient: { reference: `Patient/${patientId}` },
    dateTime: now,
    performer: [{ reference: 'Practitioner/performer-001' }],
    provision: {
      type: 'permit',
      provision: [
        {
          type: 'deny',
          code: [{ coding: [{ code: treatmentType }] }],
        },
      ],
    },
  } as ConsentResource
}

describe('ConsentEngine', () => {
  let engine: ConsentEngine
  let queryMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    const { pool, queryMock: qm } = makeMockPool()
    queryMock = qm
    engine = new ConsentEngine(pool as never, {
      defaultExpiryDays: 365,
      warningDays: 30,
      criticalDays: 7,
    })
  })

  describe('recordConsent', () => {
    it('creates a consent record with correct fields', async () => {
      queryMock.mockResolvedValue({ rows: [] })

      const record = await engine.recordConsent(
        'patient-001',
        'therapy',
        'treatment',
        'Practitioner/performer-001',
      )

      expect(record.patientId).toBe('patient-001')
      expect(record.treatmentType).toBe('therapy')
      expect(record.scope).toBe('treatment')
      expect(record.status).toBe('active')
      expect(record.performerId).toBe('Practitioner/performer-001')
      expect(record.provenanceId).toBeNull()
      expect(record.expiresAt).not.toBeNull()
      expect(queryMock).toHaveBeenCalledTimes(1)
      expect(createHIPAACompliantAuditLog).toHaveBeenCalledTimes(1)
    })

    it('creates a Provenance resource when signature is provided', async () => {
      queryMock.mockResolvedValue({ rows: [] })

      const record = await engine.recordConsent(
        'patient-001',
        'psychiatry',
        'treatment',
        'Practitioner/performer-001',
        null,
        { who: 'Practitioner/signer-001', data: 'base64sig', format: 'application/signature' },
      )

      expect(record.provenanceId).toBe('test-uuid-001')
      expect(queryMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('checkConsent', () => {
    it('returns positive result when active consent exists', async () => {
      const resource = makeActiveConsentResource('consent-001', 'patient-001', 'therapy')
      queryMock.mockResolvedValue({
        rows: [{ consent_id: 'consent-001', fhir_resource: resource, period_end: null }],
      })

      const result = await engine.checkConsent('patient-001', 'therapy')

      expect(result.hasConsent).toBe(true)
      expect(result.consentId).toBe('consent-001')
      expect(result.status).toBe('active')
      expect(result.reason).toBe('Active consent found')
    })

    it('returns negative result when no consent exists', async () => {
      queryMock.mockResolvedValue({ rows: [] })

      const result = await engine.checkConsent('patient-001', 'therapy')

      expect(result.hasConsent).toBe(false)
      expect(result.consentId).toBeNull()
      expect(result.reason).toContain('No consent record found')
    })

    it('returns negative when consent is expired', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const resource = makeActiveConsentResource('consent-001', 'patient-001', 'therapy', pastDate)
      queryMock.mockResolvedValue({
        rows: [{ consent_id: 'consent-001', fhir_resource: resource, period_end: pastDate }],
      })

      const result = await engine.checkConsent('patient-001', 'therapy')

      expect(result.hasConsent).toBe(false)
      expect(result.status).toBe('expired')
      expect(result.reason).toContain('expired')
    })

    it('returns negative when consent is withdrawn', async () => {
      const resource = makeWithdrawnConsentResource('consent-001', 'patient-001', 'therapy')
      queryMock.mockResolvedValue({
        rows: [{ consent_id: 'consent-001', fhir_resource: resource, period_end: null }],
      })

      const result = await engine.checkConsent('patient-001', 'therapy')

      expect(result.hasConsent).toBe(false)
      expect(result.status).toBe('withdrawn')
      expect(result.reason).toContain('withdrawn')
    })

    it('respects provision type deny', async () => {
      const resource = makeDeniedConsentResource('consent-001', 'patient-001', 'therapy')
      queryMock.mockResolvedValue({
        rows: [{ consent_id: 'consent-001', fhir_resource: resource, period_end: null }],
      })

      const result = await engine.checkConsent('patient-001', 'therapy')

      expect(result.hasConsent).toBe(false)
      expect(result.reason).toContain('denies')
    })
  })

  describe('withdrawConsent', () => {
    it('updates status, records reason, emits audit', async () => {
      const resource = makeActiveConsentResource('consent-001', 'patient-001', 'therapy')
      queryMock
        .mockResolvedValueOnce({
          rows: [{ consent_id: 'consent-001', fhir_resource: resource, patient_id: 'patient-001', period_end: null }],
        })
        .mockResolvedValueOnce({
          rows: [{ fhir_resource: resource }],
        })
        .mockResolvedValue({ rows: [] })

      const result = await engine.withdrawConsent('consent-001', 'Patient withdrew', 'Practitioner/withdrawer-001')

      expect(result).not.toBeNull()
      expect(result!.status).toBe('withdrawn')
      expect(result!.withdrawnReason).toBe('Patient withdrew')
      expect(result!.withdrawnAt).not.toBeNull()
      expect(createHIPAACompliantAuditLog).toHaveBeenCalledTimes(1)
    })

    it('returns null when consent does not exist', async () => {
      queryMock.mockResolvedValue({ rows: [] })

      const result = await engine.withdrawConsent('nonexistent', 'reason', 'user-001')

      expect(result).toBeNull()
    })
  })

  describe('getConsentRecord', () => {
    it('returns record by ID', async () => {
      const resource = makeActiveConsentResource('consent-001', 'patient-001', 'therapy')
      queryMock.mockResolvedValue({
        rows: [{ consent_id: 'consent-001', fhir_resource: resource, patient_id: 'patient-001', period_end: null }],
      })

      const record = await engine.getConsentRecord('consent-001')

      expect(record).not.toBeNull()
      expect(record!.id).toBe('consent-001')
      expect(record!.patientId).toBe('patient-001')
      expect(record!.treatmentType).toBe('therapy')
    })

    it('returns null when not found', async () => {
      queryMock.mockResolvedValue({ rows: [] })

      const record = await engine.getConsentRecord('nonexistent')

      expect(record).toBeNull()
    })
  })

  describe('getPatientConsents', () => {
    it('returns all records for a patient', async () => {
      const r1 = makeActiveConsentResource('consent-001', 'patient-001', 'therapy')
      const r2 = makeActiveConsentResource('consent-002', 'patient-001', 'psychiatry')
      queryMock.mockResolvedValue({
        rows: [
          { consent_id: 'consent-001', fhir_resource: r1, patient_id: 'patient-001', period_end: null },
          { consent_id: 'consent-002', fhir_resource: r2, patient_id: 'patient-001', period_end: null },
        ],
      })

      const records = await engine.getPatientConsents('patient-001')

      expect(records).toHaveLength(2)
      expect(records[0].id).toBe('consent-001')
      expect(records[1].id).toBe('consent-002')
    })
  })

  describe('getExpiringConsents', () => {
    it('delegates to ConsentExpiryService', async () => {
      const result = await engine.getExpiringConsents(30)

      expect(getConsentExpiryService).toHaveBeenCalled()
      expect(result).toHaveLength(1)
    })
  })

  describe('checkExpiries', () => {
    it('delegates to ConsentExpiryService', async () => {
      const result = await engine.checkExpiries()

      expect(getConsentExpiryService).toHaveBeenCalled()
      expect(result.totalChecked).toBe(1)
    })
  })

  describe('verifyConsentChain', () => {
    it('verifies integrity when provenance exists and matches', async () => {
      const resource = makeActiveConsentResource('consent-001', 'patient-001', 'therapy')
      resource.sourceReference = { reference: 'Provenance/test-uuid-001' }
      queryMock
        .mockResolvedValueOnce({
          rows: [{ consent_id: 'consent-001', fhir_resource: resource, patient_id: 'patient-001', period_end: null }],
        })
        .mockResolvedValueOnce({
          rows: [{
            fhir_resource: {
              resourceType: 'Provenance',
              target: [{ reference: 'Consent/consent-001' }],
              recorded: new Date().toISOString(),
              agent: [{ who: { reference: 'Practitioner/001' } }],
              signature: [{ type: [{ code: 'sig' }], when: new Date().toISOString(), who: { reference: 'Practitioner/001' } }],
            },
          }],
        })

      const valid = await engine.verifyConsentChain('consent-001')
      expect(valid).toBe(true)
    })

    it('returns true when no provenance exists', async () => {
      const resource = makeActiveConsentResource('consent-001', 'patient-001', 'therapy')
      queryMock.mockResolvedValue({
        rows: [{ consent_id: 'consent-001', fhir_resource: resource, patient_id: 'patient-001', period_end: null }],
      })

      const valid = await engine.verifyConsentChain('consent-001')
      expect(valid).toBe(true)
    })

    it('returns false when consent does not exist', async () => {
      queryMock.mockResolvedValue({ rows: [] })

      const valid = await engine.verifyConsentChain('nonexistent')
      expect(valid).toBe(false)
    })
  })

  describe('Expiry', () => {
    it('consent with past expiresAt is treated as expired', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const resource = makeActiveConsentResource('consent-001', 'patient-001', 'therapy', pastDate)
      queryMock.mockResolvedValue({
        rows: [{ consent_id: 'consent-001', fhir_resource: resource, period_end: pastDate }],
      })

      const result = await engine.checkConsent('patient-001', 'therapy')

      expect(result.hasConsent).toBe(false)
      expect(result.status).toBe('expired')
    })
  })
})
