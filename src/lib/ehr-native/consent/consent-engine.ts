import { randomUUID } from 'node:crypto'

import type { Pool } from 'pg'

import {
  AuditEventType,
  AuditEventStatus,
  createHIPAACompliantAuditLog,
} from '@/lib/audit'
import {
  getConsentExpiryService,
  type ExpiryCheckResult,
} from '@/lib/consent/ConsentExpiryService'

import type { ConsentResource, ProvenanceResource } from '../types/consent.js'
import type {
  ConsentCheckResult,
  ConsentEngineConfig,
  ConsentProvision,
  ConsentRecord,
  ConsentStatus,
  ConsentScope,
  DigitalSignature,
  TreatmentType,
} from './types.js'

const TREATMENT_TYPE_SYSTEM =
  'http://pixelated.example.com/fhir/consent/treatment-type'

const TREATMENT_TYPE_CODES: Record<TreatmentType, string> = {
  therapy: 'therapy',
  psychiatry: 'psychiatry',
  telehealth: 'telehealth',
  assessment: 'assessment',
  general: 'general',
}

const SCOPE_CODES: Record<ConsentScope, string> = {
  'patient-privacy': 'patient-privacy',
  treatment: 'treatment',
  research: 'research',
  'data-sharing': 'data-sharing',
}

const FHIR_STATUS_TO_CONSENT: Record<string, ConsentStatus> = {
  active: 'active',
  draft: 'draft',
  inactive: 'expired',
  'entered-in-error': 'withdrawn',
  'not-done': 'withdrawn',
  unknown: 'expired',
}

function mapFhirStatusToConsent(
  fhirStatus: string,
  withdrawnAt: string | null,
): ConsentStatus {
  if (withdrawnAt !== null) {
    return 'withdrawn'
  }
  return FHIR_STATUS_TO_CONSENT[fhirStatus] ?? 'expired'
}

function extractTreatmentType(
  resource: ConsentResource,
): TreatmentType {
  const categories = resource.category ?? []
  for (const cat of categories) {
    for (const coding of cat.coding ?? []) {
      if (coding.system === TREATMENT_TYPE_SYSTEM && coding.code) {
        const code = coding.code as TreatmentType
        if (code in TREATMENT_TYPE_CODES) {
          return code
        }
      }
    }
  }
  return 'general'
}

function extractScope(resource: ConsentResource): ConsentScope {
  const coding = resource.scope.coding?.[0]
  if (coding?.code && coding.code in SCOPE_CODES) {
    return coding.code as ConsentScope
  }
  return 'treatment'
}

function extractProvisions(
  resource: ConsentResource,
): ConsentProvision[] {
  const provision = resource.provision
  if (!provision) {
    return []
  }

  const result: ConsentProvision[] = []

  const collect = (prov: typeof provision): void => {
    if (prov.type) {
      result.push({
        type: prov.type,
        code: (prov.code ?? []).map((c) => c.coding?.[0]?.code ?? '').filter(Boolean),
        ...(prov.period ? { period: { start: prov.period.start ?? '', end: prov.period.end ?? '' } } : {}),
      })
    }
    for (const sub of prov.provision ?? []) {
      collect(sub)
    }
  }

  collect(provision)
  return result
}

function fhirToConsentRecord(
  resource: ConsentResource,
  row: { consent_id: string; patient_id: string | null; period_end: string | null },
): ConsentRecord {
  const withdrawnAt =
    (resource.provision?.type === 'deny' && resource.dateTime) || null

  return {
    id: row.consent_id,
    patientId: row.patient_id ?? extractPatientId(resource),
    treatmentType: extractTreatmentType(resource),
    scope: extractScope(resource),
    status: mapFhirStatusToConsent(resource.status, withdrawnAt),
    grantedAt: resource.dateTime ?? new Date().toISOString(),
    expiresAt: row.period_end,
    withdrawnAt,
    withdrawnReason: null,
    performerId: resource.performer?.[0]?.reference ?? '',
    organizationId: resource.organization?.[0]?.reference ?? null,
    provenanceId: resource.sourceReference?.reference?.split('/').pop() ?? null,
    policyRule: resource.policyRule?.coding?.[0]?.code ?? null,
    provisions: extractProvisions(resource),
  }
}

function extractPatientId(resource: ConsentResource): string {
  const ref = resource.patient.reference ?? ''
  const parts = ref.split('/')
  return parts[parts.length - 1] ?? ''
}

function buildConsentResource(
  consentId: string,
  patientId: string,
  treatmentType: TreatmentType,
  scope: ConsentScope,
  performerId: string,
  expiresAt: string | null,
  organizationId: string | null,
  policyRule: string | null,
  provenanceId: string | null,
): ConsentResource {
  const now = new Date().toISOString()
  const period = expiresAt
    ? { start: now, end: expiresAt }
    : { start: now }

  return {
    resourceType: 'Consent',
    id: consentId,
    status: 'active',
    scope: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: SCOPE_CODES[scope] }],
    },
    category: [
      {
        coding: [
          { system: TREATMENT_TYPE_SYSTEM, code: TREATMENT_TYPE_CODES[treatmentType] },
        ],
      },
    ],
    patient: { reference: `Patient/${patientId}` },
    dateTime: now,
    performer: [{ reference: performerId }],
    ...(organizationId ? { organization: [{ reference: organizationId }] } : {}),
    ...(policyRule
      ? { policyRule: { coding: [{ code: policyRule }] } }
      : {}),
    ...(provenanceId
      ? { sourceReference: { reference: `Provenance/${provenanceId}` } }
      : {}),
    provision: {
      type: 'permit',
      period,
    },
  } as ConsentResource
}

function buildProvenanceResource(
  provenanceId: string,
  consentId: string,
  signature: DigitalSignature,
): ProvenanceResource {
  return {
    resourceType: 'Provenance',
    id: provenanceId,
    target: [{ reference: `Consent/${consentId}` }],
    recorded: new Date().toISOString(),
    agent: [
      {
        who: { reference: signature.who },
      },
    ],
    signature: [
      {
        type: [
          {
            system: 'urn:iso-astm:E1762-95:2013',
            code: '1.2.840.10065.1.12.1.1',
            display: 'Author\'s Signature',
          },
        ],
        when: new Date().toISOString(),
        who: { reference: signature.who },
        sigFormat: signature.format,
        data: signature.data,
      },
    ],
  } as ProvenanceResource
}

function isExpired(expiresAt: string | null): boolean {
  if (expiresAt === null) {
    return false
  }
  return new Date(expiresAt).getTime() < Date.now()
}

function hasDenyProvision(
  provisions: ConsentProvision[],
  treatmentType: TreatmentType,
): boolean {
  const code = TREATMENT_TYPE_CODES[treatmentType]
  return provisions.some(
    (p) => p.type === 'deny' && (p.code.length === 0 || p.code.includes(code)),
  )
}

export class ConsentEngine {
  private readonly pool: Pool
  private readonly config: ConsentEngineConfig

  constructor(pool: Pool, config?: Partial<ConsentEngineConfig>) {
    this.pool = pool
    this.config = {
      defaultExpiryDays: 365,
      warningDays: 30,
      criticalDays: 7,
      ...config,
    }
  }

  async recordConsent(
    patientId: string,
    treatmentType: TreatmentType,
    scope: ConsentScope,
    performerId: string,
    expiresAt?: string | null,
    signature?: DigitalSignature,
  ): Promise<ConsentRecord> {
    const consentId = randomUUID()
    const effectiveExpiry =
      expiresAt !== undefined
        ? expiresAt
        : this.config.defaultExpiryDays > 0
          ? new Date(
              Date.now() + this.config.defaultExpiryDays * 24 * 60 * 60 * 1000,
            ).toISOString()
          : null

    const provenanceId = signature ? randomUUID() : null

    const consentResource = buildConsentResource(
      consentId,
      patientId,
      treatmentType,
      scope,
      performerId,
      effectiveExpiry,
      null,
      null,
      provenanceId,
    )

    const provenanceResource = signature
      ? buildProvenanceResource(provenanceId!, consentId, signature)
      : null

    await this.pool.query(
      `INSERT INTO ehr_consent (consent_id, tenant_id, fhir_resource, patient_id, status, scope, category, consent_level, period_start, period_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        consentId,
        'system',
        JSON.stringify(consentResource),
        patientId,
        'active',
        SCOPE_CODES[scope],
        TREATMENT_TYPE_CODES[treatmentType],
        'minimal',
        consentResource.provision?.period?.start ?? null,
        effectiveExpiry,
      ],
    )

    if (provenanceResource) {
      await this.pool.query(
        `INSERT INTO ehr_resource (resource_id, tenant_id, resource_type, fhir_resource, active)
         VALUES ($1, $2, $3, $4, true)`,
        [
          provenanceId,
          'system',
          'Provenance',
          JSON.stringify(provenanceResource),
        ],
      )
    }

    await createHIPAACompliantAuditLog({
      userId: performerId,
      action: 'consent_recorded',
      resource: 'Consent',
      eventType: AuditEventType.CONSENT,
      status: AuditEventStatus.SUCCESS,
      resourceId: consentId,
      patientId,
      details: {
        treatmentType,
        scope,
        expiresAt: effectiveExpiry,
        provenanceId,
      },
    })

    return {
      id: consentId,
      patientId,
      treatmentType,
      scope,
      status: 'active',
      grantedAt: consentResource.dateTime ?? new Date().toISOString(),
      expiresAt: effectiveExpiry,
      withdrawnAt: null,
      withdrawnReason: null,
      performerId,
      organizationId: null,
      provenanceId,
      policyRule: null,
      provisions: extractProvisions(consentResource),
    }
  }

  async checkConsent(
    patientId: string,
    treatmentType: TreatmentType,
  ): Promise<ConsentCheckResult> {
    const checkedAt = new Date().toISOString()
    const code = TREATMENT_TYPE_CODES[treatmentType]

    const result = await this.pool.query<{
      consent_id: string
      fhir_resource: ConsentResource
      period_end: string | null
    }>(
      `SELECT consent_id, fhir_resource, period_end
       FROM ehr_consent
       WHERE patient_id = $1 AND category = $2 AND active = true
       ORDER BY created_at DESC
       LIMIT 1`,
      [patientId, code],
    )

    if (result.rows.length === 0) {
      return {
        hasConsent: false,
        consentId: null,
        status: null,
        reason: 'No consent record found for this treatment type',
        treatmentType,
        patientId,
        checkedAt,
      }
    }

    const row = result.rows[0]
    const resource = row.fhir_resource
    const withdrawnAt =
      resource.provision?.type === 'deny' ? resource.dateTime ?? null : null
    const status = mapFhirStatusToConsent(resource.status, withdrawnAt)
    const provisions = extractProvisions(resource)

    if (status === 'withdrawn') {
      return {
        hasConsent: false,
        consentId: row.consent_id,
        status,
        reason: 'Consent has been withdrawn',
        treatmentType,
        patientId,
        checkedAt,
      }
    }

    if (isExpired(row.period_end)) {
      return {
        hasConsent: false,
        consentId: row.consent_id,
        status: 'expired',
        reason: 'Consent has expired',
        treatmentType,
        patientId,
        checkedAt,
      }
    }

    if (hasDenyProvision(provisions, treatmentType)) {
      return {
        hasConsent: false,
        consentId: row.consent_id,
        status,
        reason: 'Consent provision denies this treatment type',
        treatmentType,
        patientId,
        checkedAt,
      }
    }

    return {
      hasConsent: true,
      consentId: row.consent_id,
      status,
      reason: 'Active consent found',
      treatmentType,
      patientId,
      checkedAt,
    }
  }

  async withdrawConsent(
    consentId: string,
    reason: string,
    withdrawnBy: string,
  ): Promise<ConsentRecord | null> {
    const existing = await this.getConsentRecord(consentId)
    if (!existing) {
      return null
    }

    const now = new Date().toISOString()
    const result = await this.pool.query<{
      fhir_resource: ConsentResource
    }>(
      `SELECT fhir_resource FROM ehr_consent WHERE consent_id = $1`,
      [consentId],
    )

    if (result.rows.length === 0) {
      return null
    }

    const resource = result.rows[0].fhir_resource
    const updatedResource: ConsentResource = {
      ...resource,
      status: 'inactive',
      provision: {
        type: 'deny',
        period: resource.provision?.period ?? { start: resource.dateTime ?? now },
      },
    }

    await this.pool.query(
      `UPDATE ehr_consent
       SET fhir_resource = $2, status = $3, updated_at = now()
       WHERE consent_id = $1`,
      [consentId, JSON.stringify(updatedResource), 'inactive'],
    )

    await createHIPAACompliantAuditLog({
      userId: withdrawnBy,
      action: 'consent_withdrawn',
      resource: 'Consent',
      eventType: AuditEventType.CONSENT,
      status: AuditEventStatus.SUCCESS,
      resourceId: consentId,
      patientId: existing.patientId,
      details: { reason },
    })

    return {
      ...existing,
      status: 'withdrawn',
      withdrawnAt: now,
      withdrawnReason: reason,
    }
  }

  async getConsentRecord(consentId: string): Promise<ConsentRecord | null> {
    const result = await this.pool.query<{
      consent_id: string
      fhir_resource: ConsentResource
      patient_id: string | null
      period_end: string | null
    }>(
      `SELECT consent_id, fhir_resource, patient_id, period_end
       FROM ehr_consent
       WHERE consent_id = $1`,
      [consentId],
    )

    if (result.rows.length === 0) {
      return null
    }

    const row = result.rows[0]
    return fhirToConsentRecord(row.fhir_resource, row)
  }

  async getPatientConsents(patientId: string): Promise<ConsentRecord[]> {
    const result = await this.pool.query<{
      consent_id: string
      fhir_resource: ConsentResource
      patient_id: string | null
      period_end: string | null
    }>(
      `SELECT consent_id, fhir_resource, patient_id, period_end
       FROM ehr_consent
       WHERE patient_id = $1 AND active = true
       ORDER BY created_at DESC`,
      [patientId],
    )

    return result.rows.map((row) =>
      fhirToConsentRecord(row.fhir_resource, row),
    )
  }

  async getExpiringConsents(
    days: number = this.config.warningDays,
  ): Promise<unknown[]> {
    const service = getConsentExpiryService()
    return service.getExpiringConsents(days)
  }

  async checkExpiries(): Promise<ExpiryCheckResult> {
    const service = getConsentExpiryService()
    return service.checkExpiries()
  }

  async verifyConsentChain(consentId: string): Promise<boolean> {
    const record = await this.getConsentRecord(consentId)
    if (!record) {
      return false
    }

    if (record.provenanceId === null) {
      return true
    }

    const result = await this.pool.query<{
      fhir_resource: ProvenanceResource | null
    }>(
      `SELECT fhir_resource FROM ehr_resource WHERE resource_id = $1 AND resource_type = 'Provenance'`,
      [record.provenanceId],
    )

    if (result.rows.length === 0) {
      return false
    }

    const provenance = result.rows[0].fhir_resource
    if (!provenance) {
      return false
    }

    const targetRef = provenance.target?.[0]?.reference ?? ''
    return targetRef === `Consent/${consentId}` && provenance.signature !== undefined && provenance.signature.length > 0
  }
}

let engineInstance: ConsentEngine | null = null

export function getConsentEngine(
  pool: Pool,
  config?: Partial<ConsentEngineConfig>,
): ConsentEngine {
  engineInstance ??= new ConsentEngine(pool, config)
  return engineInstance
}

export function resetConsentEngine(): void {
  engineInstance = null
}
